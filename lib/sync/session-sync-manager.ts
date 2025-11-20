import { databaseService } from '@/lib/database';
import { SessionRecord, SyncConflict } from '@/lib/database/models';
import { v4 as uuidv4 } from 'uuid';

export interface SessionSyncOptions {
  userId: string;
  deviceId: string;
  patientId: string;
  sessionId: string;
}

export interface SessionSyncResult {
  success: boolean;
  session?: SessionRecord;
  conflict?: boolean;
  error?: string;
}

export class SessionSyncManager {
  /**
   * Sync a session with conflict detection and resolution
   */
  async syncSession(
    sessionData: SessionRecord,
    options: SessionSyncOptions
  ): Promise<SessionSyncResult> {
    try {
      await databaseService.initialize();

      // Get current session from database
      const patient = await databaseService.patients.findOne({
        userId: options.userId,
        patientId: options.patientId,
      });

      if (!patient) {
        return {
          success: false,
          error: 'Patient not found',
        };
      }

      // Find the session in the patient's sessions array
      const existingSessionIndex = patient.sessions.findIndex(
        s => s.sessionId === options.sessionId
      );

      const existingSession = existingSessionIndex !== -1 
        ? patient.sessions[existingSessionIndex]
        : null;

      // Check for conflicts
      if (existingSession && this.hasConflict(sessionData, existingSession)) {
        // Create conflict record
        const conflictId = uuidv4();
        await databaseService.syncConflicts.insertOne({
          conflictId,
          userId: options.userId,
          entityType: 'session',
          entityId: options.sessionId,
          localChange: {
            changeId: uuidv4(),
            userId: options.userId,
            deviceId: options.deviceId,
            entityType: 'session',
            entityId: options.sessionId,
            operation: 'update',
            changes: sessionData,
            timestamp: new Date(),
            syncStatus: 'pending',
            retryCount: 0,
          },
          serverChange: {
            changeId: uuidv4(),
            userId: options.userId,
            deviceId: options.deviceId || 'unknown',
            entityType: 'session',
            entityId: options.sessionId,
            operation: 'update',
            changes: existingSession,
            timestamp: new Date(),
            syncStatus: 'synced',
            retryCount: 0,
          },
          conflictType: 'field_merge',
          isResolved: false,
          timestamp: new Date(),
        });

        return {
          success: false,
          conflict: true,
          session: existingSession,
        };
      }

      // No conflict, proceed with sync
      if (existingSessionIndex !== -1) {
        // Update existing session
        patient.sessions[existingSessionIndex] = sessionData;
      } else {
        // Add new session
        patient.sessions.push(sessionData);
      }

      // Update patient with new session data
      await databaseService.patients.updateOne(
        { userId: options.userId, patientId: options.patientId },
        { 
          $set: { 
            sessions: patient.sessions,
            updatedAt: new Date(),
          } 
        }
      );

      // Log the change
      await databaseService.changeLogs.insertOne({
        changeId: uuidv4(),
        userId: options.userId,
        deviceId: options.deviceId,
        entityType: 'session',
        entityId: options.sessionId,
        operation: existingSession ? 'update' : 'create',
        changes: sessionData,
        timestamp: new Date(),
        syncStatus: 'synced',
        retryCount: 0,
      });

      return {
        success: true,
        session: sessionData,
      };
    } catch (error) {
      console.error('Session sync failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get session with real-time sync status
   */
  async getSession(
    userId: string,
    patientId: string,
    sessionId: string
  ): Promise<SessionRecord | null> {
    try {
      await databaseService.initialize();

      const patient = await databaseService.patients.findOne({
        userId,
        patientId,
      });

      if (!patient) {
        return null;
      }

      return patient.sessions.find(s => s.sessionId === sessionId) || null;
    } catch (error) {
      console.error('Get session failed:', error);
      return null;
    }
  }

  /**
   * Get all sessions for a patient with sync status
   */
  async getSessions(
    userId: string,
    patientId: string
  ): Promise<SessionRecord[]> {
    try {
      await databaseService.initialize();

      const patient = await databaseService.patients.findOne({
        userId,
        patientId,
      });

      if (!patient) {
        return [];
      }

      return patient.sessions;
    } catch (error) {
      console.error('Get sessions failed:', error);
      return [];
    }
  }

  /**
   * Delete a session with sync tracking
   */
  async deleteSession(
    userId: string,
    deviceId: string,
    patientId: string,
    sessionId: string
  ): Promise<boolean> {
    try {
      await databaseService.initialize();

      const patient = await databaseService.patients.findOne({
        userId,
        patientId,
      });

      if (!patient) {
        return false;
      }

      // Remove session from patient's sessions array
      const updatedSessions = patient.sessions.filter(
        s => s.sessionId !== sessionId
      );

      if (updatedSessions.length === patient.sessions.length) {
        return false; // Session not found
      }

      // Update patient
      await databaseService.patients.updateOne(
        { userId, patientId },
        { 
          $set: { 
            sessions: updatedSessions,
            updatedAt: new Date(),
          } 
        }
      );

      // Log the deletion
      await databaseService.changeLogs.insertOne({
        changeId: uuidv4(),
        userId,
        deviceId,
        entityType: 'session',
        entityId: sessionId,
        operation: 'delete',
        changes: { sessionId, patientId },
        timestamp: new Date(),
        syncStatus: 'synced',
        retryCount: 0,
      });

      return true;
    } catch (error) {
      console.error('Delete session failed:', error);
      return false;
    }
  }

  /**
   * Check if two sessions have conflicts
   */
  private hasConflict(localSession: SessionRecord, serverSession: SessionRecord): boolean {
    // Check if sessions have different content (excluding sessionId and date which are immutable)
    const fieldsToCompare = ['duration', 'type', 'notes', 'nextAppointment', 'billingCode'];
    
    return fieldsToCompare.some(field => {
      const localValue = (localSession as any)[field];
      const serverValue = (serverSession as any)[field];
      return localValue !== serverValue;
    });

    // Check for field-level conflicts
    const conflictFields = [
      'sessionDate', 'duration', 'sessionType', 'notes', 
      'interventions', 'assessments', 'nextSession', 'status'
    ];

    return conflictFields.some(field => {
      const localValue = (localSession as any)[field];
      const serverValue = (serverSession as any)[field];
      return JSON.stringify(localValue) !== JSON.stringify(serverValue);
    });
  }

  /**
   * Get session conflicts for a patient
   */
  async getSessionConflicts(
    userId: string,
    patientId: string
  ): Promise<SyncConflict[]> {
    try {
      await databaseService.initialize();

      const conflicts = await databaseService.syncConflicts
        .find({
          userId,
          entityType: 'session',
          isResolved: false,
        })
        .toArray();

      // Filter conflicts for this patient's sessions
      const patient = await databaseService.patients.findOne({
        userId,
        patientId,
      });

      if (!patient) {
        return [];
      }

      const patientSessionIds = patient.sessions.map(s => s.sessionId);
      
      return conflicts.filter(conflict => 
        patientSessionIds.includes(conflict.entityId)
      );
    } catch (error) {
      console.error('Get session conflicts failed:', error);
      return [];
    }
  }
}

export const sessionSyncManager = new SessionSyncManager();