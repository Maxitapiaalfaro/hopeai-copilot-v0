"use client"

import { useState, useEffect, useCallback, useRef } from "react"
// @deprecated - LEGACY HOOK - Migrar a useSessionsList (API v2)
// TODO FASE 4: Reemplazar este hook con useSessionsList completamente
// Este hook ya NO debe usarse en nuevos componentes
import { clinicalStorage } from "@/lib/clinical-context-storage"
import type { ChatState, AgentType, ClinicalMode, PaginationOptions, PaginatedResponse } from "@/types/clinical-types"

interface ConversationSummary {
  sessionId: string
  title: string
  lastMessage: string
  lastUpdated: Date
  activeAgent: AgentType
  mode: ClinicalMode
  messageCount: number
  preview: string
}

interface UseConversationHistoryReturn {
  conversations: ConversationSummary[]
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  hasNextPage: boolean
  totalCount: number
  
  // Gestión de conversaciones
  loadConversations: (userId: string) => Promise<void>
  loadMoreConversations: () => Promise<void>
  openConversation: (sessionId: string) => Promise<ChatState | null>
  deleteConversation: (sessionId: string) => Promise<void>
  searchConversations: (query: string) => ConversationSummary[]
  
  // Filtros
  filterByAgent: (agent: AgentType | 'all') => ConversationSummary[]
  filterByMode: (mode: ClinicalMode | 'all') => ConversationSummary[]
  
  // Utilidades
  clearError: () => void
  refreshConversations: () => Promise<void>
}

export function useConversationHistory(): UseConversationHistoryReturn {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [allConversations, setAllConversations] = useState<ConversationSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [nextPageToken, setNextPageToken] = useState<string | undefined>()
  const [searchQuery, setSearchQuery] = useState<string>('')
  
  // Cache para evitar recargas innecesarias
  const conversationCache = useRef<Map<string, ConversationSummary>>(new Map())
  const lastLoadedUserId = useRef<string | null>(null)

  // Función para convertir ChatState a ConversationSummary
  const createConversationSummary = useCallback((chatState: ChatState): ConversationSummary => {
    const lastUserMessage = chatState.history
      .filter(msg => msg.role === 'user')
      .pop()
    
    const lastMessage = chatState.history[chatState.history.length - 1]
    
    // Generar título inteligente basado en el primer mensaje del usuario
    const firstUserMessage = chatState.history.find(msg => msg.role === 'user')
    const title = firstUserMessage 
      ? firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
      : `Sesión ${chatState.activeAgent}`
    
    // Crear preview del último intercambio
    const preview = lastMessage
      ? `${lastMessage.role === 'user' ? 'Tú' : 'HopeAI'}: ${lastMessage.content.substring(0, 100)}${lastMessage.content.length > 100 ? '...' : ''}`
      : 'Sin mensajes'

    return {
      sessionId: chatState.sessionId,
      title,
      lastMessage: lastMessage?.content || '',
      lastUpdated: chatState.metadata.lastUpdated,
      activeAgent: chatState.activeAgent,
      mode: chatState.mode,
      messageCount: chatState.history.length,
      preview
    }
  }, [])

  // Cargar conversaciones del usuario con paginación
  const loadConversations = useCallback(async (userId: string, resetCache: boolean = true) => {
    console.warn('⚠️ TODO FASE 3: loadConversations stub temporal - usar useSessionsList en su lugar')
    // TODO FASE 3: Este hook debe ser reemplazado por useSessionsList
    setIsLoading(true)
    setConversations([])
    setAllConversations([])
    setHasNextPage(false)
    setTotalCount(0)
    setIsLoading(false)
  }, [createConversationSummary])

  // Cargar más conversaciones (lazy loading)
  const loadMoreConversations = useCallback(async () => {
    console.warn('⚠️ TODO FASE 3: loadMoreConversations stub temporal')
    return
  }, [currentUserId, hasNextPage, nextPageToken, isLoadingMore, allConversations, createConversationSummary, searchQuery])

  // Abrir conversación específica
  const openConversation = useCallback(async (sessionId: string): Promise<ChatState | null> => {
    console.warn('⚠️ TODO FASE 3: openConversation stub temporal')
    return null
  }, [])

  // Eliminar conversación
  const deleteConversation = useCallback(async (sessionId: string) => {
    console.warn('⚠️ TODO FASE 3: deleteConversation stub temporal')
  }, [allConversations])

  // Buscar conversaciones
  const searchConversations = useCallback((query: string): ConversationSummary[] => {
    setSearchQuery(query)
    
    if (!query.trim()) {
      setConversations(allConversations)
      return allConversations
    }
    
    const lowercaseQuery = query.toLowerCase()
    const filtered = allConversations.filter(conv => 
      conv.title.toLowerCase().includes(lowercaseQuery) ||
      conv.lastMessage.toLowerCase().includes(lowercaseQuery) ||
      conv.preview.toLowerCase().includes(lowercaseQuery)
    )
    
    setConversations(filtered)
    return filtered
  }, [allConversations])

  // Filtrar por agente
  const filterByAgent = useCallback((agent: AgentType | 'all'): ConversationSummary[] => {
    if (agent === 'all') {
      return allConversations
    }
    return allConversations.filter(conv => conv.activeAgent === agent)
  }, [allConversations])

  // Filtrar por modo
  const filterByMode = useCallback((mode: ClinicalMode | 'all'): ConversationSummary[] => {
    if (mode === 'all') {
      return allConversations
    }
    return allConversations.filter(conv => conv.mode === mode)
  }, [allConversations])

  // Estado para debouncing de refresh
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Refrescar conversaciones con debouncing
  const refreshConversations = useCallback(async () => {
    // Prevenir múltiples refreshes simultáneos
    if (isRefreshing) {
      console.log('⚠️ Refresh ya en progreso, ignorando solicitud duplicada')
      return
    }

    // Limpiar timeout anterior si existe
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
    }

    // Implementar debouncing de 200ms
    refreshTimeoutRef.current = setTimeout(async () => {
      if (currentUserId) {
        try {
          setIsRefreshing(true)
          console.log('🔄 Iniciando refresh debounced de conversaciones')
          await loadConversations(currentUserId, true) // Resetear cache
          console.log('✅ Refresh de conversaciones completado')
        } catch (error) {
          console.error('❌ Error en refresh de conversaciones:', error)
        } finally {
          setIsRefreshing(false)
        }
      }
    }, 200)
  }, [currentUserId, loadConversations, isRefreshing])

  // Limpiar error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
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
    searchConversations,
    filterByAgent,
    filterByMode,
    clearError,
    refreshConversations
  }
}