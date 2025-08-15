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

export function Sidebar({ isOpen, onToggle, userId, createSession: createSessionProp, onConversationSelect, onPatientConversationStart }: SidebarProps) {
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
        
        if (success) {
          console.log('✅ Conversación cargada exitosamente:', sessionId)
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
  
  // Estado para prevenir creación múltiple simultánea
  const [isCreatingSession, setIsCreatingSession] = useState(false)

  // Manejar nueva conversación con patrón de transacción atómica
  const handleNewConversation = async () => {
    // Prevenir múltiples ejecuciones simultáneas
    if (isCreatingSession) {
      console.log('⚠️ Sidebar: Creación de sesión ya en progreso, ignorando solicitud duplicada')
      return
    }

    try {
      setIsCreatingSession(true)
      const effectiveUserId = userId || systemState.userId
      
      if (createSessionProp && effectiveUserId) {
        console.log('📝 Sidebar: Iniciando transacción de nueva conversación...')
        
        // Transacción atómica: crear sesión y actualizar estado
        const newSessionId = await createSessionProp(effectiveUserId, 'clinical_supervision', 'socratico')
        
        if (newSessionId) {
          // Solo proceder si la sesión se creó exitosamente
          setSelectedConversation(null)
          
          // Debounced refresh para evitar múltiples llamadas
          setTimeout(async () => {
            await refreshConversations()
          }, 300)
          
          console.log('✅ Sidebar: Transacción de nueva conversación completada:', newSessionId)
        } else {
          throw new Error('No se pudo crear la sesión')
        }
      }
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
        "flex flex-col transition-all duration-300 relative bg-gray-50/50",
        isOpen ? "w-80" : "w-0 overflow-hidden md:w-16",
      )}
    >
      {/* Header estilo Gemini */}
      <div className={cn("flex flex-col transition-all duration-300", isOpen ? "p-4 pb-2" : "justify-center p-2")}>
        {!isOpen && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onToggle} 
            className="h-10 w-10 p-0 hover:bg-gray-100 transition-colors"
            title="Abrir panel lateral"
          >
            <Menu className="h-5 w-5 text-gray-600" />
          </Button>
        )}
        
        {isOpen && (
          <>
            <div className="flex items-center justify-between mb-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onToggle} 
                className="h-8 w-8 p-0 hover:bg-gray-100 transition-colors"
                title="Cerrar panel lateral"
              >
                <Menu className="h-4 w-4 text-gray-600" />
              </Button>
            </div>
            
            <Button 
              onClick={handleNewConversation}
              className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 hover:border-gray-300 transition-all duration-200 h-11 px-4 gap-3 justify-start shadow-sm"
              disabled={isCreatingSession}
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">Nuevo chat</span>
            </Button>
          </>
        )}
      </div>

      {/* Hint de recientes estilo Gemini */}
      {isOpen && filteredConversations.length > 0 && (
        <div className="px-4 pb-2">
          <span className="text-xs text-gray-600 font-medium">
            Recientes
          </span>
        </div>
      )}

      {/* Tab Navigation */}
      {isOpen && (
        <div className="flex border-b border-gray-200">
          <Button
            variant="ghost"
            className={cn(
              "flex-1 rounded-none border-b-2 transition-colors",
              activeTab === 'conversations'
                ? "border-blue-500 text-blue-600 bg-blue-50"
                : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            )}
            onClick={() => setActiveTab('conversations')}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Conversaciones
          </Button>
          <Button
            variant="ghost"
            className={cn(
              "flex-1 rounded-none border-b-2 transition-colors",
              activeTab === 'patients'
                ? "border-blue-500 text-blue-600 bg-blue-50"
                : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            )}
            onClick={() => setActiveTab('patients')}
          >
            <Users className="mr-2 h-4 w-4" />
            Pacientes
          </Button>
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'conversations' ? (
          <ScrollArea className="h-full">
            <div onScroll={handleScroll} className="h-full overflow-auto">
            <div className="px-4 pb-4">
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
                  const agentConfig = getAgentVisualConfig(conversation.activeAgent as AgentType)
                  const agentLabel = agentLabels[conversation.activeAgent] || conversation.activeAgent
                  
                  return (
                    <div key={conversation.sessionId} className="relative group">
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full mb-1 transition-all duration-200 rounded-lg",
                          isOpen ? "justify-start p-3 h-auto text-left" : "justify-center p-2 h-10",
                          selectedConversation === conversation.sessionId 
                            ? "bg-gray-100 hover:bg-gray-100" 
                            : "hover:bg-gray-50",
                        )}
                        onClick={() => handleConversationSelect(conversation.sessionId)}
                        title={!isOpen ? conversation.title : undefined}
                      >
                        {isOpen ? (
                          <div className="flex items-center gap-3 w-full">
                            <div className={cn("w-1 h-8 rounded-full flex-shrink-0", agentConfig.buttonBgColor)} />
                            <div className="flex-1 min-w-0">
                              <div className={cn("font-normal text-sm truncate leading-5", agentConfig.textColor)}>
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
                        ) : (
                          // En estado colapsado, no mostrar iconos
                          <div className="w-full h-full" />
                        )}
                      </Button>
                      
                      {/* Botón de eliminar estilo Gemini */}
                      {isOpen && (
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
            onPatientSelect={(patient) => {
              console.log('Patient selected:', patient.displayName)
            }}
            onStartConversation={(patient) => {
              console.log('Starting conversation with patient:', patient.displayName)
              onPatientConversationStart?.(patient)
            }}
          />
        )}
      </div>

    </div>
  )
}
