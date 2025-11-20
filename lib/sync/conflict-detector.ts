import { databaseService } from '../database';
import { ChangeLog, SyncConflict } from '../database/models';
import { v4 as uuidv4 } from 'uuid';

export interface ConflictDetectionOptions {
  userId: string;
  entityType: 'patient' | 'session' | 'file';
  entityId: string;
  localChange: ChangeLog;
  deviceId: string;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflict?: SyncConflict;
  resolution?: 'auto_resolved' | 'manual_required';
}

export class ConflictDetector {
  /**
   * Detect conflicts between local and server changes
   */
  async detectConflict(options: ConflictDetectionOptions): Promise<ConflictResult> {
    const { userId, entityType, entityId, localChange, deviceId } = options;

    // Get the most recent server change for this entity
    const serverChange = await databaseService.changeLogs
      .findOne(
        {
          userId,
          entityType,
          entityId,
          deviceId: { $ne: deviceId }, // Don't consider changes from the same device
          syncStatus: 'synced',
        },
        { sort: { timestamp: -1 } }
      );

    if (!serverChange) {
      return { hasConflict: false };
    }

    // Check if there's a time-based conflict (both changes within 5 minutes)
    const timeDiff = Math.abs(localChange.timestamp.getTime() - serverChange.timestamp.getTime());
    if (timeDiff < 300000) { // 5 minutes
      return {
        hasConflict: true,
        conflict: await this.createConflict(userId, localChange, serverChange, 'timestamp'),
        resolution: 'manual_required',
      };
    }

    // Check for field-level conflicts
    const fieldConflicts = this.detectFieldConflicts(localChange, serverChange);
    if (fieldConflicts.length > 0) {
      return {
        hasConflict: true,
        conflict: await this.createConflict(userId, localChange, serverChange, 'field_merge'),
        resolution: fieldConflicts.length === 1 ? 'auto_resolved' : 'manual_required',
      };
    }

    // Check for clinical priority conflicts (sessions, critical patient data)
    if (entityType === 'session' || this.isClinicalPriorityConflict(localChange, serverChange)) {
      return {
        hasConflict: true,
        conflict: await this.createConflict(userId, localChange, serverChange, 'clinical_priority'),
        resolution: 'manual_required',
      };
    }

    return { hasConflict: false };
  }

  /**
   * Detect field-level conflicts between changes
   */
  private detectFieldConflicts(localChange: ChangeLog, serverChange: ChangeLog): string[] {
    const localChanges = localChange.newValues || localChange.changes;
    const serverChanges = serverChange.newValues || serverChange.changes;
    
    const conflicts: string[] = [];
    
    // Check for conflicting field updates
    for (const field of Object.keys(localChanges)) {
      if (serverChanges[field] && JSON.stringify(localChanges[field]) !== JSON.stringify(serverChanges[field])) {
        conflicts.push(field);
      }
    }
    
    return conflicts;
  }

  /**
   * Check if this is a clinical priority conflict
   */
  private isClinicalPriorityConflict(localChange: ChangeLog, serverChange: ChangeLog): boolean {
    const localChanges = localChange.newValues || localChange.changes;
    const serverChanges = serverChange.newValues || serverChange.changes;
    
    // Critical fields that require manual review
    const criticalFields = [
      'diagnosis',
      'medications',
      'allergies',
      'treatmentPlan',
      'clinicalInfo',
    ];
    
    // Check if any critical fields are being modified
    for (const field of criticalFields) {
      if (localChanges[field] || serverChanges[field]) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Create a conflict record
   */
  private async createConflict(
    userId: string,
    localChange: ChangeLog,
    serverChange: ChangeLog,
    conflictType: 'timestamp' | 'field_merge' | 'clinical_priority' | 'user_intent'
  ): Promise<SyncConflict> {
    // Filter out user entity types as they are not supported in SyncConflict
    if (localChange.entityType === 'user') {
      throw new Error('User entity conflicts are not supported');
    }
    
    const conflict: SyncConflict = {
      conflictId: uuidv4(),
      userId,
      entityType: localChange.entityType as 'patient' | 'session' | 'file',
      entityId: localChange.entityId,
      localChange,
      serverChange,
      conflictType,
      isResolved: false,
      timestamp: new Date(),
    };

    // Store the conflict in the database
    await databaseService.syncConflicts.insertOne(conflict);
    
    return conflict;
  }

  /**
   * Auto-resolve simple conflicts
   */
  async autoResolveConflict(conflict: SyncConflict): Promise<boolean> {
    const { localChange, serverChange, conflictType } = conflict;
    
    switch (conflictType) {
      case 'field_merge':
        // Merge non-conflicting fields
        const localChanges = localChange.newValues || localChange.changes;
        const serverChanges = serverChange.newValues || serverChange.changes;
        const fieldConflicts = this.detectFieldConflicts(localChange, serverChange);
        
        if (fieldConflicts.length === 1) {
          // Single field conflict - use server value
          const resolvedValue = { ...localChanges, ...serverChanges };
          
          await databaseService.syncConflicts.updateOne(
            { conflictId: conflict.conflictId },
            {
              $set: {
                isResolved: true,
                resolvedBy: 'system',
                resolutionStrategy: 'auto_merge',
                resolvedValue,
                resolvedAt: new Date(),
              },
            }
          );
          
          return true;
        }
        break;
        
      case 'timestamp':
        // Use the more recent change
        const useLocal = localChange.timestamp > serverChange.timestamp;
        const resolvedValue = useLocal 
          ? (localChange.newValues || localChange.changes)
          : (serverChange.newValues || serverChange.changes);
        
        await databaseService.syncConflicts.updateOne(
          { conflictId: conflict.conflictId },
          {
            $set: {
              isResolved: true,
              resolvedBy: 'system',
              resolutionStrategy: useLocal ? 'use_local' : 'use_server',
              resolvedValue,
              resolvedAt: new Date(),
            },
          }
        );
        
        return true;
    }
    
    return false;
  }
}

export const conflictDetector = new ConflictDetector();