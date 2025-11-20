/**
 * Progressive Rollout System
 * 
 * Manages controlled deployment of migration features to users
 * Ensures safe rollout with monitoring and rollback capabilities
 */

import { LocalDataMigrator } from './local-data-migrator';
import { EnhancedIndexedDBAdapter } from '@/lib/storage/enhanced-indexeddb-adapter';
import { APIClientAdapter } from '@/lib/storage/api-client-adapter';
import { getEffectiveUserId, getDeviceId } from '@/lib/user-identity';
import { loggers } from '@/lib/logger';

export interface RolloutConfig {
  enabled: boolean;
  rolloutPercentage: number;
  maxConcurrentMigrations: number;
  migrationCooldownHours: number;
  autoRollbackOnFailure: boolean;
  requiredUserRole?: string;
  minimumAppVersion?: string;
  excludedUserIds?: string[];
  includedUserIds?: string[];
}

export interface MigrationQueueItem {
  userId: string;
  deviceId: string;
  priority: number;
  requestedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  attempts: number;
  lastAttempt?: Date;
  result?: any;
  error?: string;
}

export interface RolloutMetrics {
  totalEligibleUsers: number;
  totalMigrationsRequested: number;
  totalMigrationsCompleted: number;
  totalMigrationsFailed: number;
  totalMigrationsSkipped: number;
  successRate: number;
  averageMigrationTime: number;
  activeMigrations: number;
  queueSize: number;
}

export class ProgressiveRollout {
  private config: RolloutConfig;
  private migrationQueue: MigrationQueueItem[];
  private activeMigrations: Map<string, Promise<any>>;
  private localStorage: EnhancedIndexedDBAdapter;
  private remoteStorage: APIClientAdapter;
  private processingInterval: NodeJS.Timeout | null;
  private metrics: RolloutMetrics;

  constructor(
    localStorage: EnhancedIndexedDBAdapter,
    remoteStorage: APIClientAdapter,
    config: RolloutConfig
  ) {
    this.localStorage = localStorage;
    this.remoteStorage = remoteStorage;
    this.config = config;
    this.migrationQueue = [];
    this.activeMigrations = new Map();
    this.processingInterval = null;
    
    this.metrics = {
      totalEligibleUsers: 0,
      totalMigrationsRequested: 0,
      totalMigrationsCompleted: 0,
      totalMigrationsFailed: 0,
      totalMigrationsSkipped: 0,
      successRate: 0,
      averageMigrationTime: 0,
      activeMigrations: 0,
      queueSize: 0
    };
  }

  /**
   * Initialize the rollout system
   */
  async initialize(): Promise<void> {
    loggers.storage.info('Initializing Progressive Rollout System', { config: this.config });

    await this.loadMigrationQueue();
    this.startQueueProcessor();
    
    loggers.storage.info('Progressive Rollout System initialized');
  }

  /**
   * Check if user is eligible for migration
   */
  async isUserEligible(userId?: string): Promise<boolean> {
    const targetUserId = userId || getEffectiveUserId();
    
    // Check if rollout is enabled
    if (!this.config.enabled) {
      loggers.storage.debug('Rollout disabled', { userId: targetUserId });
      return false;
    }

    // Check excluded users
    if (this.config.excludedUserIds?.includes(targetUserId)) {
      loggers.storage.debug('User in excluded list', { userId: targetUserId });
      return false;
    }

    // Check included users (if specified, only these users are eligible)
    if (this.config.includedUserIds && !this.config.includedUserIds.includes(targetUserId)) {
      loggers.storage.debug('User not in included list', { userId: targetUserId });
      return false;
    }

    // Check if user already has migration in queue or completed
    const existingMigration = this.migrationQueue.find(item => 
      item.userId === targetUserId && ['pending', 'processing', 'completed'].includes(item.status)
    );

    if (existingMigration) {
      loggers.storage.debug('User already has migration in progress or completed', { 
        userId: targetUserId, 
        status: existingMigration.status 
      });
      return false;
    }

    // Check if migration was recently attempted
    const recentMigration = await this.getRecentMigration(targetUserId);
    if (recentMigration && this.isWithinCooldownPeriod(recentMigration)) {
      loggers.storage.debug('User within cooldown period', { 
        userId: targetUserId, 
        lastAttempt: recentMigration.lastAttempt 
      });
      return false;
    }

    // Check percentage-based rollout
    if (!this.isInRolloutPercentage(targetUserId)) {
      loggers.storage.debug('User not in rollout percentage', { 
        userId: targetUserId,
        rolloutPercentage: this.config.rolloutPercentage 
      });
      return false;
    }

    // Check if user already migrated using LocalDataMigrator
    const alreadyMigrated = await LocalDataMigrator.isMigrationComplete();
    if (alreadyMigrated) {
      loggers.storage.debug('User already migrated', { userId: targetUserId });
      return false;
    }

    loggers.storage.info('User eligible for migration', { userId: targetUserId });
    return true;
  }

  /**
   * Request migration for current user
   */
  async requestMigration(priority: number = 5): Promise<boolean> {
    const userId = getEffectiveUserId();
    const deviceId = getDeviceId();

    if (!await this.isUserEligible(userId)) {
      loggers.storage.info('Migration request denied - user not eligible', { userId });
      return false;
    }

    const queueItem: MigrationQueueItem = {
      userId,
      deviceId,
      priority: Math.max(1, Math.min(10, priority)),
      requestedAt: new Date(),
      status: 'pending',
      attempts: 0
    };

    this.migrationQueue.push(queueItem);
    this.migrationQueue.sort((a, b) => b.priority - a.priority);
    
    await this.saveMigrationQueue();
    
    this.metrics.totalMigrationsRequested++;
    this.metrics.queueSize = this.migrationQueue.length;
    
    loggers.storage.info('Migration request added to queue', { 
      userId, 
      deviceId, 
      priority,
      queuePosition: this.migrationQueue.indexOf(queueItem) + 1
    });

    return true;
  }

  /**
   * Process migration queue
   */
  private async processQueue(): Promise<void> {
    if (this.activeMigrations.size >= this.config.maxConcurrentMigrations) {
      loggers.storage.debug('Max concurrent migrations reached', { 
        active: this.activeMigrations.size,
        max: this.config.maxConcurrentMigrations 
      });
      return;
    }

    const pendingItems = this.migrationQueue.filter(item => item.status === 'pending');
    if (pendingItems.length === 0) {
      return;
    }

    // Process highest priority item
    const nextItem = pendingItems[0];
    nextItem.status = 'processing';
    nextItem.lastAttempt = new Date();
    nextItem.attempts++;

    await this.saveMigrationQueue();

    const migrationPromise = this.executeMigration(nextItem);
    this.activeMigrations.set(nextItem.userId, migrationPromise);

    try {
      const result = await migrationPromise;
      nextItem.status = 'completed';
      nextItem.result = result;
      
      this.metrics.totalMigrationsCompleted++;
      this.metrics.averageMigrationTime = this.calculateAverageMigrationTime();
      
      loggers.storage.info('Migration completed successfully', { 
        userId: nextItem.userId,
        attempts: nextItem.attempts,
        duration: result?.duration || 0
      });

    } catch (error) {
      nextItem.status = 'failed';
      nextItem.error = error instanceof Error ? error.message : 'Unknown error';
      
      this.metrics.totalMigrationsFailed++;
      
      loggers.storage.error('Migration failed', { 
        userId: nextItem.userId,
        attempts: nextItem.attempts,
        error: nextItem.error
      });

      // Auto-retry if configured and attempts remaining
      if (nextItem.attempts < 3 && this.config.autoRollbackOnFailure) {
        nextItem.status = 'pending';
        nextItem.priority = Math.min(10, nextItem.priority + 2); // Increase priority for retry
        loggers.storage.info('Scheduling retry for failed migration', { 
          userId: nextItem.userId,
          nextAttempt: nextItem.attempts + 1
        });
      }
    } finally {
      this.activeMigrations.delete(nextItem.userId);
      await this.saveMigrationQueue();
      this.updateMetrics();
    }
  }

  /**
   * Execute actual migration for a user
   */
  private async executeMigration(queueItem: MigrationQueueItem): Promise<any> {
    loggers.storage.info('Starting migration execution', { 
      userId: queueItem.userId,
      attempt: queueItem.attempts 
    });

    const migrator = new LocalDataMigrator(this.localStorage, this.remoteStorage, {
      backupLocalData: true,
      encryptionEnabled: true,
      dryRun: false,
      maxRetries: 2,
      retryDelay: 2000
    });

    return await migrator.migrateUserData();
  }

  /**
   * Start queue processor interval
   */
  private startQueueProcessor(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.processingInterval = setInterval(async () => {
      try {
        await this.processQueue();
      } catch (error) {
        loggers.storage.error('Error processing migration queue', { error });
      }
    }, 5000); // Process every 5 seconds

    loggers.storage.info('Queue processor started');
  }

  /**
   * Stop queue processor
   */
  stopQueueProcessor(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      loggers.storage.info('Queue processor stopped');
    }
  }

  /**
   * Get rollout metrics
   */
  getMetrics(): RolloutMetrics {
    return {
      ...this.metrics,
      successRate: this.metrics.totalMigrationsCompleted > 0 
        ? (this.metrics.totalMigrationsCompleted / (this.metrics.totalMigrationsCompleted + this.metrics.totalMigrationsFailed)) * 100
        : 0,
      queueSize: this.migrationQueue.length,
      activeMigrations: this.activeMigrations.size
    };
  }

  /**
   * Get migration queue status
   */
  getQueueStatus(): Array<Pick<MigrationQueueItem, 'userId' | 'status' | 'priority' | 'attempts' | 'requestedAt'>> {
    return this.migrationQueue.map(item => ({
      userId: item.userId,
      status: item.status,
      priority: item.priority,
      attempts: item.attempts,
      requestedAt: item.requestedAt
    }));
  }

  /**
   * Update rollout configuration
   */
  updateConfig(newConfig: Partial<RolloutConfig>): void {
    this.config = { ...this.config, ...newConfig };
    loggers.storage.info('Rollout configuration updated', { config: this.config });
  }

  /**
   * Check if user is in rollout percentage
   */
  private isInRolloutPercentage(userId: string): boolean {
    // Simple hash-based percentage selection
    const hash = this.hashUserId(userId);
    const percentage = (hash % 100) / 100;
    return percentage < (this.config.rolloutPercentage / 100);
  }

  /**
   * Hash user ID for percentage calculation
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Check if migration is within cooldown period
   */
  private isWithinCooldownPeriod(migration: MigrationQueueItem): boolean {
    if (!migration.lastAttempt) return false;
    
    const cooldownMs = this.config.migrationCooldownHours * 60 * 60 * 1000;
    const timeSinceLastAttempt = Date.now() - migration.lastAttempt.getTime();
    
    return timeSinceLastAttempt < cooldownMs;
  }

  /**
   * Get recent migration for user
   */
  private async getRecentMigration(userId: string): Promise<MigrationQueueItem | null> {
    const recentMigrations = this.migrationQueue
      .filter(item => item.userId === userId && item.lastAttempt)
      .sort((a, b) => b.lastAttempt!.getTime() - a.lastAttempt!.getTime());

    return recentMigrations.length > 0 ? recentMigrations[0] : null;
  }

  /**
   * Load migration queue from storage
   */
  private async loadMigrationQueue(): Promise<void> {
    try {
      const storedQueue = await this.localStorage.find('migration_queue', {});
      this.migrationQueue = storedQueue.map((item: any) => ({
        ...item,
        requestedAt: new Date(item.requestedAt),
        lastAttempt: item.lastAttempt ? new Date(item.lastAttempt) : undefined
      }));
      
      loggers.storage.info('Migration queue loaded', { count: this.migrationQueue.length });
    } catch (error) {
      loggers.storage.warn('Failed to load migration queue', { error });
      this.migrationQueue = [];
    }
  }

  /**
   * Save migration queue to storage
   */
  private async saveMigrationQueue(): Promise<void> {
    try {
      // Clear existing queue
      await this.localStorage.delete('migration_queue', {});
      
      // Save current queue
      for (const item of this.migrationQueue) {
        await this.localStorage.create('migration_queue', item);
      }
      
      loggers.storage.debug('Migration queue saved', { count: this.migrationQueue.length });
    } catch (error) {
      loggers.storage.error('Failed to save migration queue', { error });
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    this.metrics.queueSize = this.migrationQueue.length;
    this.metrics.activeMigrations = this.activeMigrations.size;
  }

  /**
   * Calculate average migration time
   */
  private calculateAverageMigrationTime(): number {
    const completedMigrations = this.migrationQueue.filter(item => 
      item.status === 'completed' && item.result?.duration
    );

    if (completedMigrations.length === 0) return 0;

    const totalTime = completedMigrations.reduce((sum, item) => 
      sum + (item.result?.duration || 0), 0
    );

    return totalTime / completedMigrations.length;
  }

  /**
   * Cleanup completed and old migration records
   */
  async cleanup(): Promise<void> {
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    
    this.migrationQueue = this.migrationQueue.filter(item => {
      // Keep recent items and failed items for retry
      if (item.status === 'failed' && item.attempts < 3) return true;
      if (item.requestedAt > cutoffDate) return true;
      
      // Keep last 10 completed items for metrics
      const completedItems = this.migrationQueue
        .filter(i => i.status === 'completed')
        .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
      
      return completedItems.indexOf(item) < 10;
    });

    await this.saveMigrationQueue();
    loggers.storage.info('Migration queue cleaned up', { remainingItems: this.migrationQueue.length });
  }
}

export default ProgressiveRollout;