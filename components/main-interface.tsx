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

export function MainInterface() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [documentPanelOpen, setDocumentPanelOpen] = useState(false)
  const isMobile = useMediaQuery("(max-width: 768px)")

  // Use the HopeAI system
  const { 
    systemState,
    createSession,
    sendMessage,
    switchAgent,
    getHistory,
    clearError,
    resetSystem,
    addStreamingResponseToHistory,
    loadSession
  } = useHopeAISystem()

  // Extract state properties for easier access
  const {
    sessionId,
    userId,
    mode,
    activeAgent,
    isLoading,
    error,
    isInitialized,
    history
  } = systemState

  // Initialize with default session
  useEffect(() => {
    console.log('🔄 MainInterface: useEffect ejecutado', {
      isInitialized,
      hasSession: !!sessionId,
      sessionId,
      userId
    })
    
    if (isInitialized && !sessionId) {
      console.log('📝 MainInterface: Creando sesión por defecto...')
      createSession("demo_user", "clinical_supervision", "socratico")
        .then(() => {
          console.log('✅ MainInterface: Sesión creada')
        })
        .catch(err => {
          console.error('❌ MainInterface: Error creando sesión:', err)
        })
    }
  }, [isInitialized, sessionId, createSession])

  // Close sidebar on mobile by default
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

  // Handle agent change
  const handleAgentChange = async (agent: AgentType) => {
    if (sessionId) {
      await switchAgent(agent)
    }
  }
  
  // Handle new conversation
  const handleNewConversation = async () => {
    if (userId) {
      await createSession(userId, "clinical_supervision", "socratico")
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

  // Create uploadDocument wrapper function
  const handleUploadDocument = async (file: File) => {
    if (!sessionId) {
      throw new Error('No active session for file upload')
    }
    // This would need to be implemented using the HopeAI system instance
    // For now, we'll create a placeholder that throws an error
    throw new Error('Upload document functionality needs to be implemented')
  }

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Inicializando HopeAI...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">Error: {error}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Reintentar
          </button>
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
        userId={userId || "demo_user"}
        onNewConversation={handleNewConversation}
        onConversationSelect={handleConversationSelect}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header
          activeAgent={activeAgent || "socratico"}
          onAgentChange={handleAgentChange}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onToggleDocuments={() => setDocumentPanelOpen(!documentPanelOpen)}
          documentPanelOpen={documentPanelOpen}
        />

        {/* Mobile Navigation (only visible on small screens) */}
        {isMobile && (
          <MobileNav
            activeAgent={activeAgent || "socratico"}
            onToggleDocuments={() => setDocumentPanelOpen(!documentPanelOpen)}
            documentPanelOpen={documentPanelOpen}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Central Chat Area */}
          <div className="flex-1 flex flex-col overflow-hidden">


            {/* Chat Interface */}
            <ChatInterface
              activeAgent={activeAgent || "socratico"}
              isProcessing={isLoading}
              currentSession={sessionId ? { sessionId, history, activeAgent: activeAgent || "socratico" } : null}
              sendMessage={sendMessage}
              uploadDocument={handleUploadDocument}
              addStreamingResponseToHistory={addStreamingResponseToHistory}
            />
          </div>

          {/* Document Panel */}
          <DocumentPanel
            isOpen={documentPanelOpen}
            onClose={() => setDocumentPanelOpen(false)}
            sessionId={sessionId}
          />
        </div>
      </div>
    </div>
  )
}
