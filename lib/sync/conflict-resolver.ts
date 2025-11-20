/**
 * Aurora Conflict Resolution Engine
 * 
 * Resolves synchronization conflicts between local and server data using multiple strategies:
 * - Timestamp-based resolution (server wins by default)
 * - Field-level merging for non-conflicting changes
 * - Clinical priority for medical data
 * - User intent preservation for marked important data
 */

import { loggers } from '@/lib/logger'

export interface ConflictRecord {
  id: string
  entityType: 'chat' | 'patient' | 'file' | 'analysis' | 'preference'
  entityId: string
  localChange: ChangeRecord
  serverChange: ChangeRecord
  detectedAt: Date
  userId: string
  deviceId: string
}

export interface ChangeRecord {
  id: string
  operation: 'create' | 'update' | 'delete'
  timestamp: Date
  data: any
  previousData?: any
  userId: string
  deviceId: string
  checksum?: string
}

export interface ResolutionResult {
  resolvedData: any
  resolutionStrategy: string
  conflictsResolved: ConflictDetail[]
  mergedFields: string[]
  discardedFields: string[]
  timestamp: Date
  requiresUserReview: boolean
  userReviewReason?: string
}

export interface ConflictDetail {
  field: string
  localValue: any
  serverValue: any
  resolution: 'local' | 'server' | 'merged' | 'manual'
}

export interface ResolutionStrategy {
  resolve(conflict: ConflictRecord): Promise<ResolutionResult>
  appliesTo(conflict: ConflictRecord): boolean
  priority: number
}

export class ConflictResolver {
  private resolutionStrategies: Map<string, ResolutionStrategy> = new Map()
  private readonly auditLog: ConflictAuditEntry[] = []

  constructor() {
    this.initializeStrategies()
  }

  async resolveConflict(conflict: ConflictRecord): Promise<ResolutionResult> {
    const startTime = Date.now()
    
    try {
      loggers.storage.info('Resolving conflict', {
        conflictId: conflict.id,
        entityType: conflict.entityType,
        entityId: conflict.entityId,
        localTimestamp: conflict.localChange.timestamp,
        serverTimestamp: conflict.serverChange.timestamp
      })

      // Select the most appropriate strategy
      const strategy = this.selectStrategy(conflict)
      
      if (!strategy) {
        throw new Error(`No suitable resolution strategy found for conflict ${conflict.id}`)
      }

      loggers.storage.info('Selected resolution strategy', {
        conflictId: conflict.id,
        strategy: strategy.constructor.name,
        priority: strategy.priority
      })

      // Apply the resolution strategy
      const result = await strategy.resolve(conflict)
      
      // Audit the resolution
      this.auditResolution(conflict, result, strategy.constructor.name, Date.now() - startTime)

      loggers.storage.info('Conflict resolved successfully', {
        conflictId: conflict.id,
        strategy: strategy.constructor.name,
        requiresUserReview: result.requiresUserReview,
        conflictsResolved: result.conflictsResolved.length,
        mergedFields: result.mergedFields.length
      })

      return result

    } catch (error) {
      loggers.storage.error('Conflict resolution failed', {
        conflictId: conflict.id,
        error: error instanceof Error ? error.message : String(error)
      })

      // Fallback to manual resolution
      return this.createManualResolutionRequest(conflict, error)
    }
  }

  private initializeStrategies(): void {
    // Register strategies in priority order (highest priority first)
    this.resolutionStrategies.set('clinical-priority', new ClinicalPriorityStrategy())
    this.resolutionStrategies.set('user-intent', new UserIntentStrategy())
    this.resolutionStrategies.set('timestamp', new TimestampStrategy())
    this.resolutionStrategies.set('field-merge', new FieldMergeStrategy())
  }

  private selectStrategy(conflict: ConflictRecord): ResolutionStrategy | null {
    const strategies = Array.from(this.resolutionStrategies.values())
    
    // Find strategies that apply to this conflict
    const applicableStrategies = strategies.filter(strategy => 
      strategy.appliesTo(conflict)
    )

    if (applicableStrategies.length === 0) {
      return null
    }

    // Sort by priority (highest first) and return the best match
    return applicableStrategies.sort((a, b) => b.priority - a.priority)[0]
  }

  private auditResolution(
    conflict: ConflictRecord, 
    result: ResolutionResult, 
    strategy: string, 
    duration: number
  ): void {
    this.auditLog.push({
      conflictId: conflict.id,
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      resolutionStrategy: strategy,
      duration,
      timestamp: new Date(),
      conflictsResolved: result.conflictsResolved.length,
      requiresUserReview: result.requiresUserReview,
      userId: conflict.userId,
      deviceId: conflict.deviceId
    })

    // Keep only last 1000 entries to prevent memory bloat
    if (this.auditLog.length > 1000) {
      this.auditLog.splice(0, this.auditLog.length - 1000)
    }
  }

  private createManualResolutionRequest(conflict: ConflictRecord, error: unknown): ResolutionResult {
    return {
      resolvedData: conflict.localChange.data, // Default to local data
      resolutionStrategy: 'manual-review',
      conflictsResolved: [],
      mergedFields: [],
      discardedFields: [],
      timestamp: new Date(),
      requiresUserReview: true,
      userReviewReason: `Automatic resolution failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }

  getAuditLog(): ConflictAuditEntry[] {
    return [...this.auditLog]
  }

  clearAuditLog(): void {
    this.auditLog.length = 0
  }
}

/**
 * Timestamp-based resolution strategy
 * Server timestamp wins by default, but can be configured
 */
export class TimestampStrategy implements ResolutionStrategy {
  priority = 10
  private serverWins: boolean

  constructor(serverWins: boolean = true) {
    this.serverWins = serverWins
  }

  async resolve(conflict: ConflictRecord): Promise<ResolutionResult> {
    const localTime = new Date(conflict.localChange.timestamp).getTime()
    const serverTime = new Date(conflict.serverChange.timestamp).getTime()
    
    const useServer = this.serverWins ? 
      (serverTime >= localTime) : 
      (serverTime > localTime)

    const winningChange = useServer ? conflict.serverChange : conflict.localChange
    const losingChange = useServer ? conflict.localChange : conflict.serverChange

    const conflictsResolved: ConflictDetail[] = []
    const mergedFields: string[] = []
    const discardedFields: string[] = []

    // Compare all fields to identify conflicts
    const allFields = new Set([
      ...Object.keys(winningChange.data || {}),
      ...Object.keys(losingChange.data || {})
    ])

    for (const field of allFields) {
      const winnerValue = winningChange.data?.[field]
      const loserValue = losingChange.data?.[field]

      if (JSON.stringify(winnerValue) !== JSON.stringify(loserValue)) {
        conflictsResolved.push({
          field,
          localValue: useServer ? loserValue : winnerValue,
          serverValue: useServer ? winnerValue : loserValue,
          resolution: useServer ? 'server' : 'local'
        })

        if (winnerValue !== undefined) {
          mergedFields.push(field)
        } else {
          discardedFields.push(field)
        }
      } else {
        mergedFields.push(field)
      }
    }

    return {
      resolvedData: winningChange.data,
      resolutionStrategy: 'timestamp',
      conflictsResolved,
      mergedFields,
      discardedFields,
      timestamp: new Date(),
      requiresUserReview: false
    }
  }

  appliesTo(conflict: ConflictRecord): boolean {
    // Apply to all conflicts as fallback strategy
    return true
  }
}

/**
 * Field-level merge strategy
 * Attempts to merge non-conflicting fields from both versions
 */
export class FieldMergeStrategy implements ResolutionStrategy {
  priority = 5

  async resolve(conflict: ConflictRecord): Promise<ResolutionResult> {
    const localData = conflict.localChange.data || {}
    const serverData = conflict.serverChange.data || {}
    
    const mergedData: any = {}
    const conflictsResolved: ConflictDetail[] = []
    const mergedFields: string[] = []
    const discardedFields: string[] = []

    // Get all unique fields
    const allFields = new Set([...Object.keys(localData), ...Object.keys(serverData)])

    for (const field of allFields) {
      const localValue = localData[field]
      const serverValue = serverData[field]

      // If values are identical, no conflict
      if (JSON.stringify(localValue) === JSON.stringify(serverValue)) {
        mergedData[field] = localValue
        mergedFields.push(field)
        continue
      }

      // Handle different field types
      if (this.canMergeField(field, localValue, serverValue)) {
        // Attempt to merge the field
        const mergedValue = this.mergeFieldValue(field, localValue, serverValue)
        mergedData[field] = mergedValue
        mergedFields.push(field)
        
        conflictsResolved.push({
          field,
          localValue,
          serverValue,
          resolution: 'merged'
        })
      } else {
        // Fields cannot be merged, use timestamp strategy for this field
        const localTime = new Date(conflict.localChange.timestamp).getTime()
        const serverTime = new Date(conflict.serverChange.timestamp).getTime()
        
        const useServer = serverTime > localTime
        mergedData[field] = useServer ? serverValue : localValue
        
        conflictsResolved.push({
          field,
          localValue,
          serverValue,
          resolution: useServer ? 'server' : 'local'
        })

        if (useServer ? serverValue !== undefined : localValue !== undefined) {
          mergedFields.push(field)
        } else {
          discardedFields.push(field)
        }
      }
    }

    return {
      resolvedData: mergedData,
      resolutionStrategy: 'field-merge',
      conflictsResolved,
      mergedFields,
      discardedFields,
      timestamp: new Date(),
      requiresUserReview: false
    }
  }

  private canMergeField(field: string, localValue: any, serverValue: any): boolean {
    // Don't merge certain critical fields
    const nonMergeableFields = ['id', 'createdAt', 'updatedAt', 'userId', 'deviceId']
    if (nonMergeableFields.includes(field)) {
      return false
    }

    // Can merge arrays by concatenating unique values
    if (Array.isArray(localValue) && Array.isArray(serverValue)) {
      return true
    }

    // Can merge objects recursively
    if (this.isObject(localValue) && this.isObject(serverValue)) {
      return true
    }

    // Can merge primitive values if they're different types (convert to string)
    if (this.isPrimitive(localValue) && this.isPrimitive(serverValue)) {
      return typeof localValue !== typeof serverValue
    }

    return false
  }

  private mergeFieldValue(field: string, localValue: any, serverValue: any): any {
    // Merge arrays by concatenating unique values
    if (Array.isArray(localValue) && Array.isArray(serverValue)) {
      return [...new Set([...localValue, ...serverValue])]
    }

    // Merge objects recursively
    if (this.isObject(localValue) && this.isObject(serverValue)) {
      return { ...localValue, ...serverValue }
    }

    // For different primitive types, convert to string and concatenate
    if (this.isPrimitive(localValue) && this.isPrimitive(serverValue)) {
      return `${localValue} | ${serverValue}`
    }

    // Fallback to server value
    return serverValue
  }

  private isObject(value: any): boolean {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
  }

  private isPrimitive(value: any): boolean {
    return value !== null && ['string', 'number', 'boolean'].includes(typeof value)
  }

  appliesTo(conflict: ConflictRecord): boolean {
    // Apply when both changes are updates (not creates or deletes)
    return conflict.localChange.operation === 'update' && 
           conflict.serverChange.operation === 'update'
  }
}

/**
 * Clinical priority strategy
 * Clinical/medical data always wins over UI preferences or metadata
 */
export class ClinicalPriorityStrategy implements ResolutionStrategy {
  priority = 100 // Highest priority

  async resolve(conflict: ConflictRecord): Promise<ResolutionResult> {
    const localData = conflict.localChange.data || {}
    const serverData = conflict.serverChange.data || {}
    
    // Determine which change has clinical priority
    const localClinicalScore = this.calculateClinicalScore(localData)
    const serverClinicalScore = this.calculateClinicalScore(serverData)
    
    const useServer = serverClinicalScore > localClinicalScore
    const winningChange = useServer ? conflict.serverChange : conflict.localChange
    const losingChange = useServer ? conflict.localChange : conflict.serverChange

    const conflictsResolved: ConflictDetail[] = []
    const mergedFields: string[] = []
    const discardedFields: string[] = []

    // Analyze conflicts with clinical priority
    const allFields = new Set([
      ...Object.keys(winningChange.data || {}),
      ...Object.keys(losingChange.data || {})
    ])

    for (const field of allFields) {
      const winnerValue = winningChange.data?.[field]
      const loserValue = losingChange.data?.[field]

      if (JSON.stringify(winnerValue) !== JSON.stringify(loserValue)) {
        const fieldClinicalScore = this.getFieldClinicalScore(field)
        
        conflictsResolved.push({
          field,
          localValue: useServer ? loserValue : winnerValue,
          serverValue: useServer ? winnerValue : loserValue,
          resolution: useServer ? 'server' : 'local'
        })

        if (winnerValue !== undefined) {
          mergedFields.push(field)
        } else {
          discardedFields.push(field)
        }
      } else {
        mergedFields.push(field)
      }
    }

    return {
      resolvedData: winningChange.data,
      resolutionStrategy: 'clinical-priority',
      conflictsResolved,
      mergedFields,
      discardedFields,
      timestamp: new Date(),
      requiresUserReview: false
    }
  }

  private calculateClinicalScore(data: any): number {
    let score = 0
    
    // Score based on field presence
    const clinicalFields = [
      'diagnosis', 'treatment', 'medication', 'symptoms', 'clinicalNotes',
      'patientHistory', 'allergies', 'vitalSigns', 'labResults', 'prescriptions'
    ]

    for (const field of clinicalFields) {
      if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
        score += this.getFieldClinicalScore(field)
      }
    }

    return score
  }

  private getFieldClinicalScore(field: string): number {
    const fieldScores: Record<string, number> = {
      'diagnosis': 100,
      'treatment': 90,
      'medication': 80,
      'prescriptions': 80,
      'symptoms': 70,
      'clinicalNotes': 60,
      'patientHistory': 50,
      'allergies': 40,
      'vitalSigns': 30,
      'labResults': 30,
      'name': 20,
      'dateOfBirth': 20,
      'patientId': 15,
      'default': 10
    }

    return fieldScores[field] || fieldScores.default
  }

  appliesTo(conflict: ConflictRecord): boolean {
    // Apply to patient records and clinical data
    return conflict.entityType === 'patient' || 
           conflict.entityType === 'analysis' ||
           this.hasClinicalData(conflict.localChange.data) ||
           this.hasClinicalData(conflict.serverChange.data)
  }

  private hasClinicalData(data: any): boolean {
    const clinicalFields = [
      'diagnosis', 'treatment', 'medication', 'symptoms', 'clinicalNotes'
    ]
    
    return clinicalFields.some(field => data && data[field] !== undefined)
  }
}

/**
 * User intent strategy
 * Preserves data that users have explicitly marked as important
 */
export class UserIntentStrategy implements ResolutionStrategy {
  priority = 90 // Second highest priority

  async resolve(conflict: ConflictRecord): Promise<ResolutionResult> {
    const localData = conflict.localChange.data || {}
    const serverData = conflict.serverChange.data || {}
    
    // Check which version has user-marked important data
    const localIntentScore = this.calculateUserIntentScore(localData)
    const serverIntentScore = this.calculateUserIntentScore(serverData)
    
    const useServer = serverIntentScore > localIntentScore
    const winningChange = useServer ? conflict.serverChange : conflict.localChange
    const losingChange = useServer ? conflict.localChange : conflict.serverChange

    const conflictsResolved: ConflictDetail[] = []
    const mergedFields: string[] = []
    const discardedFields: string[] = []

    // Resolve conflicts respecting user intent
    const allFields = new Set([
      ...Object.keys(winningChange.data || {}),
      ...Object.keys(losingChange.data || {})
    ])

    for (const field of allFields) {
      const winnerValue = winningChange.data?.[field]
      const loserValue = losingChange.data?.[field]

      if (JSON.stringify(winnerValue) !== JSON.stringify(loserValue)) {
        conflictsResolved.push({
          field,
          localValue: useServer ? loserValue : winnerValue,
          serverValue: useServer ? winnerValue : loserValue,
          resolution: useServer ? 'server' : 'local'
        })

        if (winnerValue !== undefined) {
          mergedFields.push(field)
        } else {
          discardedFields.push(field)
        }
      } else {
        mergedFields.push(field)
      }
    }

    return {
      resolvedData: winningChange.data,
      resolutionStrategy: 'user-intent',
      conflictsResolved,
      mergedFields,
      discardedFields,
      timestamp: new Date(),
      requiresUserReview: false
    }
  }

  private calculateUserIntentScore(data: any): number {
    let score = 0
    
    // Check for explicit user intent markers
    if (data.isImportant === true) score += 100
    if (data.isPinned === true) score += 80
    if (data.isStarred === true) score += 60
    if (data.priority === 'high') score += 40
    if (data.userConfirmed === true) score += 30
    if (data.manuallyEdited === true) score += 20
    
    // Check for user-generated content indicators
    if (data.userNotes && data.userNotes.length > 0) score += 15
    if (data.customFields && Object.keys(data.customFields).length > 0) score += 10
    if (data.tags && data.tags.includes('user-defined')) score += 5
    
    return score
  }

  appliesTo(conflict: ConflictRecord): boolean {
    // Apply when either version has user intent markers
    return this.hasUserIntent(conflict.localChange.data) ||
           this.hasUserIntent(conflict.serverChange.data)
  }

  private hasUserIntent(data: any): boolean {
    const intentMarkers = [
      'isImportant', 'isPinned', 'isStarred', 'priority', 
      'userConfirmed', 'manuallyEdited'
    ]
    
    return intentMarkers.some(marker => data && data[marker] === true)
  }
}

interface ConflictAuditEntry {
  conflictId: string
  entityType: string
  entityId: string
  resolutionStrategy: string
  duration: number
  timestamp: Date
  conflictsResolved: number
  requiresUserReview: boolean
  userId: string
  deviceId: string
}