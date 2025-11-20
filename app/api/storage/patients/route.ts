import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/auth/middleware'
import { userIdentityFromRequest } from '@/lib/auth/server-identity'
import { databaseService } from '@/lib/database/database-service'
import { loggers } from '@/lib/logger'

function now(d?: any) {
  return d instanceof Date ? d : new Date(d || Date.now())
}

export async function POST(request: NextRequest) {
  const authError = await authMiddleware(request)
  if (authError) return authError

  const identity = await userIdentityFromRequest(request)
  const user = (request as any).user
  const userId = identity?.userId || user?.id
  const deviceIdHeader = request.headers.get('x-device-id') || request.headers.get('X-Device-Id') || undefined
  if (!userId) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })

  let payload: any
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON payload' }, { status: 400 })
  }

  const rec = payload?.id ? payload : payload?.patient ?? null
  if (!rec || !rec.id) {
    return NextResponse.json({ success: false, message: 'Missing patient data or id' }, { status: 400 })
  }

  try {
    await databaseService.initialize()
    const coll = databaseService.patients

    const patientDoc: any = {
      patientId: rec.id,
      userId,
      deviceId: deviceIdHeader || identity?.deviceId || 'unknown',
      basicInfo: {
        name: rec.displayName || rec.basicInfo?.name || 'Paciente',
        dateOfBirth: rec.basicInfo?.dateOfBirth ? now(rec.basicInfo?.dateOfBirth) : undefined,
        gender: rec.basicInfo?.gender,
        phone: rec.basicInfo?.phone,
        email: rec.basicInfo?.email,
        address: rec.basicInfo?.address,
        emergencyContact: rec.basicInfo?.emergencyContact,
      },
      clinicalInfo: {
        diagnosis: rec.clinicalInfo?.diagnosis || [],
        treatmentPlan: rec.clinicalInfo?.treatmentPlan,
        medications: rec.clinicalInfo?.medications || [],
        allergies: rec.clinicalInfo?.allergies || [],
        medicalHistory: rec.clinicalInfo?.medicalHistory || [],
      },
      sessions: Array.isArray(rec.sessions) ? rec.sessions.map((s: any) => ({
        sessionId: s.sessionId || rec.id,
        date: now(s.date || s.metadata?.createdAt || Date.now()),
        duration: s.duration || s.metadata?.sessionDuration || 50,
        type: s.type || 'individual',
        notes: s.notes,
        nextAppointment: s.nextAppointment ? now(s.nextAppointment) : undefined,
        billingCode: s.billingCode,
      })) : [],
      files: Array.isArray(rec.attachments) ? rec.attachments.map((f: any) => f.id) : [],
      metadata: rec.summaryCache || rec.metadata || {},
      isActive: rec.isActive !== false,
      createdAt: now(rec.createdAt),
      updatedAt: now(),
      lastSessionAt: rec.lastSessionAt ? now(rec.lastSessionAt) : undefined,
    }

    await coll.updateOne(
      { userId, patientId: rec.id },
      { $set: patientDoc },
      { upsert: true, writeConcern: { w: 'majority' } }
    )

    loggers.api.info('Patient upserted', { userId, patientId: rec.id })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    loggers.api.error('Failed to upsert patient', err, { userId })
    return NextResponse.json({ success: false, message: err?.message ?? 'Failed to upsert patient' }, { status: 500 })
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
  const pageSizeParam = searchParams.get('pageSize')
  const pageToken = searchParams.get('pageToken') || undefined
  const pageSize = pageSizeParam ? Math.max(1, Math.min(200, parseInt(pageSizeParam, 10))) : 50

  try {
    await databaseService.initialize()
    const totalCount = await databaseService.patients.countDocuments({ userId })
    const query: Record<string, any> = { userId }
    if (pageToken) {
      const tokenDate = new Date(pageToken)
      query.updatedAt = { $lt: tokenDate }
    }
    const docs = await databaseService.patients.find(query).sort({ updatedAt: -1 }).limit(pageSize).toArray()
    return NextResponse.json({ success: true, data: { items: docs, totalCount, hasNextPage: docs.length === pageSize, nextPageToken: docs.length ? (docs[docs.length - 1].updatedAt as Date).toISOString() : undefined } })
  } catch (err: any) {
    loggers.api.error('Failed to list patients', err, { userId })
    return NextResponse.json({ success: false, message: err?.message ?? 'Failed to list patients' }, { status: 500 })
  }
}

