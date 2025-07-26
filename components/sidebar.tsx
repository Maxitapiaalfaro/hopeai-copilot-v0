"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { 
  Search, 
  Plus, 
  Clock, 
  Brain, 
  BookOpen, 
  Stethoscope, 
  ChevronLeft,
  MessageSquare,
  Trash2,
  RefreshCw
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
import type { AgentType } from "@/types/clinical-types"

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  userId?: string
  onNewConversation?: () => void
  onConversationSelect?: (sessionId: string) => void
}

// Mapeo de agentes para compatibilidad con el sistema anterior
const agentIcons = {
  'socratico': Brain,
  'clinico': Stethoscope,
  'academico': BookOpen,
}

const agentColors = {
  'socratico': "text-blue-600",
  'clinico': "text-green-600",
  'academico': "text-purple-600",
}

const agentLabels = {
  'socratico': 'Socrático',
  'clinico': 'Clínico',
  'academico': 'Académico',
}

export function Sidebar({ isOpen, onToggle, userId, onNewConversation, onConversationSelect }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  
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
      console.log('🔄 Iniciando carga de conversaciones para:', effectiveUserId)
      loadConversations(effectiveUserId)
    }
  }, [userId, systemState.userId, isOpen, loadConversations, isLoading])

  // Detectar scroll para lazy loading
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight
    
    // Cargar más cuando se llega al 80% del scroll
    if (scrollPercentage > 0.8 && hasNextPage && !isLoadingMore) {
      loadMoreConversations()
    }
  }, [hasNextPage, isLoadingMore, loadMoreConversations])
  
  // Filtrar conversaciones basado en la búsqueda
  const filteredConversations = searchQuery.trim() 
    ? conversations.filter(conv => 
        conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.preview.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations
  
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
        
        if (success) {
          console.log('✅ Conversación cargada exitosamente:', sessionId)
          onNewConversation?.() // Notificar al componente padre
        } else {
          console.error('❌ Error cargando la conversación')
          setSelectedConversation(null)
        }
      }
    } catch (err) {
      console.error('❌ Error al cargar la conversación:', err)
      setSelectedConversation(null)
    }
  }
  
  // Manejar nueva conversación
  const handleNewConversation = async () => {
    try {
      const effectiveUserId = userId || systemState.userId
      if (createSession && effectiveUserId) {
        await createSession(effectiveUserId, 'clinical_supervision', 'socratico')
        setSelectedConversation(null)
        onNewConversation?.()
        // Refrescar la lista de conversaciones
        await refreshConversations()
      }
    } catch (err) {
      console.error('Error al crear nueva conversación:', err)
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
        "bg-white border-r border-gray-200 flex flex-col transition-all duration-300 shadow-lg relative",
        isOpen ? "w-80" : "w-0 overflow-hidden md:w-16",
      )}
    >
      {/* Toggle button */}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onToggle} 
        className={cn(
          "absolute top-3 z-10 transition-all duration-300",
          isOpen ? "right-3" : "right-2 md:right-1"
        )}
      >
        <ChevronLeft className={cn("h-5 w-5 transition-transform duration-300", !isOpen && "rotate-180")} />
      </Button>

      <div className={cn("border-b border-gray-100 transition-all duration-300", isOpen ? "p-4" : "p-2")}>
        <Button 
          onClick={handleNewConversation}
          className={cn(
            "bg-blue-600 hover:bg-blue-700 transition-all duration-300",
            isOpen ? "w-full justify-start gap-2" : "w-full justify-center p-2"
          )}
        >
          <Plus className="h-4 w-4" />
          {isOpen && "Nueva Conversación"}
        </Button>
      </div>

      {isOpen && (
        <div className="p-4 border-b border-gray-100">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar conversaciones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Controles adicionales */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {totalCount > 0 ? `${filteredConversations.length}/${totalCount}` : filteredConversations.length} conversaciones
                </Badge>
                {error && (
                  <Badge variant="destructive" className="text-xs">
                    Error
                  </Badge>
                )}
              </div>
              <Button 
                onClick={refreshConversations} 
                variant="ghost" 
                size="sm"
                disabled={isLoading}
                className="h-6 w-6 p-0"
              >
                <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            
            {/* Mostrar error si existe */}
            {error && (
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                {error}
                <Button 
                  onClick={clearError} 
                  variant="ghost" 
                  size="sm" 
                  className="ml-2 h-4 text-xs"
                >
                  Cerrar
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div onScroll={handleScroll} className="h-full overflow-auto">
        <div className="p-2">
          {isLoading && isOpen ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm text-gray-500">Cargando...</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            isOpen && (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {conversations.length === 0 
                    ? 'No hay conversaciones'
                    : 'No se encontraron conversaciones'
                  }
                </p>
              </div>
            )
          ) : (
            filteredConversations.map((conversation) => {
              const IconComponent = agentIcons[conversation.activeAgent] || Brain
              const agentColor = agentColors[conversation.activeAgent] || "text-gray-600"
              const agentLabel = agentLabels[conversation.activeAgent] || conversation.activeAgent
              
              return (
                <div key={conversation.sessionId} className="relative group">
                  <Button
                    variant={selectedConversation === conversation.sessionId ? "secondary" : "ghost"}
                    className={cn(
                      "w-full mb-2 transition-all duration-300",
                      isOpen ? "justify-start p-3 h-auto text-left" : "justify-center p-2 h-10",
                      selectedConversation === conversation.sessionId && "bg-blue-50 border-l-4 border-blue-600",
                    )}
                    onClick={() => handleConversationSelect(conversation.sessionId)}
                    title={!isOpen ? conversation.title : undefined}
                  >
                    {isOpen ? (
                      <div className="flex items-start gap-3 w-full">
                        <IconComponent className={cn("h-4 w-4 mt-1 flex-shrink-0", agentColor)} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 truncate">{conversation.title}</div>
                          <div className="text-xs text-gray-500 mt-1 line-clamp-2">{conversation.preview}</div>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(conversation.lastUpdated), { 
                                addSuffix: true, 
                                locale: es 
                              })}
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {agentLabel}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <MessageSquare className="h-3 w-3" />
                              {conversation.messageCount}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <IconComponent className={cn("h-4 w-4", agentColor)} />
                    )}
                  </Button>
                  
                  {/* Botón de eliminar (solo visible en hover y cuando está abierto) */}
                  {isOpen && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-3 w-3" />
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
                  )}
                </div>
              )
            })
          )}
          
          {/* Indicador de carga para más conversaciones */}
          {isLoadingMore && (
            <div className="flex items-center justify-center py-4">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Cargando más conversaciones...</span>
              </div>
            </div>
          )}
          
          {/* Indicador de final de lista */}
          {!hasNextPage && conversations.length > 0 && (
            <div className="text-center py-4 text-sm text-gray-500">
              {totalCount > 0 ? `${conversations.length} de ${totalCount} conversaciones cargadas` : 'Todas las conversaciones cargadas'}
            </div>
          )}
        </div>
        </div>
      </ScrollArea>

      {isOpen && (
        <div className="p-4 border-t border-gray-100">
          <div className="text-xs text-gray-500 space-y-2">
            <div className="font-medium text-gray-700 mb-2">Agentes HopeAI</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Filósofo Socrático</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Archivista Clínico</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>Investigador Académico</span>
            </div>
            
            {/* Estadísticas */}
            <div className="pt-2 border-t border-gray-100 mt-3">
              <div className="flex items-center justify-between">
                <span>Total conversaciones:</span>
                <Badge variant="secondary" className="text-xs">
                  {conversations.length}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
