import { NextRequest, NextResponse } from 'next/server'
import { getGlobalOrchestrationSystem } from '@/lib/orchestration-singleton'

export async function POST(request: NextRequest) {
  try {
    const { sessionId, newAgent } = await request.json()
    
    console.log('🔄 API: Cambiando agente...', { sessionId, newAgent })
    
    const orchestrationSystem = await getGlobalOrchestrationSystem()
    
    // Usar el sistema de orquestación para manejar el cambio de agente
    const result = await orchestrationSystem.orchestrate(
      `Cambiar al agente: ${newAgent}`,
      sessionId,
      'default-user',
      {
        forceMode: 'dynamic',
        previousAgent: newAgent
      }
    )
    
    console.log('✅ API: Agente cambiado exitosamente')
    
    return NextResponse.json({
      success: true,
      result
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