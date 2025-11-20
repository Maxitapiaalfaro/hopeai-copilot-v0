/**
 * API Client Adapter
 * 
 * Implements the UnifiedStorageAdapter interface for remote backend storage.
 * Handles HTTP communication with the backend API for hybrid storage.
 * 
 * @module api-client-adapter
 */

import { 
  UnifiedStorageAdapter, 
  SyncMetadata, 
  ChangeRecord, 
  PendingOperation, 
  StorageStats, 
  StorageAdapterConfig 
} from './unified-storage-interface';
import type { ChatState, ClinicalFile, PatientRecord, PaginationOptions, PaginatedResponse } from '../../types/clinical-types';
import type { PatternAnalysisState } from '../pattern-analysis-storage';

interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}



export class APIClientAdapter implements UnifiedStorageAdapter {
  private baseURL: string
  private authToken: string
  private config: StorageAdapterConfig
  private userId: string = ''
  private deviceId: string
  private currentRequests = 0
  private maxConcurrent = 4
  private tokens = 20
  private maxTokens = 20
  private lastRefill = Date.now()
  private refillIntervalMs = 1000

  constructor(baseURL: string, authToken: string, config: StorageAdapterConfig) {
    this.baseURL = baseURL
    this.authToken = authToken
    this.config = config
    this.deviceId = this.generateDeviceId()
  }

  async initialize(userId: string): Promise<void> {
    this.userId = userId
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json',
      'X-Device-Id': this.deviceId
    }
    
    if (this.userId) {
      headers['X-User-Id'] = this.userId
    }
    
    return headers
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const options: RequestInit = {
      method,
      headers: this.getHeaders(),
      ...(body && { body: JSON.stringify(body) })
    }
    await this.acquire()
    try {
      let attempt = 0
      let delay = 100
      while (true) {
        try {
          const response = await fetch(url, options)
          if (!response.ok) {
            const errorText = await response.text()
            const err: any = new Error(`HTTP ${response.status}: ${errorText}`)
            err.status = response.status
            if (err.status === 429 || err.status >= 500) throw err
            throw err
          }
          const json = await response.json()
          if (json && typeof json === 'object' && 'success' in json) {
            const wrapped = json as APIResponse<T>
            if (!wrapped.success) {
              throw new Error(wrapped.error || 'API request failed')
            }
            return (wrapped.data !== undefined ? wrapped.data : (json as T))
          }
          return json as T
        } catch (error: any) {
          if (error && typeof error === 'object' && !('status' in error)) {
            error.code = error.code || 'NETWORK_ERROR'
          }
          const retriable = (error.status === 429 || (error.status >= 500)) || error.code === 'NETWORK_ERROR'
          if (!retriable || attempt >= 4) {
            console.error(`API request failed: ${method} ${endpoint}`, error)
            throw error
          }
          await new Promise(r => setTimeout(r, delay + Math.floor(Math.random() * 50)))
          attempt++
          delay = Math.min(delay * 2, 1600)
          continue
        }
      }
    } finally {
      this.release()
    }
  }

  // Chat session operations
  async saveChatSession(session: ChatState): Promise<void> {
    await this.makeRequest('/storage/chat-sessions', 'POST', session)
  }

  async loadChatSession(sessionId: string): Promise<ChatState | null> {
    try {
      return await this.makeRequest<ChatState>(`/storage/chat-sessions/${sessionId}`)
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      throw error
    }
  }

  async getUserSessions(options?: PaginationOptions): Promise<PaginatedResponse<ChatState>> {
    const params = new URLSearchParams()
    
    if (options?.pageSize) {
      params.append('pageSize', options.pageSize.toString())
    }
    
    if (options?.pageToken) {
      params.append('pageToken', options.pageToken)
    }

    const queryString = params.toString()
    const endpoint = `/storage/chat-sessions${queryString ? `?${queryString}` : ''}`
    
    return await this.makeRequest<PaginatedResponse<ChatState>>(endpoint)
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    await this.makeRequest(`/storage/chat-sessions/${sessionId}`, 'DELETE')
  }

  // Clinical file operations
  async saveClinicalFile(file: ClinicalFile): Promise<void> {
    await this.makeRequest('/storage/clinical-files', 'POST', file)
  }

  async getClinicalFiles(sessionId: string): Promise<ClinicalFile[]> {
    return await this.makeRequest<ClinicalFile[]>(`/storage/clinical-files?sessionId=${sessionId}`)
  }

  async deleteClinicalFile(fileId: string): Promise<void> {
    await this.makeRequest(`/storage/clinical-files/${fileId}`, 'DELETE')
  }

  // Patient record operations
  async savePatientRecord(patient: PatientRecord): Promise<void> {
    await this.makeRequest('/storage/patients', 'POST', patient)
  }

  async loadPatientRecord(patientId: string): Promise<PatientRecord | null> {
    try {
      return await this.makeRequest<PatientRecord>(`/storage/patients/${patientId}`)
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      throw error
    }
  }

  async getAllPatients(options?: PaginationOptions): Promise<PaginatedResponse<PatientRecord>> {
    const params = new URLSearchParams()
    
    if (options?.pageSize) {
      params.append('pageSize', options.pageSize.toString())
    }
    
    if (options?.pageToken) {
      params.append('pageToken', options.pageToken)
    }

    const queryString = params.toString()
    const endpoint = `/storage/patients${queryString ? `?${queryString}` : ''}`
    
    return await this.makeRequest<PaginatedResponse<PatientRecord>>(endpoint)
  }

  async deletePatientRecord(patientId: string): Promise<void> {
    await this.makeRequest(`/storage/patients/${patientId}`, 'DELETE')
  }

  // Pattern analysis operations
  async savePatternAnalysis(analysis: PatternAnalysisState): Promise<void> {
    await this.makeRequest('/storage/pattern-analyses', 'POST', analysis)
  }

  async getPatternAnalyses(patientId: string): Promise<PatternAnalysisState[]> {
    return await this.makeRequest<PatternAnalysisState[]>(`/storage/pattern-analyses?patientId=${patientId}`)
  }

  // Sync metadata operations
  async getSyncMetadata(): Promise<SyncMetadata | null> {
    try {
      const raw = await this.makeRequest<any>('/storage/sync-metadata')
      const meta = raw?.data ?? raw
      if (!meta) return null

      const toDate = (v: any) => (v ? new Date(v) : undefined)

      return {
        lastSyncAt: toDate(meta.lastSyncAt) || new Date(0),
        lastLocalUpdate: toDate(meta.lastLocalUpdate) || toDate(meta.lastSyncAt) || new Date(0),
        lastServerUpdate: toDate(meta.lastServerUpdate) || toDate(meta.lastSyncAt) || new Date(0),
        syncVersion: Number(meta.syncVersion ?? 0),
        checksum: String(meta.checksum ?? ''),
        deviceId: String(meta.deviceId ?? this.deviceId),
        userId: String(meta.userId ?? this.userId),
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      throw error
    }
  }

  async updateSyncMetadata(metadata: SyncMetadata): Promise<void> {
    await this.makeRequest('/storage/sync-metadata', 'PUT', metadata)
  }

  // Offline operations (not applicable for remote storage)
  async getPendingOperations(): Promise<PendingOperation[]> {
    // Remote storage doesn't have pending operations
    return []
  }

  async markOperationComplete(operationId: string): Promise<void> {
    // Not applicable for remote storage
  }

  async addPendingOperation(operation: PendingOperation): Promise<void> {
    // Not applicable for remote storage
    throw new Error('Pending operations are not supported in remote storage')
  }

  // Change tracking
  async getChangesSince(since: Date): Promise<ChangeRecord[]> {
    const isoDate = since.toISOString()
    return await this.makeRequest<ChangeRecord[]>(`/storage/changes?since=${isoDate}`)
  }

  async markChangesSynced(changeIds: string[]): Promise<void> {
    await this.makeRequest('/storage/changes/mark-synced', 'POST', { changeIds })
  }

  async pushChanges(changes: ChangeRecord[]): Promise<{ processedChangeIds: string[]; conflicts: any[]; raw?: any }> {
    // Map local entity types to server entity types
    const mapEntityType = (t: ChangeRecord['entityType']): 'patient' | 'session' | 'file' => {
      if (t === 'chat') return 'session'
      if (t === 'patient') return 'patient'
      if (t === 'file') return 'file'
      // 'analysis' not supported by push endpoint yet; skip
      return 'file'
    }

    // Build server payload changes
    const payloadChanges = changes
      .filter(c => c.entityType !== 'analysis')
      .map(c => {
        const entityType = mapEntityType(c.entityType)
        const timestamp = c.timestamp instanceof Date ? c.timestamp.toISOString() : c.timestamp
        let mappedChanges: any = {}

        if (entityType === 'patient') {
          const p = c.data || {}
          mappedChanges = {
            displayName: p.displayName,
            demographics: p.demographics,
            tags: p.tags,
            notes: p.notes,
            attachments: p.attachments,
            summaryCache: p.summaryCache,
            confidentiality: p.confidentiality,
          }
        } else if (entityType === 'session') {
          const s = c.data || {}
          mappedChanges = {
            patientId: s?.clinicalContext?.patientId,
            date: s?.metadata?.createdAt || c.timestamp,
            duration: (s?.metadata?.sessionDuration as number) || 50,
            type: s?.clinicalContext?.sessionType || 'individual',
            notes: '',
            nextAppointment: undefined,
            billingCode: undefined,
          }
        } else if (entityType === 'file') {
          const f = c.data || {}
          mappedChanges = {
            patientId: f?.patientId,
            sessionId: f?.sessionId,
            fileName: f?.name,
            originalName: f?.name,
            mimeType: f?.type,
            size: f?.size || 0,
            checksum: f?.checksum || '',
            encryptionMetadata: f?.encryptionMetadata,
            metadata: {
              status: f?.status,
              summary: f?.summary,
              outline: f?.outline,
              keywords: f?.keywords,
            },
          }
        }

        return {
          entityType,
          entityId: c.entityId,
          operation: c.operation,
          timestamp,
          changes: mappedChanges,
          previousValues: c.previousData || {},
          newValues: c.data || {},
        }
      })

    const rawResponse = await this.makeRequest<any>('/sync/push', 'POST', {
      deviceId: this.deviceId,
      changes: payloadChanges,
    })

    const processed: any[] = rawResponse?.changes || []
    const conflicts: any[] = rawResponse?.conflictsList || []

    // Match processed changes back to local ChangeRecord IDs
    const processedChangeIds: string[] = []
    const unmatched = new Set(changes.filter(c => c.entityType !== 'analysis').map(c => c.id))

    for (const pc of processed) {
      const matchIdx = changes.findIndex(c => {
        const remoteType = mapEntityType(c.entityType)
        return (
          c.operation === pc.operation &&
          c.entityId === pc.entityId &&
          remoteType === pc.entityType &&
          c.entityType !== 'analysis' &&
          unmatched.has(c.id)
        )
      })
      if (matchIdx >= 0) {
        const localId = changes[matchIdx].id
        processedChangeIds.push(localId)
        unmatched.delete(localId)
      }
    }

    return { processedChangeIds, conflicts, raw: rawResponse }
  }

  // Generic create operation
  async create(entityType: string, data: any): Promise<void> {
    const endpointMap: Record<string, string> = {
      'chat-session': '/storage/chat-sessions',
      'clinical-file': '/storage/clinical-files',
      'patient': '/storage/patients',
      'pattern-analysis': '/storage/pattern-analyses',
      'ficha-clinica': '/storage/fichas-clinicas',
      'user-preferences': '/storage/user-preferences'
    }
    const endpoint = endpointMap[entityType]
    if (!endpoint) {
      throw new Error(`Unsupported entity type: ${entityType}`)
    }
    await this.makeRequest(endpoint, 'POST', data)
  }

  // Utility operations
  async clearAllData(): Promise<void> {
    await this.makeRequest('/storage/clear-all', 'DELETE')
  }

  async getStorageStats(): Promise<StorageStats> {
    return await this.makeRequest<StorageStats>('/storage/stats')
  }

  // Helper methods
  private generateDeviceId(): string {
    return `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
  private refillTokens() {
    const now = Date.now()
    const elapsed = now - this.lastRefill
    if (elapsed >= this.refillIntervalMs) {
      const add = Math.floor(elapsed / this.refillIntervalMs)
      this.tokens = Math.min(this.maxTokens, this.tokens + add)
      this.lastRefill = now
    }
  }
  private async acquire(): Promise<void> {
    while (true) {
      this.refillTokens()
      if (this.currentRequests < this.maxConcurrent && this.tokens > 0) {
        this.currentRequests++
        this.tokens--
        return
      }
      await new Promise(r => setTimeout(r, 50))
    }
  }
  private release(): void {
    this.currentRequests = Math.max(0, this.currentRequests - 1)
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/health`, {
        method: 'GET',
        headers: this.getHeaders()
      })
      return response.ok
    } catch (error) {
      console.error('Health check failed:', error)
      return false
    }
  }

  // Batch operations for efficiency
  async batchSaveChatSessions(sessions: ChatState[]): Promise<void> {
    await this.makeRequest('/storage/chat-sessions/batch', 'POST', { sessions })
  }

  async batchSavePatients(patients: PatientRecord[]): Promise<void> {
    await this.makeRequest('/storage/patients/batch', 'POST', { patients })
  }

  async batchSaveClinicalFiles(files: ClinicalFile[]): Promise<void> {
    await this.makeRequest('/storage/clinical-files/batch', 'POST', { files })
  }

  // Conflict resolution
  async resolveConflict(
    conflictId: string,
    resolution: 'local' | 'remote' | 'merge',
    resolvedValue?: Record<string, any>,
    resolutionNotes?: string
  ): Promise<void> {
    const strategyMap: Record<string, string> = {
      local: 'use_local',
      remote: 'use_server',
      merge: 'merge'
    }
    await this.makeRequest('/sync/conflicts', 'POST', {
      conflictId,
      resolutionStrategy: strategyMap[resolution] || 'merge',
      resolvedValue,
      resolutionNotes
    })
  }

  // Get conflict information
  async getConflicts(): Promise<ChangeRecord[]> {
    return await this.makeRequest<ChangeRecord[]>('/storage/conflicts')
  }
}
