import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/auth/middleware'
import { userIdentityFromRequest } from '@/lib/auth/server-identity'
import { connectToDatabase } from '@/lib/database/mongodb'
import { loggers } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const authError = await authMiddleware(request)
  if (authError) return authError

  const identity = await userIdentityFromRequest(request)
  const user = (request as any).user
  const userId = identity?.userId || user?.id
  if (!userId) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })

  let payload: any
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON payload' }, { status: 400 })
  }

  const rec = payload?.analysisId ? payload : payload?.analysis ?? null
  if (!rec || !rec.analysisId) {
    return NextResponse.json({ success: false, message: 'Missing analysis data or analysisId' }, { status: 400 })
  }

  try {
    const db = await connectToDatabase()
    const coll = db.collection('patternAnalyses')
    const doc = {
      analysisId: rec.analysisId,
      userId,
      patientId: rec.patientId,
      status: rec.status || 'completed',
      analysis: rec.analysis,
      error: rec.error,
      createdAt: new Date(rec.createdAt || Date.now()),
      completedAt: rec.completedAt ? new Date(rec.completedAt) : undefined,
      viewedAt: rec.viewedAt ? new Date(rec.viewedAt) : undefined,
      viewCount: rec.viewCount || 0,
      dismissedAt: rec.dismissedAt ? new Date(rec.dismissedAt) : undefined,
      feedback: rec.feedback,
      domainValidations: rec.domainValidations,
      updatedAt: new Date(),
    }
    await coll.updateOne(
      { userId, analysisId: rec.analysisId },
      { $set: doc },
      { upsert: true, writeConcern: { w: 'majority' } }
    )
    loggers.api.info('Pattern analysis upserted', { userId, analysisId: rec.analysisId })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    loggers.api.error('Failed to upsert pattern analysis', err, { userId })
    return NextResponse.json({ success: false, message: err?.message ?? 'Failed to upsert pattern analysis' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const authError = await authMiddleware(request)
  if (authError) return authError

  const identity = await userIdentityFromRequest(request)
  const user = (request as any).user
  const userId = identity?.userId || user?.id
  if (!userId) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const patientId = searchParams.get('patientId') || undefined

  try {
    const db = await connectToDatabase()
    const coll = db.collection('patternAnalyses')
    const query: Record<string, any> = { userId }
    if (patientId) query.patientId = patientId
    const docs = await coll.find(query).sort({ createdAt: -1 }).toArray()
    return NextResponse.json({ success: true, data: docs })
  } catch (err: any) {
    loggers.api.error('Failed to list pattern analyses', err, { userId })
    return NextResponse.json({ success: false, message: err?.message ?? 'Failed to list pattern analyses' }, { status: 500 })
  }
}

