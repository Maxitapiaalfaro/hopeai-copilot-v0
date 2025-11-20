import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth/middleware';
import { databaseService } from '@/lib/database';

export interface SyncHealthResponse {
  healthy: boolean;
  checks: {
    database: boolean;
    collections: {
      changeLogs: boolean;
      syncConflicts: boolean;
      patients: boolean;
      sessions: boolean;
    };
    indexes: boolean;
    syncLatency: number;
    error?: string;
  };
  timestamp: string;
}

// GET /api/sync/health - Health check for sync system
export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (authResult) {
      return authResult;
    }

    const startTime = Date.now();
    const response: SyncHealthResponse = {
      healthy: true,
      checks: {
        database: false,
        collections: {
          changeLogs: false,
          syncConflicts: false,
          patients: false,
          sessions: false,
        },
        indexes: false,
        syncLatency: 0,
      },
      timestamp: new Date().toISOString(),
    };

    try {
      // Test database connection
      await databaseService.initialize();
      response.checks.database = true;

      // Test collections
      const collections = [
        { name: 'changeLogs', collection: databaseService.changeLogs },
        { name: 'syncConflicts', collection: databaseService.syncConflicts },
        { name: 'patients', collection: databaseService.patients },
        { name: 'sessions', collection: databaseService.sessions }
      ];
      
      for (const { name, collection } of collections) {
        try {
          await collection.countDocuments({});
          response.checks.collections[name as keyof typeof response.checks.collections] = true;
        } catch (error) {
          console.error(`Health check failed for collection ${name}:`, error);
          response.checks.collections[name as keyof typeof response.checks.collections] = false;
        }
      }

      // Test indexes
      try {
        const db = databaseService.db;
        const changeLogsIndexes = await db.collection('changeLogs').indexes();
        const syncConflictsIndexes = await db.collection('syncConflicts').indexes();

        const hasChangeLogsUserTimestamp = changeLogsIndexes.some(
          (idx: any) => idx.key && idx.key.userId === 1 && idx.key.timestamp === -1
        );

        const hasChangeLogsEntityKeys = changeLogsIndexes.some(
          (idx: any) => idx.key && idx.key.entityType === 1 && idx.key.entityId === 1
        );

        const hasSyncConflictsResolvedIndex = syncConflictsIndexes.some(
          (idx: any) => idx.key && idx.key.userId === 1 && (idx.key.isResolved === 1 || idx.key.resolved === 1)
        );

        response.checks.indexes =
          hasChangeLogsUserTimestamp &&
          hasChangeLogsEntityKeys &&
          hasSyncConflictsResolvedIndex;
      } catch (error) {
        console.error('Health check failed for indexes:', error);
        response.checks.indexes = false;
      }

      // Calculate latency
      response.checks.syncLatency = Date.now() - startTime;

      // Determine overall health
      response.healthy = 
        response.checks.database &&
        Object.values(response.checks.collections).every(check => check === true) &&
        response.checks.indexes &&
        response.checks.syncLatency < 1000; // Less than 1 second latency

      return NextResponse.json(response);

    } catch (error) {
      console.error('Sync health check error:', error);
      response.healthy = false;
      response.checks.error = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(response, { status: 503 });
    }
  } catch (error) {
    console.error('Sync health check error:', error);
    return NextResponse.json(
      { 
        healthy: false, 
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}