"use client"

import { useState, useEffect } from "react"
import { ChatInterface } from "@/components/chat-interface"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { DocumentPanel } from "@/components/document-panel"

import { MobileNav } from "@/components/mobile-nav"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useHopeAISystem } from "@/hooks/use-hopeai-system"
import type { AgentType } from "@/types/clinical-types"

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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [documentPanelOpen, setDocumentPanelOpen] = useState(false)
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
    loadSession
  } = useHopeAISystem()

  // Crear sesión por defecto si no existe
  useEffect(() => {
    console.log('🔄 MainInterfaceOptimized: useEffect ejecutado', {
      isInitialized: systemState.isInitialized,
      hasSession: !!systemState.sessionId,
      sessionId: systemState.sessionId,
      activeAgent: systemState.activeAgent
    })
    
    if (systemState.isInitialized && !systemState.sessionId && !systemState.isLoading) {
      console.log('📝 MainInterfaceOptimized: Creando sesión HopeAI por defecto...')
      createSession("demo_user", "clinical_supervision", "socratico")
        .then(sessionId => {
          console.log('✅ MainInterfaceOptimized: Sesión HopeAI creada:', sessionId)
        })
        .catch(err => {
          console.error('❌ MainInterfaceOptimized: Error creando sesión:', err)
        })
    }
  }, [systemState.isInitialized, systemState.sessionId, systemState.isLoading, createSession])

  // Responsive sidebar management
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false)
      } else if (window.innerWidth >= 1024) {
        setSidebarOpen(true)
      }
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Manejar cambio de agente
  const handleAgentChange = async (agent: AgentType) => {
    if (systemState.sessionId) {
      console.log('🔄 Cambiando a agente:', agent)
      const success = await switchAgent(agent)
      if (success) {
        console.log('✅ Agente cambiado exitosamente a:', agent)
      } else {
        console.error('❌ Error cambiando agente')
      }
    }
  }

  // Función de envío de mensaje adaptada
  const handleSendMessage = async (message: string, useStreaming = true) => {
    try {
      console.log('📤 Enviando mensaje HopeAI:', message.substring(0, 50) + '...')
      const response = await sendMessage(message, useStreaming)
      console.log('✅ Mensaje enviado exitosamente')
      return response
    } catch (error) {
      console.error('❌ Error enviando mensaje:', error)
      throw error
    }
  }

  // Función de subida de documentos (placeholder - mantener compatibilidad)
  const handleUploadDocument = async (file: File) => {
    console.log('📎 Upload de documento (placeholder):', file.name)
    // TODO: Implementar upload optimizado en futuras fases
    return {
      id: `doc_${Date.now()}`,
      name: file.name,
      type: file.type,
      size: file.size,
      uploadDate: new Date(),
      status: 'processed' as const
    }
  }

  // Handle new conversation
  const handleNewConversation = async () => {
    if (systemState.userId) {
      await createSession(systemState.userId, "clinical_supervision", "socratico")
    }
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
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - Conversation History */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        userId={systemState.userId || "demo_user"}
        onNewConversation={handleNewConversation}
        onConversationSelect={handleConversationSelect}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onToggleDocuments={() => setDocumentPanelOpen(!documentPanelOpen)}
          documentPanelOpen={documentPanelOpen}
        />

        {/* Mobile Navigation (only visible on small screens) */}
        {isMobile && (
          <MobileNav
            activeAgent={systemState.activeAgent}
            onToggleDocuments={() => setDocumentPanelOpen(!documentPanelOpen)}
            documentPanelOpen={documentPanelOpen}
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
              currentSession={compatibleSession}
              sendMessage={handleSendMessage}
              uploadDocument={handleUploadDocument}
              addStreamingResponseToHistory={addStreamingResponseToHistory}
            />
          </div>

          {/* Document Panel */}
          <DocumentPanel
            isOpen={documentPanelOpen}
            onClose={() => setDocumentPanelOpen(false)}
            currentSession={compatibleSession}
          />
        </div>
      </div>

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