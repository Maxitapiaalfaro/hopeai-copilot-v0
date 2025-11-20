import { NextRequest, NextResponse } from 'next/server'
import { getGlobalOrchestrationSystem } from '@/lib/hopeai-system'
import { userIdentityFromRequest } from '@/lib/auth/server-identity'
import { deviceTrustService } from '@/lib/security/device-trust'

// POST: Create new session
export async function POST(request: NextRequest) {
  try {
    const { mode, agent, patientSessionMeta, userId: userIdFromBody } = await request.json()
    const identity = await userIdentityFromRequest(request)
    const userId = identity?.userId || userIdFromBody
    const deviceId = identity?.deviceId
    
    if (!userId) {
      return NextResponse.json({ error: 'No authenticated user' }, { status: 401 })
    }

    console.log('🔄 API: Creando nueva sesión...', { userId, mode, agent, deviceId })
    
    const hopeAISystem = await getGlobalOrchestrationSystem()

    // Crear sesión clínica usando el sistema HopeAI
    const { sessionId, chatState } = await hopeAISystem.createClinicalSession(
      userId,
      mode,
      agent,
      undefined,
      patientSessionMeta
    )

    // Registrar o actualizar el dispositivo si está disponible
    if (deviceId) {
      await deviceTrustService.ensureDeviceRegistered(userId, deviceId)
    }

    console.log('✅ API: Sesión creada exitosamente', { sessionId })

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
    const identity = await userIdentityFromRequest(request)
    const userIdFromQuery = searchParams.get('userId')
    const userId = identity?.userId || userIdFromQuery
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId es requerido' },
        { status: 400 }
      )
    }
    
    console.log('🔄 API: Obteniendo sesiones del usuario:', userId)
    
    // Obtener sesiones del usuario mediante el singleton de HopeAI
    const hopeAISystem = await getGlobalOrchestrationSystem()
    const sessions = await hopeAISystem.getUserSessions(userId)
    
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