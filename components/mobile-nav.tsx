"use client"

import { useState, useEffect } from "react"
import { History, Plus, MessageSquare, Trash2, RefreshCw, Menu, Users, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet"
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
import { ClinicalMode, AgentType, PatientRecord } from "@/types/clinical-types"
import { PatientLibrarySection } from "@/components/patient-library-section"
import { useConversationHistory } from "@/hooks/use-conversation-history"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { getAgentVisualConfigSafe } from "@/config/agent-visual-config"

interface MobileNavProps {
  userId: string
  createSession: (userId: string, mode: ClinicalMode, agent: AgentType) => Promise<string | null>
  onConversationSelect: (sessionId: string) => Promise<void>
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  onPatientConversationStart?: (patient: PatientRecord) => void
  onClearPatientContext?: () => void
  clearPatientSelectionTrigger?: number
  onNewChat?: () => void
  initialTab?: 'conversations' | 'patients'
}

// Mapeo de agentes para etiquetas legibles
const agentLabels: Record<string, string> = {
  socratico: 'Socrático',
  archivista: 'Archivista',
  investigador: 'Investigador'
}

export function MobileNav({ userId, createSession, onConversationSelect, isOpen: externalIsOpen, onOpenChange: externalOnOpenChange, onPatientConversationStart, onClearPatientContext, clearPatientSelectionTrigger, onNewChat, initialTab = 'conversations' }: MobileNavProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [activeTab, setActiveTab] = useState<'conversations' | 'patients'>(initialTab)
  
  // Usar estado externo si está disponible, sino usar estado interno
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen
  const setIsOpen = externalOnOpenChange || setInternalIsOpen

  // Hook para gestión de conversaciones
  const {
    conversations,
    isLoading,
    isLoadingMore,
    error,
    hasNextPage,
    loadConversations,
    loadMoreConversations,
    deleteConversation,
    refreshConversations
  } = useConversationHistory()

  // Cargar conversaciones cuando se abre el sheet
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open && conversations.length === 0) {
      loadConversations(userId)
    }
  }

  // Efecto para cargar conversaciones cuando se abre externamente
  useEffect(() => {
    if (isOpen && conversations.length === 0) {
      loadConversations(userId)
    }
  }, [isOpen, conversations.length, loadConversations, userId])

  // Efecto para actualizar tab cuando cambia initialTab
  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  // Manejar nueva conversación
  const handleNewConversation = async () => {
    if (isCreatingSession) return
    try {
      setIsCreatingSession(true)
      console.log('📱 Mobile: Preparando nueva conversación (sin crear sesión hasta enviar)...')
      // Solo cerrar el sheet; la sesión se creará al enviar el primer mensaje
      setIsOpen(false)
      onNewChat?.()
    } finally {
      setIsCreatingSession(false)
    }
  }

  // Manejar selección de conversación
  const handleConversationSelect = async (sessionId: string) => {
    try {
      await onConversationSelect(sessionId)
      setIsOpen(false) // Cerrar el sheet después de seleccionar
    } catch (err) {
      console.error('❌ Mobile: Error seleccionando conversación:', err)
    }
  }

  // Manejar eliminación de conversación
  const handleDeleteConversation = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      await deleteConversation(sessionId)
    } catch (err) {
      console.error('❌ Mobile: Error eliminando conversación:', err)
    }
  }

  // Scroll infinito para cargar más conversaciones
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget
    const isNearBottom = scrollHeight - scrollTop <= clientHeight * 1.5
    
    if (isNearBottom && hasNextPage && !isLoadingMore) {
      loadMoreConversations()
    }
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
          
          <SheetContent side="left" className="w-80 p-0 backdrop-blur-sm border-r paper-noise overflow-hidden bg-gradient-to-b from-secondary/40 via-secondary/30 to-secondary/20 border-border/60 shadow-sm">
            <div className="flex flex-col h-full relative">
              {/* Subtle accent line */}
              <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent" />
              
              {/* Header with refined spacing */}
              <div className="flex flex-col border-b border-border/40 flex-shrink-0 p-3 py-4 gap-4">
                <SheetHeader className="p-0">
                  <SheetTitle className="text-left font-sans text-foreground text-lg">Historial</SheetTitle>
                </SheetHeader>

                <Button
                  onClick={handleNewConversation}
                  disabled={isCreatingSession}
                  className={cn(
                    "w-full h-12 px-5 gap-3 justify-start rounded-xl font-medium whitespace-nowrap",
                    "bg-primary text-white hover:bg-primary/90",
                    "shadow-sm border border-primary/20"
                  )}
                >
                  <Plus className="h-5 w-5 flex-shrink-0" />
                  <span className="text-sm overflow-hidden">
                    {isCreatingSession ? 'Creando...' : 'Nueva consulta'}
                  </span>
                </Button>
              </div>

              {/* Tab Navigation with refined styling */}
              <div className="relative flex border-b border-border/50 mx-5 my-2 flex-shrink-0">
                {/* Sliding indicator */}
                <div 
                  className={cn(
                    "absolute bottom-0 h-0.5 bg-primary transition-all duration-300 ease-out",
                    activeTab === 'conversations' ? "left-0 w-1/2" : "left-1/2 w-1/2"
                  )}
                />
                <Button
                  variant="ghost"
                  className={cn(
                    "flex-1 rounded-none h-10 transition-all duration-200 text-sm font-medium",
                    activeTab === 'conversations'
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                  onClick={() => setActiveTab('conversations')}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Consultas
                </Button>
                <Button
                  variant="ghost"
                  className={cn(
                    "flex-1 rounded-none h-10 transition-all duration-200 text-sm font-medium",
                    activeTab === 'patients'
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                  onClick={() => setActiveTab('patients')}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Pacientes
                </Button>
              </div>

              {/* Section label with refined styling */}
              {activeTab === 'conversations' && conversations.length > 0 && (
                <div className="px-5 py-3 border-b border-border/30 flex-shrink-0">
                  <span className="text-xs text-muted-foreground font-semibold tracking-wider uppercase whitespace-nowrap">
                    Conversaciones recientes
                  </span>
                </div>
              )}
              
              {/* Patient library section label */}
              {activeTab === 'patients' && (
                <div className="px-5 py-3 border-b border-border/30 flex-shrink-0">
                  <span className="text-xs text-muted-foreground font-semibold tracking-wider uppercase whitespace-nowrap">
                    Biblioteca de Pacientes
                  </span>
                </div>
              )}

              <div className="flex-1 overflow-hidden">
                {activeTab === 'conversations' ? (
                  <ScrollArea className="flex-1">
                    <div onScroll={handleScroll} className="h-full overflow-auto">
                      <div className="px-3 py-4 space-y-1.5">
                        {isLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <div className="flex flex-col items-center gap-3">
                              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                              <span className="text-sm text-muted-foreground font-medium">Cargando conversaciones...</span>
                            </div>
                          </div>
                        ) : conversations.length === 0 ? (
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
                        ) : (
                          conversations.map((conversation) => {
                            const agentConfig = getAgentVisualConfigSafe(conversation.activeAgent as AgentType)
                            return (
                              <div key={conversation.sessionId} className="relative group">
                                <Button
                                  variant="ghost"
                                  className={cn(
                                    "w-full transition-all duration-200 relative overflow-hidden",
                                    "justify-start p-3 h-auto text-left rounded-xl",
                                    "hover:bg-secondary/80 hover:shadow-sm border border-transparent"
                                  )}
                                  onClick={() => handleConversationSelect(conversation.sessionId)}
                                >
                                  <div className="flex items-start gap-2.5 w-full pr-10">
                                    <div className={cn(
                                      "mt-1.5 w-2 h-2 rounded-full flex-shrink-0",
                                      agentConfig.button.bg,
                                      "ring-2 ring-background"
                                    )} />
                                    <div className="flex-1 min-w-0">
                                      <div className="font-sans text-sm leading-tight text-foreground font-medium line-clamp-2 break-words">
                                        {conversation.title}
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                                        <Clock className="h-3 w-3 opacity-60 flex-shrink-0" />
                                        <span className="truncate">
                                          {formatDistanceToNow(new Date(conversation.lastUpdated), { 
                                            addSuffix: true, 
                                            locale: es 
                                          })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </Button>
                                
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      className={cn(
                                        "absolute top-1/2 -translate-y-1/2 right-2 h-7 w-7 rounded-lg",
                                        "opacity-0 group-hover:opacity-100 transition-all duration-200",
                                        "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                      )}
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
                  <div className="h-full overflow-auto">
                    <PatientLibrarySection
                      isOpen={true}
                      onPatientSelect={(patient) => {
                        // Patient selected but no automatic conversation start
                        // User must explicitly start conversation
                      }}
                      onStartConversation={(patient) => {
                        onPatientConversationStart?.(patient)
                        setIsOpen(false)
                      }}
                      onClearPatientContext={onClearPatientContext}
                      clearSelectionTrigger={clearPatientSelectionTrigger}
                      onConversationSelect={async (sessionId: string) => {
                        // Handle conversation selection from patient history modal
                        console.log('📱 Mobile: Conversación seleccionada desde historial de paciente:', sessionId);
                        await onConversationSelect(sessionId);
                        setIsOpen(false); // Close mobile nav after selecting conversation
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
    </>
  )
}
