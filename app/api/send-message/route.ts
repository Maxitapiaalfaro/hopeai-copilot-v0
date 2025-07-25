import { NextRequest, NextResponse } from 'next/server'
import { hopeAI } from '@/lib/hopeai-system'

export async function POST(request: NextRequest) {
  try {
    const { sessionId, message, useStreaming = true } = await request.json()
    
    console.log('🔄 API: Enviando mensaje...', {
      sessionId,
      message: message.substring(0, 50) + '...',
      useStreaming
    })
    
    // Asegurar que el sistema esté inicializado
    await hopeAI.initialize()
    
    const { response, updatedState } = await hopeAI.sendMessage(sessionId, message, useStreaming)
    
    if (useStreaming) {
      // Para streaming, necesitamos manejar la respuesta de manera especial
      console.log('✅ API: Mensaje enviado (streaming)')
      
      // Convertir el stream a texto completo y actualizar el historial
      let fullResponse = ""
      for await (const chunk of response) {
        const chunkText = chunk.text || ""
        fullResponse += chunkText
      }
      
      // Agregar la respuesta completa al historial de la sesión
      const aiMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: fullResponse,
        role: "model" as const,
        agent: updatedState.activeAgent,
        timestamp: new Date(),
      }
      
      updatedState.history.push(aiMessage)
      updatedState.metadata.lastUpdated = new Date()
      
      // Guardar el estado actualizado
       await hopeAI.storageAdapter.saveChatSession(updatedState)
      
      return NextResponse.json({
        success: true,
        response: {
          type: 'streaming',
          text: fullResponse
        },
        updatedState
      })
    } else {
      // Para respuestas no-streaming
      console.log('✅ API: Mensaje enviado (no-streaming)')
      
      return NextResponse.json({
        success: true,
        response: {
          type: 'text',
          text: response.text
        },
        updatedState
      })
    }
  } catch (error) {
    console.error('❌ API Error (Send Message):', error)
    return NextResponse.json(
      { 
        error: 'Error al enviar mensaje',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}