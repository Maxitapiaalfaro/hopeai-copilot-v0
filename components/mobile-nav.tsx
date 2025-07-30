"use client"

import { useState, useEffect } from "react"
import { History, Plus, MessageSquare, Trash2, RefreshCw, Menu } from "lucide-react"
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
import { ClinicalMode, AgentType } from "@/types/clinical-types"
import { useConversationHistory } from "@/hooks/use-conversation-history"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

interface MobileNavProps {
  userId: string
  createSession: (userId: string, mode: ClinicalMode, agent: AgentType) => Promise<string | null>
  onConversationSelect: (sessionId: string) => Promise<void>
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

// Mapeo de agentes para etiquetas legibles
const agentLabels: Record<string, string> = {
  socratico: 'Socrático',
  archivista: 'Archivista',
  investigador: 'Investigador'
}

export function MobileNav({ userId, createSession, onConversationSelect, isOpen: externalIsOpen, onOpenChange: externalOnOpenChange }: MobileNavProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  
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

  // Manejar nueva conversación
  const handleNewConversation = async () => {
    if (isCreatingSession) return
    
    try {
      setIsCreatingSession(true)
      console.log('📱 Mobile: Iniciando nueva conversación...')
      
      const newSessionId = await createSession(userId, "clinical_supervision" as ClinicalMode, "socratico" as AgentType)
      
      if (newSessionId) {
        console.log('✅ Mobile: Nueva sesión creada:', newSessionId)
        
        // Cerrar el sheet
        setIsOpen(false)
        
        // Refrescar conversaciones después de un breve delay
        setTimeout(async () => {
          await refreshConversations()
        }, 300)
      } else {
        throw new Error('No se pudo crear la sesión')
      }
    } catch (err) {
      console.error('❌ Mobile: Error creando nueva conversación:', err)
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
      {/* Sheet de historial de conversaciones */}
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
          
          <SheetContent side="left" className="w-80 p-0">
            <div className="flex flex-col h-full">
              {/* Header */}
              <SheetHeader className="p-4 pb-2 border-b">
                <SheetTitle className="text-left">Historial de Conversaciones</SheetTitle>
              </SheetHeader>

              {/* Botón Nueva Conversación */}
              <div className="p-4 pb-2">
                <Button 
                  onClick={handleNewConversation}
                  className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 hover:border-gray-300 transition-all duration-200 h-11 px-4 gap-3 justify-start shadow-sm"
                  disabled={isCreatingSession}
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {isCreatingSession ? 'Creando...' : 'Nuevo chat'}
                  </span>
                </Button>
              </div>

              {/* Hint de recientes */}
              {conversations.length > 0 && (
                <div className="px-4 pb-2">
                  <span className="text-xs text-gray-600 font-medium">
                    Recientes
                  </span>
                </div>
              )}

              {/* Lista de conversaciones */}
              <ScrollArea className="flex-1">
                <div onScroll={handleScroll} className="h-full overflow-auto">
                  <div className="px-4 pb-4">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        <span className="text-sm text-gray-500">Cargando...</span>
                      </div>
                    ) : conversations.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No hay conversaciones</p>
                      </div>
                    ) : (
                      conversations.map((conversation) => {
                        return (
                          <div key={conversation.sessionId} className="relative group">
                            <Button
                              variant="ghost"
                              className="w-full mb-1 transition-all duration-200 rounded-lg justify-start p-3 h-auto text-left hover:bg-gray-50"
                              onClick={() => handleConversationSelect(conversation.sessionId)}
                            >
                              <div className="flex items-center gap-3 w-full">
                                <div className="w-1 h-8 rounded-full flex-shrink-0 bg-blue-500" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-normal text-sm truncate leading-5 text-gray-900">
                                    {conversation.title}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-0.5 truncate">
                                    {formatDistanceToNow(new Date(conversation.lastUpdated), { 
                                      addSuffix: true, 
                                      locale: es 
                                    })}
                                  </div>
                                </div>
                              </div>
                            </Button>
                            
                            {/* Botón de eliminar */}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="absolute top-1/2 -translate-y-1/2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
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
                                    className="bg-red-600 hover:bg-red-700"
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
                    
                    {/* Indicador de carga para más conversaciones */}
                    {isLoadingMore && (
                      <div className="flex items-center justify-center py-4">
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Cargando más...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </div>
          </SheetContent>
        </Sheet>
    </>
  )
}
