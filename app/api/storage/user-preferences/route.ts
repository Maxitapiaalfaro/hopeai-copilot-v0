import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/auth/middleware'
import { userIdentityFromRequest } from '@/lib/auth/server-identity'
import { connectToDatabase } from '@/lib/database/mongodb'
import { loggers } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const authError = await authMiddleware(request)
  if (authError) return authError

  const identity = await userIdentityFromRequest(request)
  const user = (request as any).user
  const userId = identity?.userId || user?.id
  if (!userId) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })

  try {
    const db = await connectToDatabase()
    const prefs = await db.collection('userPreferences').findOne({ userId })
    return NextResponse.json({ success: true, data: prefs || null })
  } catch (err: any) {
    loggers.api.error('Failed to get user preferences', err, { userId })
    return NextResponse.json({ success: false, message: err?.message ?? 'Failed to get user preferences' }, { status: 500 })
  }
}

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

  try {
    const db = await connectToDatabase()
    const doc = { userId, ...payload, updatedAt: new Date() }
    await db.collection('userPreferences').updateOne(
      { userId },
      { $set: doc },
      { upsert: true, writeConcern: { w: 'majority' } }
    )
    loggers.api.info('User preferences upserted', { userId })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    loggers.api.error('Failed to upsert user preferences', err, { userId })
    return NextResponse.json({ success: false, message: err?.message ?? 'Failed to upsert user preferences' }, { status: 500 })
  }
}

