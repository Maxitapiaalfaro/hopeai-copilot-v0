/**
 * Migration Metrics API Endpoint
 * 
 * Provides metrics and analytics for the migration system
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '@/lib/auth/auth-options';
import { ProgressiveRollout } from '@/lib/migration/progressive-rollout';
import { LocalDataMigrator } from '@/lib/migration/local-data-migrator';
import { EnhancedIndexedDBAdapter } from '@/lib/storage/enhanced-indexeddb-adapter';
import { APIClientAdapter } from '@/lib/storage/api-client-adapter';
import { loggers } from '@/lib/logger';

/**
 * GET /api/migration/metrics
 * Get migration system metrics and analytics
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is admin (implement proper role checking in production)
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin privileges required' },
        { status: 403 }
      );
    }

    // Get authentication token
    const token = await getToken({ req: request });
    const authToken = token?.accessToken as string || '';

    // Initialize storage adapters
    const localStorage = new EnhancedIndexedDBAdapter({
      enableEncryption: true,
      maxRetryAttempts: 3,
      syncInterval: 30000,
      offlineTimeout: 60000
    });
    const remoteStorage = new APIClientAdapter(
      process.env.NEXT_PUBLIC_API_URL || '',
      authToken,
      {
        enableEncryption: true,
        maxRetryAttempts: 3,
        syncInterval: 30000,
        offlineTimeout: 60000
      }
    );

    // Initialize rollout system
    const rolloutConfig = {
      enabled: process.env.MIGRATION_ENABLED === 'true',
      rolloutPercentage: parseInt(process.env.MIGRATION_ROLLOUT_PERCENTAGE || '10'),
      maxConcurrentMigrations: parseInt(process.env.MIGRATION_MAX_CONCURRENT || '5'),
      migrationCooldownHours: parseInt(process.env.MIGRATION_COOLDOWN_HOURS || '24'),
      autoRollbackOnFailure: process.env.MIGRATION_AUTO_ROLLBACK === 'true'
    };

    const rolloutSystem = new ProgressiveRollout(localStorage, remoteStorage, rolloutConfig);

    // Get rollout system metrics
    const rolloutMetrics = rolloutSystem.getMetrics();
    
    // Get queue status
    const queueStatus = rolloutSystem.getQueueStatus();
    
    // Get migration history across all users
    const migrationHistory = await getGlobalMigrationHistory();
    
    // Calculate additional analytics
    const analytics = calculateMigrationAnalytics(queueStatus, migrationHistory);

    const metrics = {
      timestamp: new Date().toISOString(),
      rollout: rolloutMetrics,
      queue: {
        total: queueStatus.length,
        pending: queueStatus.filter(item => item.status === 'pending').length,
        processing: queueStatus.filter(item => item.status === 'processing').length,
        completed: queueStatus.filter(item => item.status === 'completed').length,
        failed: queueStatus.filter(item => item.status === 'failed').length,
        skipped: queueStatus.filter(item => item.status === 'skipped').length,
        items: queueStatus
      },
      history: migrationHistory,
      analytics,
      config: rolloutConfig
    };

    loggers.storage.info('Migration metrics retrieved', { 
      totalUsers: metrics.rollout.totalEligibleUsers,
      successRate: metrics.rollout.successRate,
      queueSize: metrics.queue.total
    });

    return NextResponse.json(metrics);

  } catch (error) {
    loggers.storage.error('Error getting migration metrics', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get migration history across all users
 */
async function getGlobalMigrationHistory(): Promise<any[]> {
  try {
    // Get migration history from local storage
    const history = await localStorage.find('migration_history', {});
    
    return history.map((item: any) => ({
      userId: item.userId,
      deviceId: item.deviceId,
      status: item.status,
      startedAt: item.startedAt,
      completedAt: item.completedAt,
      duration: item.duration,
      entitiesMigrated: item.entitiesMigrated,
      sizeInBytes: item.sizeInBytes,
      error: item.error
    }));
    
  } catch (error) {
    loggers.storage.error('Error retrieving global migration history', { error });
    return [];
  }
}

/**
 * Calculate migration analytics
 */
function calculateMigrationAnalytics(queueStatus: any[], migrationHistory: any[]) {
  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Recent activity
  const recentMigrations = migrationHistory.filter(item => 
    item.startedAt && new Date(item.startedAt) > last24Hours
  );

  const weeklyMigrations = migrationHistory.filter(item => 
    item.startedAt && new Date(item.startedAt) > last7Days
  );

  // Success rate trends
  const successfulRecent = recentMigrations.filter(item => item.status === 'completed').length;
  const failedRecent = recentMigrations.filter(item => item.status === 'failed').length;
  const recentSuccessRate = recentMigrations.length > 0 
    ? (successfulRecent / recentMigrations.length) * 100 
    : 0;

  // Performance metrics
  const completedMigrations = migrationHistory.filter(item => item.status === 'completed');
  const averageDuration = completedMigrations.length > 0
    ? completedMigrations.reduce((sum, item) => sum + (item.duration || 0), 0) / completedMigrations.length
    : 0;

  const averageSize = completedMigrations.length > 0
    ? completedMigrations.reduce((sum, item) => sum + (item.sizeInBytes || 0), 0) / completedMigrations.length
    : 0;

  // Queue analytics
  const averageWaitTime = calculateAverageWaitTime(queueStatus);

  return {
    activity: {
      last24Hours: recentMigrations.length,
      last7Days: weeklyMigrations.length,
      averagePerDay: weeklyMigrations.length / 7
    },
    performance: {
      averageDuration: Math.round(averageDuration),
      averageSize: Math.round(averageSize),
      averageWaitTime: averageWaitTime
    },
    quality: {
      recentSuccessRate: Math.round(recentSuccessRate * 100) / 100,
      totalSuccessRate: migrationHistory.length > 0 
        ? Math.round((completedMigrations.length / migrationHistory.length) * 100 * 100) / 100
        : 0
    },
    trends: {
      dailyMigrationCount: getDailyMigrationTrend(migrationHistory),
      successRateTrend: getSuccessRateTrend(migrationHistory)
    }
  };
}

/**
 * Calculate average wait time for pending migrations
 */
function calculateAverageWaitTime(queueStatus: any[]): number {
  const pendingItems = queueStatus.filter(item => item.status === 'pending');
  
  if (pendingItems.length === 0) return 0;
  
  const now = new Date();
  const totalWaitTime = pendingItems.reduce((sum, item) => {
    const waitTime = now.getTime() - new Date(item.requestedAt).getTime();
    return sum + waitTime;
  }, 0);
  
  return Math.round(totalWaitTime / pendingItems.length / 1000); // Return in seconds
}

/**
 * Get daily migration count trend
 */
function getDailyMigrationTrend(migrationHistory: any[]): Array<{date: string, count: number}> {
  const dailyCounts: { [key: string]: number } = {};
  
  migrationHistory.forEach(item => {
    if (item.startedAt) {
      const date = new Date(item.startedAt).toISOString().split('T')[0];
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    }
  });
  
  return Object.entries(dailyCounts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7); // Last 7 days
}

/**
 * Get success rate trend
 */
function getSuccessRateTrend(migrationHistory: any[]): Array<{date: string, successRate: number}> {
  const dailyStats: { [key: string]: {completed: number, total: number} } = {};
  
  migrationHistory.forEach(item => {
    if (item.startedAt) {
      const date = new Date(item.startedAt).toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { completed: 0, total: 0 };
      }
      dailyStats[date].total++;
      if (item.status === 'completed') {
        dailyStats[date].completed++;
      }
    }
  });
  
  return Object.entries(dailyStats)
    .map(([date, stats]) => ({ 
      date, 
      successRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100 * 100) / 100 : 0
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7); // Last 7 days
}