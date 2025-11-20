import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth/middleware';
import { databaseService } from '@/lib/database';
import { userIdentityFromRequest } from '@/lib/auth/server-identity';

// GET /api/sync/pull - Get changes from server
export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const authError = await authMiddleware(request);
    if (authError) return authError;

    const user = (request as any).user;
    const { searchParams } = new URL(request.url);
    
    const since = searchParams.get('since');
    const entityTypes = searchParams.get('entityTypes')?.split(',');
    const identity = await userIdentityFromRequest(request);
    const deviceId = searchParams.get('deviceId') || identity?.deviceId || user?.deviceId;
    const userId = identity?.userId || user?.id;

    if (!since || !deviceId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters: since or deviceId or user identity' },
        { status: 400 }
      );
    }

    const sinceTimestamp = new Date(since);
    if (isNaN(sinceTimestamp.getTime())) {
      return NextResponse.json(
        { error: 'Invalid timestamp format' },
        { status: 400 }
      );
    }

    await databaseService.initialize();

    // Build query for changes
    const query: any = {
      userId,
      timestamp: { $gt: sinceTimestamp },
      deviceId: { $ne: deviceId }, // Don't send changes from this device
    };

    if (entityTypes && entityTypes.length > 0) {
      query.entityType = { $in: entityTypes };
    }

    // Get changes from change logs
    const changes = await databaseService.changeLogs
      .find(query)
      .sort({ timestamp: 1 })
      .toArray();

    // Get unresolved conflicts
    const conflicts = await databaseService.syncConflicts
      .find({
        userId,
        isResolved: false,
      })
      .toArray();

    // Get current server state for entities that have changed
    const entityIds = changes.map(change => change.entityId);
    const currentStates = await getCurrentEntityStates(entityIds, user.id);

    return NextResponse.json({
      success: true,
      changes: changes.map(change => ({
        changeId: change.changeId,
        entityType: change.entityType,
        entityId: change.entityId,
        operation: change.operation,
        changes: change.changes,
        previousValues: change.previousValues,
        newValues: change.newValues,
        timestamp: change.timestamp,
        currentState: currentStates[change.entityId],
      })),
      conflicts: conflicts.map(conflict => ({
        conflictId: conflict.conflictId,
        entityType: conflict.entityType,
        entityId: conflict.entityId,
        localChange: conflict.localChange,
        serverChange: conflict.serverChange,
        conflictType: conflict.conflictType,
        resolutionStrategy: conflict.resolutionStrategy,
        resolvedValue: conflict.resolvedValue,
        isResolved: conflict.isResolved,
        timestamp: conflict.timestamp,
      })),
      serverTime: new Date().toISOString(),
      totalChanges: changes.length,
      totalConflicts: conflicts.length,
    });
  } catch (error) {
    console.error('Sync pull error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getCurrentEntityStates(entityIds: string[], userId: string): Promise<Record<string, any>> {
  const states: Record<string, any> = {};

  // Get current patient states
  const patients = await databaseService.patients
    .find({ 
      patientId: { $in: entityIds },
      userId,
      isActive: true,
    })
    .toArray();

  patients.forEach(patient => {
    states[patient.patientId] = {
      type: 'patient',
      data: patient,
    };
  });

  // Get current file states
  const files = await databaseService.files
    .find({ 
      fileId: { $in: entityIds },
      userId,
      isActive: true,
    })
    .toArray();

  files.forEach(file => {
    states[file.fileId] = {
      type: 'file',
      data: file,
    };
  });

  return states;
}