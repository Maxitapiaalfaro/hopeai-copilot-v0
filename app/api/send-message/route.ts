import { NextRequest, NextResponse } from 'next/server'
import { hopeAI } from '@/lib/hopeai-system'
import { getGlobalOrchestrationSystem } from '@/lib/hopeai-system'
import { sentryMetricsTracker } from '@/lib/sentry-metrics-tracker'
import * as Sentry from '@sentry/nextjs'
import type { AgentType } from '@/types/clinical-types'

export async function POST(request: NextRequest) {
  let requestBody: any
  const startTime = Date.now();
  
  try {
    requestBody = await request.json()
    const { sessionId, message, useStreaming = true, userId = 'default-user', suggestedAgent } = requestBody
    
    console.log('🔄 API: Enviando mensaje con sistema optimizado...', {
      sessionId,
      message: message.substring(0, 50) + '...',
      useStreaming,
      userId,
      suggestedAgent,
      sessionId
    })
    
    // Obtener el sistema de orquestación optimizado (singleton)
    const orchestrationSystem = await getGlobalOrchestrationSystem()
    
    // Usar el método sendMessage optimizado del sistema de orquestación
    const result = await orchestrationSystem.sendMessage(
      sessionId,
      message,
      useStreaming,
      suggestedAgent,
      // Files are now loaded from session automatically
    )
    
    console.log('🎯 Orquestación optimizada completada:', {
      sessionId: result.updatedState.sessionId,
      agentType: result.updatedState.activeAgent,
      responseLength: result.response?.text?.length || 0
    })
    
    // Usar los resultados del sistema optimizado
    const response = result.response
    const updatedState = result.updatedState
    
    // El estado ya se guarda automáticamente en hopeAI.sendMessage() usando saveChatSessionBoth
    // await hopeAI.storageAdapter.saveChatSession(updatedState)
    
    // Calcular tiempo de respuesta y registrar métricas
    const responseTime = Date.now() - startTime;
    const activeAgent: AgentType = result.updatedState.activeAgent as AgentType || 'socratico';
    
    // Actualizar actividad de sesión con el agente correcto
    sentryMetricsTracker.updateSessionActivity(userId, sessionId, activeAgent);
    
    // Registrar métricas del mensaje del usuario con sistema optimizado
    sentryMetricsTracker.trackMessageSent({
      userId,
      sessionId,
      agentType: activeAgent,
      timestamp: new Date(),
      messageLength: message.length,
      responseTime
    });
    
    // Retornar respuesta optimizada usando ReadableStream
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        
        // Enviar el resultado como JSON
        const jsonResponse = JSON.stringify({
          success: true,
          sessionId: result.updatedState.sessionId,
          response: result.response,
          updatedState: result.updatedState,
          optimized: true // Flag para indicar uso del singleton optimizado
        })
        
        controller.enqueue(encoder.encode(jsonResponse))
        controller.close()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('❌ Error en API optimizada de send-message:', error)
    
    // Seguimiento mejorado de errores
    Sentry.captureException(error, {
      tags: {
        context: 'send-message-api-optimized',
        sessionId: requestBody?.sessionId,
        userId: requestBody?.userId
      }
    })
    
    return NextResponse.json(
      { 
        error: 'Error al procesar mensaje con sistema optimizado',
        details: error instanceof Error ? error.message : 'Error desconocido',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}