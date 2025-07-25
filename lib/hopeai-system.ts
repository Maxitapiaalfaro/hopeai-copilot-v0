import { clinicalAgentRouter } from "./clinical-agent-router"
import { getStorageAdapter } from "./server-storage-adapter"
import { clinicalFileManager } from "./clinical-file-manager"
import { createIntelligentIntentRouter, type EnrichedContext } from "./intelligent-intent-router"
import type { AgentType, ClinicalMode, ChatState, ChatMessage, ClinicalFile } from "@/types/clinical-types"

export class HopeAISystem {
  private initialized = false
  private storage: any = null
  private intentRouter: any = null
  
  // Getter público para acceder al storage desde la API
  get storageAdapter() {
    return this.storage
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // Inicializar el storage adapter
      this.storage = await getStorageAdapter()
      
      // Asegurar que el storage esté inicializado
      if (this.storage && typeof this.storage.initialize === 'function') {
        await this.storage.initialize()
      }
      
      // Inicializar el router de intenciones inteligente
      this.intentRouter = createIntelligentIntentRouter(clinicalAgentRouter, {
        confidenceThreshold: 0.8,
        fallbackAgent: 'socratico',
        enableLogging: true,
        maxRetries: 2
      })
      
      this.initialized = true
      console.log("HopeAI System initialized successfully with Intelligent Intent Router")
    } catch (error) {
      console.error("Failed to initialize HopeAI System:", error)
      throw error
    }
  }

  async createClinicalSession(
    userId: string,
    mode: ClinicalMode,
    agent: AgentType,
    sessionId?: string,
  ): Promise<{ sessionId: string; chatState: ChatState }> {
    if (!this.initialized) await this.initialize()

    const finalSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    let chatHistory: ChatMessage[] = []

    // Try to restore existing session
    if (sessionId) {
      const existingState = await this.storage.loadChatSession(sessionId)
      if (existingState) {
        chatHistory = existingState.history
      }
    }

    // Create chat session with agent router
    await clinicalAgentRouter.createChatSession(finalSessionId, agent, chatHistory)

    // Create initial chat state
    const chatState: ChatState = {
      sessionId: finalSessionId,
      userId,
      mode,
      activeAgent: agent,
      history: chatHistory,
      metadata: {
        createdAt: new Date(),
        lastUpdated: new Date(),
        totalTokens: 0,
        fileReferences: [],
      },
      clinicalContext: {
        sessionType: mode,
        confidentialityLevel: "high",
      },
    }

    // Save initial state
    await this.storage.saveChatSession(chatState)

    return { sessionId: finalSessionId, chatState }
  }

  async sendMessage(
    sessionId: string,
    message: string,
    useStreaming = true,
  ): Promise<{
    response: any
    updatedState: ChatState
  }> {
    if (!this.initialized) await this.initialize()

    // Load current session state
    const currentState = await this.storage.loadChatSession(sessionId)
    if (!currentState) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    try {
      // Convertir historial al formato Content[] esperado por el router
      const sessionContext = currentState.history.map((msg: ChatMessage) => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }))

      // Usar el router inteligente para clasificar la intención y enrutar automáticamente
      const routingResult = await this.intentRouter.routeUserInput(
        message,
        sessionContext,
        currentState.activeAgent
      )

      // Manejar solicitudes explícitas de cambio de agente
      if (routingResult.enrichedContext?.isExplicitRequest) {
        // Para solicitudes explícitas, NO agregamos el mensaje del usuario al historial
        // ya que es solo un comando de cambio de agente
        
        // Si se detectó un cambio de agente, actualizar la sesión
        if (routingResult.targetAgent !== currentState.activeAgent) {
          console.log(`[HopeAI] Explicit agent switch request: ${currentState.activeAgent} → ${routingResult.targetAgent}`)
          
          // Close current chat session
          clinicalAgentRouter.closeChatSession(sessionId)
          
          // Create new chat session with new agent
          await clinicalAgentRouter.createChatSession(sessionId, routingResult.targetAgent, currentState.history)
          
          // Update state
          currentState.activeAgent = routingResult.targetAgent
          currentState.metadata.lastUpdated = new Date()
        }

        // Para solicitudes explícitas, crear un prompt especial para que el agente genere la confirmación
        const confirmationPrompt = this.createAgentConfirmationPrompt(routingResult.targetAgent, message)
        
        // Enviar el prompt de confirmación al agente correspondiente con streaming
        const confirmationResponse = await clinicalAgentRouter.sendMessage(
          sessionId, 
          confirmationPrompt, 
          useStreaming, // Usar streaming también para confirmaciones
          {
            ...routingResult.enrichedContext,
            isConfirmationRequest: true
          }
        )

        // Manejar respuesta según si es streaming o no
        if (useStreaming) {
          // Para streaming, agregar routing info y retornar el generator
          if (confirmationResponse && typeof confirmationResponse[Symbol.asyncIterator] === 'function') {
            confirmationResponse.routingInfo = {
              detectedIntent: 'explicit_agent_switch',
              targetAgent: routingResult.targetAgent,
              confidence: 1.0,
              extractedEntities: routingResult.enrichedContext?.extractedEntities || [],
              isExplicitRequest: true
            }
          }
          
          return { 
            response: confirmationResponse, 
            updatedState: currentState 
          }
        } else {
          // Para no-streaming, agregar al historial y retornar
          const confirmationMessage: ChatMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content: confirmationResponse.text,
            role: "model",
            agent: currentState.activeAgent,
            timestamp: new Date(),
          }

          currentState.history.push(confirmationMessage)
          currentState.metadata.lastUpdated = new Date()
          await this.storage.saveChatSession(currentState)

          return {
            response: {
              text: confirmationResponse.text,
              routingInfo: {
                detectedIntent: 'explicit_agent_switch',
                targetAgent: routingResult.targetAgent,
                confidence: 1.0,
                extractedEntities: routingResult.enrichedContext?.extractedEntities || [],
                isExplicitRequest: true
              }
            },
            updatedState: currentState
          }
        }
      }

      // Para mensajes normales (no explícitos), agregar el mensaje del usuario al historial
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: message,
        role: "user",
        timestamp: new Date(),
      }

      currentState.history.push(userMessage)

      // Si se detectó un cambio de agente (routing automático), actualizar la sesión
      if (routingResult.targetAgent !== currentState.activeAgent) {
        console.log(`[HopeAI] Intelligent routing: ${currentState.activeAgent} → ${routingResult.targetAgent}`)
        
        // Close current chat session
        clinicalAgentRouter.closeChatSession(sessionId)
        
        // Create new chat session with new agent
        await clinicalAgentRouter.createChatSession(sessionId, routingResult.targetAgent, currentState.history)
        
        // Update state
        currentState.activeAgent = routingResult.targetAgent
        currentState.metadata.lastUpdated = new Date()
      }

      // Send message through agent router with enriched context
      const response = await clinicalAgentRouter.sendMessage(
        sessionId, 
        message, 
        useStreaming,
        routingResult.enrichedContext
      )

      // Save state with user message immediately (for both streaming and non-streaming)
      currentState.metadata.lastUpdated = new Date()
      await this.storage.saveChatSession(currentState)

      // Handle response based on streaming or not
      let responseContent = ""
      if (useStreaming) {
        // For streaming, we need to preserve the async generator while adding routing info
        // The response from clinical router is already an async generator
        const streamingResponse = response
        
        // Add routing info as a property on the async generator
        if (streamingResponse && typeof streamingResponse[Symbol.asyncIterator] === 'function') {
          streamingResponse.routingInfo = {
            detectedIntent: routingResult.enrichedContext?.detectedIntent || 'unknown',
            targetAgent: routingResult.targetAgent,
            confidence: routingResult.enrichedContext?.confidence || 0,
            extractedEntities: routingResult.enrichedContext?.extractedEntities || []
          }
        }
        
        return { 
          response: streamingResponse, 
          updatedState: currentState 
        }
      } else {
        responseContent = response.text

        // Add AI response to history
        const aiMessage: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          content: responseContent,
          role: "model",
          agent: currentState.activeAgent,
          timestamp: new Date(),
        }

        currentState.history.push(aiMessage)
      }

      // Update metadata
      currentState.metadata.lastUpdated = new Date()
      currentState.metadata.totalTokens += this.estimateTokens(message + responseContent)

      // Save updated state
      await this.storage.saveChatSession(currentState)

      return { 
        response: {
          ...response,
          routingInfo: {
            detectedIntent: routingResult.enrichedContext?.detectedIntent || 'unknown',
            targetAgent: routingResult.targetAgent,
            confidence: routingResult.enrichedContext?.confidence || 0,
            extractedEntities: routingResult.enrichedContext?.extractedEntities || []
          }
        }, 
        updatedState: currentState 
      }
    } catch (error) {
      console.error("Error sending message:", error)
      throw error
    }
  }

  async switchAgent(sessionId: string, newAgent: AgentType): Promise<ChatState> {
    if (!this.initialized) await this.initialize()

    const currentState = await this.storage.loadChatSession(sessionId)
    if (!currentState) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    // Close current chat session
    clinicalAgentRouter.closeChatSession(sessionId)

    // Create new chat session with new agent
    await clinicalAgentRouter.createChatSession(sessionId, newAgent, currentState.history)

    // Update state
    currentState.activeAgent = newAgent
    currentState.metadata.lastUpdated = new Date()

    // Save updated state
    await this.storage.saveChatSession(currentState)

    return currentState
  }

  async uploadDocument(sessionId: string, file: File, userId: string): Promise<ClinicalFile> {
    if (!this.initialized) await this.initialize()

    if (!clinicalFileManager.isValidClinicalFile(file)) {
      throw new Error("Invalid file type or size. Please upload PDF, Word, or image files under 10MB.")
    }

    const uploadedFile = await clinicalFileManager.uploadFile(file, sessionId, userId)

    // Update session metadata
    const currentState = await this.storage.loadChatSession(sessionId)
    if (currentState) {
      currentState.metadata.fileReferences.push(uploadedFile.id)
      currentState.metadata.lastUpdated = new Date()
      await this.storage.saveChatSession(currentState)
    }

    return uploadedFile
  }

  async getUserSessions(userId: string): Promise<ChatState[]> {
    if (!this.initialized) await this.initialize()
    return await this.storage.getUserSessions(userId)
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this.initialized) await this.initialize()

    // Close active chat session
    clinicalAgentRouter.closeChatSession(sessionId)

    // Delete from storage
    await this.storage.deleteChatSession(sessionId)
  }

  /**
   * Crea un prompt específico para que cada agente genere su propia confirmación de activación
   */
  private createAgentConfirmationPrompt(targetAgent: string, originalMessage: string): string {
    const agentConfirmationPrompts = {
      socratico: `El usuario me ha solicitado activar el modo socrático con el mensaje: "${originalMessage}". 

Como HopeAI Socrático, debo confirmar mi activación de manera cálida y contextual, explicando brevemente mis capacidades de exploración reflexiva, desarrollo de insights terapéuticos y análisis profundo de casos clínicos. Luego debo hacer una pregunta reflexiva que invite al usuario a comenzar nuestra exploración socrática.

Por favor, genera una confirmación natural y empática que refleje mi personalidad socrática.`,
      
      clinico: `El usuario me ha solicitado activar el modo clínico con el mensaje: "${originalMessage}".

Como HopeAI Clínico, debo confirmar mi activación de manera profesional y estructurada, explicando brevemente mis capacidades de documentación clínica, resúmenes de sesión, notas SOAP y estructuración de información profesional. Luego debo preguntar específicamente qué tipo de documentación o tarea clínica necesita.

Por favor, genera una confirmación clara y profesional que refleje mi enfoque clínico y organizativo.`,
      
      academico: `El usuario me ha solicitado activar el modo académico con el mensaje: "${originalMessage}".

Como HopeAI Académico, debo confirmar mi activación de manera rigurosa y científica, explicando brevemente mis capacidades de búsqueda de investigación científica, evidencia empírica y revisión de literatura especializada. Luego debo preguntar específicamente qué tema de investigación o evidencia científica necesita explorar.

Por favor, genera una confirmación precisa y académica que refleje mi enfoque basado en evidencia científica.`
    }

    return agentConfirmationPrompts[targetAgent as keyof typeof agentConfirmationPrompts] || 
           `El usuario me ha solicitado cambiar al modo ${targetAgent}. Por favor, confirma la activación y pregunta en qué puedo ayudar.`
  }

  async addStreamingResponseToHistory(
    sessionId: string,
    responseContent: string,
    agent: AgentType
  ): Promise<void> {
    if (!this.initialized) await this.initialize()

    const currentState = await this.storage.loadChatSession(sessionId)
    if (!currentState) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    // Add AI response to history
    const aiMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: responseContent,
      role: "model",
      agent: agent,
      timestamp: new Date(),
    }

    currentState.history.push(aiMessage)

    // Update metadata
    currentState.metadata.lastUpdated = new Date()
    currentState.metadata.totalTokens += this.estimateTokens(responseContent)

    // Save updated state
    await this.storage.saveChatSession(currentState)
  }

  async getChatState(sessionId: string): Promise<ChatState> {
    if (!this.initialized) await this.initialize()

    const currentState = await this.storage.loadChatSession(sessionId)
    if (!currentState) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    return currentState
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4)
  }

  async getSystemStatus(): Promise<{
    initialized: boolean
    activeAgents: string[]
    totalSessions: number
  }> {
    const allSessions = await this.storage.getUserSessions("all") // This would need to be implemented

    return {
      initialized: this.initialized,
      activeAgents: Array.from(clinicalAgentRouter.getAllAgents().keys()),
      totalSessions: allSessions.length,
    }
  }
}

// Global singleton instance for server-side usage
let globalHopeAI: HopeAISystem | null = null

// Function to get or create singleton instance
export function getHopeAIInstance(): HopeAISystem {
  if (!globalHopeAI) {
    globalHopeAI = new HopeAISystem()
  }
  return globalHopeAI
}

// Export singleton instance
export const hopeAI = getHopeAIInstance()
