/**
 * Migration Status API Endpoint
 *
 * GET /api/migration/status
 * Returns migration eligibility, progress, and history for the current user.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { ProgressiveRollout } from '@/lib/migration/progressive-rollout'
import { LocalDataMigrator } from '@/lib/migration/local-data-migrator'
import { EnhancedIndexedDBAdapter } from '@/lib/storage/enhanced-indexeddb-adapter'
import { APIClientAdapter } from '@/lib/storage/api-client-adapter'
import { loggers } from '@/lib/logger'

const MIGRATION_ENABLED = process.env.MIGRATION_ENABLED === 'true'
const RATE_LIMIT_TOKENS = parseInt(process.env.MIGRATION_RATE_TOKENS || '5')
const RATE_REFILL_MS = parseInt(process.env.MIGRATION_RATE_REFILL_MS || '1000')
const limiter = new Map<string, { tokens: number; last: number }>()

function allow(userId: string): boolean {
  const now = Date.now()
  const entry = limiter.get(userId) || { tokens: RATE_LIMIT_TOKENS, last: now }
  const elapsed = now - entry.last
  if (elapsed >= RATE_REFILL_MS) {
    const add = Math.floor(elapsed / RATE_REFILL_MS)
    entry.tokens = Math.min(RATE_LIMIT_TOKENS, entry.tokens + add)
    entry.last = now
  }
  if (entry.tokens <= 0) {
    limiter.set(userId, entry)
    return false
  }
  entry.tokens -= 1
  limiter.set(userId, entry)
  return true
}

// Initialize storage adapters (server-side safe; userId injected during operations)
const localStorage = new EnhancedIndexedDBAdapter({
  enableEncryption: process.env.ENCRYPTION_ENABLED === 'true',
  maxRetryAttempts: 3,
  syncInterval: 30000,
  offlineTimeout: 10000
})

const remoteStorage = new APIClientAdapter(
  process.env.NEXT_PUBLIC_API_URL || '',
  '', // authToken not required for status read
  {
    enableEncryption: process.env.ENCRYPTION_ENABLED === 'true',
    maxRetryAttempts: 3,
    syncInterval: 30000,
    offlineTimeout: 10000
  }
)

const rolloutConfig = {
  enabled: process.env.MIGRATION_ENABLED === 'true',
  rolloutPercentage: parseInt(process.env.MIGRATION_ROLLOUT_PERCENTAGE || '10'),
  maxConcurrentMigrations: parseInt(process.env.MIGRATION_MAX_CONCURRENT || '5'),
  migrationCooldownHours: parseInt(process.env.MIGRATION_COOLDOWN_HOURS || '24'),
  autoRollbackOnFailure: process.env.MIGRATION_AUTO_ROLLBACK === 'true',
  requiredUserRole: process.env.MIGRATION_REQUIRED_ROLE || 'user',
  minimumAppVersion: process.env.MIGRATION_MIN_VERSION || '1.0.0'
}

const rolloutSystem = new ProgressiveRollout(localStorage, remoteStorage, rolloutConfig)

export async function GET(request: NextRequest) {
  try {
    if (!MIGRATION_ENABLED) {
      return NextResponse.json({ error: 'Migration disabled' }, { status: 404 })
    }
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const userId = session.user.id

    if (!allow(userId)) {
      return new NextResponse(JSON.stringify({ error: 'Too Many Requests', retryAfter: 2 }), {
        status: 429,
        headers: { 'Retry-After': '2', 'Content-Type': 'application/json' }
      })
    }

    // Eligibility and migration completion
    const [isEligible, isMigrated] = await Promise.all([
      rolloutSystem.isUserEligible(userId),
      LocalDataMigrator.isMigrationComplete(userId)
    ])

    // History and queue status
    const [migrationHistory, queueItems] = await Promise.all([
      LocalDataMigrator.getMigrationHistory(userId),
      rolloutSystem.getQueueStatus()
    ])

    const userQueueItem = queueItems.find(item => item.userId === userId)

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
    }

    loggers.storage.info('Migration status retrieved (status route)', { userId, status })
    return NextResponse.json(status)
  } catch (error) {
    loggers.storage.error('Error getting migration status (status route)', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
