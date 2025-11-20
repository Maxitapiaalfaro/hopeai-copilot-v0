import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/auth/middleware'
import { databaseService } from '@/lib/database'
import { userIdentityFromRequest } from '@/lib/auth/server-identity'

// Helper: map server entity types to UnifiedStorage entity types
function mapEntityType(t: string): 'chat' | 'patient' | 'file' {
  if (t === 'session') return 'chat'
  if (t === 'patient') return 'patient'
  return 'file'
}

// Helper: get current states for patient/file entities
async function getCurrentEntityStates(entityIds: string[], userId: string): Promise<Record<string, any>> {
  const states: Record<string, any> = {}

  // Patients
  const patients = await databaseService.patients
    .find({ patientId: { $in: entityIds }, userId, isActive: true })
    .toArray()

  patients.forEach(p => {
    states[p.patientId] = { type: 'patient', data: p }
  })

  // Files
  const files = await databaseService.files
    .find({ fileId: { $in: entityIds }, userId, isActive: true })
    .toArray()

  files.forEach(f => {
    states[f.fileId] = { type: 'file', data: f }
  })

  return states
}

// GET /api/storage/changes?since=ISO_DATE[&entityTypes=a,b]
// Devuelve un array ChangeRecord[] para el cliente remoto
export async function GET(request: NextRequest) {
  try {
    const authError = await authMiddleware(request)
    if (authError) return authError

    const user = (request as any).user
    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since')
    const entityTypes = searchParams.get('entityTypes')?.split(',').filter(Boolean)

    const identity = await userIdentityFromRequest(request)
    const userId = identity?.userId || user?.id
    const deviceId = identity?.deviceId || user?.deviceId

    if (!since || !userId || !deviceId) {
      return NextResponse.json(
        { error: 'Missing required parameters: since, userId, or deviceId' },
        { status: 400 }
      )
    }

    const sinceTimestamp = new Date(since)
    if (isNaN(sinceTimestamp.getTime())) {
      return NextResponse.json({ error: 'Invalid timestamp format' }, { status: 400 })
    }

    await databaseService.initialize()

    const query: any = {
      userId,
      timestamp: { $gt: sinceTimestamp },
      deviceId: { $ne: deviceId },
    }
    if (entityTypes && entityTypes.length > 0) {
      query.entityType = { $in: entityTypes }
    }

    const changes = await databaseService.changeLogs
      .find(query)
      .sort({ timestamp: 1 })
      .toArray()

    const entityIds = changes.map(c => c.entityId)
    const currentStates = await getCurrentEntityStates(entityIds, userId)

    const changeRecords = changes.map(ch => {
      const et = mapEntityType(ch.entityType as any)
      const current = currentStates[ch.entityId]?.data
      const data = current || ch.newValues || ch.changes || { id: ch.entityId }
      return {
        id: ch.changeId,
        operation: ch.operation,
        entityType: et,
        entityId: ch.entityId,
        timestamp: ch.timestamp,
        data,
        previousData: ch.previousValues,
        userId,
        deviceId: ch.deviceId,
        syncStatus: (ch.syncStatus === 'failed' ? 'pending' : 'synced') as 'pending' | 'synced' | 'conflict',
        version: 1,
      }
    })

    // Envolver como { success, data }
    return NextResponse.json({ success: true, data: changeRecords })
  } catch (error) {
    console.error('GET /api/storage/changes error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}