/**
 * Sync Orchestrator - Central coordination for hybrid storage synchronization
 * 
 * This orchestrator manages the synchronization between local IndexedDB storage
 * and remote API storage, handling conflicts, retries, and offline operations.
 */

import { EnhancedIndexedDBAdapter } from '@/lib/storage/enhanced-indexeddb-adapter'
import { APIClientAdapter } from '@/lib/storage/api-client-adapter'
import { UnifiedStorageAdapter, SyncMetadata, ChangeRecord, PendingOperation } from '@/lib/storage/unified-storage-interface'
import { getEffectiveUserId } from '@/lib/user-identity'
import { loggers } from '@/lib/logger'
import { syncQueue } from './sync-queue'
import { SyncQueue } from './sync-queue'
import { ConflictResolver, ConflictRecord } from './conflict-resolver'

/**
 * Sync operation result
 */
interface SyncResult {
  success: boolean
  error?: string
  timestamp: Date
  changesProcessed?: number
  metadata?: SyncMetadata
  conflictsDetected?: number
  conflictsResolved?: number
  conflictsRequireReview?: number
  isOffline?: boolean
}

export class SyncOrchestrator {
  private static instance: SyncOrchestrator
  private localStorage: EnhancedIndexedDBAdapter
  private remoteStorage: APIClientAdapter
  private syncQueue: SyncQueue
  private conflictResolver: ConflictResolver
  private isSyncing = false
  private syncInterval?: NodeJS.Timeout
  private syncInProgress = false
  private lastSyncTime?: Date
  private retryCount = 0
  private readonly maxRetries = 3
  private readonly syncIntervalMs = 30000 // 30 seconds
  private readonly retryDelayMs = 1000 // 1 second base delay
  private deviceId: string

  private constructor() {
    this.deviceId = this.generateDeviceId()
    
    this.localStorage = new EnhancedIndexedDBAdapter({
      enableEncryption: true,
      maxRetryAttempts: 3,
      syncInterval: 30000,
      offlineTimeout: 60000
    })
    
    // Initialize with placeholder - will be updated when auth is available
    this.remoteStorage = new APIClientAdapter(
      process.env.NEXT_PUBLIC_API_URL || '/api',
      '', // Will be set when user authenticates
      {
        enableEncryption: true,
        maxRetryAttempts: 3,
        syncInterval: 30000,
        offlineTimeout: 60000
      }
    )

    // Initialize sync queue
    this.syncQueue = syncQueue
    
    // Initialize conflict resolver
    this.conflictResolver = new ConflictResolver()
  }

  private generateDeviceId(): string {
    return `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private getEffectiveUserId(): string {
    // Usar la función importada del sistema de identidad
    return getEffectiveUserId()
  }

  static getInstance(): SyncOrchestrator {
    if (!SyncOrchestrator.instance) {
      SyncOrchestrator.instance = new SyncOrchestrator()
    }
    return SyncOrchestrator.instance
  }

  /**
   * Reset the singleton instance - useful for testing
   * This will create a fresh instance on next getInstance() call
   */
  static resetInstance(): void {
    if (SyncOrchestrator.instance) {
      // Clean up any ongoing sync operations
      if (SyncOrchestrator.instance.syncInterval) {
        clearInterval(SyncOrchestrator.instance.syncInterval)
      }
      // Reset sync state before destroying instance
      SyncOrchestrator.instance.resetSyncState()
      SyncOrchestrator.instance = null as any
      loggers.storage.info('SyncOrchestrator singleton instance reset')
    }
  }

  /**
   * Initialize the orchestrator with user authentication
   */
  async initialize(authToken: string): Promise<void> {
    try {
      const userId = this.getEffectiveUserId()
      if (!userId) {
        throw new Error('No user identity available')
      }

      // Update remote storage with auth token
      this.remoteStorage = new APIClientAdapter(
        process.env.NEXT_PUBLIC_API_URL || '/api',
        authToken,
        {
          enableEncryption: true,
          maxRetryAttempts: 3,
          syncInterval: 30000,
          offlineTimeout: 60000
        }
      )

      // Initialize remote storage with user context
      await this.remoteStorage.initialize(userId)

      // Initialize local storage with user context
      await this.localStorage.initialize(userId)
      
      loggers.storage.info('SyncOrchestrator initialized', { userId })
    } catch (error) {
      loggers.storage.error('Failed to initialize SyncOrchestrator', error)
      throw error
    }
  }

  /**
   * Start automatic background synchronization
   */
  async startSync(): Promise<void> {
    if (this.isSyncing) {
      loggers.storage.warn('Sync already in progress')
      return
    }

    try {
      this.isSyncing = true
      loggers.storage.info('Starting automatic sync')

      // Perform initial sync
      await this.forceSync()

      // Schedule periodic sync
      this.syncInterval = setInterval(async () => {
        if (!this.syncInProgress) {
          await this.performBackgroundSync()
        }
      }, this.syncIntervalMs)

      loggers.storage.info('Automatic sync started')
    } catch (error) {
      this.isSyncing = false
      loggers.storage.error('Failed to start sync', error)
      throw error
    }
  }

  /**
   * Stop automatic background synchronization
   */
  async stopSync(): Promise<void> {
    if (!this.isSyncing) {
      return
    }

    try {
      this.isSyncing = false
      this.syncInProgress = false  // Also reset syncInProgress flag

      if (this.syncInterval) {
        clearInterval(this.syncInterval)
        this.syncInterval = undefined
      }

      loggers.storage.info('Automatic sync stopped')
    } catch (error) {
      loggers.storage.error('Error stopping sync', error)
      throw error
    }
  }

  /**
   * Reset sync state - useful for testing
   */
  resetSyncState(): void {
    this.syncInProgress = false
    this.isSyncing = false
    this.retryCount = 0
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = undefined
    }
    loggers.storage.info('Sync state reset')
  }

  /**
   * Force immediate synchronization
   */
  async forceSync(): Promise<SyncResult> {
    if (this.syncInProgress) {
      loggers.storage.warn('Sync already in progress, skipping forced sync')
      return {
        success: false,
        error: 'Sync already in progress',
        timestamp: new Date()
      }
    }

    this.syncInProgress = true
    loggers.storage.info('Starting forced sync')

    try {
      const result = await this.performSync()
      this.lastSyncTime = new Date()
      this.retryCount = 0
      
      loggers.storage.info('Forced sync completed', { result })
      return result
    } catch (error) {
      loggers.storage.error('Forced sync failed', error)
      
      // Handle retry logic - retry synchronously for forced sync
      if (this.retryCount < this.maxRetries) {
        this.retryCount++
        const delay = this.retryDelayMs * Math.pow(2, this.retryCount - 1)
        loggers.storage.info(`Retrying sync in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`)
        
        // Wait for the delay and retry
        await new Promise(resolve => setTimeout(resolve, delay))
        
        // Recursively retry
        return this.forceSync()
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
        timestamp: new Date()
      }
    } finally {
      this.syncInProgress = false
    }
  }

  /**
   * Perform background synchronization
   */
  private async performBackgroundSync(): Promise<void> {
    try {
      loggers.storage.info('Starting background sync')
      await this.performSync()
      this.lastSyncTime = new Date()
      loggers.storage.info('Background sync completed')
    } catch (error) {
      loggers.storage.error('Background sync failed', error)
      // Don't retry background syncs as aggressively
    }
  }

  /**
   * Core synchronization logic
   */
  private async performSync(): Promise<SyncResult> {
    const syncStartTime = new Date()
    const userId = this.getEffectiveUserId()
    
    if (!userId) {
      throw new Error('No user identity available for sync')
    }
    
    let conflictsDetected = 0
    let conflictsResolved = 0
    let conflictsRequireReview = 0
    let isOffline = false
    
    try {
      // Get current sync metadata
      const localMetadata = await this.localStorage.getSyncMetadata()
      let serverMetadata: SyncMetadata | null = null
      
      // Try to get server metadata with retry logic
      try {
        serverMetadata = await this.remoteStorage.getSyncMetadata()
      } catch (error) {
        loggers.storage.warn('Failed to get server metadata - will retry during sync operations', error as Record<string, any>)
        // Don't set isOffline here, let individual operations handle retries
        serverMetadata = null
      }

      // Detect changes
      const localChanges = await this.detectLocalChanges(localMetadata)
      const serverChanges = await this.detectServerChanges(serverMetadata)

      loggers.storage.info('Detected changes', {
        localChanges: localChanges.length,
        serverChanges: serverChanges.length,
        isOffline
      })

      // Apply server changes to local (only if we have server changes)
      if (serverChanges.length > 0) {
        try {
          loggers.storage.debug(`About to apply server changes`)
          const conflictResult = await this.applyServerChanges(serverChanges)
          conflictsDetected += conflictResult.conflictsDetected
          conflictsResolved += conflictResult.conflictsResolved
          conflictsRequireReview += conflictResult.conflictsRequireReview
          loggers.storage.debug(`Server changes applied`, conflictResult)
        } catch (error) {
          loggers.storage.warn('Failed to apply server changes, will handle local changes as pending', error as Record<string, any>)
          // If we can't apply server changes, we'll treat this as an offline scenario
          isOffline = true
        }
      } else if (!serverMetadata) {
        // If we don't have server metadata, we're effectively offline
        isOffline = true
      }

      // Push local changes to server (or create pending operations if offline)
      if (localChanges.length > 0) {
        loggers.storage.debug(`About to push local changes`)
        if (isOffline) {
          // When offline, convert local changes to pending operations
          await this.convertLocalChangesToPending(localChanges)
          loggers.storage.debug(`Local changes converted to pending operations for offline sync`)
        } else {
          await this.pushLocalChanges(localChanges)
          loggers.storage.debug(`Local changes pushed`)
        }
      }

      // Process pending operations solo cuando estamos online.
      // En modo offline, las operaciones deben permanecer en cola hasta reconexión.
      if (!isOffline) {
        await this.processPendingOperations()
      }

      // Update sync metadata
      const newMetadata: SyncMetadata = {
        lastSyncAt: syncStartTime,
        lastLocalUpdate: new Date(),
        lastServerUpdate: isOffline ? (localMetadata?.lastServerUpdate || syncStartTime) : new Date(),
        syncVersion: (localMetadata?.syncVersion || 0) + 1,
        checksum: await this.calculateChecksum(),
        deviceId: this.deviceId,
        userId: userId
      }

      await this.localStorage.updateSyncMetadata(newMetadata)
      
      // Only update server metadata if we're online
      if (!isOffline) {
        await this.remoteStorage.updateSyncMetadata(newMetadata)
      }

      // Return success if we processed any changes or if we're in offline mode
      // (offline mode means we successfully converted local changes to pending operations)
      const success = isOffline || localChanges.length > 0 || serverChanges.length > 0 || conflictsDetected > 0

      return {
        success: success,
        changesProcessed: localChanges.length + serverChanges.length,
        timestamp: syncStartTime,
        metadata: newMetadata,
        conflictsDetected,
        conflictsResolved,
        conflictsRequireReview,
        isOffline
      }

    } catch (error) {
      loggers.storage.error('Sync operation failed', error)
      throw error
    }
  }

  /**
   * Detect local changes since last sync
   */
  private async detectLocalChanges(metadata?: SyncMetadata | null): Promise<ChangeRecord[]> {
    try {
      const since = metadata?.lastSyncAt || new Date(0)
      return await this.localStorage.getChangesSince(since)
    } catch (error) {
      loggers.storage.error('Failed to detect local changes', error)
      return []
    }
  }

  /**
   * Convert local changes to pending operations when offline
   */
  private async convertLocalChangesToPending(changes: ChangeRecord[]): Promise<void> {
    loggers.storage.info(`Converting ${changes.length} local changes to pending operations for offline sync`)
    
    for (const change of changes) {
      try {
        // Convert ChangeRecord to PendingOperation
        const pendingOperation: PendingOperation = {
          id: change.id,
          type: change.operation, // 'create' | 'update' | 'delete'
          entityType: change.entityType,
          data: change.operation === 'delete' ? undefined : change.data,
          previousData: change.previousData,
          priority: 1, // Default priority
          attempts: 0,
          createdAt: change.timestamp,
          userId: change.userId,
          deviceId: change.deviceId,
          retryCount: 0,
          maxRetries: 3
        }
        
        // Add to local storage as pending operation
        await this.localStorage.addPendingOperation(pendingOperation)
        loggers.storage.debug(`Converted change ${change.id} to pending operation`)
      } catch (error) {
        loggers.storage.error(`Failed to convert change ${change.id} to pending operation`, error as Record<string, any>)
        // Continue with other changes, don't fail entire conversion
      }
    }
  }

  /**
   * Detect server changes since last sync
   */
  private async detectServerChanges(metadata?: SyncMetadata | null): Promise<ChangeRecord[]> {
    try {
      const since = metadata?.lastSyncAt || new Date(0)
      return await this.remoteStorage.getChangesSince(since)
    } catch (error) {
      loggers.storage.error('Failed to detect server changes', error)
      return []
    }
  }

  /**
   * Apply server changes to local storage with conflict detection and resolution
   */
  private async applyServerChanges(changes: ChangeRecord[]): Promise<{conflictsDetected: number, conflictsResolved: number, conflictsRequireReview: number}> {
    loggers.storage.info(`Applying ${changes.length} server changes to local storage`)
    
    let conflictsDetected = 0
    let conflictsResolved = 0
    let conflictsRequireReview = 0

    for (const change of changes) {
      try {
        // Check for conflicts before applying changes
        const hasConflict = await this.detectConflict(change)
        
        if (hasConflict) {
          loggers.storage.info(`Conflict detected for change ${change.id}`, {
            entityType: change.entityType,
            entityId: change.entityId
          })
          conflictsDetected++
          
          // Resolve conflict using the conflict resolver
          const resolvedChange = await this.resolveConflict(change)
          
          if (resolvedChange) {
            // Apply the resolved change
            await this.applyResolvedChange(resolvedChange)
            conflictsResolved++
          } else {
            loggers.storage.warn(`Conflict resolution failed for change ${change.id}, skipping`)
            conflictsRequireReview++
            // Continue with other changes, don't fail entire sync
            continue
          }
        } else {
          // No conflict, apply normally
          switch (change.operation) {
            case 'create':
            case 'update':
              await this.applyServerChangeToLocal(change)
              break
            case 'delete':
              await this.applyServerDeleteToLocal(change)
              break
          }
        }
      } catch (error) {
        loggers.storage.error(`Failed to apply server change: ${change.id}`, error)
        // Continue with other changes, don't fail entire sync
      }
    }

    // Mark changes as synced
    const changeIds = changes.map(c => c.id)
    await this.localStorage.markChangesSynced(changeIds)

    return { conflictsDetected, conflictsResolved, conflictsRequireReview }
  }

  /**
   * Apply individual server change to local storage
   */
  private async applyServerChangeToLocal(change: ChangeRecord): Promise<{conflictsDetected: number, conflictsResolved: number, conflictsRequireReview: number}> {
    const { entityType, data } = change
    let conflictsDetected = 0
    let conflictsResolved = 0
    let conflictsRequireReview = 0

    switch (entityType) {
      case 'chat':
        await this.localStorage.saveChatSession(data)
        break
      case 'patient':
        await this.localStorage.savePatientRecord(data)
        break
      case 'file':
        await this.localStorage.saveClinicalFile(data)
        break
      case 'analysis':
        await this.localStorage.savePatternAnalysis(data)
        break
      default:
        loggers.storage.warn(`Unknown entity type: ${entityType}`)
    }

    return { conflictsDetected, conflictsResolved, conflictsRequireReview }
  }

  /**
   * Apply server delete to local storage
   */
  private async applyServerDeleteToLocal(change: ChangeRecord): Promise<void> {
    const { entityType, data } = change

    switch (entityType) {
      case 'chat':
        await this.localStorage.deleteChatSession(data.id)
        break
      case 'patient':
        await this.localStorage.deletePatientRecord(data.id)
        break
      case 'file':
        await this.localStorage.deleteClinicalFile(data.id)
        break
      case 'analysis':
        // Pattern analyses are tied to patients, no direct delete needed
        break
      default:
        loggers.storage.warn(`Unknown entity type for delete: ${entityType}`)
    }
  }

  /**
   * Push local changes to server
   */
  private async pushLocalChanges(changes: ChangeRecord[]): Promise<void> {
    loggers.storage.info(`Pushing ${changes.length} local changes to server (batch)`)

    try {
      const { processedChangeIds, conflicts } = await this.remoteStorage.pushChanges(changes)

      if (conflicts && conflicts.length > 0) {
        loggers.storage.warn(`Conflicts detected during push: ${conflicts.length}`)
      }

      if (processedChangeIds.length > 0) {
        await this.localStorage.markChangesSynced(processedChangeIds)
        loggers.storage.info(`Marked ${processedChangeIds.length} changes as synced`)
      }

      const processedSet = new Set(processedChangeIds)
      const notProcessed = changes.filter(c => !processedSet.has(c.id))

      if (notProcessed.length > 0) {
        loggers.storage.warn(`Queueing ${notProcessed.length} unprocessed changes for retry`)
        for (const change of notProcessed) {
          await this.queueOperationForRetry(change)
          try {
            const pendingOp: PendingOperation = {
              id: change.id,
              type: change.operation,
              entityType: change.entityType,
              data: change.data,
              previousData: change.previousData,
              priority: this.calculateOperationPriority(change),
              attempts: 1,
              createdAt: new Date(),
              lastAttempt: new Date(),
              userId: change.userId,
              deviceId: change.deviceId,
              retryCount: 1,
              maxRetries: this.maxRetries
            }
            await this.localStorage.addPendingOperation(pendingOp)
          } catch (storageError) {
            loggers.storage.warn(`Failed to add operation to local storage: ${change.id}`, storageError as Record<string, any>)
          }
        }
      }
    } catch (error) {
      loggers.storage.error('Batch push failed', error)
      // Fallback: queue all for retry
      for (const change of changes) {
        if (this.shouldRetryOperation(error)) {
          await this.queueOperationForRetry(change)
          try {
            const pendingOp: PendingOperation = {
              id: change.id,
              type: change.operation,
              entityType: change.entityType,
              data: change.data,
              previousData: change.previousData,
              priority: this.calculateOperationPriority(change),
              attempts: 1,
              createdAt: new Date(),
              lastAttempt: new Date(),
              userId: change.userId,
              deviceId: change.deviceId,
              retryCount: 1,
              maxRetries: this.maxRetries
            }
            await this.localStorage.addPendingOperation(pendingOp)
          } catch (storageError) {
            loggers.storage.warn(`Failed to add operation to local storage: ${change.id}`, storageError as Record<string, any>)
          }
        }
      }
    }
  }

  /**
   * Push individual local change to server
   */
  private async pushLocalChangeToServer(change: ChangeRecord): Promise<void> {
    const { entityType, data } = change

    switch (entityType) {
      case 'chat':
        await this.remoteStorage.saveChatSession(data)
        break
      case 'patient':
        await this.remoteStorage.savePatientRecord(data)
        break
      case 'file':
        await this.remoteStorage.saveClinicalFile(data)
        break
      case 'analysis':
        await this.remoteStorage.savePatternAnalysis(data)
        break
      default:
        loggers.storage.warn(`Unknown entity type: ${entityType}`)
    }
  }

  /**
   * Push local delete to server
   */
  private async pushLocalDeleteToServer(change: ChangeRecord): Promise<void> {
    const { entityType, data } = change

    switch (entityType) {
      case 'chat':
        await this.remoteStorage.deleteChatSession(data.id)
        break
      case 'patient':
        await this.remoteStorage.deletePatientRecord(data.id)
        break
      case 'file':
        await this.remoteStorage.deleteClinicalFile(data.id)
        break
      case 'analysis':
        // Pattern analyses are tied to patients, no direct delete needed
        break
      default:
        loggers.storage.warn(`Unknown entity type for delete: ${entityType}`)
    }
  }

  /**
   * Process pending operations from previous failed syncs
   */
  private async processPendingOperations(): Promise<void> {
    try {
      const userId = this.getEffectiveUserId()
      if (!userId) {
        loggers.storage.warn('No user ID available for processing pending operations')
        return
      }

      const pendingOps = await this.localStorage.getPendingOperations()
      
      if (pendingOps.length === 0) {
        return
      }

      loggers.storage.info(`Processing ${pendingOps.length} pending operations`)

      for (const operation of pendingOps) {
        try {
          await this.processPendingOperation(operation)
          await this.localStorage.markOperationComplete(operation.id)
        } catch (error) {
          await this.handleLocalOperationError(operation, error)
        }
      }
    } catch (error) {
      loggers.storage.error('Failed to process pending operations', error)
    }
  }

  /**
   * Process individual pending operation
   */
  private async processPendingOperation(operation: PendingOperation): Promise<void> {
    const { type, entityType, data, previousData } = operation

    switch (type) {
      case 'create':
      case 'update':
        await this.pushLocalChangeToServer({
          id: operation.id,
          operation: type,
          entityType,
          entityId: data.id || operation.id,
          data,
          timestamp: operation.createdAt,
          userId: operation.userId,
          deviceId: operation.deviceId,
          syncStatus: 'pending',
          version: 1
        })
        break
      case 'delete':
        await this.pushLocalDeleteToServer({
          id: operation.id,
          operation: type,
          entityType,
          entityId: data.id || operation.id,
          data,
          timestamp: operation.createdAt,
          userId: operation.userId,
          deviceId: operation.deviceId,
          syncStatus: 'pending',
          version: 1
        })
        break
    }
  }

  /**
   * Detect if a server change conflicts with local changes
   */
  private async detectConflict(serverChange: ChangeRecord): Promise<boolean> {
    try {
      // Derivar entityId cuando no esté presente en el cambio del servidor
      let effectiveEntityId = serverChange.entityId
      if (!effectiveEntityId) {
        const d: any = serverChange.data || {}
        switch (serverChange.entityType) {
          case 'chat':
            effectiveEntityId = d.sessionId || d.id
            break
          case 'patient':
            effectiveEntityId = d.id || d.patientId
            break
          case 'file':
            effectiveEntityId = d.id
            break
          case 'analysis':
            effectiveEntityId = d.id || d.analysisId || d.patientId
            break
          default:
            effectiveEntityId = d.id
        }
      }

      // Get the current local version of the entity
      const localData = effectiveEntityId
        ? await this.getLocalEntityData(serverChange.entityType, effectiveEntityId)
        : null
      
      if (!localData) {
        // No local data, no conflict
        return false
      }

      // Check if local data has been modified since the server change timestamp
      const localLastModified = new Date(localData.updatedAt || localData.createdAt)
      const serverTimestamp = new Date(serverChange.timestamp)
      
      // If local data is newer than server change, potential conflict
      if (localLastModified > serverTimestamp) {
        loggers.storage.info(`Conflict detected: local data newer than server change`, {
          entityType: serverChange.entityType,
          entityId: serverChange.entityId,
          localLastModified: localLastModified.toISOString(),
          serverTimestamp: serverTimestamp.toISOString()
        })
        return true
      }

      // Check if data content differs (using checksum if available)
      const localChecksum = localData.checksum || await this.calculateDataChecksum(localData)
      const serverChecksum = await this.calculateDataChecksum(serverChange.data)
      
      if (localChecksum !== serverChecksum) {
        loggers.storage.info(`Conflict detected: checksum mismatch`, {
          entityType: serverChange.entityType,
          entityId: serverChange.entityId,
          localChecksum,
          serverChecksum
        })
        return true
      }

      return false
    } catch (error) {
      loggers.storage.error(`Error detecting conflict for ${serverChange.id}`, error)
      // Assume conflict exists if we can't determine
      return true
    }
  }

  /**
   * Resolve a conflict using the conflict resolver
   */
  private async resolveConflict(serverChange: ChangeRecord): Promise<ChangeRecord | null> {
    try {
      // Derivar entityId para conflictos si falta
      let effectiveEntityId = serverChange.entityId
      if (!effectiveEntityId) {
        const d: any = serverChange.data || {}
        switch (serverChange.entityType) {
          case 'chat':
            effectiveEntityId = d.sessionId || d.id
            break
          case 'patient':
            effectiveEntityId = d.id || d.patientId
            break
          case 'file':
            effectiveEntityId = d.id
            break
          case 'analysis':
            effectiveEntityId = d.id || d.analysisId || d.patientId
            break
          default:
            effectiveEntityId = d.id
        }
      }

      // Get current local data for conflict resolution
      const localData = effectiveEntityId
        ? await this.getLocalEntityData(serverChange.entityType, effectiveEntityId)
        : null
      
      if (!localData) {
        // No local data, use server change
        loggers.storage.debug(`No local data found for conflict resolution, using server change`, {
          entityType: serverChange.entityType,
          entityId: serverChange.entityId
        })
        return serverChange
      }

      // Create conflict record
      const conflictRecord: ConflictRecord = {
        id: `conflict-${serverChange.id}-${Date.now()}`,
        entityType: serverChange.entityType,
        entityId: effectiveEntityId || serverChange.entityId,
        localChange: {
          id: `local-${serverChange.id}`,
          operation: 'update',
          timestamp: new Date(localData.updatedAt || localData.createdAt),
          data: localData,
          userId: localData.userId || this.getEffectiveUserId(),
          deviceId: localData.deviceId || this.deviceId,
          checksum: localData.checksum || await this.calculateDataChecksum(localData)
        },
        serverChange: serverChange,
        detectedAt: new Date(),
        userId: this.getEffectiveUserId(),
        deviceId: this.deviceId
      }

      // Internal resolver is sufficient; avoid external API call to prevent unnecessary load

      // Resolve the conflict
      const resolution = await this.conflictResolver.resolveConflict(conflictRecord)
      
      if (resolution.requiresUserReview) {
        loggers.storage.warn(`Conflict requires user review: ${resolution.userReviewReason}`, {
          conflictId: conflictRecord.id,
          entityType: serverChange.entityType,
          entityId: serverChange.entityId
        })
        
        // Track conflicts requiring review but still proceed with sync
        // Return the server change as-is to mark it processed
        return serverChange
      }

      // Create resolved change record
      const resolvedChange = {
        ...serverChange,
        data: resolution.resolvedData,
        timestamp: resolution.timestamp
      } as ChangeRecord

      loggers.storage.info(`Conflict resolved using strategy: ${resolution.resolutionStrategy}`, {
        conflictId: conflictRecord.id,
        conflictsResolved: resolution.conflictsResolved.length,
        mergedFields: resolution.mergedFields.length,
        discardedFields: resolution.discardedFields.length
      })

      return resolvedChange
    } catch (error) {
      loggers.storage.error(`Failed to resolve conflict for ${serverChange.id}`, error)
      // Don't return null on error - this causes the change to be skipped
      // Instead, return the original server change to continue processing
      return serverChange
    }
  }

  /**
   * Apply a resolved change to local storage
   */
  private async applyResolvedChange(resolvedChange: ChangeRecord): Promise<void> {
    switch (resolvedChange.operation) {
      case 'create':
      case 'update':
        await this.applyServerChangeToLocal(resolvedChange)
        break
      case 'delete':
        await this.applyServerDeleteToLocal(resolvedChange)
        break
    }
  }

  /**
   * Get local entity data for conflict detection
   */
  private async getLocalEntityData(entityType: string, entityId: string): Promise<any | null> {
    try {
      switch (entityType) {
        case 'chat':
          return await this.localStorage.loadChatSession(entityId)
        case 'patient':
          return await this.localStorage.loadPatientRecord(entityId)
        case 'file':
          // Buscar archivo clínico por ID directamente usando el índice local
          try {
            const matches = await this.localStorage.find('clinical_files', { id: entityId })
            return (Array.isArray(matches) && matches.length > 0) ? matches[0] : null
          } catch (e) {
            // Fallback: algunos adaptadores solo exponen getClinicalFiles(sessionId)
            // En ausencia de sessionId, no podemos buscar confiablemente, devolvemos null
            return null
          }
        case 'analysis':
          // Buscar análisis por ID si el adaptador soporta consultas genéricas
          try {
            // Primero intenta por analysisId (esquema correcto)
            let matches = await this.localStorage.find('pattern_analyses', { analysisId: entityId })
            if (!Array.isArray(matches) || matches.length === 0) {
              // Fallback para esquemas heredados con 'id' como key
              matches = await this.localStorage.find('pattern_analyses', { id: entityId })
            }
            return (Array.isArray(matches) && matches.length > 0) ? matches[0] : null
          } catch {
            return null
          }
        default:
          loggers.storage.warn(`Unknown entity type for conflict detection: ${entityType}`)
          return null
      }
    } catch (error) {
      loggers.storage.error(`Failed to get local entity data for conflict detection`, {
        entityType,
        entityId,
        error
      })
      return null
    }
  }

  /**
   * Calculate checksum for data integrity verification
   */
  private async calculateDataChecksum(data: any): Promise<string> {
    // Simple checksum implementation - in production, use a proper cryptographic hash
    const dataString = JSON.stringify(data)
    let hash = 0
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return hash.toString(16)
  }

  /**
   * Determine if an operation should be retried
   */
  private shouldRetryOperation(error: any): boolean {
    // Retry on network errors, server errors (5xx), but not client errors (4xx)
    if (error?.status >= 500 || error?.code === 'NETWORK_ERROR') {
      return true
    }
    const msg = String(error?.message || '')
    if (/network|timeout|fetch failed|failed to fetch|ECONNRESET|ENETUNREACH/i.test(msg)) {
      return true
    }
    return false
  }

  /**
   * Queue operation for retry
   */
  private async queueOperationForRetry(change: ChangeRecord): Promise<void> {
    const pendingOp: PendingOperation = {
      id: change.id,
      type: change.operation,
      entityType: change.entityType,
      data: change.data,
      previousData: change.previousData,
      priority: this.calculateOperationPriority(change),
      attempts: 1,
      createdAt: new Date(),
      lastAttempt: new Date(),
      userId: change.userId,
      deviceId: change.deviceId,
      retryCount: 1,
      maxRetries: this.maxRetries
    }

    await this.syncQueue.addOperation(pendingOp)
    // Also add to local storage for persistence
    try {
      await this.localStorage.addPendingOperation(pendingOp)
    } catch (storageError) {
      // Ignore storage errors
    }
  }

  /**
   * Handle operation error with retry logic
   */
  private async handleOperationError(operation: PendingOperation, error: unknown): Promise<void> {
    if (this.shouldRetryOperation(error)) {
      loggers.storage.warn(`Operation ${operation.id} failed, queuing for retry`, error as Record<string, any>)
      // Convert PendingOperation to ChangeRecord for retry
      const changeRecord: ChangeRecord = {
        id: operation.id,
        operation: operation.type,
        entityType: operation.entityType,
        entityId: operation.data?.id || operation.id,
        timestamp: operation.createdAt,
        data: operation.data,
        previousData: operation.previousData,
        userId: operation.userId,
        deviceId: operation.deviceId,
        syncStatus: 'pending',
        version: 1
      }
      await this.queueOperationForRetry(changeRecord)
    } else {
      loggers.storage.error(`Operation ${operation.id} failed permanently`, error)
      await this.syncQueue.removeOperation(operation.id)
    }
  }

  /**
   * Handle local operation error with retry logic
   */
  private async handleLocalOperationError(operation: PendingOperation, error: any): Promise<void> {
    if (this.shouldRetryOperation(error)) {
      loggers.storage.warn(`Local operation ${operation.id} failed, keeping in pending operations`, error)
      // Operation remains in local storage for retry
    } else {
      loggers.storage.error(`Local operation ${operation.id} failed permanently`, error)
      await this.localStorage.markOperationComplete(operation.id)
    }
  }

  /**
   * Calculate priority for operation
   */
  private calculateOperationPriority(change: ChangeRecord): number {
    let priority = 1

    // Higher priority for user-initiated operations
    if (change.operation === 'create' || change.operation === 'update') {
      priority += 2
    }

    // Higher priority for clinical data
    if (change.entityType === 'patient' || change.entityType === 'analysis') {
      priority += 3
    }

    // Lower priority for operations that have been retried many times
    priority -= this.retryCount * 0.1

    // Ensure priority is within reasonable bounds
    return Math.max(0.1, Math.min(10, priority))
  }

  /**
   * Calculate checksum for sync verification
   */
  private async calculateChecksum(): Promise<string> {
    // Simple checksum based on data hashes
    // In a real implementation, this would be more sophisticated
    const timestamp = new Date().getTime()
    const random = Math.random().toString(36).substring(7)
    return `${timestamp}-${random}`
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): {
    isSyncing: boolean
    lastSyncTime?: Date
    retryCount: number
  } {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      retryCount: this.retryCount
    }
  }
}

/**
 * Export singleton instance
 */
export const syncOrchestrator = SyncOrchestrator.getInstance()
