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
  activeTab?: 'conversations' | 'patients'
  onActiveTabChange?: (tab: 'conversations' | 'patients') => void
  userId?: string
  createSession?: (userId: string, mode: any, agent: any) => Promise<string | null>
  onConversationSelect?: (sessionId: string) => void
  onPatientConversationStart?: (patient: PatientRecord) => void
  onClearPatientContext?: () => void
  clearPatientSelectionTrigger?: number
  onNewChat?: () => void
  hasOpenDialog?: boolean
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

export function Sidebar({ isOpen, onToggle, activeTab: activeTabProp, onActiveTabChange, userId, createSession: createSessionProp, onConversationSelect, onPatientConversationStart, onClearPatientContext, clearPatientSelectionTrigger, onNewChat, hasOpenDialog }: SidebarProps) {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [hasOpenPatientDialog, setHasOpenPatientDialog] = useState(false)
  
  // Usar estado controlado si se proporciona, de lo contrario usar estado local
  const [internalActiveTab, setInternalActiveTab] = useState<'conversations' | 'patients'>('conversations')
  const activeTab = activeTabProp !== undefined ? activeTabProp : internalActiveTab
  const setActiveTab = onActiveTabChange || setInternalActiveTab
  
  // Combinar el estado de diálogos externo e interno
  const shouldPreventAutoClose = hasOpenDialog || hasOpenPatientDialog
  
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
        "flex flex-col relative backdrop-blur-sm border-r paper-noise overflow-hidden",
        "bg-gradient-to-b from-secondary/40 via-secondary/30 to-secondary/20",
        "border-border/60 shadow-sm h-full",
        isOpen ? "w-80" : "w-16",
      )}
      style={{
        transition: 'width 400ms cubic-bezier(0.25, 0.1, 0.25, 1)'
      }}
      onMouseEnter={() => !isOpen && onToggle()}
      onMouseLeave={() => isOpen && !shouldPreventAutoClose && onToggle()}
    >
      {/* Subtle accent line */}
      <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent" />
      {/* Header with refined spacing */}
      <div className="flex flex-col border-b border-border/40 flex-shrink-0 p-3 py-4 gap-4 overflow-visible"> 
        {/* Toggle button - always visible at left */}
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onToggle} 
          className="h-10 w-10 hover:bg-primary/10 transition-all duration-200 hover:scale-105 relative z-10"
          title={isOpen ? "Cerrar panel lateral" : "Abrir panel lateral"}
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        {/* Nueva consulta button - siempre renderizado, revelado por ancho */}
        <Button 
          onClick={isOpen ? handleNewConversation : onToggle}
          disabled={isOpen && isCreatingSession}
          className={cn(
            "h-12 rounded-xl font-medium",
            "bg-primary text-white hover:bg-primary/90",
            "shadow-sm border border-primary/20",
            isOpen 
              ? "w-full px-5 gap-3 justify-start" 
              : "w-10 px-0 justify-center"
          )}
          style={{
            transition: 'width 400ms cubic-bezier(0.25, 0.1, 0.25, 1), padding 400ms cubic-bezier(0.25, 0.1, 0.25, 1), gap 400ms cubic-bezier(0.25, 0.1, 0.25, 1)'
          }}
          title={isOpen ? undefined : "Nueva consulta"}
        >
          <Plus className="h-5 w-5 flex-shrink-0" />
          {isOpen && (
            <span 
              className="text-sm whitespace-nowrap overflow-hidden"
              style={{
                transition: 'opacity 250ms cubic-bezier(0.25, 0.1, 0.25, 1) 150ms'
              }}
            >
              Nueva consulta
            </span>
          )}
        </Button>
      </div>

      {/* Section label with refined styling - siempre presente, revelado por ancho */}
      {isOpen && activeTab === 'conversations' && filteredConversations.length > 0 && (
        <div 
          className="px-5 py-3 border-b border-border/30 flex-shrink-0"
          style={{
            animation: 'fadeIn 300ms cubic-bezier(0.25, 0.1, 0.25, 1) 250ms both'
          }}
        >
          <span className="text-xs text-muted-foreground font-semibold tracking-wider uppercase whitespace-nowrap">
            Conversaciones recientes
          </span>
        </div>
      )}
      
      {/* Patient library section label */}
      {isOpen && activeTab === 'patients' && (
        <div 
          className="px-5 py-3 border-b border-border/30 flex-shrink-0"
          style={{
            animation: 'fadeIn 300ms cubic-bezier(0.25, 0.1, 0.25, 1) 250ms both'
          }}
        >
          <span className="text-xs text-muted-foreground font-semibold tracking-wider uppercase whitespace-nowrap">
            Biblioteca de Pacientes
          </span>
        </div>
      )}

      {/* Tab Navigation - solo visible cuando está expandido */}
      {isOpen && (
        <div 
          className="relative flex border-b border-border/50 mx-5 my-2 flex-shrink-0"
          style={{
            animation: 'fadeIn 300ms cubic-bezier(0.25, 0.1, 0.25, 1) 200ms both'
          }}
        >
          {/* Sliding indicator */}
          <div 
            className={cn(
              "absolute bottom-0 h-0.5 bg-primary",
              activeTab === 'conversations' ? "left-0 w-1/2" : "left-1/2 w-1/2"
            )}
            style={{
              transition: 'left 300ms cubic-bezier(0.25, 0.1, 0.25, 1), width 300ms cubic-bezier(0.25, 0.1, 0.25, 1)'
            }}
          />
          <Button
            variant="ghost"
            className={cn(
              "flex-1 rounded-none h-10 text-sm font-medium",
              activeTab === 'conversations'
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}
            style={{
              transition: 'color 200ms cubic-bezier(0.25, 0.1, 0.25, 1), background-color 200ms cubic-bezier(0.25, 0.1, 0.25, 1)'
            }}
            onClick={() => setActiveTab('conversations')}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Consultas
          </Button>
          <Button
            variant="ghost"
            className={cn(
              "flex-1 rounded-none h-10 text-sm font-medium",
              activeTab === 'patients'
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}
            style={{
              transition: 'color 200ms cubic-bezier(0.25, 0.1, 0.25, 1), background-color 200ms cubic-bezier(0.25, 0.1, 0.25, 1)'
            }}
            onClick={() => setActiveTab('patients')}
          >
            <Users className="mr-2 h-4 w-4" />
            Pacientes
          </Button>
        </div>
      )}
      
      {/* Collapsed state icons - commented out per user request */}
      {/* {!isOpen && (
        <div className="flex flex-col items-center gap-1 py-2 border-b border-border/50"> 
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              title="Consultas"
              onClick={() => handleCollapsedOpenTo('conversations')}
              className={cn(
                "h-10 w-10 transition-all duration-200 rounded-lg",
                activeTab === 'conversations' 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              )}
            >
              <MessageSquare className="h-5 w-5" />
            </Button>
            {activeTab === 'conversations' && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full -ml-3" />
            )}
          </div>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              title="Pacientes"
              onClick={() => handleCollapsedOpenTo('patients')}
              className={cn(
                "h-10 w-10 transition-all duration-200 rounded-lg",
                activeTab === 'patients' 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              )}
            >
              <Users className="h-5 w-5" />
            </Button>
            {activeTab === 'patients' && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full -ml-3" />
            )}
          </div>
        </div>
      )} */}

      {/* Tab Content */}
      <div className={cn(
        "flex-1 overflow-hidden",
        !isOpen && "pointer-events-none opacity-0"
      )}>
          {activeTab === 'conversations' ? (
            <ScrollArea className="h-full">
              <div onScroll={handleScroll} className="h-full overflow-auto">
              <div className="p-5 space-y-1.5">
                {isLoading && isOpen ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground font-medium">Cargando conversaciones...</span>
                    </div>
                  </div>
                ) : filteredConversations.length === 0 ? (
                  isOpen && (
                    <div className="text-center py-12 px-4 text-muted-foreground">
                      <div className="bg-secondary/40 rounded-xl p-6 border border-border/40">
                        <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
                        <p className="text-sm font-medium">
                          No hay conversaciones aún
                        </p>
                        <p className="text-xs mt-1 opacity-70">
                          Inicia una nueva consulta
                        </p>
                      </div>
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
                            "w-full transition-all duration-200 relative overflow-hidden",
                            isOpen ? "justify-start p-4 h-auto text-left rounded-xl" : "justify-center p-2 h-10 rounded-lg",
                            selectedConversation === conversation.sessionId 
                              ? "bg-primary/10 hover:bg-primary/12 shadow-sm border border-primary/20" 
                              : "hover:bg-secondary/80 hover:shadow-sm border border-transparent",
                          )}
                          onClick={() => handleConversationSelect(conversation.sessionId)}
                          title={!isOpen ? conversation.title : undefined}
                        >
                          {/* Accent border on active */}
                          {selectedConversation === conversation.sessionId && isOpen && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
                          )}
                          {isOpen ? (
                            <div className="flex items-start gap-3 w-full pl-3">
                              <div className={cn(
                                "mt-1 w-2 h-2 rounded-full flex-shrink-0",
                                agentConfig.button.bg,
                                "ring-2 ring-background"
                              )} />
                              <div className="flex-1 min-w-0">
                                <div className="font-serif text-sm truncate leading-snug text-foreground font-medium">
                                  {conversation.title}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1.5 truncate flex items-center gap-1.5">
                                  <Clock className="h-3 w-3 opacity-60" />
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
                                className={cn(
                                  "absolute top-1/2 -translate-y-1/2 right-3 h-8 w-8 rounded-lg",
                                  "opacity-0 group-hover:opacity-100 transition-all duration-200",
                                  "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                )}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash2 className="h-4 w-4" />
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
                  <div className="flex items-center justify-center py-6">
                    <div className="flex items-center gap-2.5 text-sm text-muted-foreground bg-secondary/40 px-4 py-2.5 rounded-full border border-border/40">
                      <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                      <span className="font-medium">Cargando más...</span>
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
              onClearPatientContext={onClearPatientContext}
              clearSelectionTrigger={clearPatientSelectionTrigger}
              onPatientSelect={(patient) => {
                // Handle patient selection if needed
              }}
              onConversationSelect={onConversationSelect}
              onDialogOpenChange={setHasOpenPatientDialog}
            />
          )}
        </div>

    </div>
  )
}
