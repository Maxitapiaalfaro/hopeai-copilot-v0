/**
 * Migration Management API Endpoints
 * 
 * Provides REST API endpoints for managing data migration
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
import { getEffectiveUserId } from '@/lib/user-identity';
const MIGRATION_ENABLED = process.env.MIGRATION_ENABLED === 'true';
const RATE_LIMIT_TOKENS = parseInt(process.env.MIGRATION_RATE_TOKENS || '5');
const RATE_REFILL_MS = parseInt(process.env.MIGRATION_RATE_REFILL_MS || '1000');
const limiter = new Map<string, { tokens: number; last: number }>();

function allow(userId: string): boolean {
  const now = Date.now();
  const entry = limiter.get(userId) || { tokens: RATE_LIMIT_TOKENS, last: now };
  const elapsed = now - entry.last;
  if (elapsed >= RATE_REFILL_MS) {
    const add = Math.floor(elapsed / RATE_REFILL_MS);
    entry.tokens = Math.min(RATE_LIMIT_TOKENS, entry.tokens + add);
    entry.last = now;
  }
  if (entry.tokens <= 0) {
    limiter.set(userId, entry);
    return false;
  }
  entry.tokens -= 1;
  limiter.set(userId, entry);
  return true;
}

// Initialize storage adapters - se inicializarán con userId cuando sea necesario
const localStorage = new EnhancedIndexedDBAdapter({
  enableEncryption: process.env.ENCRYPTION_ENABLED === 'true',
  maxRetryAttempts: 3,
  syncInterval: 30000,
  offlineTimeout: 10000
});
const remoteStorage = new APIClientAdapter(
  process.env.NEXT_PUBLIC_API_URL || '',
  '', // authToken - will be provided during actual migration
  {
    enableEncryption: process.env.ENCRYPTION_ENABLED === 'true',
    maxRetryAttempts: 3,
    syncInterval: 30000,
    offlineTimeout: 10000
  }
);

// Initialize rollout system with default config
const rolloutConfig = {
  enabled: process.env.MIGRATION_ENABLED === 'true',
  rolloutPercentage: parseInt(process.env.MIGRATION_ROLLOUT_PERCENTAGE || '10'),
  maxConcurrentMigrations: parseInt(process.env.MIGRATION_MAX_CONCURRENT || '5'),
  migrationCooldownHours: parseInt(process.env.MIGRATION_COOLDOWN_HOURS || '24'),
  autoRollbackOnFailure: process.env.MIGRATION_AUTO_ROLLBACK === 'true',
  requiredUserRole: process.env.MIGRATION_REQUIRED_ROLE || 'user',
  minimumAppVersion: process.env.MIGRATION_MIN_VERSION || '1.0.0'
};

const rolloutSystem = new ProgressiveRollout(localStorage, remoteStorage, rolloutConfig);

/**
 * GET /api/migration/status
 * Get migration status for current user
 */
export async function GET(request: NextRequest) {
  try {
    if (!MIGRATION_ENABLED) {
      return NextResponse.json({ error: 'Migration disabled' }, { status: 404 });
    }
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    if (!allow(userId)) {
      return new NextResponse(JSON.stringify({ error: 'Too Many Requests', retryAfter: 2 }), {
        status: 429,
        headers: { 'Retry-After': '2', 'Content-Type': 'application/json' }
      });
    }
    
    // Check if user is eligible for migration
    const isEligible = await rolloutSystem.isUserEligible(userId);
    
    // Check if migration is already complete
    const isMigrated = await LocalDataMigrator.isMigrationComplete(userId);
    
    // Get migration history
    const migrationHistory = await LocalDataMigrator.getMigrationHistory(userId);
    
    // Get current queue status for user
    const queueStatus = await rolloutSystem.getQueueStatus();
    const userQueueItem = queueStatus.find(item => item.userId === userId);

    const status = {
      userId,
      eligible: isEligible,
      migrated: isMigrated,
      queueStatus: userQueueItem,
      history: migrationHistory,
      config: {
        rolloutEnabled: rolloutConfig.enabled,
        rolloutPercentage: rolloutConfig.rolloutPercentage,
        maxConcurrentMigrations: rolloutConfig.maxConcurrentMigrations,
        migrationCooldownHours: rolloutConfig.migrationCooldownHours
      }
    };

    loggers.storage.info('Migration status retrieved', { userId, status });
    return NextResponse.json(status);

  } catch (error) {
    loggers.storage.error('Error getting migration status', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/migration/request
 * Request migration for current user
 */
export async function POST(request: NextRequest) {
  try {
    if (!MIGRATION_ENABLED) {
      return NextResponse.json({ error: 'Migration disabled' }, { status: 404 });
    }
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    if (!allow(userId)) {
      return new NextResponse(JSON.stringify({ error: 'Too Many Requests', retryAfter: 2 }), {
        status: 429,
        headers: { 'Retry-After': '2', 'Content-Type': 'application/json' }
      });
    }
    const { priority = 5 } = await request.json();

    loggers.storage.info('Migration request received', { userId, priority });

    // Request migration through rollout system
    const success = await rolloutSystem.requestMigration(priority);

    if (success) {
      loggers.storage.info('Migration request accepted', { userId });
      return NextResponse.json({
        success: true,
        message: 'Migration request added to queue',
        userId,
        priority
      });
    } else {
      loggers.storage.info('Migration request denied', { userId });
      return NextResponse.json({
        success: false,
        message: 'Migration request denied - user not eligible or already in queue',
        userId
      }, { status: 400 });
    }

  } catch (error) {
    loggers.storage.error('Error requesting migration', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/migration/execute
 * Execute migration immediately (admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    if (!MIGRATION_ENABLED) {
      return NextResponse.json({ error: 'Migration disabled' }, { status: 404 });
    }
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is admin (you may want to implement proper role checking)
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin privileges required' },
        { status: 403 }
      );
    }

    const { userId, dryRun = false } = await request.json();
    const targetUserId = userId || session.user.id;

    loggers.storage.info('Migration execution requested', { targetUserId, dryRun });

    // Get auth token from session
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET || 'your-secret-key' 
    });

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication token required' },
        { status: 401 }
      );
    }

    // Initialize remote storage with auth token
    const authRemoteStorage = new APIClientAdapter(
      process.env.NEXT_PUBLIC_API_URL || '',
      token.accessToken as string || '',
      {
        enableEncryption: process.env.ENCRYPTION_ENABLED === 'true',
        maxRetryAttempts: 3,
        syncInterval: 30000,
        offlineTimeout: 10000
      }
    );

    // Initialize migrator
    // Note: localStorage is already initialized, no need to connect
    
    const migrator = new LocalDataMigrator(localStorage, authRemoteStorage, {
      backupLocalData: true,
      encryptionEnabled: true,
      dryRun,
      maxRetries: 3,
      retryDelay: 2000
    });

    // Execute migration
    const result = await migrator.migrateUserData();

    loggers.storage.info('Migration executed successfully', { targetUserId, result });
    return NextResponse.json({
      success: true,
      message: dryRun ? 'Migration dry-run completed' : 'Migration executed successfully',
      userId: targetUserId,
      result
    });

  } catch (error) {
    loggers.storage.error('Error executing migration', { error });
    return NextResponse.json(
      { error: 'Migration execution failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/migration/rollback
 * Rollback migration (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    if (!MIGRATION_ENABLED) {
      return NextResponse.json({ error: 'Migration disabled' }, { status: 404 });
    }
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin privileges required' },
        { status: 403 }
      );
    }

    const { userId } = await request.json();
    const targetUserId = userId || session.user.id;

    loggers.storage.info('Migration rollback requested', { targetUserId });

    // Get auth token from session
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET || 'your-secret-key' 
    });

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication token required' },
        { status: 401 }
      );
    }

    // Initialize remote storage with auth token
    const authRemoteStorage = new APIClientAdapter(
      process.env.NEXT_PUBLIC_API_URL || '',
      token.accessToken as string || '',
      {
        enableEncryption: process.env.ENCRYPTION_ENABLED === 'true',
        maxRetryAttempts: 3,
        syncInterval: 30000,
        offlineTimeout: 10000
      }
    );

    // Initialize migrator
    // Note: localStorage is already initialized, no need to connect
    
    const migrator = new LocalDataMigrator(localStorage, authRemoteStorage, {
      backupLocalData: true,
      encryptionEnabled: true,
      dryRun: false,
      maxRetries: 2,
      retryDelay: 1000
    });

    // Get the latest backup for this user
    const backups = await localStorage.find('migration_backups', { userId: targetUserId });
    if (backups.length === 0) {
      return NextResponse.json(
        { error: 'No backup found for rollback' },
        { status: 404 }
      );
    }
    
    // Sort by timestamp and get the most recent backup
    const latestBackup = backups.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];

    // Execute rollback
    const result = await migrator.rollbackMigration(latestBackup);

    loggers.storage.info('Migration rollback completed', { targetUserId, result });
    return NextResponse.json({
      success: true,
      message: 'Migration rollback completed',
      userId: targetUserId,
      result
    });

  } catch (error) {
    loggers.storage.error('Error rolling back migration', { error });
    return NextResponse.json(
      { error: 'Migration rollback failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
