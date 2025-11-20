import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/auth/middleware'
import { userIdentityFromRequest } from '@/lib/auth/server-identity'
import { getStorageAdapter } from '@/lib/server-storage-adapter'
import type { ChatState, PaginationOptions } from '@/types/clinical-types'
import { loggers } from '@/lib/logger'

function normalizeChatStateDates(session: any): ChatState {
  const s = { ...session }
  // metadata dates
  if (s?.metadata?.createdAt) s.metadata.createdAt = new Date(s.metadata.createdAt)
  s.metadata = s.metadata || { createdAt: new Date(), lastUpdated: new Date(), totalTokens: 0, fileReferences: [] }
  s.metadata.lastUpdated = new Date(s?.metadata?.lastUpdated || Date.now())

  // history timestamps
  if (Array.isArray(s.history)) {
    s.history = s.history.map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp || Date.now()),
    }))
  }

  // riskState dates
  if (s?.riskState) {
    if (s.riskState.detectedAt) s.riskState.detectedAt = new Date(s.riskState.detectedAt)
    if (s.riskState.lastRiskCheck) s.riskState.lastRiskCheck = new Date(s.riskState.lastRiskCheck)
  }

  return s as ChatState
}

export async function POST(request: NextRequest) {
  // Autenticación obligatoria
  const authError = await authMiddleware(request)
  if (authError) return authError

  const identity = await userIdentityFromRequest(request)
  const user = (request as any).user
  const userId = identity?.userId || user?.id
  const deviceIdHeader = request.headers.get('x-device-id') || request.headers.get('X-Device-Id') || undefined
  loggers.api.info('Saving chat session (single)', {
    source: identity?.source || 'unknown',
    userId,
    deviceIdHeader,
  })
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  let payload: any
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON payload' }, { status: 400 })
  }

  const session: any = payload?.sessionId ? payload : payload?.session ?? null
  if (!session || !session.sessionId) {
    return NextResponse.json({ success: false, message: 'Missing session data or sessionId' }, { status: 400 })
  }

  if (session.userId && session.userId !== userId) {
    return NextResponse.json({ success: false, message: 'Forbidden: user mismatch' }, { status: 403 })
  }

  try {
    const storage = await getStorageAdapter()
    const normalized = normalizeChatStateDates({ ...session, userId })
    loggers.api.debug('Normalized chat session before save', {
      sessionId: normalized.sessionId,
      historyCount: Array.isArray(normalized.history) ? normalized.history.length : 0,
    })
    await storage.saveChatSession(normalized)
    loggers.api.info('Chat session saved', { sessionId: normalized.sessionId, userId })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    loggers.api.error('Failed to save chat session', err, { userId, sessionId: session?.sessionId })
    return NextResponse.json({ success: false, message: err?.message ?? 'Failed to save chat session' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const authError = await authMiddleware(request)
  if (authError) return authError

  const identity = await userIdentityFromRequest(request)
  const user = (request as any).user
  const userId = identity?.userId || user?.id
  const deviceIdHeader = request.headers.get('x-device-id') || request.headers.get('X-Device-Id') || undefined
  loggers.api.info('Listing user chat sessions (paginated)', {
    source: identity?.source || 'unknown',
    userId,
    deviceIdHeader,
  })
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const pageSizeParam = searchParams.get('pageSize')
  const pageToken = searchParams.get('pageToken') || undefined
  const sortBy = (searchParams.get('sortBy') as PaginationOptions['sortBy']) || 'lastUpdated'
  const sortOrder = (searchParams.get('sortOrder') as PaginationOptions['sortOrder']) || 'desc'
  const pageSize = pageSizeParam ? Math.max(1, Math.min(200, parseInt(pageSizeParam, 10))) : 50

  try {
    const storage = await getStorageAdapter()
    loggers.api.debug('Pagination options', { pageSize, pageToken, sortBy, sortOrder })
    const data = await storage.getUserSessionsPaginated(userId, {
      pageSize,
      pageToken,
      sortBy,
      sortOrder,
    })
    loggers.api.info('Fetched chat sessions', { userId, count: data.items.length, totalCount: data.totalCount })
    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    loggers.api.error('Failed to fetch sessions', err, { userId })
    return NextResponse.json({ success: false, message: err?.message ?? 'Failed to fetch sessions' }, { status: 500 })
  }
}