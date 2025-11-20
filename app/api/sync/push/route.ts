import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth/middleware';
import { databaseService } from '@/lib/database';
import { v4 as uuidv4 } from 'uuid';
import { conflictDetector } from '@/lib/sync/conflict-detector';
import { clinicalValidationService } from '@/lib/clinical/validation-service';
import { hipaaComplianceService } from '@/lib/security/hipaa-compliance';
import { deviceTrustService } from '@/lib/security/device-trust';
import { userIdentityFromRequest } from '@/lib/auth/server-identity';

// POST /api/sync/push - Push local changes to server
export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const authError = await authMiddleware(request);
    if (authError) return authError;

    const user = (request as any).user;
    const { changes, deviceId: deviceIdInput } = await request.json();

    const identity = await userIdentityFromRequest(request);
    const userId = identity?.userId || user?.id;
    const deviceId = deviceIdInput || identity?.deviceId || user?.deviceId;

    if (!changes || !Array.isArray(changes) || !userId || !deviceId) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    await databaseService.initialize();

    // Ensure device is registered and get trust level (soft-enforced)
    await deviceTrustService.ensureDeviceRegistered(userId, deviceId);
    const deviceTrust = await deviceTrustService.getTrustLevel(userId, deviceId);

    const processedChanges = [];
    const conflicts = [];

    for (const change of changes) {
      try {
        const changeId = uuidv4();
        const timestamp = new Date(change.timestamp || Date.now());

        // Check for existing conflicts
        const existingConflict = await databaseService.syncConflicts.findOne({
          userId,
          entityType: change.entityType,
          entityId: change.entityId,
          isResolved: false,
        });

        if (existingConflict) {
          conflicts.push(existingConflict);
          continue;
        }

        // Validate and sanitize incoming change payload
        const validation = clinicalValidationService.validateChange({
          entityType: change.entityType,
          operation: change.operation,
          changes: change.changes,
        });

        if (!validation.isValid) {
          await databaseService.changeLogs.insertOne({
            changeId: uuidv4(),
            userId,
            deviceId,
            entityType: change?.entityType || 'unknown',
            entityId: change?.entityId || 'unknown',
            operation: change?.operation || 'unknown',
            changes: change?.changes || {},
            timestamp: new Date(),
            syncStatus: 'failed' as const,
            retryCount: 0,
            lastError: `Validation failed: ${validation.errors.join('; ')}`,
          });
          continue;
        }

        change.changes = hipaaComplianceService.sanitizeForStorage(change.entityType, change.changes);

        // Create change log entry first
        const changeLog = {
          changeId,
          userId,
          deviceId,
          entityType: change.entityType,
          entityId: change.entityId,
          operation: change.operation,
          changes: change.changes,
          previousValues: change.previousValues,
          newValues: change.newValues,
          timestamp,
          syncStatus: 'pending' as const,
          retryCount: 0,
          // Attach device trust snapshot for audit purposes
          deviceTrust,
        };

        // Detect conflicts before processing
        const conflictResult = await conflictDetector.detectConflict({
          userId,
          entityType: change.entityType,
          entityId: change.entityId,
          localChange: changeLog,
          deviceId,
        });

        if (conflictResult.hasConflict && conflictResult.conflict) {
          conflicts.push(conflictResult.conflict);
          
          // Try to auto-resolve if possible
          if (conflictResult.resolution === 'auto_resolved') {
            const autoResolved = await conflictDetector.autoResolveConflict(conflictResult.conflict);
            if (autoResolved) {
              // Continue with processing using the resolved value
              const resolvedValue = conflictResult.conflict.resolvedValue;
              if (resolvedValue) {
                change.changes = { ...change.changes, ...resolvedValue };
              }
            } else {
              continue; // Skip processing this change
            }
          } else {
            continue; // Skip processing this change, needs manual resolution
          }
        }

        // Process the change based on entity type
        let processed = false;
        
        switch (change.entityType) {
          case 'patient':
            processed = await processPatientChange(change, userId, deviceId);
            break;
          case 'session':
            processed = await processSessionChange(change, userId, deviceId);
            break;
          case 'file':
            processed = await processFileChange(change, userId, deviceId);
            break;
          default:
            console.warn(`Unknown entity type: ${change.entityType}`);
        }

        if (processed) {
          // Create synced change log entry
          const syncedChangeLog = {
            ...changeLog,
            syncStatus: 'synced' as const,
          };
          await databaseService.changeLogs.insertOne(syncedChangeLog);
          processedChanges.push(syncedChangeLog);
        }
      } catch (error) {
        console.error(`Error processing change ${change.entityId}:`, error);
        
        // Log failed change with safe access to change properties
        await databaseService.changeLogs.insertOne({
          changeId: uuidv4(),
          userId,
          deviceId,
          entityType: change?.entityType || 'unknown',
          entityId: change?.entityId || 'unknown',
          operation: change?.operation || 'unknown',
          changes: change?.changes || {},
          timestamp: new Date(),
          syncStatus: 'failed' as const,
          retryCount: 0,
          lastError: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      processedChanges: processedChanges.length,
      conflicts: conflicts.length,
      changes: processedChanges,
      conflictsList: conflicts,
      deviceTrust,
    });
  } catch (error) {
    console.error('Sync push error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function processPatientChange(change: any, userId: string, deviceId: string): Promise<boolean> {
  const { entityId, operation, changes } = change;

  switch (operation) {
    case 'create':
      await databaseService.patients.insertOne({
        patientId: entityId,
        userId,
        deviceId,
        ...changes,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return true;

    case 'update':
      const result = await databaseService.patients.updateOne(
        { patientId: entityId, userId },
        { 
          $set: {
            ...changes,
            updatedAt: new Date(),
          },
        }
      );
      return result.modifiedCount > 0;

    case 'delete':
      const deleteResult = await databaseService.patients.updateOne(
        { patientId: entityId, userId },
        { 
          $set: {
            isActive: false,
            updatedAt: new Date(),
          },
        }
      );
      return deleteResult.modifiedCount > 0;

    default:
      return false;
  }
}

async function processSessionChange(change: any, userId: string, deviceId: string): Promise<boolean> {
  const { entityId, operation, changes } = change;

  switch (operation) {
    case 'create':
      // Session creation is handled through patient records
      // Update the patient's sessions array
      if (changes.patientId) {
        const result = await databaseService.patients.updateOne(
          { patientId: changes.patientId, userId },
          {
            $push: {
              sessions: {
                sessionId: entityId,
                date: changes.date || new Date(),
                duration: changes.duration || 50,
                type: changes.type || 'individual',
                notes: changes.notes || '',
                nextAppointment: changes.nextAppointment,
                billingCode: changes.billingCode,
              },
            },
            $set: {
              lastSessionAt: changes.date || new Date(),
              updatedAt: new Date(),
            },
          }
        );
        return result.modifiedCount > 0;
      }
      return false;

    case 'update':
      // Update session within patient's sessions array
      if (changes.patientId) {
        const result = await databaseService.patients.updateOne(
          { 
            patientId: changes.patientId, 
            userId,
            'sessions.sessionId': entityId,
          },
          {
            $set: {
              'sessions.$': {
                sessionId: entityId,
                date: changes.date || new Date(),
                duration: changes.duration || 50,
                type: changes.type || 'individual',
                notes: changes.notes || '',
                nextAppointment: changes.nextAppointment,
                billingCode: changes.billingCode,
              },
              updatedAt: new Date(),
            },
          }
        );
        return result.modifiedCount > 0;
      }
      return false;

    case 'delete':
      // Remove session from patient's sessions array
      if (changes.patientId) {
        const result = await databaseService.patients.updateOne(
          { patientId: changes.patientId, userId },
          {
            $pull: {
              sessions: { sessionId: entityId },
            },
            $set: {
              updatedAt: new Date(),
            },
          }
        );
        return result.modifiedCount > 0;
      }
      return false;

    default:
      return false;
  }
}

async function processFileChange(change: any, userId: string, deviceId: string): Promise<boolean> {
  const { entityId, operation, changes } = change;

  switch (operation) {
    case 'create':
      await databaseService.files.insertOne({
        fileId: entityId,
        userId,
        patientId: changes.patientId,
        sessionId: changes.sessionId,
        fileName: changes.fileName,
        originalName: changes.originalName,
        mimeType: changes.mimeType,
        size: changes.size || 0,
        checksum: changes.checksum || '',
        encryptionMetadata: changes.encryptionMetadata,
        metadata: changes.metadata || {},
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return true;

    case 'update':
      const result = await databaseService.files.updateOne(
        { fileId: entityId, userId },
        { 
          $set: {
            ...changes,
            updatedAt: new Date(),
          },
        }
      );
      return result.modifiedCount > 0;

    case 'delete':
      const deleteResult = await databaseService.files.updateOne(
        { fileId: entityId, userId },
        { 
          $set: {
            isActive: false,
            updatedAt: new Date(),
          },
        }
      );
      return deleteResult.modifiedCount > 0;

    default:
      return false;
  }
}