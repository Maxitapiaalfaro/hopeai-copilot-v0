import { NextRequest, NextResponse } from 'next/server'
import { hopeAI } from '@/lib/hopeai-system'

export async function POST(request: NextRequest) {
  try {
    const { sessionId, newAgent } = await request.json()
    
    console.log('🔄 API: Cambiando agente...', { sessionId, newAgent })
    
    // Asegurar que el sistema esté inicializado
    await hopeAI.initialize()
    
    const updatedState = await hopeAI.switchAgent(sessionId, newAgent)
    
    console.log('✅ API: Agente cambiado exitosamente')
    
    return NextResponse.json({
      success: true,
      updatedState
    })
  } catch (error) {
    console.error('❌ API Error (Switch Agent):', error)
    return NextResponse.json(
      { 
        error: 'Error al cambiar agente',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}