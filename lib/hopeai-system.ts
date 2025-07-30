import { clinicalAgentRouter } from "./clinical-agent-router"
import { getStorageAdapter } from "./server-storage-adapter"
import { clinicalFileManager } from "./clinical-file-manager"
import { createIntelligentIntentRouter, type EnrichedContext } from "./intelligent-intent-router"
import { trackAgentSwitch } from "./sentry-metrics-tracker"
// Removed singleton-monitor import to avoid circular dependency
import * as Sentry from '@sentry/nextjs'
import type { AgentType, ClinicalMode, ChatState, ChatMessage, ClinicalFile } from "@/types/clinical-types"

export class HopeAISystem {
  private _initialized = false
  private storage: any = null
  private intentRouter: any = null
  
  // Public getter for initialization status
  public get initialized(): boolean {
    return this._initialized
  }
  
  // Método privado para guardar en el sistema de almacenamiento del servidor con verificación de existencia
  private async saveChatSessionBoth(chatState: ChatState): Promise<void> {
    try {
      // Verificar si la sesión ya existe para prevenir duplicaciones
      const existingSession = await this.storage.loadChatSession(chatState.sessionId)
      
      if (existingSession) {
        console.log(`⚠️ Sesión ya existe, actualizando: ${chatState.sessionId}`)
        // Actualizar metadata de la sesión existente
        chatState.metadata.lastUpdated = new Date()
      } else {
        console.log(`📝 Creando nueva sesión: ${chatState.sessionId}`)
      }
      
      // Guardar en el storage adapter principal (servidor)
      await this.storage.saveChatSession(chatState)
      console.log(`💾 Chat session saved: ${chatState.sessionId}`)
    } catch (error) {
      console.error(`❌ Error saving chat session ${chatState.sessionId}:`, error)
      throw error
    }
  }
  
  // Getter público para acceder al storage desde la API
  get storageAdapter() {
    return this.storage
  }

  async initialize(): Promise<void> {
    if (this._initialized) return

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
      
      this._initialized = true
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
    if (!this._initialized) await this.initialize()

    const finalSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    let chatHistory: ChatMessage[] = []
    let isExistingSession = false

    // Verificación robusta de sesión existente
    if (sessionId) {
      try {
        const existingState = await this.storage.loadChatSession(sessionId)
        if (existingState) {
          console.log(`♻️ Restaurando sesión existente: ${sessionId}`)
          chatHistory = existingState.history
          isExistingSession = true
          // Retornar la sesión existente sin crear duplicado
          return { sessionId: finalSessionId, chatState: existingState }
        }
      } catch (error) {
        console.log(`⚠️ Error verificando sesión existente ${sessionId}, creando nueva:`, error)
      }
    }

    // Verificación adicional para prevenir duplicación por ID generado
    if (!sessionId) {
      try {
        const potentialExisting = await this.storage.loadChatSession(finalSessionId)
        if (potentialExisting) {
          console.log(`⚠️ ID de sesión generado ya existe, regenerando...`)
          // Regenerar ID único
          const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          return this.createClinicalSession(userId, mode, agent, newId)
        }
      } catch (error) {
        // Error esperado si la sesión no existe, continuar con la creación
      }
    }

    console.log(`🆕 Creando nueva sesión clínica: ${finalSessionId}`)

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

    // Save initial state with verification
    await this.saveChatSessionBoth(chatState)

    return { sessionId: finalSessionId, chatState }
  }

  async sendMessage(
    sessionId: string,
    message: string,
    useStreaming = true,
    suggestedAgent?: string
  ): Promise<{
    response: any
    updatedState: ChatState
  }> {
    if (!this._initialized) await this.initialize()

    // Load current session state or create a new one if it doesn't exist
    let currentState = await this.storage.loadChatSession(sessionId)
    if (!currentState) {
      console.log(`[HopeAI] Creating new session: ${sessionId}`)
      currentState = {
        sessionId,
        userId: 'default-user',
        activeAgent: 'socratic-philosopher', // Default agent
        history: [],
        metadata: {
          createdAt: new Date(),
          lastUpdated: new Date(),
          totalTokens: 0,
          messageCount: 0
        }
      }
      // Save the new session
      await this.saveChatSessionBoth(currentState)
    }

    // Get session files automatically - no longer passed as parameter
    const sessionFiles = await this.getPendingFilesForSession(sessionId)

    try {
      // Convertir historial al formato Content[] esperado por el router
      const sessionContext = currentState.history.map((msg: ChatMessage) => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }))

      // Si hay un agente sugerido por el orquestador, usarlo; sino usar el router inteligente
      let routingResult;
      if (suggestedAgent) {
        console.log(`[HopeAI] Usando agente sugerido por orquestador: ${suggestedAgent}`)
        routingResult = {
          targetAgent: suggestedAgent,
          enrichedContext: {
            detectedIntent: 'orchestrator_suggestion',
            confidence: 0.95,
            extractedEntities: [],
            isExplicitRequest: false
          }
        }
      } else {
        // Usar el router inteligente para clasificar la intención y enrutar automáticamente
        routingResult = await this.intentRouter.routeUserInput(
          message,
          sessionContext,
          currentState.activeAgent
        )
      }

      // Manejar solicitudes explícitas de cambio de agente
      if (routingResult.enrichedContext?.isExplicitRequest) {
        // Para solicitudes explícitas, NO agregamos el mensaje del usuario al historial
        // ya que es solo un comando de cambio de agente
        
        // Si se detectó un cambio de agente, actualizar la sesión
        if (routingResult.targetAgent !== currentState.activeAgent) {
          console.log(`[HopeAI] Explicit agent switch request: ${currentState.activeAgent} → ${routingResult.targetAgent}`)
          
          // Instrumentar cambio de agente con Sentry
          const agentSwitchSpan = Sentry.startSpan(
            { name: 'agent.switch.explicit', op: 'orchestration' },
            () => {
              // Registrar métricas del cambio de agente
              trackAgentSwitch({
                userId: currentState.userId || 'demo_user',
                sessionId,
                fromAgent: currentState.activeAgent,
                toAgent: routingResult.targetAgent,
                switchType: 'explicit',
                confidence: routingResult.enrichedContext?.confidence || 1.0
              })
              
              // Close current chat session
              clinicalAgentRouter.closeChatSession(sessionId)
              
              // Create new chat session with new agent
              return clinicalAgentRouter.createChatSession(sessionId, routingResult.targetAgent, currentState.history)
            }
          )
          
          await agentSwitchSpan
          
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
          await this.saveChatSessionBoth(currentState)

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
        fileReferences: sessionFiles || [],
        attachments: sessionFiles || []
      }

      currentState.history.push(userMessage)

      // Si se detectó un cambio de agente (routing automático), actualizar la sesión
      if (routingResult.targetAgent !== currentState.activeAgent) {
        console.log(`[HopeAI] Intelligent routing: ${currentState.activeAgent} → ${routingResult.targetAgent}`)
        
        // Instrumentar cambio de agente automático con Sentry
        const agentSwitchSpan = Sentry.startSpan(
          { name: 'agent.switch.automatic', op: 'orchestration' },
          () => {
            // Registrar métricas del cambio de agente
            trackAgentSwitch({
              userId: currentState.userId || 'demo_user',
              sessionId,
              fromAgent: currentState.activeAgent,
              toAgent: routingResult.targetAgent,
              switchType: 'automatic',
              confidence: routingResult.enrichedContext?.confidence || 0.8
            })
            
            // Close current chat session
            clinicalAgentRouter.closeChatSession(sessionId)
            
            // Create new chat session with new agent
            return clinicalAgentRouter.createChatSession(sessionId, routingResult.targetAgent, currentState.history)
          }
        )
        
        await agentSwitchSpan
        
        // Update state
        currentState.activeAgent = routingResult.targetAgent
        currentState.metadata.lastUpdated = new Date()
      }

      // Send message through agent router with enriched context
      // Session files are handled through conversation history, not as attachments
      const response = await clinicalAgentRouter.sendMessage(
        sessionId, 
        message, 
        useStreaming,
        routingResult.enrichedContext
      )

      // Save state with user message immediately (for both streaming and non-streaming)
      currentState.metadata.lastUpdated = new Date()
      await this.saveChatSessionBoth(currentState)

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
      await this.saveChatSessionBoth(currentState)

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
    if (!this._initialized) await this.initialize()

    const currentState = await this.storage.loadChatSession(sessionId)
    if (!currentState) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    // Instrumentar cambio manual de agente con Sentry
    return await Sentry.startSpan(
      { name: 'agent.switch.manual', op: 'orchestration' },
      async () => {
        // Registrar métricas del cambio de agente
        trackAgentSwitch({
          userId: currentState.userId || 'demo_user',
          sessionId,
          fromAgent: currentState.activeAgent,
          toAgent: newAgent,
          switchType: 'manual',
          confidence: 1.0
        })
        
        // Close current chat session
        clinicalAgentRouter.closeChatSession(sessionId)

        // Create new chat session with new agent
        await clinicalAgentRouter.createChatSession(sessionId, newAgent, currentState.history)

        // Update state
        currentState.activeAgent = newAgent
        currentState.metadata.lastUpdated = new Date()

        // Save updated state
        await this.saveChatSessionBoth(currentState)

        return currentState
      }
    )
  }

  // Método uploadDocument implementado más abajo con mejor manejo de errores

  async getUserSessions(userId: string): Promise<ChatState[]> {
    if (!this._initialized) await this.initialize()
    return await this.storage.getUserSessions(userId)
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this._initialized) await this.initialize()

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

Como HopeAI Socrático, núcleo reflexivo de la plataforma integral HopeAI, debo confirmar mi activación de manera cálida y contextual. Mi respuesta debe reflejar naturalmente mi capacidad de exploración reflexiva profunda, desarrollo de insights terapéuticos y análisis de casos clínicos, mientras mantengo una conciencia implícita de formar parte de un ecosistema más amplio de apoyo clínico. Luego debo hacer una pregunta reflexiva que invite al usuario a comenzar nuestra exploración socrática.

Por favor, genera una confirmación natural y empática que refleje mi personalidad socrática integrada.`,
      
      clinico: `El usuario me ha solicitado activar el modo clínico con el mensaje: "${originalMessage}".

Como HopeAI Clínico, núcleo organizacional de la plataforma integral HopeAI, debo confirmar mi activación de manera profesional y estructurada. Mi respuesta debe reflejar naturalmente mi capacidad de documentación clínica, resúmenes de sesión, notas SOAP y estructuración de información profesional, mientras mantengo una conciencia implícita de formar parte de un ecosistema que integra exploración reflexiva, documentación estructurada y validación empírica. Luego debo preguntar específicamente qué tipo de documentación o tarea clínica necesita.

Por favor, genera una confirmación clara y profesional que refleje mi enfoque clínico organizativo integrado.`,
      
      academico: `El usuario me ha solicitado activar el modo académico con el mensaje: "${originalMessage}".

Como HopeAI Académico, núcleo científico de la plataforma integral HopeAI, debo confirmar mi activación de manera rigurosa y científica. Mi respuesta debe reflejar naturalmente mi capacidad de búsqueda de investigación científica, evidencia empírica y revisión de literatura especializada, mientras mantengo una conciencia implícita de formar parte de un ecosistema que conecta rigor científico con exploración reflexiva y documentación profesional. Luego debo preguntar específicamente qué tema de investigación o evidencia científica necesita explorar.

Por favor, genera una confirmación precisa y académica que refleje mi enfoque científico integrado.`
    }

    return agentConfirmationPrompts[targetAgent as keyof typeof agentConfirmationPrompts] || 
           `El usuario me ha solicitado cambiar al modo ${targetAgent}. Por favor, confirma la activación y pregunta en qué puedo ayudar.`
  }

  async addStreamingResponseToHistory(
    sessionId: string,
    responseContent: string,
    agent: AgentType,
    groundingUrls?: Array<{title: string, url: string, domain?: string}>
  ): Promise<void> {
    if (!this._initialized) await this.initialize()

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
      groundingUrls: groundingUrls || []
    }

    currentState.history.push(aiMessage)

    // Update metadata
    currentState.metadata.lastUpdated = new Date()
    currentState.metadata.totalTokens += this.estimateTokens(responseContent)

    // Save updated state
    await this.saveChatSessionBoth(currentState)
  }

  async getChatState(sessionId: string): Promise<ChatState> {
    if (!this._initialized) await this.initialize()

    const currentState = await this.storage.loadChatSession(sessionId)
    if (!currentState) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    // Verificar si existe sesión activa en el router, si no, recrearla
    // Esto es crítico para mantener la sincronización entre persistencia y sesiones activas
    const hasActiveSession = clinicalAgentRouter.getActiveChatSessions().has(sessionId)
    if (!hasActiveSession) {
      console.log(`[HopeAI] Recreando sesión activa para: ${sessionId}`)
      await clinicalAgentRouter.createChatSession(
        sessionId, 
        currentState.activeAgent, 
        currentState.history
      )
    }

    return currentState
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4)
  }

  async uploadDocument(sessionId: string, file: File, userId: string): Promise<ClinicalFile> {
    if (!this._initialized) await this.initialize()
    
    try {
      console.log(`📁 Uploading document: ${file.name} for session: ${sessionId}`)
      
      // Validate file before upload
      if (!clinicalFileManager.isValidClinicalFile(file)) {
        throw new Error("Invalid file type or size. Please upload PDF, Word, or image files under 10MB.")
      }
      
      // Check for duplicate files in the session (file deduplication)
      const existingFiles = await this.getPendingFilesForSession(sessionId)
      const duplicateFile = existingFiles.find(existingFile => 
        existingFile.name === file.name && 
        existingFile.size === file.size &&
        existingFile.status !== 'failed'
      )
      
      if (duplicateFile) {
        console.log(`📋 Document already exists in session: ${file.name} (${duplicateFile.id})`)
        return duplicateFile
      }
      
      const uploadedFile = await clinicalFileManager.uploadFile(file, sessionId, userId)
      
      // Update session metadata
      const currentState = await this.storage.loadChatSession(sessionId)
      if (currentState) {
        currentState.metadata.fileReferences.push(uploadedFile.id)
        currentState.metadata.lastUpdated = new Date()
        await this.saveChatSessionBoth(currentState)
      }
      
      console.log(`✅ Document uploaded successfully: ${uploadedFile.id}`)
      return uploadedFile
    } catch (error) {
      console.error(`❌ Error uploading document ${file.name}:`, error)
      throw error
    }
  }

  async getPendingFilesForSession(sessionId: string): Promise<ClinicalFile[]> {
    if (!this._initialized) await this.initialize()
    
    try {
      console.log(`📋 Getting pending files for session: ${sessionId}`)
      
      // Obtener archivos clínicos de la sesión desde el almacenamiento
      const clinicalFiles = await this.storage.getClinicalFiles(sessionId)
      
      // Filtrar archivos que pertenecen a esta sesión y están en estado procesado
      const sessionFiles = clinicalFiles.filter(file => 
        file.sessionId === sessionId && 
        file.status === 'processed'
      )
      
      console.log(`📋 Found ${sessionFiles.length} files for session ${sessionId}`)
      return sessionFiles
    } catch (error) {
      console.error(`❌ Error getting pending files for session ${sessionId}:`, error)
      return []
    }
  }

  async removeDocumentFromSession(sessionId: string, fileId: string): Promise<void> {
    if (!this._initialized) await this.initialize()
    
    try {
      console.log(`🗑️ Removing document ${fileId} from session: ${sessionId}`)
      
      // Remove file from clinical storage
      await this.storage.deleteClinicalFile(fileId)
      
      // Update session metadata to remove file reference
      const currentState = await this.storage.loadChatSession(sessionId)
      if (currentState) {
        currentState.metadata.fileReferences = currentState.metadata.fileReferences.filter(
          ref => ref !== fileId
        )
        currentState.metadata.lastUpdated = new Date()
        await this.saveChatSessionBoth(currentState)
      }
      
      console.log(`✅ Document ${fileId} removed successfully from session ${sessionId}`)
    } catch (error) {
      console.error(`❌ Error removing document ${fileId} from session ${sessionId}:`, error)
      throw error
    }
  }

  async getSystemStatus(): Promise<{
    initialized: boolean
    activeAgents: string[]
    totalSessions: number
  }> {
    const allSessions = await this.storage.getUserSessions("all") // This would need to be implemented

    return {
      initialized: this._initialized,
      activeAgents: Array.from(clinicalAgentRouter.getAllAgents().keys()),
      totalSessions: allSessions.length,
    }
  }
}

// Global singleton instance for server-side usage
let globalHopeAI: HopeAISystem | null = null

/**
 * Singleton implementation for HopeAISystem
 * Ensures only one instance exists across the entire application
 * Prevents multiple reinitializations and state conflicts
 */
export class HopeAISystemSingleton {
  private static instance: HopeAISystem | null = null
  private static initializationPromise: Promise<HopeAISystem> | null = null
  private static isInitializing = false

  /**
   * Gets the singleton instance of HopeAISystem
   * Implements lazy initialization with thread safety
   */
  public static getInstance(): HopeAISystem {
    if (!HopeAISystemSingleton.instance) {
      console.log('🔧 Creating new HopeAISystem singleton instance')
      HopeAISystemSingleton.instance = new HopeAISystem()
    }
    return HopeAISystemSingleton.instance
  }

  /**
   * Gets the singleton instance with guaranteed initialization
   * Returns a promise that resolves when the system is fully initialized
   */
  public static async getInitializedInstance(): Promise<HopeAISystem> {
    // If already initialized, return immediately
    if (HopeAISystemSingleton.instance?.initialized) {
      return HopeAISystemSingleton.instance
    }

    // If initialization is in progress, wait for it
    if (HopeAISystemSingleton.initializationPromise) {
      return HopeAISystemSingleton.initializationPromise
    }

    // Start initialization
    HopeAISystemSingleton.initializationPromise = HopeAISystemSingleton.initializeInstance()
    return HopeAISystemSingleton.initializationPromise
  }

  /**
   * Private method to handle the initialization process
   */
  private static async initializeInstance(): Promise<HopeAISystem> {
    if (HopeAISystemSingleton.isInitializing) {
      // Wait for current initialization to complete
      while (HopeAISystemSingleton.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      return HopeAISystemSingleton.instance!
    }

    HopeAISystemSingleton.isInitializing = true
    console.log('🔄 Starting HopeAI System initialization...')
    const startTime = Date.now()

    try {
      const instance = HopeAISystemSingleton.getInstance()
      await instance.initialize()
      
      const initTime = Date.now() - startTime
      console.log(`🚀 HopeAI Singleton System initialized successfully in ${initTime}ms`)
      return instance
    } catch (error) {
      console.error('❌ Failed to initialize HopeAI Singleton System:', error)
      Sentry.captureException(error, {
        tags: {
          context: 'hopeai-system-initialization'
        }
      })
      throw error
    } finally {
      HopeAISystemSingleton.isInitializing = false
    }
  }

  /**
   * Resets the singleton instance (for testing purposes only)
   * @internal
   */
  public static resetInstance(): void {
    if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development') {
      console.warn('⚠️ resetInstance should only be used in test/development environments')
    }
    HopeAISystemSingleton.instance = null
    HopeAISystemSingleton.initializationPromise = null
    HopeAISystemSingleton.isInitializing = false
  }

  /**
   * Gets the current initialization status
   */
  public static getStatus(): {
    hasInstance: boolean
    isInitialized: boolean
    isInitializing: boolean
  } {
    return {
      hasInstance: HopeAISystemSingleton.instance !== null,
      isInitialized: HopeAISystemSingleton.instance?.initialized || false,
      isInitializing: HopeAISystemSingleton.isInitializing
    }
  }

  /**
   * Upload a document through the singleton instance
   */
  public static async uploadDocument(sessionId: string, file: File, userId: string): Promise<ClinicalFile> {
    const instance = await HopeAISystemSingleton.getInitializedInstance()
    return instance.uploadDocument(sessionId, file, userId)
  }

  /**
   * Get pending files for a session through the singleton instance
   */
  public static async getPendingFilesForSession(sessionId: string): Promise<ClinicalFile[]> {
    const instance = await HopeAISystemSingleton.getInitializedInstance()
    return instance.getPendingFilesForSession(sessionId)
  }

  /**
   * Remove a document from a session through the singleton instance
   */
  public static async removeDocumentFromSession(sessionId: string, fileId: string): Promise<void> {
    const instance = await HopeAISystemSingleton.getInitializedInstance()
    return instance.removeDocumentFromSession(sessionId, fileId)
  }
}

// Legacy function for backward compatibility
export function getHopeAIInstance(): HopeAISystem {
  console.warn('⚠️ getHopeAIInstance() is deprecated. Use HopeAISystemSingleton.getInstance() instead.')
  return HopeAISystemSingleton.getInstance()
}

// Export singleton instance using the new pattern
export const hopeAI = HopeAISystemSingleton.getInstance()

/**
 * Global orchestration system for server-side usage
 * Ensures consistent singleton access across API routes
 * Replaces the previous getGlobalOrchestrationSystem function
 */
export async function getGlobalOrchestrationSystem(): Promise<HopeAISystem> {
  return await HopeAISystemSingleton.getInitializedInstance()
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use getGlobalOrchestrationSystem() instead
 */
export function getOrchestrationSystem(): HopeAISystem {
  console.warn('⚠️ getOrchestrationSystem() is deprecated. Use getGlobalOrchestrationSystem() instead.')
  return HopeAISystemSingleton.getInstance()
}
