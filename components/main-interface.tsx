"use client"

import { useState, useEffect } from "react"
import { ChatInterface } from "@/components/chat-interface"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { DocumentPanel } from "@/components/document-panel"
import { AgentSelector } from "@/components/agent-selector"
import { MobileNav } from "@/components/mobile-nav"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useHopeAI } from "@/hooks/use-hopeai"
import type { AgentType } from "@/types/clinical-types"

export function MainInterface() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [documentPanelOpen, setDocumentPanelOpen] = useState(false)
  const isMobile = useMediaQuery("(max-width: 768px)")

  // Use the HopeAI system
  const { isInitialized, currentSession, isLoading, error, createSession, switchAgent, getAvailableAgents, sendMessage, uploadDocument } =
    useHopeAI()

  // Initialize with default session
  useEffect(() => {
    console.log('🔄 MainInterface: useEffect ejecutado', {
      isInitialized,
      hasCurrentSession: !!currentSession,
      sessionId: currentSession?.sessionId
    })
    
    if (isInitialized && !currentSession) {
      console.log('📝 MainInterface: Creando sesión por defecto...')
      createSession("demo_user", "clinical_supervision", "socratico")
        .then(session => {
          console.log('✅ MainInterface: Sesión creada:', session?.sessionId)
        })
        .catch(err => {
          console.error('❌ MainInterface: Error creando sesión:', err)
        })
    }
  }, [isInitialized, currentSession, createSession])

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
    if (currentSession) {
      await switchAgent(agent)
    }
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
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

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
            activeAgent={currentSession?.activeAgent || "socratico"}
            onAgentChange={handleAgentChange}
            onToggleDocuments={() => setDocumentPanelOpen(!documentPanelOpen)}
            documentPanelOpen={documentPanelOpen}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Central Chat Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Agent Selector (desktop only) */}
            {!isMobile && (
              <AgentSelector
                activeAgent={currentSession?.activeAgent || "socratico"}
                onAgentChange={handleAgentChange}
                isProcessing={isLoading}
              />
            )}

            {/* Chat Interface */}
            <ChatInterface
              activeAgent={currentSession?.activeAgent || "socratico"}
              isProcessing={isLoading}
              currentSession={currentSession}
              sendMessage={sendMessage}
              uploadDocument={uploadDocument}
            />
          </div>

          {/* Document Panel */}
          <DocumentPanel
            isOpen={documentPanelOpen}
            onClose={() => setDocumentPanelOpen(false)}
            currentSession={currentSession}
          />
        </div>
      </div>
    </div>
  )
}
