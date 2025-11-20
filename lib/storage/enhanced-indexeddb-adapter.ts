/**
 * Enhanced IndexedDB Adapter
 * 
 * Implements the UnifiedStorageAdapter interface for local IndexedDB storage.
 * Provides encryption, change tracking, and offline capabilities.
 * 
 * @module enhanced-indexeddb-adapter
 */

import { 
  UnifiedStorageAdapter, 
  SyncMetadata, 
  ChangeRecord, 
  PendingOperation, 
  EncryptedData, 
  StorageStats, 
  StorageOperationResult,
  StorageAdapterConfig 
} from './unified-storage-interface';
import type { ChatState, ClinicalFile, PatientRecord, PaginationOptions, PaginatedResponse } from '../../types/clinical-types';
import type { PatternAnalysisState } from '../pattern-analysis-storage';

const DB_NAME = 'hopeai_clinical_db';
const DB_VERSION = 9; // Incremented for migration stores

interface DatabaseSchema {
  chat_sessions: ChatState
  clinical_files: ClinicalFile
  patient_records: PatientRecord
  pattern_analyses: PatternAnalysisState
  sync_metadata: SyncMetadata
  change_records: ChangeRecord
  pending_operations: PendingOperation
  encrypted_data: EncryptedData
}

export class EnhancedIndexedDBAdapter implements UnifiedStorageAdapter {
  private db: IDBDatabase | null = null
  private config: StorageAdapterConfig
  private userId: string = ''
  private deviceId: string = ''

  constructor(config: StorageAdapterConfig) {
    this.config = config
    this.deviceId = this.generateDeviceId()
  }

  async initialize(userId: string): Promise<void> {
    this.userId = userId
    this.db = await this.openDatabase()
  }

  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)

      request.onupgradeneeded = (event) => {
        const openReq = (event.target as IDBOpenDBRequest)
        const db = openReq.result
        const upgradeTx = openReq.transaction as IDBTransaction

        // Existing stores
        if (!db.objectStoreNames.contains('chat_sessions')) {
          db.createObjectStore('chat_sessions', { keyPath: 'sessionId' })
        }

        if (!db.objectStoreNames.contains('clinical_files')) {
          const fileStore = db.createObjectStore('clinical_files', { keyPath: 'id' })
          fileStore.createIndex('sessionId', 'sessionId', { unique: false })
        }

        // New stores for unified interface
        if (!db.objectStoreNames.contains('patient_records')) {
          db.createObjectStore('patient_records', { keyPath: 'id' })
        }

        // Ensure pattern_analyses uses 'analysisId' as keyPath
        if (!db.objectStoreNames.contains('pattern_analyses')) {
          const analysisStore = db.createObjectStore('pattern_analyses', { keyPath: 'analysisId' })
          analysisStore.createIndex('patientId', 'patientId', { unique: false })
          analysisStore.createIndex('status', 'status', { unique: false })
          analysisStore.createIndex('createdAt', 'createdAt', { unique: false })
        } else {
          try {
            const existingStore = upgradeTx.objectStore('pattern_analyses')
            const keyPath = existingStore.keyPath as string | string[] | null
            if (keyPath !== 'analysisId') {
              // Migrate store to use 'analysisId' as keyPath without data loss
              const tempStoreName = 'pattern_analyses_temp'
              if (db.objectStoreNames.contains(tempStoreName)) {
                db.deleteObjectStore(tempStoreName)
              }
              const tempStore = db.createObjectStore(tempStoreName, { keyPath: 'analysisId' })
              tempStore.createIndex('patientId', 'patientId', { unique: false })
              tempStore.createIndex('status', 'status', { unique: false })
              tempStore.createIndex('createdAt', 'createdAt', { unique: false })

              const getAllReq = existingStore.getAll()
              getAllReq.onsuccess = () => {
                const records = (getAllReq.result || []) as any[]
                records.forEach(rec => {
                  if (rec && !rec.analysisId && rec.id) {
                    rec.analysisId = rec.id
                  }
                  try {
                    tempStore.put(rec)
                  } catch (e) {
                    // Ignore individual record failures during migration
                  }
                })

                // Recreate main store with correct keyPath
                db.deleteObjectStore('pattern_analyses')
                const newStore = db.createObjectStore('pattern_analyses', { keyPath: 'analysisId' })
                newStore.createIndex('patientId', 'patientId', { unique: false })
                newStore.createIndex('status', 'status', { unique: false })
                newStore.createIndex('createdAt', 'createdAt', { unique: false })

                // Copy back from temp
                const tempGetAllReq = (upgradeTx.objectStore(tempStoreName) as IDBObjectStore).getAll()
                tempGetAllReq.onsuccess = () => {
                  const tempRecords = (tempGetAllReq.result || []) as any[]
                  tempRecords.forEach(r => {
                    try {
                      newStore.put(r)
                    } catch (e) {
                      // Ignore individual record failures
                    }
                  })
                  // Cleanup temp store
                  db.deleteObjectStore(tempStoreName)
                }
                tempGetAllReq.onerror = () => {
                  // Even if reading temp fails, attempt to cleanup
                  try { db.deleteObjectStore(tempStoreName) } catch {}
                }
              }
              getAllReq.onerror = () => {
                // If we cannot read existing records, fallback to recreating the store
                try {
                  db.deleteObjectStore('pattern_analyses')
                } catch {}
                const newStore = db.createObjectStore('pattern_analyses', { keyPath: 'analysisId' })
                newStore.createIndex('patientId', 'patientId', { unique: false })
                newStore.createIndex('status', 'status', { unique: false })
                newStore.createIndex('createdAt', 'createdAt', { unique: false })
              }
            }
          } catch (e) {
            // If any error occurs while inspecting/migrating, ensure store exists with desired keyPath for fresh setups
            try {
              db.deleteObjectStore('pattern_analyses')
            } catch {}
            const analysisStore = db.createObjectStore('pattern_analyses', { keyPath: 'analysisId' })
            analysisStore.createIndex('patientId', 'patientId', { unique: false })
            analysisStore.createIndex('status', 'status', { unique: false })
            analysisStore.createIndex('createdAt', 'createdAt', { unique: false })
          }
        }

        // Sync and change tracking stores
        if (!db.objectStoreNames.contains('sync_metadata')) {
          db.createObjectStore('sync_metadata', { keyPath: 'userId' })
        }

        if (!db.objectStoreNames.contains('change_records')) {
          const changeStore = db.createObjectStore('change_records', { keyPath: 'id' })
          changeStore.createIndex('entityType', 'entityType', { unique: false })
          changeStore.createIndex('timestamp', 'timestamp', { unique: false })
          changeStore.createIndex('userId', 'userId', { unique: false })
          changeStore.createIndex('syncStatus', 'syncStatus', { unique: false })
        }

        if (!db.objectStoreNames.contains('pending_operations')) {
          const pendingStore = db.createObjectStore('pending_operations', { keyPath: 'id' })
          pendingStore.createIndex('userId', 'userId', { unique: false })
          pendingStore.createIndex('createdAt', 'createdAt', { unique: false })
          pendingStore.createIndex('priority', 'priority', { unique: false })
        }

        if (!db.objectStoreNames.contains('encrypted_data')) {
          db.createObjectStore('encrypted_data', { keyPath: 'id' })
        }

        // Migration system stores
        if (!db.objectStoreNames.contains('migration_backups')) {
          db.createObjectStore('migration_backups', { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains('migration_status')) {
          db.createObjectStore('migration_status', { keyPath: 'userId' })
        }

        if (!db.objectStoreNames.contains('migration_queue')) {
          const queueStore = db.createObjectStore('migration_queue', { keyPath: 'userId' })
          queueStore.createIndex('priority', 'priority', { unique: false })
          queueStore.createIndex('createdAt', 'createdAt', { unique: false })
        }

        if (!db.objectStoreNames.contains('migration_history')) {
          const historyStore = db.createObjectStore('migration_history', { keyPath: 'id' })
          historyStore.createIndex('userId', 'userId', { unique: false })
          historyStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  // Chat session operations
  async saveChatSession(session: ChatState): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(['chat_sessions', 'change_records'], 'readwrite')
    const sessionStore = transaction.objectStore('chat_sessions')
    const changeStore = transaction.objectStore('change_records')

    // Check if this is a new session or an update
    const existingSession = await new Promise<ChatState | null>((resolve, reject) => {
      const request = sessionStore.get(session.sessionId)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })

    const operation = existingSession ? 'update' : 'create'

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = sessionStore.put(session)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }),
      this.recordChange('chat', session.sessionId, operation, session, changeStore)
    ])
  }

  async loadChatSession(sessionId: string): Promise<ChatState | null> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(['chat_sessions'], 'readonly')
    const store = transaction.objectStore('chat_sessions')

    return new Promise((resolve, reject) => {
      const request = store.get(sessionId)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async getUserSessions(options?: PaginationOptions): Promise<PaginatedResponse<ChatState>> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(['chat_sessions'], 'readonly')
    const store = transaction.objectStore('chat_sessions')

    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => {
        const sessions = request.result
        const pageSize = options?.pageSize || 50
        const pageToken = options?.pageToken

        let startIndex = 0
        if (pageToken) {
          try {
            const decodedToken = JSON.parse(atob(pageToken))
            startIndex = decodedToken.offset || 0
          } catch (error) {
            console.warn('Invalid page token, starting from beginning')
          }
        }

        const endIndex = startIndex + pageSize
        const paginatedSessions = sessions.slice(startIndex, endIndex)
        const hasNextPage = endIndex < sessions.length

        let nextPageToken: string | undefined
        if (hasNextPage) {
          nextPageToken = btoa(JSON.stringify({ offset: endIndex }))
        }

        resolve({
          items: paginatedSessions,
          nextPageToken,
          totalCount: sessions.length,
          hasNextPage
        })
      }
      request.onerror = () => reject(request.error)
    })
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(['chat_sessions', 'change_records'], 'readwrite')
    const sessionStore = transaction.objectStore('chat_sessions')
    const changeStore = transaction.objectStore('change_records')

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = sessionStore.delete(sessionId)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }),
      this.recordChange('chat', sessionId, 'delete', null, changeStore)
    ])
  }

  // Clinical file operations
  async saveClinicalFile(file: ClinicalFile): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(['clinical_files', 'change_records'], 'readwrite')
    const fileStore = transaction.objectStore('clinical_files')
    const changeStore = transaction.objectStore('change_records')

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = fileStore.put(file)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }),
      this.recordChange('file', file.id, 'update', file, changeStore)
    ])
  }

  async getClinicalFiles(sessionId: string): Promise<ClinicalFile[]> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(['clinical_files'], 'readonly')
    const store = transaction.objectStore('clinical_files')
    const index = store.index('sessionId')

    return new Promise((resolve, reject) => {
      const request = index.getAll(sessionId)
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  async deleteClinicalFile(fileId: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(['clinical_files', 'change_records'], 'readwrite')
    const fileStore = transaction.objectStore('clinical_files')
    const changeStore = transaction.objectStore('change_records')

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = fileStore.delete(fileId)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }),
      this.recordChange('file', fileId, 'delete', null, changeStore)
    ])
  }

  // Patient record operations
  async savePatientRecord(patient: PatientRecord): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(['patient_records', 'change_records'], 'readwrite')
    const patientStore = transaction.objectStore('patient_records')
    const changeStore = transaction.objectStore('change_records')

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = patientStore.put(patient)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }),
      this.recordChange('patient', patient.id, 'update', patient, changeStore)
    ])
  }

  async loadPatientRecord(patientId: string): Promise<PatientRecord | null> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(['patient_records'], 'readonly')
    const store = transaction.objectStore('patient_records')

    return new Promise((resolve, reject) => {
      const request = store.get(patientId)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async getAllPatients(options?: PaginationOptions): Promise<PaginatedResponse<PatientRecord>> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(['patient_records'], 'readonly')
    const store = transaction.objectStore('patient_records')

    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => {
        const patients = request.result
        const pageSize = options?.pageSize || 50
        const pageToken = options?.pageToken

        let startIndex = 0
        if (pageToken) {
          try {
            const decodedToken = JSON.parse(atob(pageToken))
            startIndex = decodedToken.offset || 0
          } catch (error) {
            console.warn('Invalid page token, starting from beginning')
          }
        }

        const endIndex = startIndex + pageSize
        const paginatedPatients = patients.slice(startIndex, endIndex)
        const hasNextPage = endIndex < patients.length

        let nextPageToken: string | undefined
        if (hasNextPage) {
          nextPageToken = btoa(JSON.stringify({ offset: endIndex }))
        }

        resolve({
          items: paginatedPatients,
          nextPageToken,
          totalCount: patients.length,
          hasNextPage
        })
      }
      request.onerror = () => reject(request.error)
    })
  }

  async deletePatientRecord(patientId: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(['patient_records', 'change_records'], 'readwrite')
    const patientStore = transaction.objectStore('patient_records')
    const changeStore = transaction.objectStore('change_records')

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = patientStore.delete(patientId)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }),
      this.recordChange('patient', patientId, 'delete', null, changeStore)
    ])
  }

  // Pattern analysis operations
  async savePatternAnalysis(analysis: PatternAnalysisState): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(['pattern_analyses', 'change_records'], 'readwrite')
    const analysisStore = transaction.objectStore('pattern_analyses')
    const changeStore = transaction.objectStore('change_records')
    const keyPath = analysisStore.keyPath as string | string[] | null

    // Normalize record according to store keyPath for backward compatibility
    const toSave = (() => {
      if (keyPath === 'id') {
        // Legacy store expecting 'id' as key
        return { id: (analysis as any).id || analysis.analysisId, ...analysis }
      }
      // Preferred store expects 'analysisId'
      return analysis
    })()

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = analysisStore.put(toSave)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }),
      this.recordChange('analysis', analysis.analysisId, 'update', analysis, changeStore)
    ])
  }

  async getPatternAnalyses(patientId: string): Promise<PatternAnalysisState[]> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(['pattern_analyses'], 'readonly')
    const store = transaction.objectStore('pattern_analyses')
    const index = store.index('patientId')

    return new Promise((resolve, reject) => {
      const request = index.getAll(patientId)
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  // Sync metadata operations
  async getSyncMetadata(): Promise<SyncMetadata | null> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(['sync_metadata'], 'readonly')
    const store = transaction.objectStore('sync_metadata')

    return new Promise((resolve, reject) => {
      const request = store.get(this.userId)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async updateSyncMetadata(metadata: SyncMetadata): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(['sync_metadata'], 'readwrite')
    const store = transaction.objectStore('sync_metadata')

    return new Promise((resolve, reject) => {
      const request = store.put(metadata)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Pending operations
  async getPendingOperations(): Promise<PendingOperation[]> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(['pending_operations'], 'readonly')
    const store = transaction.objectStore('pending_operations')
    const index = store.index('userId')

    return new Promise((resolve, reject) => {
      const request = index.getAll(this.userId)
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  async markOperationComplete(operationId: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(['pending_operations'], 'readwrite')
    const store = transaction.objectStore('pending_operations')

    return new Promise((resolve, reject) => {
      const request = store.delete(operationId)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async addPendingOperation(operation: PendingOperation): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(['pending_operations'], 'readwrite')
    const store = transaction.objectStore('pending_operations')

    return new Promise((resolve, reject) => {
      const request = store.put(operation)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Change tracking
  async getChangesSince(since: Date): Promise<ChangeRecord[]> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(['change_records'], 'readonly')
    const store = transaction.objectStore('change_records')
    const index = store.index('userId')

    return new Promise((resolve, reject) => {
      const request = index.getAll(this.userId)
      request.onsuccess = () => {
        const allChanges = request.result || []
        const recentChanges = allChanges.filter(change => 
          new Date(change.timestamp) >= since
        )
        resolve(recentChanges)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async markChangesSynced(changeIds: string[]): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(['change_records'], 'readwrite')
    const store = transaction.objectStore('change_records')

    await Promise.all(changeIds.map(changeId => 
      new Promise<void>((resolve, reject) => {
        const request = store.get(changeId)
        request.onsuccess = () => {
          const change = request.result
          if (change) {
            change.syncStatus = 'synced'
            const updateRequest = store.put(change)
            updateRequest.onsuccess = () => resolve()
            updateRequest.onerror = () => reject(updateRequest.error)
          } else {
            resolve()
          }
        }
        request.onerror = () => reject(request.error)
      })
    ))
  }

  async pushChanges(changes: ChangeRecord[]): Promise<{ processedChangeIds: string[]; conflicts: any[]; raw?: any }> {
    // Local adapter does not push to server; return as if processed
    const processedChangeIds = changes.map(c => c.id)
    return { processedChangeIds, conflicts: [], raw: { localAdapter: true } }
  }

  // Utility operations
  async clearAllData(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")

    const storeNames = [
      'chat_sessions',
      'clinical_files',
      'patient_records',
      'pattern_analyses',
      'change_records',
      'pending_operations'
    ]

    const transaction = this.db.transaction(storeNames, 'readwrite')

    await Promise.all(storeNames.map(storeName => 
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore(storeName).clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    ))
  }

  async getStorageStats(): Promise<StorageStats> {
    if (!this.db) throw new Error("Database not initialized")

    const storeNames = [
      'chat_sessions',
      'clinical_files',
      'patient_records',
      'pattern_analyses'
    ]

    const counts = await Promise.all(
      storeNames.map(storeName => 
        new Promise<number>((resolve, reject) => {
          const transaction = this.db!.transaction([storeName], 'readonly')
          const store = transaction.objectStore(storeName)
          const request = store.count()
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
      )
    )

    const pendingOps = await this.getPendingOperations()
    const syncMetadata = await this.getSyncMetadata()

    return {
      totalSize: 0, // Would need to calculate actual size
      entityCounts: {
        chats: counts[0],
        files: counts[1],
        patients: counts[2],
        analyses: counts[3]
      },
      lastSyncAt: syncMetadata?.lastSyncAt,
      pendingOperations: pendingOps.length,
      isEncrypted: this.config.enableEncryption
    }
  }

  // Helper methods
  private async recordChange(
    entityType: string,
    entityId: string,
    operation: 'create' | 'update' | 'delete',
    data: any,
    changeStore: IDBObjectStore
  ): Promise<void> {
    const change: ChangeRecord = {
      id: this.generateId(),
      operation,
      entityType: entityType as any,
      entityId,
      timestamp: new Date(),
      data,
      userId: this.userId,
      deviceId: this.deviceId,
      syncStatus: 'pending',
      version: 1
    }

    return new Promise((resolve, reject) => {
      const request = changeStore.put(change)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private generateDeviceId(): string {
    return `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // Generic methods for migration system
  async find(storeName: string, query: any): Promise<any[]> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction([storeName], 'readonly')
    const store = transaction.objectStore(storeName)

    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => {
        const allData = request.result || []
        // Simple query filtering (can be enhanced)
        const filteredData = Object.keys(query).length > 0 
          ? allData.filter(item => {
              return Object.entries(query).every(([key, value]) => item[key] === value)
            })
          : allData
        resolve(filteredData)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async createInStore(storeName: string, data: any): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction([storeName], 'readwrite')
    const store = transaction.objectStore(storeName)

    return new Promise((resolve, reject) => {
      const request = store.add(data)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

   async create(entityType: string, data: any): Promise<void> {
     const storeName = this.getStoreNameForEntityType(entityType)
     return this.createInStore(storeName, data)
   }

  private getStoreNameForEntityType(entityType: string): string {
    const entityMap: Record<string, string> = {
      'chat-session': 'chat_sessions',
      'clinical-file': 'clinical_files',
      'patient-record': 'patient_records',
      'pattern-analysis': 'pattern_analyses',
      'change-record': 'change_records',
      'sync-metadata': 'sync_metadata',
      'pending-operation': 'pending_operations',
      // Additional stores used by migration and encryption flows
      'encrypted-data': 'encrypted_data',
      'migration-backup': 'migration_backups',
      'migration-status': 'migration_status',
      'migration-queue': 'migration_queue',
      'migration-history': 'migration_history'
    }
    
    // If a canonical entity type is provided, map to its store name
    const mapped = entityMap[entityType]
    if (mapped) return mapped

    // Allow direct store names for flexibility (e.g., 'migration_status')
    const allowedStoreNames = new Set([
      'chat_sessions',
      'clinical_files',
      'patient_records',
      'pattern_analyses',
      'change_records',
      'sync_metadata',
      'pending_operations',
      'encrypted_data',
      'migration_backups',
      'migration_status',
      'migration_queue',
      'migration_history',
    ])

    if (allowedStoreNames.has(entityType)) return entityType

    throw new Error(`Unknown entity type or store name: ${entityType}`)
  }

  async update(storeName: string, data: any, query?: any): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction([storeName], 'readwrite')
    const store = transaction.objectStore(storeName)

    return new Promise((resolve, reject) => {
      if (query && Object.keys(query).length > 0) {
        // Update specific records based on query
        const getAllRequest = store.getAll()
        getAllRequest.onsuccess = () => {
          const allData = getAllRequest.result || []
          const toUpdate = allData.filter(item => {
            return Object.entries(query).every(([key, value]) => item[key] === value)
          })

          Promise.all(
            toUpdate.map(item => {
              const updatedItem = { ...item, ...data }
              return new Promise<void>((resolveUpdate, rejectUpdate) => {
                const updateRequest = store.put(updatedItem)
                updateRequest.onsuccess = () => resolveUpdate()
                updateRequest.onerror = () => rejectUpdate(updateRequest.error)
              })
            })
          ).then(() => resolve()).catch(reject)
        }
        getAllRequest.onerror = () => reject(getAllRequest.error)
      } else {
        // Update single record (assume data has the key)
        const request = store.put(data)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }
    })
  }

  async delete(storeName: string, query: any): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction([storeName], 'readwrite')
    const store = transaction.objectStore(storeName)

    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => {
        const allData = request.result || []
        const toDelete = Object.keys(query).length > 0 
          ? allData.filter(item => {
              return Object.entries(query).every(([key, value]) => item[key] === value)
            })
          : allData

        Promise.all(
          toDelete.map(item => 
            new Promise<void>((resolveDelete, rejectDelete) => {
              const deleteRequest = store.delete(item[store.keyPath as string])
              deleteRequest.onsuccess = () => resolveDelete()
              deleteRequest.onerror = () => rejectDelete(deleteRequest.error)
            })
          )
        ).then(() => resolve()).catch(reject)
      }
      request.onerror = () => reject(request.error)
    })
  }
}