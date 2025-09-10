"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { HopeAISystemSingleton, HopeAISystem } from "@/lib/hopeai-system"
import type { AgentType, ClinicalMode, ChatMessage, ChatState, ClinicalFile, ReasoningBullet, ReasoningBulletsState } from "@/types/clinical-types"
import { ClientContextPersistence } from '@/lib/client-context-persistence'

// ARQUITECTURA MEJORADA: Constante para límite de bullets históricos
const MAX_HISTORICAL_BULLETS = 15

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
  // Estado de bullets progresivos
  reasoningBullets: ReasoningBulletsState
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
  addStreamingResponseToHistory: (
    responseContent: string,
    agent: AgentType,
    groundingUrls?: Array<{title: string, url: string, domain?: string}>,
    reasoningBulletsForThisResponse?: ReasoningBullet[]
  ) => Promise<void>
  setSessionMeta: (sessionMeta: any) => void
  
  // Bullets progresivos
  clearReasoningBullets: () => void
  addReasoningBullet: (bullet: ReasoningBullet) => void
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
    transitionState: 'idle',
    reasoningBullets: {
      sessionId: '',
      bullets: [],
      isGenerating: false,
      currentStep: 0,
      totalSteps: undefined,
      error: undefined
    }
  })

  const hopeAISystem = useRef<HopeAISystem | null>(null)
  const lastSessionIdRef = useRef<string | null>(null)

  // NUEVA FUNCIONALIDAD: Estado temporal para bullets del mensaje actual
  const [currentMessageBullets, setCurrentMessageBullets] = useState<ReasoningBullet[]>([])

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

      // Reconstruct sessionMeta if session has patient context
      let reconstructedSessionMeta = undefined
      if (chatState.clinicalContext?.patientId) {
        try {
          const { getPatientPersistence } = await import('@/lib/patient-persistence')
          const { PatientContextComposer } = await import('@/lib/patient-summary-builder')
          
          const persistence = getPatientPersistence()
          await persistence.initialize()
          const patient = await persistence.loadPatientRecord(chatState.clinicalContext.patientId)
          
          if (patient) {
            console.log(`🔄 Reconstructing sessionMeta for patient: ${patient.displayName}`)
            const composer = new PatientContextComposer()
            reconstructedSessionMeta = composer.createSessionMetadata(patient, {
              sessionId: chatState.sessionId,
              userId: chatState.userId,
              clinicalMode: chatState.clinicalContext.sessionType || 'clinical_supervision',
              activeAgent: chatState.activeAgent
            })
            console.log(`✅ SessionMeta reconstructed for patient: ${reconstructedSessionMeta.patient.reference}`)
          } else {
            console.warn(`⚠️ Patient not found for ID: ${chatState.clinicalContext.patientId}`)
          }
        } catch (error) {
          console.error('Failed to reconstruct sessionMeta:', error)
        }
      }

      // Actualizar el estado del sistema con los datos de la sesión cargada
      setSystemState(prev => ({
        ...prev,
        sessionId: chatState.sessionId,
        userId: chatState.userId,
        mode: chatState.mode,
        activeAgent: chatState.activeAgent,
        history: chatState.history,
        isLoading: false,
        sessionMeta: reconstructedSessionMeta
      }))
      lastSessionIdRef.current = chatState.sessionId

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
  }, [systemState.isInitialized, systemState.sessionMeta])

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
        
        // Automatic session restoration disabled to prevent unwanted conversation loading
        // when users navigate to the Patients tab. Sessions should only be restored
        // through explicit user actions (e.g., clicking on a conversation or starting a new one)
        console.log('ℹ️ Automatic session restoration disabled - sessions load only on explicit user action')
        
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
    if (!hopeAISystem.current) {
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
      lastSessionIdRef.current = sessionId

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
    if (!hopeAISystem.current) {
      throw new Error('Sistema no inicializado')
    }

    // Lazy-create session on first message send
    let sessionIdToUse = systemState.sessionId
    if (!sessionIdToUse) {
      const userId = systemState.userId || 'demo_user'
      const mode = systemState.mode || 'clinical_supervision'
      const agent = systemState.activeAgent || 'socratico'
      const newSessionId = await createSession(userId, mode, agent)
      if (!newSessionId) {
        throw new Error('No se pudo crear la sesión')
      }
      sessionIdToUse = newSessionId
      lastSessionIdRef.current = newSessionId
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

      // NUEVA FUNCIONALIDAD: Limpiar bullets temporales del mensaje anterior
      setCurrentMessageBullets([])
      
      // Actualizar el historial inmediatamente con el mensaje del usuario
      setSystemState(prev => {
        return {
          ...prev,
          history: [...prev.history, userMessage],
          isLoading: true,
          error: null,
          transitionState: 'thinking',
          reasoningBullets: {
            ...prev.reasoningBullets,
            sessionId: sessionIdToUse!,
            bullets: [], // Limpiar bullets globales para el nuevo mensaje
            isGenerating: true,
            currentStep: 0
          }
        }
      })

      console.log('📤 Enviando mensaje con enrutamiento inteligente:', message.substring(0, 50) + '...')
      
      // Callback para manejar bullets progresivos
      const handleBulletUpdate = (bullet: ReasoningBullet) => {
        console.log('🎯 Bullet recibido:', bullet.content)
        addReasoningBullet(bullet)
      }
      
      // Simular estado de selección de agente
      setTimeout(() => {
        setSystemState(prev => ({
          ...prev,
          transitionState: 'selecting_agent'
        }))
      }, 500)
      
      const result = await hopeAISystem.current.sendMessage(
        sessionIdToUse!,
        message,
        useStreaming,
        undefined, // suggestedAgent
        sessionMeta || systemState.sessionMeta, // patient context metadata
        handleBulletUpdate // callback para bullets progresivos
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
        transitionState: 'idle',
        reasoningBullets: {
          ...prev.reasoningBullets,
          isGenerating: false
        }
      }))
      lastSessionIdRef.current = sessionIdToUse!

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
      transitionState: 'idle',
      reasoningBullets: {
        sessionId: '',
        bullets: [],
        isGenerating: false,
        currentStep: 0,
        totalSteps: undefined,
        error: undefined
      }
    })
    lastSessionIdRef.current = null
  }, [systemState.isInitialized])

  // Agregar respuesta de streaming al historial
  const addStreamingResponseToHistory = useCallback(async (
    responseContent: string,
    agent: AgentType,
    groundingUrls?: Array<{title: string, url: string, domain?: string}>,
    reasoningBulletsForThisResponse?: ReasoningBullet[],
    sessionIdOverride?: string
  ): Promise<void> => {
    if (!hopeAISystem.current) {
      throw new Error('Sistema no inicializado')
    }

    // Resolver sessionId objetivo de forma robusta
    let targetSessionId: string | null = sessionIdOverride || systemState.sessionId || lastSessionIdRef.current
    if (!targetSessionId) {
      try {
        const persistence = ClientContextPersistence.getInstance()
        const recent = await persistence.getMostRecentSession()
        targetSessionId = recent?.sessionId || null
      } catch (e) {
        // ignore
      }
    }

    if (!targetSessionId) {
      console.warn('⚠️ addStreamingResponseToHistory: Sin sessionId, se omite la escritura del historial')
      return
    }

    try {
      await hopeAISystem.current.addStreamingResponseToHistory(
        targetSessionId,
        responseContent,
        agent,
        groundingUrls,
        reasoningBulletsForThisResponse && reasoningBulletsForThisResponse.length > 0
          ? reasoningBulletsForThisResponse
          : currentMessageBullets
      )

      // Actualizar el historial local inmediatamente
      const updatedState = await hopeAISystem.current.getChatState(targetSessionId)
      
      // NUEVA FUNCIONALIDAD: Asociar bullets del mensaje actual con el último mensaje de respuesta
      const updatedHistory = [...updatedState.history]
      const bulletsToAttach = (reasoningBulletsForThisResponse && reasoningBulletsForThisResponse.length > 0)
        ? reasoningBulletsForThisResponse
        : currentMessageBullets
      if (updatedHistory.length > 0 && bulletsToAttach.length > 0) {
        const lastMessage = updatedHistory[updatedHistory.length - 1]
        if (lastMessage.role === 'model') {
          lastMessage.reasoningBullets = [...bulletsToAttach]
          console.log('🎯 Bullets asociados al mensaje:', bulletsToAttach.length)
        }
      }
      
      setSystemState(prev => ({
        ...prev,
        history: updatedHistory,
        activeAgent: updatedState.activeAgent, // Sincronizar el agente activo
        isLoading: false
      }))
      
      // Limpiar bullets temporales después de asociarlos
      setCurrentMessageBullets([])

      console.log('✅ Respuesta de streaming agregada al historial')
      console.log('📊 Historial actualizado con', updatedHistory.length, 'mensajes')
    } catch (error) {
      console.error('❌ Error agregando respuesta al historial:', error)
      throw error
    }
  }, [systemState.sessionId, currentMessageBullets])

  // Establecer contexto del paciente
  const setSessionMeta = useCallback((sessionMeta: any) => {
    console.log('🏥 Estableciendo contexto del paciente:', sessionMeta?.patient?.reference || 'None')
    setSystemState(prev => ({
      ...prev,
      sessionMeta
    }))
  }, [])

  // Funciones para manejar bullets progresivos
  const clearReasoningBullets = useCallback((clearAll = false) => {
    setCurrentMessageBullets([])
    setSystemState(prev => ({
      ...prev,
      reasoningBullets: {
        ...prev.reasoningBullets,
        bullets: [],
        isGenerating: false,
        currentStep: 0,
        error: undefined
      }
    }))
  }, [])

  const addReasoningBullet = useCallback((bullet: ReasoningBullet) => {
    // Agregar bullet al estado temporal del mensaje actual
    setCurrentMessageBullets(prev => [...prev, bullet])
    
    // Mantener compatibilidad con el estado global para la UI actual
    setSystemState(prev => ({
      ...prev,
      reasoningBullets: {
        ...prev.reasoningBullets,
        bullets: [...prev.reasoningBullets.bullets, bullet],
        currentStep: prev.reasoningBullets.currentStep + 1,
        isGenerating: bullet.status === 'generating'
      }
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
    setSessionMeta,
    clearReasoningBullets,
    addReasoningBullet
  }
}