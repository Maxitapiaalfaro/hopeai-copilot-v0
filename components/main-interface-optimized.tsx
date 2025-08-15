"use client"

import { useState, useEffect } from "react"
import { ChatInterface } from "@/components/chat-interface"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"


import { MobileNav } from "@/components/mobile-nav"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useHopeAISystem } from "@/hooks/use-hopeai-system"
import { HopeAISystemSingleton } from "@/lib/hopeai-system"
import { useSessionMetrics } from "@/hooks/use-session-metrics"
import { useConversationHistory } from "@/hooks/use-conversation-history"
import { usePioneerInvitation } from "@/hooks/use-pioneer-invitation"
import { usePatientChatSession } from "@/hooks/use-patient-chat-session"
import { PioneerCircleInvitation } from "@/components/pioneer-circle-invitation"
import { DebugPioneerInvitation } from "@/components/debug-pioneer-invitation"
import type { AgentType, ClinicalFile, PatientRecord } from "@/types/clinical-types"
import { PatientContextComposer } from "@/lib/patient-summary-builder"
import * as Sentry from "@sentry/nextjs"

// Componente de métricas de rendimiento (opcional, para desarrollo)
function PerformanceMetrics({ performanceReport }: { performanceReport: any }) {
  if (process.env.NODE_ENV !== 'development') return null

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-2 rounded-lg max-w-xs">
      <div className="font-semibold mb-1">Métricas de Rendimiento</div>
      <div>Sesión: {performanceReport.session.age}min</div>
      <div>Interacciones: {performanceReport.interactions.total}</div>
      <div>Resp. promedio: {Math.round(performanceReport.interactions.averageResponseTime)}ms</div>
      <div>Compresión: {(performanceReport.context.compressionRatio * 100).toFixed(1)}%</div>
      <div>Tokens: {performanceReport.context.tokenCount}</div>
      <div>Ventana: {performanceReport.context.contextWindowUtilization.toFixed(1)}%</div>
    </div>
  )
}

export function MainInterfaceOptimized({ showDebugElements = true }: { showDebugElements?: boolean }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const [pendingFiles, setPendingFiles] = useState<ClinicalFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const isMobile = useMediaQuery("(max-width: 768px)")

  // Usar el sistema HopeAI
  const {
    systemState,
    createSession,
    sendMessage,
    switchAgent,
    getHistory,
    clearError,
    addStreamingResponseToHistory,
    loadSession,
    setSessionMeta
  } = useHopeAISystem()

  // Integración de métricas Sentry - Fase 1
  const {
    startSession: startMetricsSession,
    endSession: endMetricsSession,
    updateActivity,
    trackAgentChange,
    getSessionStats
  } = useSessionMetrics({
    userId: systemState.userId || "demo_user",
    sessionId: systemState.sessionId || "temp_session",
    currentAgent: systemState.activeAgent
  })

  // Hook para obtener el conteo real de conversaciones (fuente de verdad)
  const { totalCount: totalConversationsCount, loadConversations } = useConversationHistory()

  // Cargar conversaciones para asegurar que tenemos el conteo correcto
  useEffect(() => {
    const userId = systemState.userId || "demo_user"
    if (userId) {
      loadConversations(userId)
    }
  }, [systemState.userId, loadConversations])

  // Hook de invitación al Círculo de Pioneros
  const {
    shouldShowInvitation,
    markAsShown,
    recordResponse,
    eligibilityMetrics
  } = usePioneerInvitation({
    userId: systemState.userId || "demo_user",
    sessionId: systemState.sessionId || "temp_session",
    currentAgent: systemState.activeAgent,
    isActive: true,
    currentMessageCount: systemState.history?.length || 0, // Usar el count real
    totalConversations: totalConversationsCount || 0 // NUEVA: Pasar el conteo real de conversaciones
  })

  // Hook para gestión de conversaciones con pacientes
  const {
    startPatientConversation,
    isStartingConversation,
    error: patientConversationError,
    clearError: clearPatientError
  } = usePatientChatSession()

  // Debug logging para Pioneer Circle
  useEffect(() => {
    console.log('🔍 Pioneer Circle Debug - Main Interface:', {
      totalConversationsFromHook: totalConversationsCount,
      currentMessageCount: systemState.history?.length || 0,
      shouldShowInvitation,
      eligibilityMetrics
    });
  }, [totalConversationsCount, systemState.history?.length, shouldShowInvitation, eligibilityMetrics])

  // Estado para controlar la creación de sesión por defecto
  const [sessionCreationAttempted, setSessionCreationAttempted] = useState(false)

  // Cargar archivos pendientes cuando cambie la sesión
  useEffect(() => {
    const loadPendingFiles = async () => {
      if (systemState.sessionId) {
        try {
          const files = await HopeAISystemSingleton.getPendingFilesForSession(systemState.sessionId)
          setPendingFiles(files)
        } catch (error) {
          console.error('❌ Error cargando archivos pendientes:', error)
        }
      } else {
        setPendingFiles([])
      }
    }

    loadPendingFiles()
  }, [systemState.sessionId])
  
  // Crear sesión por defecto si no existe (optimizado para evitar condiciones de carrera)
  useEffect(() => {
    // Solo intentar crear sesión una vez cuando el sistema esté completamente inicializado
    if (systemState.isInitialized && !systemState.sessionId && !systemState.isLoading && !sessionCreationAttempted) {
      console.log('📝 MainInterfaceOptimized: Creando sesión HopeAI por defecto...')
      setSessionCreationAttempted(true)
      
      // Instrumentación Sentry para creación de sesión
      Sentry.startSpan(
        {
          op: "session.create",
          name: "Create Default HopeAI Session",
        },
        async (span) => {
          try {
            span.setAttribute("user.id", "demo_user")
            span.setAttribute("session.type", "clinical_supervision")
            span.setAttribute("agent.initial", "socratico")
            span.setAttribute("session.trigger", "no_session_found")
            
            const sessionId = await createSession("demo_user", "clinical_supervision", "socratico")
            
            if (sessionId) {
              // Iniciar tracking de métricas de sesión
              startMetricsSession("socratico")
              
              span.setAttribute("session.id", sessionId)
              span.setStatus({ code: 1, message: "Session created successfully" })
              console.log('✅ MainInterfaceOptimized: Nueva sesión HopeAI creada:', sessionId)
            } else {
              span.setStatus({ code: 2, message: "Session creation returned null" })
              console.error('❌ MainInterfaceOptimized: Error - createSession retornó null')
            }
          } catch (err) {
            span.setStatus({ code: 2, message: "Session creation failed" })
            Sentry.captureException(err)
            console.error('❌ MainInterfaceOptimized: Error creando sesión:', err)
            // Resetear flag para permitir reintento
            setSessionCreationAttempted(false)
          }
        }
      )
    }
  }, [systemState.isInitialized, systemState.sessionId, systemState.isLoading, sessionCreationAttempted, createSession, startMetricsSession])

  // Responsive sidebar management
  useEffect(() => {
    const handleResize = () => {
      // El sidebar permanece cerrado por defecto en todas las pantallas
      // Solo se cierra automáticamente en móviles si estaba abierto
      if (window.innerWidth < 768 && sidebarOpen) {
        setSidebarOpen(false)
      }
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [sidebarOpen])

  // Manejar cambio de agente con métricas Sentry
  const handleAgentChange = async (agent: AgentType) => {
    if (systemState.sessionId) {
      console.log('🔄 Cambiando a agente:', agent)
      
      // Instrumentación Sentry para cambio de agente
      return Sentry.startSpan(
        {
          op: "agent.switch",
          name: `Switch Agent: ${systemState.activeAgent} -> ${agent}`,
        },
        async (span) => {
          try {
            span.setAttribute("agent.from", systemState.activeAgent)
            span.setAttribute("agent.to", agent)
            span.setAttribute("session.id", systemState.sessionId || "unknown_session")
            
            const success = await switchAgent(agent)
            
            if (success) {
              // Tracking de cambio de agente en métricas
              trackAgentChange(systemState.activeAgent, agent)
              
              span.setAttribute("switch.success", true)
              span.setStatus({ code: 1, message: "Agent switch successful" })
              console.log('✅ Agente cambiado exitosamente a:', agent)
            } else {
              span.setAttribute("switch.success", false)
              span.setStatus({ code: 2, message: "Agent switch failed" })
              console.error('❌ Error cambiando agente')
            }
            
            return success
          } catch (err) {
            span.setStatus({ code: 2, message: "Agent switch error" })
            Sentry.captureException(err)
            console.error('❌ Error en cambio de agente:', err)
            return false
          }
        }
      )
    }
    return false
  }

  // Función de envío de mensaje adaptada con métricas
  const handleSendMessage = async (message: string, useStreaming = true) => {
    return Sentry.startSpan(
      {
        op: "message.send",
        name: "Send Message to HopeAI",
      },
      async (span) => {
        try {
          span.setAttribute("message.length", message.length)
          span.setAttribute("message.streaming", useStreaming)
          span.setAttribute("agent.current", systemState.activeAgent)
          span.setAttribute("session.id", systemState.sessionId || "unknown_session")
          span.setAttribute("attached_files_count", pendingFiles.length)
          
          // Validar que todos los archivos estén en estado 'active' antes de enviar
          const nonActiveFiles = pendingFiles.filter(file => 
            (file as any).processingStatus && (file as any).processingStatus !== 'active'
          )
          
          if (nonActiveFiles.length > 0) {
            const fileNames = nonActiveFiles.map(f => f.name).join(', ')
            const errorMessage = `No se puede enviar el mensaje. Los siguientes archivos aún están procesándose: ${fileNames}. Por favor, espera a que terminen de procesarse.`
            console.warn('⚠️ Archivos no listos:', nonActiveFiles)
            throw new Error(errorMessage)
          }
          
          const startTime = Date.now()
          console.log('📤 Enviando mensaje HopeAI:', message.substring(0, 50) + '...')
          console.log('📎 Archivos adjuntos:', pendingFiles.length)
          
          // Actualizar actividad del usuario
          updateActivity()
          
          // CRITICAL: Capturar archivos antes de envío para mostrar inmediatamente en historial
          const attachedFilesForMessage = [...pendingFiles]
          
          const response = await sendMessage(message, useStreaming, attachedFilesForMessage)
          
          // Limpiar archivos pendientes después del envío exitoso
          setPendingFiles([])
          console.log('🧹 Archivos pendientes limpiados después del envío exitoso')
          
          const responseTime = Date.now() - startTime
          span.setAttribute("message.response_time", responseTime)
          span.setAttribute("message.success", true)
          span.setStatus({ code: 1, message: "Message sent successfully" })
          
          console.log('✅ Mensaje enviado exitosamente')
          return response
        } catch (error) {
          span.setAttribute("message.success", false)
          span.setStatus({ code: 2, message: "Message send failed" })
          Sentry.captureException(error)
          console.error('❌ Error enviando mensaje:', error)
          throw error
        }
      }
    )
  }

  // Manejar respuesta de invitación al Círculo de Pioneros
  const handlePioneerResponse = (response: 'interested' | 'not_now' | 'not_interested') => {
    recordResponse(response)
    
    // Log para tracking
    console.log('🎯 Respuesta Pioneer Circle:', {
      userId: systemState.userId,
      sessionId: systemState.sessionId,
      response,
      eligibilityMetrics
    })
    
    // Enviar evento a Sentry para analytics
    Sentry.addBreadcrumb({
      message: 'Pioneer Circle Response',
      category: 'user_engagement',
      data: {
        user_id: systemState.userId,
        session_id: systemState.sessionId,
        response,
        message_count: eligibilityMetrics.messageCount,
        session_duration_minutes: Math.round(eligibilityMetrics.sessionDuration / 1000 / 60)
      }
    })
  }

  // Mostrar invitación cuando sea elegible
  const handleShowPioneerInvitation = () => {
    markAsShown()
    console.log('📋 Invitación Pioneer Circle mostrada')
  }

  // Manejar inicio de conversación con paciente
  const handlePatientConversationStart = async (patient: PatientRecord, initialMessage?: string) => {
    try {
      console.log('🏥 Iniciando conversación con paciente:', patient.displayName)
      
      // Limpiar cualquier error previo
      if (patientConversationError) {
        clearPatientError()
      }
      
      // Iniciar conversación con paciente usando el hook especializado
      const sessionId = await startPatientConversation(patient, initialMessage)
      
      if (sessionId) {
        console.log('✅ Conversación con paciente iniciada exitosamente:', sessionId)
        
        // CRÍTICO: Cargar la nueva sesión en el sistema principal
        const loadSuccess = await loadSession(sessionId)
        
        if (loadSuccess) {
          console.log('✅ Sesión del paciente cargada en el sistema principal:', sessionId)
          
          // Crear y establecer el contexto del paciente en el sistema
          const composer = new PatientContextComposer()
          const patientSessionMeta = composer.createSessionMetadata(
            patient,
            {
              sessionId,
              userId: systemState.userId || "demo_user",
              clinicalMode: "clinical",
              activeAgent: systemState.activeAgent
            }
          )
          
          // Establecer el contexto del paciente en el sistema
          setSessionMeta(patientSessionMeta)
          console.log('🏥 Contexto del paciente establecido en el sistema:', patient.displayName)
        } else {
          console.error('❌ Error cargando sesión del paciente en el sistema principal')
        }
      } else {
        console.error('❌ Error iniciando conversación con paciente')
      }
    } catch (error) {
      console.error('❌ Error en handlePatientConversationStart:', error)
    }
  }

  // Función de subida de documentos usando HopeAI System con estado reactivo
  const handleUploadDocument = async (file: File) => {
    if (!systemState.sessionId) {
      console.error('❌ No hay sesión activa para subir documento')
      throw new Error('No hay sesión activa')
    }

    setIsUploading(true) // ⭐ Bloquear chat mientras se sube archivo
    
    try {
      console.log('📎 Subiendo documento:', file.name)
      
      // Usar el sistema HopeAI para subir el documento
      const uploadedFile = await HopeAISystemSingleton.uploadDocument(
        systemState.sessionId,
        file,
        systemState.userId || 'demo_user'
      )
      
      // Agregar archivo con estado inicial de procesamiento
      setPendingFiles(prev => [...prev, {
        ...uploadedFile,
        processingStatus: uploadedFile.status === 'processed' ? 'active' : 'processing'
      }])
      
      // Si el archivo aún está procesando, iniciar polling para verificar estado
      if (uploadedFile.status !== 'processed') {
        pollFileStatus(uploadedFile.id, uploadedFile.geminiFileId)
      }
      
      console.log('✅ Documento subido exitosamente:', uploadedFile.name)
      return uploadedFile
    } catch (error) {
      console.error('❌ Error subiendo documento:', error)
      throw error
    } finally {
      setIsUploading(false) // ⭐ Desbloquear chat
    }
  }

  // Función para verificar el estado de procesamiento de archivos
  const pollFileStatus = async (fileId: string, geminiFileId?: string) => {
    if (!geminiFileId) return
    
    const maxAttempts = 30 // 60 segundos máximo (2s * 30)
    let attempts = 0
    
    const checkStatus = async () => {
      try {
        attempts++
        
        // Verificar estado del archivo en Google GenAI
        const response = await fetch('/api/check-file-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ geminiFileId })
        })
        
        if (response.ok) {
          const { state } = await response.json()
          
          setPendingFiles(prev => prev.map(file => 
            file.id === fileId 
              ? { ...file, processingStatus: state === 'ACTIVE' ? 'active' : 'processing' }
              : file
          ))
          
          if (state === 'ACTIVE') {
            console.log('✅ Archivo procesado y listo:', fileId)
            return
          }
          
          if (state === 'FAILED') {
            console.error('❌ Archivo falló en procesamiento:', fileId)
            setPendingFiles(prev => prev.map(file => 
              file.id === fileId 
                ? { ...file, processingStatus: 'error' }
                : file
            ))
            return
          }
        }
        
        // Continuar polling si no ha alcanzado el máximo de intentos
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 2000) // Verificar cada 2 segundos
        } else {
          console.warn('⚠️ Timeout verificando estado del archivo:', fileId)
          setPendingFiles(prev => prev.map(file => 
            file.id === fileId 
              ? { ...file, processingStatus: 'timeout' }
              : file
          ))
        }
      } catch (error) {
        console.error('❌ Error verificando estado del archivo:', error)
        setPendingFiles(prev => prev.map(file => 
          file.id === fileId 
            ? { ...file, processingStatus: 'error' }
            : file
        ))
      }
    }
    
    // Iniciar verificación después de 1 segundo
    setTimeout(checkStatus, 1000)
  }

  // Función para remover archivos pendientes
  const handleRemoveFile = (fileId: string) => {
    setPendingFiles(prev => prev.filter(file => file.id !== fileId))
  }

  // Handle new conversation - Delegado completamente al Sidebar para evitar duplicación
  const handleNewConversation = async () => {
    // La lógica de creación de sesión se maneja completamente en el Sidebar
    // para evitar la creación duplicada de sesiones
    console.log('🔄 Main: Delegando creación de nueva conversación al Sidebar')
  }

  // Handle conversation selection from history
  const handleConversationSelect = async (sessionId: string) => {
    try {
      console.log('🔄 Cargando conversación desde historial:', sessionId)
      const success = await loadSession(sessionId)
      if (success) {
        console.log('✅ Conversación cargada exitosamente')
        // Close sidebar on mobile after selecting conversation
        if (isMobile) {
          setSidebarOpen(false)
        }
      } else {
        console.error('❌ Error cargando la conversación')
      }
    } catch (err) {
      console.error('❌ Error al cargar conversación:', err)
    }
  }

  // Crear objeto de sesión compatible con ChatInterface
  const compatibleSession = systemState.sessionId ? {
    sessionId: systemState.sessionId,
    userId: systemState.userId,
    mode: systemState.mode,
    activeAgent: systemState.activeAgent,
    history: systemState.history, // Usar directamente systemState.history para reactividad
    metadata: {
      createdAt: new Date(),
      lastUpdated: new Date(),
      totalTokens: systemState.history.length * 100, // Estimación aproximada
      fileReferences: []
    },
    clinicalContext: {
      sessionType: systemState.mode,
      confidentialityLevel: 'high' as const
    }
  } : null

  // Estados de carga y error
  if (!systemState.isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Inicializando HopeAI System...</p>
          <p className="text-sm text-gray-500 mt-2">Cargando contexto y configuraciones avanzadas</p>
        </div>
      </div>
    )
  }

  if (systemState.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">Error: {systemState.error}</div>
          <div className="space-x-2">
            <button
              onClick={clearError}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Limpiar Error
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Reiniciar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Sidebar - Conversation History */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        userId={systemState.userId || "demo_user"}
        createSession={createSession}
        onConversationSelect={handleConversationSelect}
        onPatientConversationStart={handlePatientConversationStart}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header onHistoryToggle={() => setMobileNavOpen(true)} />

        {/* Mobile Navigation */}
        {isMobile && (
          <MobileNav 
            userId={systemState.userId || "demo_user"}
            createSession={createSession}
            onConversationSelect={handleConversationSelect}
            isOpen={mobileNavOpen}
            onOpenChange={setMobileNavOpen}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Central Chat Area */}
          <div className="flex-1 flex flex-col overflow-hidden h-full">


            {/* Chat Interface */}
            <ChatInterface
              activeAgent={systemState.activeAgent}
              isProcessing={systemState.isLoading}
              isUploading={isUploading}
              currentSession={compatibleSession}
              sendMessage={handleSendMessage}
              uploadDocument={handleUploadDocument}
              addStreamingResponseToHistory={addStreamingResponseToHistory}
              pendingFiles={pendingFiles}
              onRemoveFile={handleRemoveFile}
              transitionState={systemState.transitionState}
            />
          </div>


        </div>
      </div>

      {/* Invitación al Círculo de Pioneros */}
      {shouldShowInvitation && (
        <PioneerCircleInvitation
          isOpen={shouldShowInvitation}
          onClose={handleShowPioneerInvitation}
          onResponse={handlePioneerResponse}
          userMetrics={{
            messageCount: eligibilityMetrics.messageCount,
            sessionDuration: eligibilityMetrics.sessionDuration
          }}
          currentAgent={systemState.activeAgent}
        />
      )}

      {/* Debug Pioneer Invitation (development only) */}
      {systemState.sessionId && process.env.NODE_ENV === 'development' && showDebugElements && (
        <DebugPioneerInvitation
          userId={systemState.userId || "demo_user"}
          sessionId={systemState.sessionId}
          currentAgent={systemState.activeAgent}
          currentMessageCount={systemState.history?.length || 0}
        />
      )}

      {/* Performance Metrics (development only) */}
       {systemState.sessionId && process.env.NODE_ENV === 'development' && showDebugElements && (
         <div className="fixed bottom-4 right-4 bg-black/80 text-white p-2 rounded text-xs">
           <div>Sesión: {systemState.sessionId}</div>
           <div>Agente: {systemState.activeAgent}</div>
           <div>Mensajes: {systemState.history.length}</div>
           {systemState.routingInfo && (
             <div>Intent: {systemState.routingInfo.detectedIntent}</div>
           )}
         </div>
       )}
    </div>
  )
}