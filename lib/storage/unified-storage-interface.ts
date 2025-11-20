/**
 * Unified Storage Interface
 * 
 * Provides a consistent API for both local IndexedDB and remote backend storage.
 * This interface abstracts storage operations to enable seamless hybrid storage
 * with offline-first capabilities and background synchronization.
 * 
 * @module unified-storage-interface
 */

import type {
  ChatState,
  ClinicalFile,
  PatientRecord,
  PaginationOptions,
  PaginatedResponse,
} from "../../types/clinical-types";
import type { PatternAnalysisState } from "../pattern-analysis-storage";

/**
 * Sync metadata for tracking changes and synchronization state
 */
export interface SyncMetadata {
  lastSyncAt: Date
  lastLocalUpdate: Date
  lastServerUpdate: Date
  syncVersion: number
  checksum: string
  deviceId: string
  userId: string
}

/**
 * Change record for tracking operations
 */
export interface ChangeRecord {
  id: string
  operation: 'create' | 'update' | 'delete'
  entityType: 'chat' | 'patient' | 'file' | 'analysis'
  entityId: string
  timestamp: Date
  data: any
  previousData?: any
  userId: string
  deviceId: string
  syncStatus: 'pending' | 'synced' | 'conflict'
  version: number
}

/**
 * Pending operation for offline queue
 */
export interface PendingOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  entityType: 'chat' | 'patient' | 'file' | 'analysis'
  data: any
  previousData?: any
  priority: number
  attempts: number
  createdAt: Date
  lastAttempt?: Date
  userId: string
  deviceId: string
  retryCount: number
  maxRetries: number
}

/**
 * Encrypted data wrapper
 */
export interface EncryptedData {
  data: string
  iv: string
  salt: string
  tag: string
  algorithm: string
}

/**
 * Unified Storage Adapter Interface
 * 
 * Provides a consistent API for storage operations across different backends
 */
export interface UnifiedStorageAdapter {
  // User operations
  initialize(userId: string): Promise<void>
  
  // Chat sessions
  saveChatSession(session: ChatState): Promise<void>
  loadChatSession(sessionId: string): Promise<ChatState | null>
  getUserSessions(options?: PaginationOptions): Promise<PaginatedResponse<ChatState>>
  deleteChatSession(sessionId: string): Promise<void>
  
  // Clinical files
  saveClinicalFile(file: ClinicalFile): Promise<void>
  getClinicalFiles(sessionId: string): Promise<ClinicalFile[]>
  deleteClinicalFile(fileId: string): Promise<void>
  
  // Patient records
  savePatientRecord(patient: PatientRecord): Promise<void>
  loadPatientRecord(patientId: string): Promise<PatientRecord | null>
  getAllPatients(options?: PaginationOptions): Promise<PaginatedResponse<PatientRecord>>
  deletePatientRecord(patientId: string): Promise<void>
  
  // Pattern analyses
  savePatternAnalysis(analysis: PatternAnalysisState): Promise<void>
  getPatternAnalyses(patientId: string): Promise<PatternAnalysisState[]>
  
  // Sync metadata
  getSyncMetadata(): Promise<SyncMetadata | null>
  updateSyncMetadata(metadata: SyncMetadata): Promise<void>
  
  // Offline operations
  getPendingOperations(): Promise<PendingOperation[]>
  markOperationComplete(operationId: string): Promise<void>
  addPendingOperation(operation: PendingOperation): Promise<void>
  
  // Change tracking
  getChangesSince(since: Date): Promise<ChangeRecord[]>
  markChangesSynced(changeIds: string[]): Promise<void>
  pushChanges(changes: ChangeRecord[]): Promise<PushChangesResult>
  
  // Generic operations
  create(entityType: string, data: any): Promise<void>
  
  // Utility operations
  clearAllData(): Promise<void>
  getStorageStats(): Promise<StorageStats>
}

/**
 * Storage statistics
 */
export interface StorageStats {
  totalSize: number
  entityCounts: {
    chats: number
    patients: number
    files: number
    analyses: number
  }
  lastSyncAt?: Date
  pendingOperations: number
  isEncrypted: boolean
}

/**
 * Storage operation result
 */
export interface StorageOperationResult<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp: Date
  operationId: string
}
/**
 * Result of a batch push operation to the server
 */
export interface PushChangesResult {
  processedChangeIds: string[]
  conflicts: any[]
  raw?: any
}

/**
 * Storage adapter configuration
 */
export interface StorageAdapterConfig {
  enableEncryption: boolean
  maxRetryAttempts: number
  syncInterval: number
  offlineTimeout: number
  encryptionKey?: CryptoKey
}