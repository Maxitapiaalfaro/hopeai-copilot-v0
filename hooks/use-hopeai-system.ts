"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { HopeAISystemSingleton, HopeAISystem } from "@/lib/hopeai-system"
import type { AgentType, ClinicalMode, ChatMessage, ChatState, ClinicalFile } from "@/types/clinical-types"
import { ClientContextPersistence } from '@/lib/client-context-persistence'

// Estados de transición explícitos para HopeAI
export type TransitionState = 'idle' | 'thinking' | 'selecting_agent' | 'specialist_responding'

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
  // Nuevo estado de transición explícito
  transitionState: TransitionState
  // Contexto del paciente para sesiones clínicas
  sessionMeta?: any
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
  loadSession: (sessionId: string) => Promise<boolean>
  
  // Comunicación con enrutamiento inteligente
  sendMessage: (message: string, useStreaming?: boolean, attachedFiles?: ClinicalFile[], sessionMeta?: any) => Promise<any>
  switchAgent: (newAgent: AgentType) => Promise<boolean>
  
  // Acceso al historial
  getHistory: () => ChatMessage[]
  
  // Control de estado
  clearError: () => void
  resetSystem: () => void
  addStreamingResponseToHistory: (responseContent: string, agent: AgentType) => Promise<void>
  setSessionMeta: (sessionMeta: any) => void
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
    history: [],
    transitionState: 'idle'
  })

  const hopeAISystem = useRef<HopeAISystem | null>(null)

  // Cargar sesión existente
  const loadSession = useCallback(async (sessionId: string, allowDuringInit = false): Promise<boolean> => {
    if (!hopeAISystem.current || (!systemState.isInitialized && !allowDuringInit)) {
      console.error('Sistema HopeAI no inicializado')
      return false
    }

    try {
      setSystemState(prev => ({ ...prev, isLoading: true, error: null }))

      // Cargar el estado de la sesión desde el almacenamiento
      const chatState = await hopeAISystem.current.getChatState(sessionId)
      
      if (!chatState) {
        throw new Error(`Sesión no encontrada: ${sessionId}`)
      }

      // Actualizar el estado del sistema con los datos de la sesión cargada
      setSystemState(prev => ({
        ...prev,
        sessionId: chatState.sessionId,
        userId: chatState.userId,
        mode: chatState.mode,
        activeAgent: chatState.activeAgent,
        history: chatState.history,
        isLoading: false
      }))

      console.log('✅ Sesión HopeAI cargada:', sessionId)
      console.log('📊 Historial cargado con', chatState.history.length, 'mensajes')
      return true
    } catch (error) {
      console.error('❌ Error cargando sesión:', error)
      setSystemState(prev => ({
        ...prev,
        error: 'Error al cargar la sesión',
        isLoading: false
      }))
      return false
    }
  }, [systemState.isInitialized])

  // Función para intentar restaurar la sesión más reciente
  const attemptSessionRestoration = useCallback(async () => {
    try {
      const persistence = ClientContextPersistence.getInstance()
      const recentSession = await persistence.getMostRecentSession()
      
      if (recentSession) {
        console.log('🔄 Intentando restaurar sesión más reciente:', recentSession.sessionId)
        
        // Verificar que la sesión sea válida y no muy antigua (ej: menos de 24 horas)
         const sessionAge = Date.now() - new Date(recentSession.metadata.lastUpdated).getTime()
        const maxAge = 24 * 60 * 60 * 1000 // 24 horas en milisegundos
        
        if (sessionAge < maxAge) {
          const success = await loadSession(recentSession.sessionId, true) // Permitir carga durante inicialización
          if (success) {
            console.log('✅ Sesión más reciente restaurada exitosamente')
            return true // Indicar que se restauró una sesión
          } else {
            console.log('⚠️ No se pudo restaurar la sesión más reciente')
          }
        } else {
          console.log('⚠️ Sesión más reciente demasiado antigua, no se restaurará')
        }
      } else {
        console.log('ℹ️ No hay sesiones recientes para restaurar')
      }
    } catch (error) {
      console.error('❌ Error intentando restaurar sesión:', error)
      // No lanzamos el error para no interrumpir la inicialización
    }
    return false // No se restauró ninguna sesión
  }, [loadSession])

  // Inicialización del sistema HopeAI (sin dependencias para evitar re-inicializaciones)
  useEffect(() => {
    const initializeSystem = async () => {
      try {
        setSystemState(prev => ({ ...prev, isLoading: true }))
        
        // Obtener instancia singleton inicializada del sistema HopeAI
        hopeAISystem.current = await HopeAISystemSingleton.getInitializedInstance()
        console.log('🚀 HopeAI Singleton System inicializado con Intelligent Intent Router')
        
        // Intentar restaurar la sesión más reciente automáticamente
        try {
          const persistence = ClientContextPersistence.getInstance()
          const recentSession = await persistence.getMostRecentSession()
          
          if (recentSession) {
            console.log('🔄 Intentando restaurar sesión más reciente:', recentSession.sessionId)
            
            // Verificar que la sesión sea válida y no muy antigua (ej: menos de 24 horas)
            const sessionAge = Date.now() - new Date(recentSession.metadata.lastUpdated).getTime()
            const maxAge = 24 * 60 * 60 * 1000 // 24 horas en milisegundos
            
            if (sessionAge < maxAge) {
              const chatState = await hopeAISystem.current.getChatState(recentSession.sessionId)
              
              if (chatState) {
                setSystemState(prev => ({
                  ...prev,
                  sessionId: chatState.sessionId,
                  userId: chatState.userId,
                  mode: chatState.mode,
                  activeAgent: chatState.activeAgent,
                  history: chatState.history,
                  isInitialized: true,
                  isLoading: false
                }))
                console.log('✅ Sesión más reciente restaurada exitosamente')
                return
              }
            } else {
              console.log('⚠️ Sesión más reciente demasiado antigua, no se restaurará')
            }
          } else {
            console.log('ℹ️ No hay sesiones recientes para restaurar')
          }
        } catch (error) {
          console.error('❌ Error intentando restaurar sesión:', error)
        }
        
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
  }, []) // Sin dependencias para evitar re-inicializaciones

  // Estado para prevenir creación múltiple simultánea
  const [isCreatingSession, setIsCreatingSession] = useState(false)

  // Crear nueva sesión con protección contra llamadas simultáneas
  const createSession = useCallback(async (
    userId: string,
    mode: ClinicalMode,
    agent: AgentType
  ): Promise<string | null> => {
    if (!hopeAISystem.current || !systemState.isInitialized) {
      console.error('Sistema HopeAI no inicializado')
      return null
    }

    // Prevenir múltiples ejecuciones simultáneas
    if (isCreatingSession) {
      console.log('⚠️ Hook: Creación de sesión ya en progreso, ignorando solicitud duplicada')
      return null
    }

    try {
      setIsCreatingSession(true)
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
    } finally {
      setIsCreatingSession(false)
    }
  }, [systemState.isInitialized, isCreatingSession])



  // Enviar mensaje con enrutamiento inteligente
  const sendMessage = useCallback(async (
    message: string,
    useStreaming = true,
    attachedFiles?: ClinicalFile[],
    sessionMeta?: any
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
        agent: systemState.activeAgent,
        // ARQUITECTURA OPTIMIZADA: Solo usar fileReferences con IDs
        fileReferences: attachedFiles?.map(file => file.id) || []
      }

      // Actualizar el historial inmediatamente con el mensaje del usuario
      setSystemState(prev => ({
        ...prev,
        history: [...prev.history, userMessage],
        isLoading: true,
        error: null,
        transitionState: 'thinking'
      }))

      console.log('📤 Enviando mensaje con enrutamiento inteligente:', message.substring(0, 50) + '...')
      
      // Simular estado de selección de agente
      setTimeout(() => {
        setSystemState(prev => ({
          ...prev,
          transitionState: 'selecting_agent'
        }))
      }, 500)
      
      const result = await hopeAISystem.current.sendMessage(
        systemState.sessionId,
        message,
        useStreaming,
        undefined, // suggestedAgent
        sessionMeta || systemState.sessionMeta // patient context metadata
      )
      
      // Cambiar a estado de respuesta del especialista
      setSystemState(prev => ({
        ...prev,
        transitionState: 'specialist_responding'
      }))

      // Actualizar estado con la respuesta y información de enrutamiento
      // Mantener el historial actualizado sin sobrescribir
      setSystemState(prev => ({
        ...prev,
        history: result.updatedState.history,
        activeAgent: result.updatedState.activeAgent,
        routingInfo: result.response.routingInfo,
        isLoading: false,
        transitionState: 'idle'
      }))

      console.log('✅ Mensaje enviado exitosamente')
      console.log('🧠 Información de enrutamiento:', result.response.routingInfo)
      
      return result.response
    } catch (error) {
      console.error('❌ Error enviando mensaje:', error)
      setSystemState(prev => ({
        ...prev,
        error: 'Error al enviar el mensaje',
        isLoading: false,
        transitionState: 'idle'
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
      history: [],
      transitionState: 'idle'
    })
  }, [systemState.isInitialized])

  // Agregar respuesta de streaming al historial
  const addStreamingResponseToHistory = useCallback(async (
    responseContent: string,
    agent: AgentType,
    groundingUrls?: Array<{title: string, url: string, domain?: string}>
  ): Promise<void> => {
    if (!hopeAISystem.current || !systemState.sessionId) {
      throw new Error('Sistema no inicializado o sesión no encontrada')
    }

    try {
      await hopeAISystem.current.addStreamingResponseToHistory(
        systemState.sessionId,
        responseContent,
        agent,
        groundingUrls
      )

      // Actualizar el historial local inmediatamente
      const updatedState = await hopeAISystem.current.getChatState(systemState.sessionId)
      setSystemState(prev => ({
        ...prev,
        history: updatedState.history,
        activeAgent: updatedState.activeAgent, // Sincronizar el agente activo
        isLoading: false
      }))

      console.log('✅ Respuesta de streaming agregada al historial')
      console.log('📊 Historial actualizado con', updatedState.history.length, 'mensajes')
    } catch (error) {
      console.error('❌ Error agregando respuesta al historial:', error)
      throw error
    }
  }, [systemState.sessionId])

  // Establecer contexto del paciente
  const setSessionMeta = useCallback((sessionMeta: any) => {
    console.log('🏥 Estableciendo contexto del paciente:', sessionMeta?.patient?.reference || 'None')
    setSystemState(prev => ({
      ...prev,
      sessionMeta
    }))
  }, [])

  return {
    systemState,
    createSession,
    loadSession,
    sendMessage,
    switchAgent,
    getHistory,
    clearError,
    resetSystem,
    addStreamingResponseToHistory,
    setSessionMeta
  }
}