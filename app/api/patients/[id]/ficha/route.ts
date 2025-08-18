import { NextRequest, NextResponse } from 'next/server'
import { clinicalTaskOrchestrator } from '@/lib/clinical-task-orchestrator'
import { getStorageAdapter } from '@/lib/server-storage-adapter'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json()
    const { fichaId, sessionId, sessionState, patientForm, conversationSummary } = body
    if (!fichaId) {
      return NextResponse.json({ error: 'fichaId es requerido' }, { status: 400 })
    }
    const { id } = await params
    let effectiveSessionState = sessionState
    if (!effectiveSessionState && sessionId) {
      const storage = await getStorageAdapter()
      const loaded = await storage.loadChatSession(sessionId)
      if (!loaded) {
        return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
      }
      effectiveSessionState = loaded
    }
    if (!effectiveSessionState) {
      return NextResponse.json({ error: 'Debe proveerse sessionId o sessionState' }, { status: 400 })
    }
    await clinicalTaskOrchestrator.generateFichaClinica({
      fichaId,
      pacienteId: id,
      sessionState: effectiveSessionState,
      patientForm,
      conversationSummary
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 })
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const storage = await getStorageAdapter()
    const { id } = await params
    const fichas = await storage.getFichasClinicasByPaciente(id)
    return NextResponse.json({ items: fichas })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 })
  }
}


