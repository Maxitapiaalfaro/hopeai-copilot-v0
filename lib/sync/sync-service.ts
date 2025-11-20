import { databaseService } from '@/lib/database';
import { ChangeLog, SyncConflict } from '@/lib/database/models';
import { v4 as uuidv4 } from 'uuid';

export interface SyncOptions {
  userId: string;
  deviceId: string;
  since?: Date;
  entityTypes?: string[];
}

export interface SyncResult {
  success: boolean;
  changes: ChangeLog[];
  conflicts: SyncConflict[];
  serverTime: Date;
  totalChanges: number;
  totalConflicts: number;
}

export interface SyncStatus {
  deviceId: string;
  userId: string;
  lastSyncAt?: Date;
  pendingChanges: number;
  unresolvedConflicts: number;
  failedSyncs: number;
  syncHealth: {
    successRate: number;
    totalChanges: number;
    lastError?: string;
  };
}

export class SyncService {
  /**
   * Get sync status for a device
   */
  async getSyncStatus(userId: string, deviceId: string): Promise<SyncStatus> {
    await databaseService.initialize();

    // Get last sync timestamp
    const lastSync = await databaseService.changeLogs.findOne(
      { userId, deviceId },
      { sort: { timestamp: -1 } }
    );

    // Count pending changes
    const pendingChanges = await databaseService.changeLogs.countDocuments({
      userId,
      deviceId,
      syncStatus: 'pending',
    });

    // Count unresolved conflicts
    const unresolvedConflicts = await databaseService.syncConflicts.countDocuments({
      userId,
      isResolved: false,
    });

    // Count failed syncs in the last 24 hours
    const failedSyncs = await databaseService.changeLogs.countDocuments({
      userId,
      deviceId,
      syncStatus: 'failed',
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    // Calculate sync health
    const totalChanges = await databaseService.changeLogs.countDocuments({
      userId,
      deviceId,
      timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
    });

    const successfulChanges = await databaseService.changeLogs.countDocuments({
      userId,
      deviceId,
      syncStatus: 'synced',
      timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });

    const successRate = totalChanges > 0 ? (successfulChanges / totalChanges) * 100 : 100;

    return {
      deviceId,
      userId,
      lastSyncAt: lastSync?.timestamp,
      pendingChanges,
      unresolvedConflicts,
      failedSyncs,
      syncHealth: {
        successRate,
        totalChanges,
      },
    };
  }

  /**
   * Update sync status
   */
  async updateSyncStatus(
    userId: string, 
    deviceId: string, 
    status: Partial<SyncStatus>
  ): Promise<void> {
    await databaseService.initialize();

    // Update last sync timestamp if provided
    if (status.lastSyncAt) {
      await databaseService.changeLogs.insertOne({
        changeId: uuidv4(),
        userId,
        deviceId,
        entityType: 'user',
        entityId: userId,
        operation: 'update',
        changes: { lastSyncAt: status.lastSyncAt },
        timestamp: status.lastSyncAt,
        syncStatus: 'synced',
        retryCount: 0,
      });
    }
  }

  /**
   * Clean up old sync data
   */
  async cleanupOldSyncData(userId: string, daysToKeep: number = 30): Promise<void> {
    await databaseService.initialize();

    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    // Remove old resolved conflicts
    await databaseService.syncConflicts.deleteMany({
      userId,
      isResolved: true,
      resolvedAt: { $lt: cutoffDate },
    });

    // Remove old change logs
    await databaseService.changeLogs.deleteMany({
      userId,
      timestamp: { $lt: cutoffDate },
      syncStatus: 'synced',
    });
  }

  /**
   * Get sync statistics
   */
  async getSyncStatistics(userId: string, days: number = 7): Promise<{
    totalChanges: number;
    successfulChanges: number;
    failedChanges: number;
    conflicts: number;
    resolvedConflicts: number;
    averageSyncTime: number;
  }> {
    await databaseService.initialize();

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const totalChanges = await databaseService.changeLogs.countDocuments({
      userId,
      timestamp: { $gte: startDate },
    });

    const successfulChanges = await databaseService.changeLogs.countDocuments({
      userId,
      syncStatus: 'synced',
      timestamp: { $gte: startDate },
    });

    const failedChanges = await databaseService.changeLogs.countDocuments({
      userId,
      syncStatus: 'failed',
      timestamp: { $gte: startDate },
    });

    const conflicts = await databaseService.syncConflicts.countDocuments({
      userId,
      timestamp: { $gte: startDate },
    });

    const resolvedConflicts = await databaseService.syncConflicts.countDocuments({
      userId,
      isResolved: true,
      timestamp: { $gte: startDate },
    });

    // Calculate average sync time (simplified - based on change log density)
    const averageSyncTime = totalChanges > 0 ? (days * 24 * 60 * 60 * 1000) / totalChanges : 0;

    return {
      totalChanges,
      successfulChanges,
      failedChanges,
      conflicts,
      resolvedConflicts,
      averageSyncTime,
    };
  }
}

export const syncService = new SyncService();