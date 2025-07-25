"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { HopeAISystem } from "@/lib/hopeai-system"
import type { AgentType, ClinicalMode, ChatMessage, ChatState } from "@/types/clinical-types"

// Interfaz para el estado del sistema HopeAI
interface HopeAISystemState {
  sessionId: string | null
  userId: string
  mode: ClinicalMode
  activeAgent: AgentType
  isLoading: boolean
  error: string | null
  isInitialized: boolean
  history: ChatMessage[]
  routingInfo?: {
    detectedIntent: string
    targetAgent: AgentType
    confidence: number
    extractedEntities: any[]
  }
}

interface UseHopeAISystemReturn {
  // Estado del sistema
  systemState: HopeAISystemState
  
  // Gestión de sesiones
  createSession: (userId: string, mode: ClinicalMode, agent: AgentType) => Promise<string | null>
  
  // Comunicación con enrutamiento inteligente
  sendMessage: (message: string, useStreaming?: boolean) => Promise<any>
  switchAgent: (newAgent: AgentType) => Promise<boolean>
  
  // Acceso al historial
  getHistory: () => ChatMessage[]
  
  // Control de estado
  clearError: () => void
  resetSystem: () => void
  addStreamingResponseToHistory: (responseContent: string, agent: AgentType) => Promise<void>
}

export function useHopeAISystem(): UseHopeAISystemReturn {
  const [systemState, setSystemState] = useState<HopeAISystemState>({
    sessionId: null,
    userId: 'demo_user',
    mode: 'clinical_supervision',
    activeAgent: 'socratico',
    isLoading: false,
    error: null,
    isInitialized: false,
    history: []
  })

  const hopeAISystem = useRef<HopeAISystem | null>(null)

  // Inicialización del sistema HopeAI
  useEffect(() => {
    const initializeSystem = async () => {
      try {
        setSystemState(prev => ({ ...prev, isLoading: true }))
        
        // Crear instancia del sistema HopeAI
        hopeAISystem.current = new HopeAISystem()
        
        // Inicializar el sistema (incluye intelligent intent router)
        await hopeAISystem.current.initialize()
        
        console.log('✅ HopeAI System inicializado con Intelligent Intent Router')
        
        setSystemState(prev => ({
          ...prev,
          isInitialized: true,
          isLoading: false
        }))
        
      } catch (error) {
        console.error('❌ Error inicializando HopeAI System:', error)
        setSystemState(prev => ({
          ...prev,
          error: 'Error al inicializar el sistema HopeAI',
          isLoading: false,
          isInitialized: true
        }))
      }
    }

    initializeSystem()
  }, [])

  // Crear nueva sesión
  const createSession = useCallback(async (
    userId: string,
    mode: ClinicalMode,
    agent: AgentType
  ): Promise<string | null> => {
    if (!hopeAISystem.current || !systemState.isInitialized) {
      console.error('Sistema HopeAI no inicializado')
      return null
    }

    try {
      setSystemState(prev => ({ ...prev, isLoading: true, error: null }))

      const { sessionId, chatState } = await hopeAISystem.current.createClinicalSession(
        userId,
        mode,
        agent
      )

      setSystemState(prev => ({
        ...prev,
        sessionId,
        userId,
        mode,
        activeAgent: agent,
        history: chatState.history,
        isLoading: false
      }))

      console.log('✅ Sesión HopeAI creada:', sessionId)
      return sessionId
    } catch (error) {
      console.error('❌ Error creando sesión:', error)
      setSystemState(prev => ({
        ...prev,
        error: 'Error al crear la sesión',
        isLoading: false
      }))
      return null
    }
  }, [systemState.isInitialized])

  // Enviar mensaje con enrutamiento inteligente
  const sendMessage = useCallback(async (
    message: string,
    useStreaming = true
  ): Promise<any> => {
    if (!hopeAISystem.current || !systemState.sessionId) {
      throw new Error('Sistema no inicializado o sesión no encontrada')
    }

    try {
      // Crear mensaje del usuario inmediatamente para mostrar en la UI
      const userMessage: ChatMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date(),
        agent: systemState.activeAgent
      }

      // Actualizar el historial inmediatamente con el mensaje del usuario
      setSystemState(prev => ({
        ...prev,
        history: [...prev.history, userMessage],
        isLoading: true,
        error: null
      }))

      console.log('📤 Enviando mensaje con enrutamiento inteligente:', message.substring(0, 50) + '...')
      
      const result = await hopeAISystem.current.sendMessage(
        systemState.sessionId,
        message,
        useStreaming
      )

      // Actualizar estado con la respuesta y información de enrutamiento
      // Mantener el historial actualizado sin sobrescribir
      setSystemState(prev => ({
        ...prev,
        history: result.updatedState.history,
        activeAgent: result.updatedState.activeAgent,
        routingInfo: result.response.routingInfo,
        isLoading: false
      }))

      console.log('✅ Mensaje enviado exitosamente')
      console.log('🧠 Información de enrutamiento:', result.response.routingInfo)
      
      return result.response
    } catch (error) {
      console.error('❌ Error enviando mensaje:', error)
      setSystemState(prev => ({
        ...prev,
        error: 'Error al enviar el mensaje',
        isLoading: false
      }))
      throw error
    }
  }, [systemState.sessionId, systemState.activeAgent])

  // Cambiar agente manualmente (aunque el sistema puede hacerlo automáticamente)
  const switchAgent = useCallback(async (newAgent: AgentType): Promise<boolean> => {
    if (!systemState.sessionId) {
      console.error('No hay sesión activa para cambiar agente')
      return false
    }

    try {
      setSystemState(prev => ({ ...prev, isLoading: true }))
      
      // El cambio de agente se maneja internamente por el intelligent router
      // Aquí solo actualizamos el estado local
      setSystemState(prev => ({
        ...prev,
        activeAgent: newAgent,
        isLoading: false
      }))

      console.log('✅ Agente cambiado a:', newAgent)
      return true
    } catch (error) {
      console.error('❌ Error cambiando agente:', error)
      setSystemState(prev => ({ ...prev, isLoading: false }))
      return false
    }
  }, [systemState.sessionId])

  // Obtener historial
  const getHistory = useCallback((): ChatMessage[] => {
    return systemState.history
  }, [systemState.history])

  // Limpiar error
  const clearError = useCallback(() => {
    setSystemState(prev => ({ ...prev, error: null }))
  }, [])

  // Resetear sistema
  const resetSystem = useCallback(() => {
    setSystemState({
      sessionId: null,
      userId: 'demo_user',
      mode: 'clinical_supervision',
      activeAgent: 'socratico',
      isLoading: false,
      error: null,
      isInitialized: systemState.isInitialized,
      history: []
    })
  }, [systemState.isInitialized])

  // Agregar respuesta de streaming al historial
  const addStreamingResponseToHistory = useCallback(async (
    responseContent: string,
    agent: AgentType
  ): Promise<void> => {
    if (!hopeAISystem.current || !systemState.sessionId) {
      throw new Error('Sistema no inicializado o sesión no encontrada')
    }

    try {
      await hopeAISystem.current.addStreamingResponseToHistory(
        systemState.sessionId,
        responseContent,
        agent
      )

      // Actualizar el historial local inmediatamente
      const updatedState = await hopeAISystem.current.getChatState(systemState.sessionId)
      setSystemState(prev => ({
        ...prev,
        history: updatedState.history,
        isLoading: false
      }))

      console.log('✅ Respuesta de streaming agregada al historial')
      console.log('📊 Historial actualizado con', updatedState.history.length, 'mensajes')
    } catch (error) {
      console.error('❌ Error agregando respuesta al historial:', error)
      throw error
    }
  }, [systemState.sessionId])

  return {
    systemState,
    createSession,
    sendMessage,
    switchAgent,
    getHistory,
    clearError,
    resetSystem,
    addStreamingResponseToHistory
  }
}