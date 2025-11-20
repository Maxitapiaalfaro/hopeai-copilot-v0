import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/auth/middleware'
import { userIdentityFromRequest } from '@/lib/auth/server-identity'
import { getStorageAdapter } from '@/lib/server-storage-adapter'
import type { ChatState } from '@/types/clinical-types'
import { loggers } from '@/lib/logger'

function normalizeChatStateDates(session: any): ChatState {
  const s = { ...session }
  if (s?.metadata?.createdAt) s.metadata.createdAt = new Date(s.metadata.createdAt)
  s.metadata = s.metadata || { createdAt: new Date(), lastUpdated: new Date(), totalTokens: 0, fileReferences: [] }
  s.metadata.lastUpdated = new Date(s?.metadata?.lastUpdated || Date.now())
  if (Array.isArray(s.history)) {
    s.history = s.history.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp || Date.now()) }))
  }
  if (s?.riskState) {
    if (s.riskState.detectedAt) s.riskState.detectedAt = new Date(s.riskState.detectedAt)
    if (s.riskState.lastRiskCheck) s.riskState.lastRiskCheck = new Date(s.riskState.lastRiskCheck)
  }
  return s as ChatState
}

export async function POST(request: NextRequest) {
  const authError = await authMiddleware(request)
  if (authError) return authError

  const identity = await userIdentityFromRequest(request)
  const user = (request as any).user
  const userId = identity?.userId || user?.id
  const deviceIdHeader = request.headers.get('x-device-id') || request.headers.get('X-Device-Id') || undefined
  loggers.api.info('Saving chat sessions (batch)', {
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

  const sessions: any[] = Array.isArray(payload?.sessions) ? payload.sessions : []
  if (!sessions.length) {
    return NextResponse.json({ success: false, message: 'Missing sessions array' }, { status: 400 })
  }

  try {
    const storage = await getStorageAdapter()
    let savedCount = 0

    for (const session of sessions) {
      if (!session || !session.sessionId) continue
      if (session.userId && session.userId !== userId) continue
      const normalized = normalizeChatStateDates({ ...session, userId })
      loggers.api.debug('Batch normalized session', { sessionId: normalized.sessionId })
      await storage.saveChatSession(normalized)
      savedCount++
    }

    loggers.api.info('Batch save complete', { userId, savedCount, submitted: sessions.length })
    return NextResponse.json({ success: true, data: { savedCount } })
  } catch (err: any) {
    loggers.api.error('Failed to batch save sessions', err, { userId })
    return NextResponse.json({ success: false, message: err?.message ?? 'Failed to batch save sessions' }, { status: 500 })
  }
}