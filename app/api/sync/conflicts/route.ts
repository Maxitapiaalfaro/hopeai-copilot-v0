import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth/middleware';
import { databaseService } from '@/lib/database';
import { v4 as uuidv4 } from 'uuid';
import { userIdentityFromRequest } from '@/lib/auth/server-identity';

// GET /api/sync/conflicts - Get all unresolved conflicts
export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const authError = await authMiddleware(request);
    if (authError) return authError;

    const user = (request as any).user;
    const { searchParams } = new URL(request.url);
    
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const resolved = searchParams.get('resolved');
    const identity = await userIdentityFromRequest(request);
    const userId = identity?.userId || user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'No authenticated user' }, { status: 401 });
    }

    await databaseService.initialize();

    // Build query
    const query: any = { userId };
    
    if (entityType) {
      query.entityType = entityType;
    }
    
    if (entityId) {
      query.entityId = entityId;
    }
    
    if (resolved !== undefined) {
      query.isResolved = resolved === 'true';
    }

    const conflicts = await databaseService.syncConflicts
      .find(query)
      .sort({ timestamp: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      conflicts: conflicts.map(conflict => ({
        conflictId: conflict.conflictId,
        entityType: conflict.entityType,
        entityId: conflict.entityId,
        conflictType: conflict.conflictType,
        localChange: conflict.localChange,
        serverChange: conflict.serverChange,
        resolutionStrategy: conflict.resolutionStrategy,
        resolvedValue: conflict.resolvedValue,
        isResolved: conflict.isResolved,
        resolvedBy: conflict.resolvedBy,
        resolutionNotes: conflict.resolutionNotes,
        timestamp: conflict.timestamp,
        resolvedAt: conflict.resolvedAt,
      })),
      total: conflicts.length,
    });
  } catch (error) {
    console.error('Get conflicts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/sync/conflicts - Resolve a conflict
export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const authError = await authMiddleware(request);
    if (authError) return authError;

    const user = (request as any).user;
    const { conflictId, resolutionStrategy, resolvedValue, resolutionNotes } = await request.json();

    if (!conflictId || !resolutionStrategy) {
      return NextResponse.json(
        { error: 'Missing required parameters: conflictId, resolutionStrategy' },
        { status: 400 }
      );
    }

    await databaseService.initialize();

    // Find the conflict
    const conflict = await databaseService.syncConflicts.findOne({
      conflictId,
      userId: user.id,
      isResolved: false,
    });

    if (!conflict) {
      return NextResponse.json(
        { error: 'Conflict not found or already resolved' },
        { status: 404 }
      );
    }

    // Apply resolution based on strategy
    let finalResolvedValue = resolvedValue;
    
    switch (resolutionStrategy) {
      case 'use_local':
        finalResolvedValue = conflict.localChange.newValues || conflict.localChange.changes;
        break;
      
      case 'use_server':
        finalResolvedValue = conflict.serverChange.newValues || conflict.serverChange.changes;
        break;
      
      case 'merge':
        // Merge both values (client provided merged value)
        finalResolvedValue = resolvedValue || mergeChanges(conflict.localChange, conflict.serverChange);
        break;
      
      case 'manual':
        // Use manually provided resolution
        if (!resolvedValue) {
          return NextResponse.json(
            { error: 'Resolved value required for manual resolution' },
            { status: 400 }
          );
        }
        finalResolvedValue = resolvedValue;
        break;
      
      default:
        return NextResponse.json(
          { error: 'Invalid resolution strategy' },
          { status: 400 }
        );
    }

    // Update the conflict
    await databaseService.syncConflicts.updateOne(
      { conflictId },
      {
        $set: {
          isResolved: true,
          resolvedBy: 'user',
          resolutionStrategy,
          resolvedValue: finalResolvedValue,
          resolutionNotes,
          resolvedAt: new Date(),
        },
      }
    );

    // Apply the resolved value to the actual entity
    await applyResolvedValue(conflict, finalResolvedValue);

    // Log the resolution
    await databaseService.changeLogs.insertOne({
      changeId: uuidv4(),
      userId: user.id,
      deviceId: conflict.localChange.deviceId,
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      operation: 'update',
      changes: finalResolvedValue,
      timestamp: new Date(),
      syncStatus: 'synced',
      retryCount: 0,
    });

    return NextResponse.json({
      success: true,
      message: 'Conflict resolved successfully',
      conflictId,
      resolutionStrategy,
      resolvedValue: finalResolvedValue,
    });
  } catch (error) {
    console.error('Resolve conflict error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to merge conflicting changes
function mergeChanges(localChange: any, serverChange: any): Record<string, any> {
  const localValues = localChange.newValues || localChange.changes;
  const serverValues = serverChange.newValues || serverChange.changes;
  
  // Simple merge strategy: prioritize server changes for conflicts
  return { ...localValues, ...serverValues };
}

// Helper function to apply resolved value to entity
async function applyResolvedValue(conflict: any, resolvedValue: Record<string, any>): Promise<void> {
  const { entityType, entityId } = conflict;
  
  switch (entityType) {
    case 'patient':
      await databaseService.patients.updateOne(
        { patientId: entityId },
        { $set: { ...resolvedValue, updatedAt: new Date() } }
      );
      break;
    
    case 'session':
      // Sessions are embedded in patient documents
      if (resolvedValue.patientId) {
        await databaseService.patients.updateOne(
          { 
            patientId: resolvedValue.patientId,
            'sessions.sessionId': entityId,
          },
          { 
            $set: { 
              'sessions.$': { sessionId: entityId, ...resolvedValue },
              updatedAt: new Date(),
            },
          }
        );
      }
      break;
    
    case 'file':
      await databaseService.files.updateOne(
        { fileId: entityId },
        { $set: { ...resolvedValue, updatedAt: new Date() } }
      );
      break;
    
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}