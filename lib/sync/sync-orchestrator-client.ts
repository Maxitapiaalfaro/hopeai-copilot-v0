import { ConflictDetector } from './conflict-detector';
import { databaseService } from '@/lib/database';
import { ChangeLog, SyncConflict } from '@/lib/database/models';
import { v4 as uuidv4 } from 'uuid';
import { EnhancedIndexedDBAdapter } from '@/lib/storage/enhanced-indexeddb-adapter';
import type { PendingOperation } from '@/lib/storage/unified-storage-interface';

export interface SyncConfig {
  userId: string;
  deviceId: string;
  syncInterval?: number; // milliseconds
  batchSize?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface SyncOperation {
  id: string;
  type: 'push' | 'pull' | 'resolve';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  entityType: string;
  entityId: string;
  changes?: any;
  conflict?: SyncConflict;
  retryCount: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class SyncOrchestratorClient {
  private config: SyncConfig;
  private conflictDetector: ConflictDetector;
  private syncIntervalId?: NodeJS.Timeout;
  private activeOperations: Map<string, SyncOperation> = new Map();
  private localAdapter?: EnhancedIndexedDBAdapter;

  constructor(config: SyncConfig) {
    this.config = {
      syncInterval: 30000, // 30 seconds default
      batchSize: 50,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };
    this.conflictDetector = new ConflictDetector();
  }

  /**
   * Start automatic sync
   */
  start(): void {
    if (this.syncIntervalId) {
      return; // Already running
    }

    // Initial sync
    this.performSync();

    // Schedule periodic sync
    this.syncIntervalId = setInterval(() => {
      this.performSync();
    }, this.config.syncInterval);
  }

  /**
   * Stop automatic sync
   */
  stop(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = undefined;
    }
  }

  /**
   * Perform a complete sync cycle
   */
  async performSync(): Promise<void> {
    try {
      console.log('Starting sync cycle...');
      
      // Step 1: Pull changes from server
      await this.pullChanges();
      
      // Step 2: Push local changes to server
      await this.pushChanges();
      
      // Step 3: Resolve any conflicts
      await this.resolveConflicts();
      
      console.log('Sync cycle completed successfully');
    } catch (error) {
      console.error('Sync cycle failed:', error);
    }
  }

  /**
   * Pull changes from server
   */
  private async pullChanges(): Promise<void> {
    try {
      const response = await fetch('/api/sync/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.config.userId,
          deviceId: this.config.deviceId,
          timestamp: this.getLastSyncTimestamp(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Pull failed: ${response.statusText}`);
      }

      const { changes, conflicts } = await response.json();
      
      // Process pulled changes
      for (const change of changes) {
        await this.processPulledChange(change);
      }
      
      // Handle conflicts
      for (const conflict of conflicts) {
        await this.handleConflict(conflict);
      }
      
    } catch (error) {
      console.error('Pull changes failed:', error);
      throw error;
    }
  }

  /**
   * Push local changes to server
   */
  private async pushChanges(): Promise<void> {
    try {
      // Get pending changes from local storage
      const pendingChanges = await this.getPendingChanges();
      
      if (pendingChanges.length === 0) {
        return; // No changes to push
      }

      // Batch changes
      const batches = this.createBatches(pendingChanges, this.config.batchSize!);
      
      for (const batch of batches) {
        await this.pushBatch(batch);
      }
      
    } catch (error) {
      console.error('Push changes failed:', error);
      throw error;
    }
  }

  /**
   * Push a batch of changes
   */
  private async pushBatch(changes: ChangeLog[]): Promise<void> {
    try {
      const response = await fetch('/api/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.config.userId,
          deviceId: this.config.deviceId,
          changes,
        }),
      });

      if (!response.ok) {
        throw new Error(`Push batch failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Handle conflicts from push
      if (result.conflicts && result.conflicts.length > 0) {
        for (const conflict of result.conflicts) {
          await this.handleConflict(conflict);
        }
      }
      
      // Determine which local changes were processed successfully on server
      const processedServerChanges: Array<{ entityType: string; entityId: string; operation: string }> = Array.isArray(result.changes)
        ? result.changes.map((c: any) => ({ entityType: c.entityType, entityId: c.entityId, operation: c.operation }))
        : [];

      const processedLocalIds: string[] = [];
      const unmatchedLocalIds = new Set<string>(changes.map(c => c.changeId));

      for (const pc of processedServerChanges) {
        const localMatch = changes.find(c =>
          c.entityType === pc.entityType &&
          c.entityId === pc.entityId &&
          c.operation === pc.operation &&
          unmatchedLocalIds.has(c.changeId)
        );
        if (localMatch) {
          processedLocalIds.push(localMatch.changeId);
          unmatchedLocalIds.delete(localMatch.changeId);
        }
      }

      // Mark processed as synced; queue the rest for retry/failure handling
      if (processedLocalIds.length > 0) {
        await this.markChangesAsSynced(changes.filter(c => processedLocalIds.includes(c.changeId)));
      }
      if (unmatchedLocalIds.size > 0) {
        await this.markChangesAsFailed(changes.filter(c => unmatchedLocalIds.has(c.changeId)), null);
      }
      
    } catch (error) {
      console.error('Push batch failed:', error);
      
      // Retry logic
      if (changes[0].retryCount < this.config.retryAttempts!) {
        await this.retryBatch(changes);
      } else {
        await this.markChangesAsFailed(changes, error);
      }
    }
  }

  /**
   * Resolve conflicts
   */
  private async resolveConflicts(): Promise<void> {
    try {
      // Get unresolved conflicts
      const conflicts = await this.getUnresolvedConflicts();
      
      for (const conflict of conflicts) {
        await this.resolveConflict(conflict);
      }
      
    } catch (error) {
      console.error('Resolve conflicts failed:', error);
      throw error;
    }
  }

  /**
   * Get active sync operations
   */
  getActiveOperations(): SyncOperation[] {
    return Array.from(this.activeOperations.values());
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{
    isSyncing: boolean;
    lastSyncTime: Date | null;
    pendingChanges: number;
    unresolvedConflicts: number;
    activeOperations: SyncOperation[];
  }> {
    try {
      const response = await fetch(`/api/sync/status?deviceId=${this.config.deviceId}`);
      
      if (!response.ok) {
        throw new Error(`Get sync status failed: ${response.statusText}`);
      }
      
      const status = await response.json();
      
      return {
        isSyncing: this.activeOperations.size > 0,
        lastSyncTime: status.lastSyncAt ? new Date(status.lastSyncAt) : null,
        pendingChanges: status.pendingChanges,
        unresolvedConflicts: status.unresolvedConflicts,
        activeOperations: this.getActiveOperations(),
      };
    } catch (error) {
      console.error('Get sync status failed:', error);
      throw error;
    }
  }

  /**
   * Force sync
   */
  async forceSync(): Promise<void> {
    this.stop();
    await this.performSync();
    this.start();
  }

  // Helper methods
  private async getLocalAdapter(): Promise<EnhancedIndexedDBAdapter> {
    if (!this.localAdapter) {
      this.localAdapter = new EnhancedIndexedDBAdapter({
        enableEncryption: true,
        maxRetryAttempts: this.config.retryAttempts ?? 3,
        syncInterval: this.config.syncInterval ?? 30000,
        offlineTimeout: 60000,
      } as any);
      await this.localAdapter.initialize(this.config.userId);
    }
    return this.localAdapter;
  }

  private getLastSyncTimestamp(): Date {
    // This would typically come from local storage
    return new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
  }

  private async getPendingChanges(): Promise<ChangeLog[]> {
    try {
      const adapter = await this.getLocalAdapter();
      // Prefer using sync metadata when available; fallback to last 24h
      const since = this.getLastSyncTimestamp();
      const localChanges = await adapter.getChangesSince(since);

      // Only push pending changes
      const pending = (localChanges || []).filter((c: any) => c.syncStatus === 'pending');

      const mapped: ChangeLog[] = pending.map((c: any) => {
        const entityType = c.entityType === 'chat' ? 'session' : c.entityType; // normalize if needed

        // Map file fields explicitly to avoid losing originalName/mimeType/size
        let changes: any = {};
        if (entityType === 'file') {
          const f = c.data || {};
          changes = {
            patientId: f?.patientId,
            sessionId: f?.sessionId,
            fileName: f?.name,
            originalName: f?.name,
            mimeType: f?.type,
            size: f?.size ?? 0,
            checksum: f?.checksum,
            encryptionMetadata: f?.encryptionMetadata,
            metadata: {
              status: f?.status,
              summary: f?.summary,
              outline: f?.outline,
              keywords: f?.keywords,
            },
          };
        } else if (entityType === 'patient') {
          changes = c.data || {};
        } else if (entityType === 'session') {
          changes = c.data || {};
        } else {
          changes = c.data || {};
        }

        return {
          changeId: c.id,
          userId: this.config.userId,
          deviceId: this.config.deviceId,
          entityType,
          entityId: c.entityId,
          operation: c.operation,
          changes,
          previousValues: c.previousData || {},
          newValues: c.data || {},
          timestamp: new Date(c.timestamp || Date.now()),
          syncStatus: 'pending',
          retryCount: c.retryCount ?? 0,
          lastError: undefined,
        } as ChangeLog;
      });

      return mapped;
    } catch (err) {
      console.error('Failed to load pending changes from local storage', err);
      return [];
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private async processPulledChange(change: ChangeLog): Promise<void> {
    // Apply change to local storage
    console.log('Processing pulled change:', change);
  }

  private async handleConflict(conflict: SyncConflict): Promise<void> {
    console.log('Handling conflict:', conflict);
    // This would typically show UI for conflict resolution
  }

  private async getUnresolvedConflicts(): Promise<SyncConflict[]> {
    // This would typically come from local storage or API
    return [];
  }

  private async resolveConflict(conflict: SyncConflict): Promise<void> {
    console.log('Resolving conflict:', conflict);
    // This would typically apply resolution strategy
  }

  private async markChangesAsSynced(changes: ChangeLog[]): Promise<void> {
    try {
      const adapter = await this.getLocalAdapter();
      const ids = changes.map(c => c.changeId).filter(Boolean);
      if (ids.length > 0) {
        await adapter.markChangesSynced(ids);
      }
    } catch (err) {
      console.error('Failed to mark changes as synced locally', err);
    }
  }

  private async markChangesAsFailed(changes: ChangeLog[], error: any): Promise<void> {
    try {
      const adapter = await this.getLocalAdapter();
      for (const ch of changes) {
        const pendingOp: PendingOperation = {
          id: ch.changeId,
          type: ch.operation as any,
          entityType: ch.entityType as any,
          data: ch.operation === 'delete' ? undefined : ch.newValues,
          previousData: ch.previousValues,
          priority: 1,
          attempts: ch.retryCount ?? 0,
          createdAt: new Date(ch.timestamp),
          lastAttempt: new Date(),
          userId: ch.userId,
          deviceId: ch.deviceId,
          retryCount: ch.retryCount ?? 0,
          maxRetries: this.config.retryAttempts ?? 3,
        };
        await adapter.addPendingOperation(pendingOp);
      }
    } catch (err) {
      console.error('Failed to persist failed changes locally', err, error);
    }
  }

  private async retryBatch(changes: ChangeLog[]): Promise<void> {
    // Retry the batch after a delay
    console.log('Retrying batch after delay');
    await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
    
    // Increment retry count
    const retryChanges = changes.map(change => ({
      ...change,
      retryCount: change.retryCount + 1,
    }));
    
    await this.pushBatch(retryChanges);
  }
}

export const createSyncOrchestrator = (config: SyncConfig): SyncOrchestratorClient => {
  return new SyncOrchestratorClient(config);
};