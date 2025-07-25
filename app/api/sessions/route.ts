import { NextRequest, NextResponse } from 'next/server'
import { getGlobalOrchestrationSystem } from '@/lib/orchestration-singleton'

// POST: Create new session
export async function POST(request: NextRequest) {
  try {
    const { userId, mode, agent } = await request.json()
    
    console.log('🔄 API: Creando nueva sesión...', { userId, mode, agent })
    
    const orchestrationSystem = await getGlobalOrchestrationSystem()
    
    // Usar el sistema de orquestación para crear la sesión
    const sessionId = `new-session-${Date.now()}`
    const result = await orchestrationSystem.orchestrate(
      `Crear nueva sesión clínica`,
      sessionId,
      userId,
      {
        forceMode: 'dynamic',
        previousAgent: agent
      }
    )
    
    console.log('✅ API: Sesión creada exitosamente')
    
    return NextResponse.json({
      success: true,
      result
    })
  } catch (error) {
    console.error('❌ API Error (Create Session):', error)
    return NextResponse.json(
      { 
        error: 'Error al crear sesión',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

// GET: Get user sessions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId es requerido' },
        { status: 400 }
      )
    }
    
    console.log('🔄 API: Obteniendo sesiones del usuario:', userId)
    
    // Asegurar que el sistema esté inicializado
    const orchestrationSystem = await getGlobalOrchestrationSystem()
    
    // Por ahora retornamos un array vacío ya que la funcionalidad de getUserSessions
    // necesita ser implementada en el nuevo sistema
    const sessions: any[] = []
    
    console.log('✅ API: Sesiones obtenidas:', sessions.length)
    
    return NextResponse.json({
      success: true,
      sessions
    })
  } catch (error) {
    console.error('❌ API Error (Get Sessions):', error)
    return NextResponse.json(
      { 
        error: 'Error al obtener sesiones',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}