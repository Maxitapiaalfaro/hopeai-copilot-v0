"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, 
  Clock, 
  Brain, 
  BookOpen, 
  Stethoscope, 
  MessageSquare,
  Trash2,
  RefreshCw,
  Zap,
  Menu,
  Users
} from "lucide-react"
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { useConversationHistory } from "@/hooks/use-conversation-history"
import { useHopeAISystem } from "@/hooks/use-hopeai-system"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import type { AgentType, PatientRecord } from "@/types/clinical-types"
import { getAgentVisualConfig } from "@/config/agent-visual-config"
import { PatientLibrarySection } from "@/components/patient-library-section"

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  userId?: string
  createSession?: (userId: string, mode: any, agent: any) => Promise<string | null>
  onConversationSelect?: (sessionId: string) => void
  onPatientConversationStart?: (patient: PatientRecord) => void
  onNewChat?: () => void
}

// Mapeo de agentes para compatibilidad con el sistema anterior
const agentIcons = {
  'socratico': Brain,
  'clinico': Stethoscope,
  'academico': BookOpen,
  'orquestador': Zap,
}

const agentLabels = {
  'socratico': 'Socrático',
  'clinico': 'Clínico',
  'academico': 'Académico',
  'orquestador': 'Orquestador',
}

export function Sidebar({ isOpen, onToggle, userId, createSession: createSessionProp, onConversationSelect, onPatientConversationStart, onNewChat }: SidebarProps) {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'conversations' | 'patients'>('conversations')
  
  // Hooks para gestión de conversaciones
  const {
    conversations,
    isLoading,
    isLoadingMore,
    error,
    hasNextPage,
    totalCount,
    loadConversations,
    loadMoreConversations,
    openConversation,
    deleteConversation,

    clearError,
    refreshConversations
  } = useConversationHistory()
  
  const { createSession, loadSession, systemState } = useHopeAISystem()
  
  // Cargar conversaciones al montar el componente
  useEffect(() => {
    const effectiveUserId = userId || systemState.userId
    if (effectiveUserId && isOpen && conversations.length === 0 && !isLoading) {
      loadConversations(effectiveUserId)
    }
  }, [userId, systemState.userId, isOpen, loadConversations, isLoading, conversations.length])

  // Detectar scroll para lazy loading
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight
    
    // Cargar más cuando se llega al 80% del scroll
    if (scrollPercentage > 0.8 && hasNextPage && !isLoadingMore) {
      loadMoreConversations()
    }
  }, [hasNextPage, isLoadingMore, loadMoreConversations])
  
  // Usar todas las conversaciones sin filtrado
  const filteredConversations = conversations
  
  // Manejar selección de conversación
  const handleConversationSelect = async (sessionId: string) => {
    try {
      setSelectedConversation(sessionId)
      
      // Usar la función proporcionada por el componente padre si está disponible
      if (onConversationSelect) {
        await onConversationSelect(sessionId)
      } else {
        // Fallback a la lógica anterior si no se proporciona la función
        const success = await loadSession(sessionId)
        
        if (!success) {
          setSelectedConversation(null)
        }
      }
    } catch (err) {
      console.error('❌ Error al cargar la conversación:', err)
      setSelectedConversation(null)
    }
  }
  
  // Estado para prevenir creación múltiple simultánea
  const [isCreatingSession, setIsCreatingSession] = useState(false)

  // Abrir y navegar a una sección específica cuando el sidebar está colapsado
  const handleCollapsedOpenTo = useCallback((tab: 'conversations' | 'patients') => {
    setActiveTab(tab)
    if (!isOpen) {
      onToggle()
    }
  }, [isOpen, onToggle])

  // Manejar nueva conversación con patrón de transacción atómica
  const handleNewConversation = async () => {
    // Prevenir múltiples ejecuciones simultáneas
    if (isCreatingSession) {
      return
    }

    try {
      setIsCreatingSession(true)
      const effectiveUserId = userId || systemState.userId
      
      // No crear sesión aquí. Limpiar selección y delegar al padre para resetear estado.
      setSelectedConversation(null)
      onNewChat?.()
    } catch (err) {
      console.error('❌ Sidebar: Error en transacción de nueva conversación:', err)
    } finally {
      setIsCreatingSession(false)
    }
  }
  
  // Manejar eliminación de conversación
  const handleDeleteConversation = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      await deleteConversation(sessionId)
      if (selectedConversation === sessionId) {
        setSelectedConversation(null)
      }
    } catch (err) {
      console.error('Error al eliminar conversación:', err)
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col transition-all duration-300 relative bg-secondary/30 border-r border-border/80 paper-noise",
        isOpen ? "w-80" : "w-0 overflow-hidden md:w-16",
      )}
    >
      {/* Header estilo Gemini */}
      <div className={cn("flex flex-col transition-all duration-300", isOpen ? "p-4 pb-2" : "items-center p-2")}> 
        {!isOpen && (
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onToggle} 
            className="h-10 w-10"
            title="Abrir panel lateral"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        
        {isOpen ? (
          <>
            <div className="flex items-center justify-end mb-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onToggle} 
                className="h-8 w-8"
                title="Cerrar panel lateral"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>
            
            <Button 
              variant="secondary"
              onClick={handleNewConversation}
              className="w-full h-11 px-4 gap-3 justify-start"
              disabled={isCreatingSession}
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">Nuevo chat</span>
            </Button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-2"> 
            <Button
              variant="ghost"
              size="icon"
              title="Historial"
              onClick={() => handleCollapsedOpenTo('conversations')}
              className={cn(activeTab === 'conversations' ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
            >
              <Clock className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Pacientes"
              onClick={() => handleCollapsedOpenTo('patients')}
              className={cn(activeTab === 'patients' ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
            >
              <Users className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>

      {/* Hint de recientes estilo Gemini */}
      {isOpen && filteredConversations.length > 0 && (
        <div className="px-4 pb-2">
          <span className="text-xs text-muted-foreground font-medium">
            Recientes
          </span>
        </div>
      )}

      {/* Tab Navigation */}
      {isOpen && (
        <div className="flex border-b border-border/80 mx-4 brush-border">
          <Button
            variant="ghost"
            className={cn(
              "flex-1 rounded-none border-b-2 h-9",
              activeTab === 'conversations'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
            onClick={() => setActiveTab('conversations')}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Conversaciones
          </Button>
          <Button
            variant="ghost"
            className={cn(
              "flex-1 rounded-none border-b-2 h-9",
              activeTab === 'patients'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
            onClick={() => setActiveTab('patients')}
          >
            <Users className="mr-2 h-4 w-4" />
            Pacientes
          </Button>
        </div>
      )}

      {/* Tab Content */}
      {isOpen ? (
        <div className="flex-1 overflow-hidden">
          {activeTab === 'conversations' ? (
            <ScrollArea className="h-full">
              <div onScroll={handleScroll} className="h-full overflow-auto">
              <div className="p-4 space-y-2">
                {isLoading && isOpen ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-4 w-4 animate-spin mr-2 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Cargando...</span>
                  </div>
                ) : filteredConversations.length === 0 ? (
                  isOpen && (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        No hay conversaciones
                      </p>
                    </div>
                  )
                ) : (
                  filteredConversations.map((conversation) => {
                    const agentConfig = getAgentVisualConfig(conversation.activeAgent as AgentType)
                    
                    return (
                      <div key={conversation.sessionId} className="relative group">
                        <Button
                          variant="ghost"
                          className={cn(
                            "w-full mb-1 transition-all duration-200 rounded-lg",
                            isOpen ? "justify-start p-3 h-auto text-left" : "justify-center p-2 h-10",
                            selectedConversation === conversation.sessionId 
                              ? "bg-primary/10 hover:bg-primary/10" 
                              : "hover:bg-secondary",
                          )}
                          onClick={() => handleConversationSelect(conversation.sessionId)}
                          title={!isOpen ? conversation.title : undefined}
                        >
                          {isOpen ? (
                            <div className="flex items-center gap-3 w-full">
                              <div className="flex-1 min-w-0">
                                <div className="font-serif text-sm truncate leading-5 text-foreground">
                                  {conversation.title}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                                  {formatDistanceToNow(new Date(conversation.lastUpdated), { 
                                    addSuffix: true, 
                                    locale: es 
                                  })}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className={cn("w-2 h-2 rounded-full", agentConfig.button.bg)} />
                          )}
                        </Button>
                        
                        {isOpen && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="absolute top-1/2 -translate-y-1/2 right-2 opacity-0 group-hover:opacity-100 h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-secondary"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar conversación?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. La conversación "{conversation.title}" 
                                  será eliminada permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={(e) => handleDeleteConversation(conversation.sessionId, e)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    )
                  })
                )}
                
                {isLoadingMore && (
                  <div className="flex items-center justify-center py-4">
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Cargando más...</span>
                    </div>
                  </div>
                )}
              </div>
              </div>
            </ScrollArea>
          ) : (
            <PatientLibrarySection 
              isOpen={isOpen}
              onStartConversation={(patient) => {
                onPatientConversationStart?.(patient)
              }}
            />
          )}
        </div>
      ) : (
        <div className="flex-1" />
      )}

    </div>
  )
}
