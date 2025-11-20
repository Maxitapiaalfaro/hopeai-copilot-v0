import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth/middleware';
import { syncService } from '@/lib/sync/sync-service';
import { userIdentityFromRequest } from '@/lib/auth/server-identity';

// GET /api/sync/status - Get sync status
export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (authResult) {
      return authResult;
    }

    const user = (request as any).user;
    const { searchParams } = new URL(request.url);
    const identity = await userIdentityFromRequest(request);
    const userId = identity?.userId || user?.id;
    const deviceId = searchParams.get('deviceId') || identity?.deviceId || user?.deviceId;

    if (!userId || !deviceId) {
      return NextResponse.json({ error: 'Missing required parameters: user or deviceId' }, { status: 400 });
    }

    const syncStatus = await syncService.getSyncStatus(userId, deviceId);
    return NextResponse.json(syncStatus);
  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/sync/status - Update sync status
export async function POST(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (authResult) {
      return authResult;
    }

    const user = (request as any).user;
    const body = await request.json();
    const identity = await userIdentityFromRequest(request);
    const { deviceId: deviceIdInput, lastSyncAt, syncHealth } = body;
    const userId = identity?.userId || user?.id;
    const deviceId = deviceIdInput || identity?.deviceId || user?.deviceId;

    if (!userId || !deviceId) {
      return NextResponse.json({ error: 'Missing required parameters: user or deviceId' }, { status: 400 });
    }

    await syncService.updateSyncStatus(userId, deviceId, {
      lastSyncAt: lastSyncAt ? new Date(lastSyncAt) : new Date(),
      syncHealth: syncHealth || {},
    });

    return NextResponse.json({
      success: true,
      message: 'Sync status updated successfully',
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync status update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}