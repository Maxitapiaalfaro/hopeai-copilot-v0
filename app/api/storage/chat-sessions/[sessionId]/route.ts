import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/auth/middleware'
import { userIdentityFromRequest } from '@/lib/auth/server-identity'
import { getStorageAdapter } from '@/lib/server-storage-adapter'
import { loggers } from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const authError = await authMiddleware(request)
  if (authError) return authError

  const identity = await userIdentityFromRequest(request)
  const user = (request as any).user
  const userId = identity?.userId || user?.id
  const deviceIdHeader = request.headers.get('x-device-id') || request.headers.get('X-Device-Id') || undefined
  loggers.api.info('Loading chat session', { source: identity?.source || 'unknown', userId, deviceIdHeader })
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  const resolved = await params
  const { sessionId } = resolved || {}
  if (!sessionId) {
    return NextResponse.json({ success: false, message: 'Missing sessionId' }, { status: 400 })
  }

  try {
    const storage = await getStorageAdapter()
    const session = await storage.loadChatSession(sessionId)
    if (!session) {
      loggers.api.warn('Chat session not found', { sessionId, userId })
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 })
    }
    // Extra safety: ensure the requester owns the session
    if (session.userId && session.userId !== userId) {
      loggers.api.warn('Forbidden: user mismatch on load', { sessionId, ownerId: session.userId, userId })
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    loggers.api.info('Loaded chat session', { sessionId, userId })
    return NextResponse.json({ success: true, data: session })
  } catch (err: any) {
    loggers.api.error('Failed to load session', err, { sessionId, userId })
    return NextResponse.json({ success: false, message: err?.message ?? 'Failed to load session' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const authError = await authMiddleware(request)
  if (authError) return authError

  const identity = await userIdentityFromRequest(request)
  const user = (request as any).user
  const userId = identity?.userId || user?.id
  const deviceIdHeader = request.headers.get('x-device-id') || request.headers.get('X-Device-Id') || undefined
  loggers.api.info('Deleting chat session', { source: identity?.source || 'unknown', userId, deviceIdHeader })
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  const resolved = await params
  const { sessionId } = resolved || {}
  if (!sessionId) {
    return NextResponse.json({ success: false, message: 'Missing sessionId' }, { status: 400 })
  }

  try {
    const storage = await getStorageAdapter()
    const session = await storage.loadChatSession(sessionId)
    if (!session) {
      loggers.api.warn('Chat session not found (delete)', { sessionId, userId })
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 })
    }
    if (session.userId && session.userId !== userId) {
      loggers.api.warn('Forbidden: user mismatch on delete', { sessionId, ownerId: session.userId, userId })
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }

    await storage.deleteChatSession(sessionId)
    loggers.api.info('Deleted chat session', { sessionId, userId })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    loggers.api.error('Failed to delete session', err, { sessionId, userId })
    return NextResponse.json({ success: false, message: err?.message ?? 'Failed to delete session' }, { status: 500 })
  }
}