import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth/middleware';
import { syncService } from '@/lib/sync/sync-service';
import { userIdentityFromRequest } from '@/lib/auth/server-identity';

// GET /api/sync/statistics - Get sync statistics
export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (authResult) {
      return authResult;
    }

    const user = (request as any).user;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    const identity = await userIdentityFromRequest(request);
    const userId = identity?.userId || user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'No authenticated user' },
        { status: 401 }
      );
    }

    try {
      const statistics = await syncService.getSyncStatistics(userId, days);
      return NextResponse.json(statistics);
    } catch (error) {
      console.error('Error getting sync statistics:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve sync statistics' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Sync statistics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/sync/statistics/cleanup - Clean up old sync data
export async function POST(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (authResult) {
      return authResult;
    }

    const user = (request as any).user;
    const body = await request.json();
    const { daysToKeep = 30 } = body;
    const identity = await userIdentityFromRequest(request);
    const userId = identity?.userId || user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'No authenticated user' },
        { status: 401 }
      );
    }

    try {
      await syncService.cleanupOldSyncData(userId, daysToKeep);
      return NextResponse.json({
        success: true,
        message: `Old sync data cleaned up successfully (kept last ${daysToKeep} days)`,
      });
    } catch (error) {
      console.error('Error cleaning up sync data:', error);
      return NextResponse.json(
        { error: 'Failed to clean up sync data' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Sync cleanup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}