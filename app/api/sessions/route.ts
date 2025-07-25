import { NextRequest, NextResponse } from 'next/server'
import { hopeAI } from '@/lib/hopeai-system'

// POST: Create new session
export async function POST(request: NextRequest) {
  try {
    const { userId, mode, agent } = await request.json()
    
    console.log('🔄 API: Creando nueva sesión...', { userId, mode, agent })
    
    // Asegurar que el sistema esté inicializado
    await hopeAI.initialize()
    
    const { sessionId, chatState } = await hopeAI.createClinicalSession(userId, mode, agent)
    
    console.log('✅ API: Sesión creada exitosamente:', sessionId)
    
    return NextResponse.json({
      success: true,
      sessionId,
      chatState
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
    await hopeAI.initialize()
    
    const sessions = await hopeAI.getUserSessions(userId)
    
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