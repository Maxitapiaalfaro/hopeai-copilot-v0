import { NextRequest, NextResponse } from 'next/server'
import { hopeAI } from '@/lib/hopeai-system'
import { getGlobalOrchestrationSystem } from '@/lib/orchestration-singleton'

export async function POST(request: NextRequest) {
  let requestBody: any
  
  try {
    requestBody = await request.json()
    const { sessionId, message, useStreaming = true, userId = 'default-user' } = requestBody
    
    console.log('🔄 API: Enviando mensaje...', {
      sessionId,
      message: message.substring(0, 50) + '...',
      useStreaming,
      userId
    })
    
    // Obtener el sistema de orquestación singleton
    const orchestrationSystem = await getGlobalOrchestrationSystem()
    
    // Cargar el estado de la sesión para obtener el historial (o crear uno nuevo si no existe)
    let sessionState
    try {
      sessionState = await hopeAI.storageAdapter.loadChatSession(sessionId)
    } catch (error) {
      // Si la sesión no existe, crear una nueva
      console.log('📝 Creando nueva sesión:', sessionId)
      sessionState = null
    }
    
    // Usar el sistema de orquestación avanzado
    const orchestrationResult = await orchestrationSystem.orchestrate(
      message,
      sessionId,
      userId,
      {
        sessionHistory: sessionState?.history?.map((msg: any) => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        })) || [],
        previousAgent: sessionState?.activeAgent,
        enableMonitoring: true,
        forceMode: 'dynamic' // Forzar modo dinámico
      }
    )
    
    console.log('🎯 Orquestación completada:', {
      selectedAgent: orchestrationResult.selectedAgent,
      orchestrationType: orchestrationResult.orchestrationType,
      confidence: orchestrationResult.confidence,
      toolsUsed: orchestrationResult.availableTools?.length || 0
    })
    
    // Procesar la respuesta según el tipo de orquestación
    let response: any
    let updatedState: any
    
    if (orchestrationResult.orchestrationType === 'dynamic') {
      // Para orquestación dinámica, necesitamos generar la respuesta usando el agente seleccionado
      const legacyResult = await hopeAI.sendMessage(sessionId, message, useStreaming, orchestrationResult.selectedAgent)
      response = legacyResult.response
      
      // Actualizar el estado con información de orquestación
       updatedState = legacyResult.updatedState
       updatedState.activeAgent = orchestrationResult.selectedAgent
      
    } else {
      // Para orquestación legacy, usar el flujo tradicional
      const legacyResult = await hopeAI.sendMessage(sessionId, message, useStreaming, orchestrationResult.selectedAgent)
      response = legacyResult.response
      updatedState = legacyResult.updatedState
    }
    
    // Guardar el estado actualizado
    await hopeAI.storageAdapter.saveChatSession(updatedState)
    
    // Manejar respuesta según el tipo
    if (useStreaming && (orchestrationResult.orchestrationType === 'legacy' || orchestrationResult.orchestrationType === 'dynamic')) {
      // Para streaming (tanto legacy como dynamic), manejar de la misma forma
      console.log(`✅ API: Mensaje enviado (streaming ${orchestrationResult.orchestrationType})`)
      
      let fullResponse = ""
      let accumulatedGroundingUrls = []
      for await (const chunk of response) {
        const chunkText = chunk.text || ""
        fullResponse += chunkText
        
        // Acumular groundingUrls de los chunks
        if (chunk.groundingUrls && chunk.groundingUrls.length > 0) {
          accumulatedGroundingUrls = [...accumulatedGroundingUrls, ...chunk.groundingUrls]
        }
      }
      
      return NextResponse.json({
        success: true,
        response: {
          type: 'streaming',
          text: fullResponse,
          groundingUrls: accumulatedGroundingUrls,
          routingInfo: response.routingInfo
        },
        updatedState,
        orchestration: {
          type: orchestrationResult.orchestrationType,
          agent: orchestrationResult.selectedAgent,
          confidence: orchestrationResult.confidence
        }
      })
    } else {
      // Para respuestas dinámicas o no-streaming
      console.log('✅ API: Mensaje enviado', {
        type: orchestrationResult.orchestrationType,
        agent: orchestrationResult.selectedAgent
      })
      
      return NextResponse.json({
        success: true,
        response: {
          type: useStreaming ? 'streaming' : 'text',
          text: typeof response === 'string' ? response : response.text,
          groundingUrls: response.groundingUrls || [],
          routingInfo: response.routingInfo
        },
        updatedState,
        orchestration: {
          type: orchestrationResult.orchestrationType,
          agent: orchestrationResult.selectedAgent,
          confidence: orchestrationResult.confidence,
          toolsUsed: orchestrationResult.availableTools?.length || 0,
          responseTime: orchestrationResult.performanceMetrics?.totalProcessingTime
        }
      })
    }
  } catch (error) {
    console.error('❌ API Error (Send Message):', error)
    
    // Intentar fallback al sistema legacy en caso de error
    try {
      if (!requestBody) {
        throw new Error('No se pudo obtener el cuerpo de la petición')
      }
      
      const { sessionId, message, useStreaming = true } = requestBody
      console.log('🔄 Intentando fallback al sistema legacy...')
      
      await hopeAI.initialize()
      const { response, updatedState } = await hopeAI.sendMessage(sessionId, message, useStreaming)
      
      return NextResponse.json({
        success: true,
        response: {
          type: useStreaming ? 'streaming' : 'text',
          text: typeof response === 'string' ? response : response.text,
          groundingUrls: response.groundingUrls || [],
          routingInfo: response.routingInfo
        },
        updatedState,
        orchestration: {
          type: 'legacy-fallback',
          agent: updatedState.activeAgent,
          confidence: 0.5
        },
        warning: 'Se utilizó el sistema legacy debido a un error en la orquestación avanzada'
      })
    } catch (fallbackError) {
      console.error('❌ Error en fallback legacy:', fallbackError)
    }
    
    return NextResponse.json(
      { 
        error: 'Error al enviar mensaje',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}