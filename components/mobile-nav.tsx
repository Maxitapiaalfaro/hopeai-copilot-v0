"use client"

import { useState, useEffect } from "react"
import { History, Plus, MessageSquare, Trash2, RefreshCw, Menu, Users } from "lucide-react"
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
  onNewChat?: () => void
  initialTab?: 'conversations' | 'patients'
}

// Mapeo de agentes para etiquetas legibles
const agentLabels: Record<string, string> = {
  socratico: 'Socrático',
  archivista: 'Archivista',
  investigador: 'Investigador'
}

export function MobileNav({ userId, createSession, onConversationSelect, isOpen: externalIsOpen, onOpenChange: externalOnOpenChange, onPatientConversationStart, onNewChat, initialTab = 'conversations' }: MobileNavProps) {
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
          
          <SheetContent side="left" className="w-80 p-0 bg-background border-r border-border/80 paper-noise color-fragment">
            <div className="flex flex-col h-full">
              <SheetHeader className="p-4 pb-2 border-b border-border/80">
                <SheetTitle className="text-left font-serif text-foreground">Historial</SheetTitle>
              </SheetHeader>

              <div className="p-4 pb-2 flex items-center gap-2">
                <Button 
                  variant="secondary"
                  onClick={handleNewConversation}
                  className="flex-1"
                  disabled={isCreatingSession}
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {isCreatingSession ? 'Creando...' : 'Nuevo chat'}
                  </span>
                </Button>
              </div>

              <div className="px-2 flex border-b border-border/80">
                <Button
                  variant="ghost"
                  className={cn(
                    "flex-1 rounded-none border-b-2 h-9",
                    activeTab === 'conversations' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                  onClick={() => setActiveTab('conversations')}
                >
                  <MessageSquare className="mr-2 h-4 w-4" /> Conversaciones
                </Button>
                <Button
                  variant="ghost"
                  className={cn(
                    "flex-1 rounded-none border-b-2 h-9",
                    activeTab === 'patients' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                  onClick={() => setActiveTab('patients')}
                >
                  <Users className="mr-2 h-4 w-4" /> Pacientes
                </Button>
              </div>

              {activeTab === 'conversations' && conversations.length > 0 && (
                <div className="px-4 pt-2">
                  <span className="text-xs text-muted-foreground font-sans">
                    Recientes
                  </span>
                </div>
              )}

              <div className="flex-1 overflow-hidden">
                {activeTab === 'conversations' ? (
                  <ScrollArea className="flex-1">
                    <div onScroll={handleScroll} className="h-full overflow-auto">
                      <div className="p-4 space-y-2">
                        {isLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw className="h-4 w-4 animate-spin mr-2 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground font-sans">Cargando...</span>
                          </div>
                        ) : conversations.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm font-sans">No hay conversaciones</p>
                          </div>
                        ) : (
                          conversations.map((conversation) => {
                            const agentConfig = getAgentVisualConfigSafe(conversation.activeAgent as AgentType)
                            return (
                              <div key={conversation.sessionId} className="relative group">
                                <Button
                                  variant="ghost"
                                  className="w-full mb-1 h-auto text-left rounded-lg justify-start p-3 hover:bg-secondary"
                                  onClick={() => handleConversationSelect(conversation.sessionId)}
                                >
                                  <div className="flex items-center gap-3 w-full">
                                    <div className="flex-1 min-w-0">
                                      <div className="font-serif text-sm truncate leading-5 text-foreground">
                                        {conversation.title}
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-0.5 truncate font-sans">
                                        {formatDistanceToNow(new Date(conversation.lastUpdated), { 
                                          addSuffix: true, 
                                          locale: es 
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                </Button>
                                
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
                              </div>
                            )
                          })
                        )}
                        
                        {isLoadingMore && (
                          <div className="flex items-center justify-center py-4">
                            <div className="flex items-center space-x-2 text-sm text-muted-foreground font-sans">
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              <span>Cargando más...</span>
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
                        // Start conversation immediately
                        onPatientConversationStart?.(patient)
                        setIsOpen(false)
                      }}
                      onStartConversation={(patient) => {
                        onPatientConversationStart?.(patient)
                        setIsOpen(false)
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
