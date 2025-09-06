"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Search, MessageCircle, Clock, User, Filter, ChevronDown, Trash2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, Loader2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { usePatientConversationHistory } from "@/hooks/use-patient-conversation-history"
import { getAgentVisualConfigSafe } from "@/config/agent-visual-config"
import type { AgentType, ClinicalMode, PatientRecord } from "@/types/clinical-types"

interface PatientConversationHistoryProps {
  patient: PatientRecord
  userId: string
  onConversationSelect?: (sessionId: string) => void
  onNewConversation?: (patientId: string) => void
  className?: string
}

type FilterType = 'all' | AgentType
type ModeFilterType = 'all' | ClinicalMode
type SortType = 'recent' | 'oldest' | 'messages'

export function PatientConversationHistory({
  patient,
  userId,
  onConversationSelect,
  onNewConversation,
  className = ""
}: PatientConversationHistoryProps) {
  const {
    conversations,
    isLoading,
    isLoadingMore,
    error,
    hasNextPage,
    totalCount,
    loadPatientConversations,
    loadMoreConversations,
    deleteConversation,
    searchConversations,
    filterByAgent,
    filterByMode,
    clearError,
    refreshConversations
  } = usePatientConversationHistory()

  // Estados locales para filtros y búsqueda
  const [searchQuery, setSearchQuery] = useState("")
  const [agentFilter, setAgentFilter] = useState<FilterType>('all')
  const [modeFilter, setModeFilter] = useState<ModeFilterType>('all')
  const [sortBy, setSortBy] = useState<SortType>('recent')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null)

  // Cargar conversaciones al montar el componente
  useEffect(() => {
    if (patient.id && userId) {
      loadPatientConversations(patient.id, userId)
    }
  }, [patient.id, userId, loadPatientConversations])

  // Aplicar filtros y búsqueda
  const filteredAndSortedConversations = useMemo(() => {
    let filtered = conversations

    // Aplicar búsqueda
    if (searchQuery.trim()) {
      filtered = searchConversations(searchQuery)
    }

    // Aplicar filtro por agente
    if (agentFilter !== 'all') {
      filtered = filterByAgent(agentFilter)
    }

    // Aplicar filtro por modo
    if (modeFilter !== 'all') {
      filtered = filterByMode(modeFilter)
    }

    // Aplicar ordenamiento
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
        case 'oldest':
          return new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime()
        case 'messages':
          return b.messageCount - a.messageCount
        default:
          return 0
      }
    })

    return sorted
  }, [conversations, searchQuery, agentFilter, modeFilter, sortBy, searchConversations, filterByAgent, filterByMode])

  // Manejar selección de conversación
  const handleConversationSelect = (sessionId: string) => {
    onConversationSelect?.(sessionId)
  }

  // Manejar eliminación de conversación
  const handleDeleteConversation = async () => {
    if (conversationToDelete) {
      await deleteConversation(conversationToDelete)
      setDeleteDialogOpen(false)
      setConversationToDelete(null)
    }
  }

  // Formatear fecha relativa
  const formatRelativeTime = (date: Date) => {
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Hace menos de 1 hora'
    if (diffInHours < 24) return `Hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `Hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`
    
    const diffInWeeks = Math.floor(diffInDays / 7)
    if (diffInWeeks < 4) return `Hace ${diffInWeeks} semana${diffInWeeks > 1 ? 's' : ''}`
    
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  // Obtener configuración visual del agente
  const getAgentConfig = (agent: AgentType) => {
    return getAgentVisualConfigSafe(agent)
  }

  if (isLoading && conversations.length === 0) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
        
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
        
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header con información del paciente */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-lg">
            {`Paciente ${patient.id}`}
          </h3>
          <Badge variant="outline" className="text-xs">
            {totalCount} conversación{totalCount !== 1 ? 'es' : ''}
          </Badge>
        </div>
        
        <Button
          onClick={() => onNewConversation?.(patient.id)}
          size="sm"
          className="gap-2"
        >
          <MessageCircle className="h-4 w-4" />
          Nueva conversación
        </Button>
      </div>

      {/* Barra de búsqueda y filtros */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar en conversaciones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9 sm:h-10"
          />
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {/* Filtro por agente */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                <Filter className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Agente:</span> {agentFilter === 'all' ? 'Todos' : getAgentConfig(agentFilter as AgentType).name}
                <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Filtrar por agente</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setAgentFilter('all')}>
                Todos los agentes
              </DropdownMenuItem>
              {(['socratico', 'clinico', 'academico', 'orquestador'] as AgentType[]).map((agentType) => {
                const config = getAgentVisualConfigSafe(agentType)
                return (
                  <DropdownMenuItem 
                    key={agentType} 
                    onClick={() => setAgentFilter(agentType)}
                  >
                    <span className="mr-2"><config.icon className="h-4 w-4" /></span>
                    {config.name}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Filtro por modo */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                <span className="hidden sm:inline">Modo:</span> {modeFilter === 'all' ? 'Todos' : modeFilter}
                <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Filtrar por modo</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setModeFilter('all')}>
                Todos los modos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setModeFilter('therapeutic_assistance')}>
                Asistencia Terapéutica
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setModeFilter('clinical_supervision')}>
                Supervisión Clínica
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setModeFilter('research_support')}>
                Soporte de Investigación
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Ordenamiento */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">
                  {sortBy === 'recent' ? 'Más reciente' : 
                   sortBy === 'oldest' ? 'Más antiguo' : 'Más mensajes'}
                </span>
                <span className="sm:hidden">
                  {sortBy === 'recent' ? 'Reciente' : 
                   sortBy === 'oldest' ? 'Antiguo' : 'Mensajes'}
                </span>
                <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSortBy('recent')}>
                Más reciente
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('oldest')}>
                Más antiguo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('messages')}>
                Más mensajes
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Manejo de errores */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearError}
                className="ml-auto"
              >
                Cerrar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de conversaciones */}
      <ScrollArea className="h-[400px] sm:h-[500px] lg:h-[600px]">
        <div className="space-y-2 sm:space-y-3">
          {isLoading ? (
            <div className="space-y-2 sm:space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Card key={index}>
                  <CardHeader className="pb-2 p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <Skeleton className="h-4 w-3/4 mb-2" />
                        <div className="flex items-center gap-1 sm:gap-2">
                          <Skeleton className="h-5 w-20" />
                          <Skeleton className="h-5 w-16" />
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 sm:gap-1">
                        <Skeleton className="h-6 w-6 sm:h-8 sm:w-8" />
                        <Skeleton className="h-6 w-6 sm:h-8 sm:w-8" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0">
                    <Skeleton className="h-3 w-full mb-1" />
                    <Skeleton className="h-3 w-2/3 mb-2 sm:mb-3" />
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredAndSortedConversations.length === 0 ? (
            <Card>
              <CardContent className="pt-4 sm:pt-6">
                <div className="text-center text-muted-foreground px-4">
                  <MessageCircle className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                  <p className="text-base sm:text-lg font-medium mb-2">
                    {searchQuery ? 'No se encontraron conversaciones' : 'Sin conversaciones'}
                  </p>
                  <p className="text-xs sm:text-sm">
                    {searchQuery 
                      ? 'Intenta con otros términos de búsqueda o ajusta los filtros'
                      : 'Inicia una nueva conversación con este paciente'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredAndSortedConversations.map((conversation) => {
              const agentConfig = getAgentConfig(conversation.activeAgent)
              
              return (
                <Card 
                  key={conversation.sessionId} 
                  className="hover:shadow-md transition-all duration-200 cursor-pointer group"
                  onClick={() => handleConversationSelect(conversation.sessionId)}
                >
                  <CardHeader className="pb-2 p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-xs sm:text-sm truncate group-hover:text-primary transition-colors">
                          {conversation.title}
                        </h4>
                        <div className="flex items-center gap-1 sm:gap-2 mt-1 flex-wrap">
                          <Badge 
                            variant="outline" 
                            className={`text-xs px-1.5 py-0.5 ${agentConfig.textColor} ${agentConfig.bgColor} ${agentConfig.borderColor}`}
                          >
                            <span className="mr-1"><agentConfig.icon className="h-3 w-3" /></span>
                            <span className="hidden sm:inline">{agentConfig.name}</span>
                            <span className="sm:hidden">{agentConfig.name.split(' ')[0]}</span>
                          </Badge>
                          <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                            {conversation.messageCount} mensaje{conversation.messageCount !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-0.5 sm:gap-1 ml-1 sm:ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 sm:h-8 sm:w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleConversationSelect(conversation.sessionId)
                          }}
                        >
                          <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 sm:h-8 sm:w-8 p-0 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            setConversationToDelete(conversation.sessionId)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-3 sm:p-4 pt-0">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 line-clamp-2">
                      {conversation.preview}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 min-w-0">
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{formatRelativeTime(new Date(conversation.lastUpdated))}</span>
                      </span>
                      <Badge variant="outline" className="text-xs px-1.5 py-0.5 ml-2 flex-shrink-0">
                        {conversation.mode}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
          
          {/* Botón para cargar más */}
          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={loadMoreConversations}
                disabled={isLoadingMore}
                className="gap-1 sm:gap-2 text-xs sm:text-sm"
                size="sm"
              >
                {isLoadingMore ? (
                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                ) : (
                  <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
                )}
                <span className="hidden sm:inline">
                  {isLoadingMore ? 'Cargando...' : 'Cargar más conversaciones'}
                </span>
                <span className="sm:hidden">
                  {isLoadingMore ? 'Cargando...' : 'Cargar más'}
                </span>
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Dialog de confirmación para eliminar */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar conversación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La conversación será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConversation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default PatientConversationHistory