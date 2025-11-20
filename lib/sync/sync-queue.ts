/**
 * Sync Queue - Manages pending operations and retry logic
 * 
 * This queue handles operations that failed to sync and need to be retried,
 * with priority management and exponential backoff.
 */

import { PendingOperation } from '@/lib/storage/unified-storage-interface'
import { loggers } from '@/lib/logger'

export class SyncQueue {
  private queue: PendingOperation[] = []
  private processing = false
  private maxRetries = 3
  private backoffMultiplier = 2
  private baseDelayMs = 1000
  private maxDelayMs = 30000
  private storageKey = 'aurora_sync_queue'

  constructor() {
    // Avoid accessing localStorage during SSR or non-browser environments
    if (this.isBrowser()) {
      this.loadQueue()
    } else {
      // Initialize with empty queue on server to prevent ReferenceError
      this.queue = []
      try {
        loggers.storage.debug('SyncQueue initialized without localStorage (SSR/non-browser)')
      } catch {}
    }
  }

  /**
   * Add operation to queue
   */
  async addOperation(operation: PendingOperation): Promise<void> {
    try {
      // Generate unique ID if not present
      if (!operation.id) {
        operation.id = this.generateOperationId()
      }

      // Set default values
      operation.attempts = operation.attempts || 0
      operation.createdAt = operation.createdAt || new Date()
      operation.priority = operation.priority || this.calculatePriority(operation)

      this.queue.push(operation)
      this.sortQueueByPriority()
      await this.saveQueue()

      loggers.storage.info('Operation added to sync queue', {
        operationId: operation.id,
        type: operation.type,
        entityType: operation.entityType,
        priority: operation.priority
      })
    } catch (error) {
      loggers.storage.error('Failed to add operation to queue', error)
      throw error
    }
  }

  /**
   * Get next operation to process
   */
  getNextOperation(): PendingOperation | null {
    // Filter out operations that are waiting for retry delay
    const readyOperations = this.queue.filter(op => {
      if (op.attempts === 0) return true
      
      const nextRetryTime = this.getNextRetryTime(op)
      return new Date() >= nextRetryTime
    })

    if (readyOperations.length === 0) {
      return null
    }

    // Return highest priority operation
    return readyOperations.reduce((highest, current) => 
      current.priority > highest.priority ? current : highest
    )
  }

  /**
   * Remove operation from queue
   */
  async removeOperation(operationId: string): Promise<void> {
    const initialLength = this.queue.length
    this.queue = this.queue.filter(op => op.id !== operationId)
    
    if (this.queue.length < initialLength) {
      await this.saveQueue()
      loggers.storage.info('Operation removed from sync queue', { operationId })
    }
  }

  /**
   * Update operation in queue
   */
  async updateOperation(operationId: string, updates: Partial<PendingOperation>): Promise<void> {
    const operation = this.queue.find(op => op.id === operationId)
    if (!operation) {
      throw new Error(`Operation ${operationId} not found in queue`)
    }

    Object.assign(operation, updates)
    this.sortQueueByPriority()
    await this.saveQueue()

    loggers.storage.info('Operation updated in sync queue', { operationId, updates })
  }

  /**
   * Mark operation as failed
   */
  async markOperationFailed(operationId: string, error: Error): Promise<void> {
    const operation = this.queue.find(op => op.id === operationId)
    if (!operation) {
      loggers.storage.warn(`Operation ${operationId} not found in queue`)
      return
    }

    operation.attempts++
    operation.lastAttempt = new Date()

    if (operation.attempts >= this.maxRetries) {
      loggers.storage.error(`Operation ${operationId} exceeded max retries, removing from queue`, {
        attempts: operation.attempts,
        maxRetries: this.maxRetries,
        error: error.message
      })
      
      await this.removeOperation(operationId)
    } else {
      const nextRetryDelay = this.getNextRetryDelay(operation.attempts)
      loggers.storage.info(`Operation ${operationId} failed, will retry in ${nextRetryDelay}ms (attempt ${operation.attempts}/${this.maxRetries})`)
      
      await this.saveQueue()
    }
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    total: number
    ready: number
    waiting: number
    byType: Record<string, number>
    byEntityType: Record<string, number>
  } {
    const readyOperations = this.queue.filter(op => {
      if (op.attempts === 0) return true
      const nextRetryTime = this.getNextRetryTime(op)
      return new Date() >= nextRetryTime
    })

    const waitingOperations = this.queue.filter(op => {
      if (op.attempts === 0) return false
      const nextRetryTime = this.getNextRetryTime(op)
      return new Date() < nextRetryTime
    })

    const byType: Record<string, number> = {}
    const byEntityType: Record<string, number> = {}

    this.queue.forEach(op => {
      byType[op.type] = (byType[op.type] || 0) + 1
      byEntityType[op.entityType] = (byEntityType[op.entityType] || 0) + 1
    })

    return {
      total: this.queue.length,
      ready: readyOperations.length,
      waiting: waitingOperations.length,
      byType,
      byEntityType
    }
  }

  /**
   * Clear all operations from queue
   */
  async clearQueue(): Promise<void> {
    this.queue = []
    await this.saveQueue()
    loggers.storage.info('Sync queue cleared')
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0
  }

  /**
   * Get all operations (for debugging)
   */
  getAllOperations(): PendingOperation[] {
    return [...this.queue]
  }

  /**
   * Calculate priority for operation
   */
  private calculatePriority(operation: PendingOperation): number {
    let priority = 1

    // Higher priority for user-initiated operations
    if (operation.type === 'create' || operation.type === 'update') {
      priority += 2
    }

    // Higher priority for clinical data
    if (operation.entityType === 'patient' || operation.entityType === 'analysis') {
      priority += 3
    }

    // Lower priority for operations with many retries
    priority -= operation.attempts * 0.5

    // Ensure priority is within reasonable bounds
    return Math.max(0.1, Math.min(10, priority))
  }

  /**
   * Get next retry delay with exponential backoff
   */
  private getNextRetryDelay(attempts: number): number {
    const delay = this.baseDelayMs * Math.pow(this.backoffMultiplier, attempts - 1)
    return Math.min(delay, this.maxDelayMs)
  }

  /**
   * Get next retry time for operation
   */
  private getNextRetryTime(operation: PendingOperation): Date {
    if (operation.attempts === 0) {
      return new Date(0) // Ready immediately
    }

    const delay = this.getNextRetryDelay(operation.attempts)
    const lastAttempt = operation.lastAttempt || operation.createdAt
    return new Date(lastAttempt.getTime() + delay)
  }

  /**
   * Sort queue by priority (highest first)
   */
  private sortQueueByPriority(): void {
    this.queue.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substring(7)}`
  }

  /**
   * Save queue to localStorage
   */
  private async saveQueue(): Promise<void> {
    try {
      if (!this.isBrowser()) {
        // Skip persistence when not in a browser environment
        try { loggers.storage.debug('Skipping saveQueue: localStorage not available') } catch {}
        return
      }
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue))
    } catch (error) {
      loggers.storage.error('Failed to save sync queue to localStorage', error)
      // Continue operation even if save fails
    }
  }

  /**
   * Load queue from localStorage
   */
  private loadQueue(): void {
    try {
      if (!this.isBrowser()) {
        // Ensure queue is empty on server and avoid ReferenceError
        this.queue = []
        try { loggers.storage.debug('Skipping loadQueue: localStorage not available') } catch {}
        return
      }
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          this.queue = parsed.map(op => ({
            ...op,
            createdAt: new Date(op.createdAt),
            lastAttempt: op.lastAttempt ? new Date(op.lastAttempt) : undefined
          }))
          this.sortQueueByPriority()
        }
      }
    } catch (error) {
      loggers.storage.error('Failed to load sync queue from localStorage', error)
      this.queue = []
    }
  }

  /**
   * Runtime check for browser environment
   */
  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
  }

  /**
   * Process next operation in queue
   */
  async processNext(): Promise<boolean> {
    if (this.processing) {
      loggers.storage.warn('Queue processing already in progress')
      return false
    }

    const operation = this.getNextOperation()
    if (!operation) {
      loggers.storage.debug('No operations ready for processing')
      return false
    }

    this.processing = true

    try {
      loggers.storage.info('Processing operation from queue', {
        operationId: operation.id,
        type: operation.type,
        entityType: operation.entityType
      })

      // Operation processing will be handled by SyncOrchestrator
      // This method just prepares the operation and removes it from queue
      
      await this.removeOperation(operation.id)
      return true

    } catch (error) {
      loggers.storage.error(`Failed to process operation ${operation.id}`, error)
      await this.markOperationFailed(operation.id, error as Error)
      return false
    } finally {
      this.processing = false
    }
  }
}

/**
 * Export singleton instance
 */
export const syncQueue = new SyncQueue()