import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/auth/middleware'
import { userIdentityFromRequest } from '@/lib/auth/server-identity'
import { getStorageAdapter } from '@/lib/server-storage-adapter'
import type { FichaClinicaState } from '@/types/clinical-types'
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

  const ficha: FichaClinicaState | null = payload?.fichaId ? payload : payload?.ficha ?? null
  if (!ficha || !ficha.fichaId) {
    return NextResponse.json({ success: false, message: 'Missing ficha data or fichaId' }, { status: 400 })
  }

  try {
    const storage = await getStorageAdapter()
    await storage.saveFichaClinica({
      ...ficha,
      ultimaActualizacion: new Date(ficha.ultimaActualizacion || Date.now()),
    })
    loggers.api.info('Ficha clinica saved', { fichaId: ficha.fichaId, userId })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    loggers.api.error('Failed to save ficha clinica', err, { userId })
    return NextResponse.json({ success: false, message: err?.message ?? 'Failed to save ficha clinica' }, { status: 500 })
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
  const pacienteId = searchParams.get('pacienteId') || undefined
  const fichaId = searchParams.get('fichaId') || undefined

  try {
    const storage = await getStorageAdapter()
    if (fichaId) {
      const ficha = await storage.getFichaClinicaById(fichaId)
      return NextResponse.json({ success: true, data: ficha })
    }
    if (pacienteId) {
      const fichas = await storage.getFichasClinicasByPaciente(pacienteId)
      return NextResponse.json({ success: true, data: fichas })
    }
    return NextResponse.json({ success: false, message: 'Missing pacienteId or fichaId' }, { status: 400 })
  } catch (err: any) {
    loggers.api.error('Failed to fetch fichas clinicas', err, { userId })
    return NextResponse.json({ success: false, message: err?.message ?? 'Failed to fetch fichas clinicas' }, { status: 500 })
  }
}

