import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/auth/middleware'
import { syncService } from '@/lib/sync/sync-service'
import { userIdentityFromRequest } from '@/lib/auth/server-identity'

// GET /api/storage/sync-metadata
// Devuelve SyncMetadata alineado con UnifiedStorageAdapter usando la información del sync status
export async function GET(request: NextRequest) {
  try {
    const authError = await authMiddleware(request)
    if (authError) return authError

    const user = (request as any).user
    const identity = await userIdentityFromRequest(request)
    const userId = identity?.userId || user?.id
    const deviceId = identity?.deviceId || user?.deviceId

    if (!userId || !deviceId) {
      return NextResponse.json(
        { error: 'Missing required parameters: userId or deviceId' },
        { status: 400 }
      )
    }

    const status = await syncService.getSyncStatus(userId, deviceId)

    // Mapear SyncStatus -> SyncMetadata
    const lastSyncAt = status.lastSyncAt || new Date(0)
    const metadata = {
      lastSyncAt,
      lastLocalUpdate: lastSyncAt,
      lastServerUpdate: lastSyncAt,
      syncVersion: status.syncHealth?.totalChanges || 0,
      checksum: `server-${userId}-${status.syncHealth?.totalChanges || 0}`,
      deviceId,
      userId,
    }

    // Responder con envoltura { success, data }
    return NextResponse.json({ success: true, data: metadata })
  } catch (error) {
    console.error('GET /api/storage/sync-metadata error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/storage/sync-metadata
// Actualiza el estado de sync del servidor utilizando lastSyncAt
export async function PUT(request: NextRequest) {
  try {
    const authError = await authMiddleware(request)
    if (authError) return authError

    const user = (request as any).user
    const identity = await userIdentityFromRequest(request)
    const userId = identity?.userId || user?.id
    const deviceId = identity?.deviceId || user?.deviceId

    if (!userId || !deviceId) {
      return NextResponse.json(
        { error: 'Missing required parameters: userId or deviceId' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const lastSyncAtRaw = body?.lastSyncAt
    const lastSyncAt = lastSyncAtRaw ? new Date(lastSyncAtRaw) : new Date()

    if (isNaN(lastSyncAt.getTime())) {
      return NextResponse.json(
        { error: 'Invalid lastSyncAt format' },
        { status: 400 }
      )
    }

    await syncService.updateSyncStatus(userId, deviceId, { lastSyncAt })

    return NextResponse.json({ success: true, message: 'Sync metadata updated', serverTime: new Date().toISOString() })
  } catch (error) {
    console.error('PUT /api/storage/sync-metadata error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}