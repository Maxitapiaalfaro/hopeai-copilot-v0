import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock user identity to provide stable user and device IDs
vi.mock('@/lib/user-identity', () => ({
  getEffectiveUserId: vi.fn(() => 'user-abc'),
  getDeviceId: vi.fn(() => 'device-123'),
}))

import LocalDataMigrator from '@/lib/migration/local-data-migrator'
import { EnhancedIndexedDBAdapter } from '@/lib/storage/enhanced-indexeddb-adapter'

describe('LocalDataMigrator - migration status and history', () => {
  let localAdapter: EnhancedIndexedDBAdapter

  beforeEach(async () => {
    localAdapter = new EnhancedIndexedDBAdapter({
      enableEncryption: true,
      maxRetryAttempts: 3,
      syncInterval: 30000,
      offlineTimeout: 60000,
    })
    await localAdapter.initialize('user-abc')

    // Ensure a clean state in migration stores
    await localAdapter.delete('migration_status', {})
    await localAdapter.delete('migration_backups', {})
  })

  afterEach(async () => {
    // Clean up after each test to avoid cross-test interference
    await localAdapter.delete('migration_status', {})
    await localAdapter.delete('migration_backups', {})
    vi.clearAllMocks()
  })

  it('isMigrationComplete returns false when no status record exists', async () => {
    const done = await LocalDataMigrator.isMigrationComplete()
    expect(done).toBe(false)
  })

  it('isMigrationComplete returns true when a matching status record exists', async () => {
    const record = {
      userId: 'user-abc',
      deviceId: 'device-123',
      completedAt: new Date(),
      version: '1.0.0',
    }
    // Exercise adapter mapping: accept direct store name in create()
    await localAdapter.create('migration_status', record)

    const done = await LocalDataMigrator.isMigrationComplete()
    expect(done).toBe(true)
  })

  it('getMigrationHistory returns combined, sorted backup and completion records', async () => {
    // Older backup
    const backup = {
      id: 'b1',
      timestamp: new Date(Date.now() - 60_000), // 1 minute ago
      userId: 'user-abc',
      deviceId: 'device-123',
      data: { note: 'encrypted-payload-placeholder' },
      checksum: 'checksum-abc',
    }
    await localAdapter.create('migration_backups', backup)

    // Newer completion status
    const status = {
      userId: 'user-abc',
      deviceId: 'device-123',
      completedAt: new Date(),
      version: 'v1',
    }
    await localAdapter.create('migration_status', status)

    const history = await LocalDataMigrator.getMigrationHistory()
    expect(history.length).toBe(2)

    // Sorted descending by timestamp: completion should appear first
    expect(history[0].status).toBe('migration_completed')
    expect(history[1].status).toBe('backup_created')

    // Verify details mapping
    expect(history[0].details.deviceId).toBe('device-123')
    expect(history[0].details.version).toBe('v1')
    expect(history[1].details.deviceId).toBe('device-123')
    expect(history[1].details.checksum).toBe('checksum-abc')
  })
})