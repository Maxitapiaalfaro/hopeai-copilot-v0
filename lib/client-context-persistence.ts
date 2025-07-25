"use client"

import type { ChatMessage, AgentType } from "@/types/clinical-types"

// Interfaz para el contexto optimizado persistente
interface OptimizedContextData {
  sessionId: string
  activeAgent: AgentType
  curatedHistory: ChatMessage[]
  comprehensiveHistory: ChatMessage[]
  metadata: {
    createdAt: string
    lastUpdated: string
    totalTokens: number
    usageMetadata: {
      totalMessages: number
      averageResponseTime: number
      compressionRatio: number
      modalityUsage: Record<string, number>
    }
    modalityDetails: {
      textTokens: number
      audioTokens: number
      videoTokens: number
    }
    contextWindow: {
      utilized: number
      available: number
      compressionActive: boolean
    }
  }
}

// Configuración de compresión
const COMPRESSION_THRESHOLD = 50000 // caracteres
const MAX_STORED_SESSIONS = 10 // máximo de sesiones almacenadas
const STORAGE_KEY_PREFIX = 'hopeai_optimized_context_'
const SESSIONS_INDEX_KEY = 'hopeai_sessions_index'

export class ClientContextPersistence {
  private static instance: ClientContextPersistence | null = null

  // Singleton pattern para asegurar una sola instancia
  static getInstance(): ClientContextPersistence {
    if (!ClientContextPersistence.instance) {
      ClientContextPersistence.instance = new ClientContextPersistence()
    }
    return ClientContextPersistence.instance
  }

  private constructor() {
    // Constructor privado para singleton
  }

  // Verificar si estamos en el cliente (browser)
  private isClient(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
  }

  // Alias para compatibilidad con tests
  async saveOptimizedSession(
    sessionId: string,
    activeAgent: AgentType,
    curatedHistory: ChatMessage[],
    metadata: any
  ): Promise<void> {
    return this.saveOptimizedContext(sessionId, activeAgent, curatedHistory, metadata)
  }

  // Guardar contexto optimizado
  async saveOptimizedContext(
    sessionId: string,
    activeAgent: AgentType,
    curatedHistory: ChatMessage[],
    metadata: any
  ): Promise<void> {
    if (!this.isClient()) {
      console.warn('ClientContextPersistence: No disponible en servidor')
      return
    }

    try {
      // Obtener historial comprehensivo desde localStorage si existe
      const existingContext = await this.loadOptimizedContext(sessionId)
      const comprehensiveHistory = existingContext?.comprehensiveHistory || curatedHistory

      // Determinar si necesitamos compresión inteligente
      const totalContent = comprehensiveHistory.reduce((acc, msg) => acc + msg.content.length, 0)
      const needsCompression = totalContent > COMPRESSION_THRESHOLD

      let finalCuratedHistory = curatedHistory
      let compressionRatio = 1.0

      if (needsCompression) {
        finalCuratedHistory = this.compressHistory(comprehensiveHistory)
        compressionRatio = finalCuratedHistory.length / comprehensiveHistory.length
      }

      // Calcular conteo de tokens estimado
      const tokenCount = this.estimateTokenCount(comprehensiveHistory)

      const optimizedContext: OptimizedContextData = {
        sessionId,
        activeAgent,
        curatedHistory: finalCuratedHistory,
        comprehensiveHistory,
        metadata: {
          createdAt: existingContext?.metadata.createdAt || new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          totalTokens: tokenCount,
          usageMetadata: {
            ...metadata.usageMetadata,
            compressionRatio
          },
          modalityDetails: metadata.modalityDetails || {
            textTokens: tokenCount,
            audioTokens: 0,
            videoTokens: 0
          },
          contextWindow: {
            utilized: tokenCount,
            available: 1000000, // MAX_CONTEXT_WINDOW
            compressionActive: needsCompression
          }
        }
      }

      // Guardar en localStorage
      const storageKey = `${STORAGE_KEY_PREFIX}${sessionId}`
      localStorage.setItem(storageKey, JSON.stringify(optimizedContext))

      // Actualizar índice de sesiones
      await this.updateSessionsIndex(sessionId)

      console.log(`✅ Contexto optimizado guardado para sesión ${sessionId}`, {
        compressionActive: needsCompression,
        compressionRatio,
        tokenCount,
        curatedMessages: finalCuratedHistory.length,
        comprehensiveMessages: comprehensiveHistory.length
      })
    } catch (error) {
      console.error('Error guardando contexto optimizado:', error)
      throw error
    }
  }

  // Alias para compatibilidad con tests
  async loadOptimizedSession(sessionId: string): Promise<OptimizedContextData | null> {
    return this.loadOptimizedContext(sessionId)
  }

  // Cargar contexto optimizado
  async loadOptimizedContext(sessionId: string): Promise<OptimizedContextData | null> {
    if (!this.isClient()) {
      console.warn('ClientContextPersistence: No disponible en servidor')
      return null
    }

    try {
      const storageKey = `${STORAGE_KEY_PREFIX}${sessionId}`
      const storedData = localStorage.getItem(storageKey)

      if (!storedData) {
        return null
      }

      const context: OptimizedContextData = JSON.parse(storedData)
      
      // Validar integridad de los datos
      if (!this.validateContextData(context)) {
        console.warn(`Datos de contexto inválidos para sesión ${sessionId}`)
        return null
      }

      // Convertir fechas de string a Date objects en los mensajes
      context.curatedHistory = context.curatedHistory.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))
      
      context.comprehensiveHistory = context.comprehensiveHistory.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))

      console.log(`✅ Contexto optimizado cargado para sesión ${sessionId}`, {
        compressionActive: context.metadata.contextWindow.compressionActive,
        tokenCount: context.metadata.totalTokens,
        curatedMessages: context.curatedHistory.length,
        comprehensiveMessages: context.comprehensiveHistory.length
      })

      return context
    } catch (error) {
      console.error('Error cargando contexto optimizado:', error)
      return null
    }
  }

  // Obtener la sesión más reciente
  async getMostRecentSession(): Promise<OptimizedContextData | null> {
    if (!this.isClient()) return null

    try {
      const sessionsIndex = this.getSessionsIndex()
      if (sessionsIndex.length === 0) return null

      // Ordenar por fecha de última actualización
      const sortedSessions = sessionsIndex.sort((a, b) => 
        new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
      )

      const mostRecentSessionId = sortedSessions[0].sessionId
      return await this.loadOptimizedContext(mostRecentSessionId)
    } catch (error) {
      console.error('Error obteniendo sesión más reciente:', error)
      return null
    }
  }

  // Listar todas las sesiones disponibles
  async listAvailableSessions(): Promise<Array<{
    sessionId: string
    activeAgent: AgentType
    lastUpdated: string
    messageCount: number
    tokenCount: number
  }>> {
    if (!this.isClient()) return []

    try {
      const sessionsIndex = this.getSessionsIndex()
      return sessionsIndex.sort((a, b) => 
        new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
      )
    } catch (error) {
      console.error('Error listando sesiones:', error)
      return []
    }
  }

  // Eliminar sesión
  async deleteSession(sessionId: string): Promise<void> {
    if (!this.isClient()) return

    try {
      const storageKey = `${STORAGE_KEY_PREFIX}${sessionId}`
      localStorage.removeItem(storageKey)
      
      // Actualizar índice
      const sessionsIndex = this.getSessionsIndex()
      const updatedIndex = sessionsIndex.filter(session => session.sessionId !== sessionId)
      localStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(updatedIndex))

      console.log(`✅ Sesión ${sessionId} eliminada`)
    } catch (error) {
      console.error('Error eliminando sesión:', error)
      throw error
    }
  }

  // Limpiar sesiones antiguas (mantener solo las más recientes)
  async cleanupOldSessions(): Promise<void> {
    if (!this.isClient()) return

    try {
      const sessionsIndex = this.getSessionsIndex()
      
      if (sessionsIndex.length <= MAX_STORED_SESSIONS) {
        return // No hay necesidad de limpiar
      }

      // Ordenar por fecha y mantener solo las más recientes
      const sortedSessions = sessionsIndex.sort((a, b) => 
        new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
      )

      const sessionsToDelete = sortedSessions.slice(MAX_STORED_SESSIONS)
      
      for (const session of sessionsToDelete) {
        await this.deleteSession(session.sessionId)
      }

      console.log(`✅ Limpieza completada: ${sessionsToDelete.length} sesiones eliminadas`)
    } catch (error) {
      console.error('Error en limpieza de sesiones:', error)
    }
  }

  // Métodos privados de utilidad
  // Función pública para compresión de contenido (para tests)
  compressContent(content: string): string {
    // Compresión simple para testing
    if (content.length <= COMPRESSION_THRESHOLD) {
      return content
    }
    
    // Mantener inicio y final, comprimir el medio
    const start = content.substring(0, 1000)
    const end = content.substring(content.length - 1000)
    const compressed = `${start}\n\n[... contenido comprimido ...]\n\n${end}`
    
    return compressed
  }

  private compressHistory(history: ChatMessage[]): ChatMessage[] {
    // Estrategia de compresión inteligente:
    // 1. Mantener siempre los primeros 2 mensajes (contexto inicial)
    // 2. Mantener siempre los últimos 10 mensajes (contexto reciente)
    // 3. Para el medio, mantener 1 de cada 3 mensajes, priorizando mensajes del usuario
    
    if (history.length <= 12) {
      return history // No necesita compresión
    }

    const compressed: ChatMessage[] = []
    
    // Primeros 2 mensajes
    compressed.push(...history.slice(0, 2))
    
    // Últimos 10 mensajes
    const recentMessages = history.slice(-10)
    
    // Mensajes del medio con compresión selectiva
    const middleMessages = history.slice(2, -10)
    const compressedMiddle = middleMessages.filter((msg, index) => 
      msg.role === 'user' || index % 3 === 0
    )
    
    compressed.push(...compressedMiddle)
    compressed.push(...recentMessages)
    
    return compressed
  }

  private estimateTokenCount(history: ChatMessage[]): number {
    // Estimación: ~4 caracteres por token para español
    const totalChars = history.reduce((acc, msg) => acc + msg.content.length, 0)
    return Math.ceil(totalChars / 4)
  }

  private validateContextData(context: OptimizedContextData): boolean {
    return (
      context &&
      typeof context.sessionId === 'string' &&
      typeof context.activeAgent === 'string' &&
      Array.isArray(context.curatedHistory) &&
      Array.isArray(context.comprehensiveHistory) &&
      context.metadata &&
      typeof context.metadata.totalTokens === 'number'
    )
  }

  private getSessionsIndex(): Array<{
    sessionId: string
    activeAgent: AgentType
    lastUpdated: string
    messageCount: number
    tokenCount: number
  }> {
    try {
      const indexData = localStorage.getItem(SESSIONS_INDEX_KEY)
      return indexData ? JSON.parse(indexData) : []
    } catch (error) {
      console.error('Error leyendo índice de sesiones:', error)
      return []
    }
  }

  private async updateSessionsIndex(sessionId: string): Promise<void> {
    try {
      const context = await this.loadOptimizedContext(sessionId)
      if (!context) return

      let sessionsIndex = this.getSessionsIndex()
      
      // Remover entrada existente si la hay
      sessionsIndex = sessionsIndex.filter(session => session.sessionId !== sessionId)
      
      // Agregar nueva entrada
      sessionsIndex.push({
        sessionId: context.sessionId,
        activeAgent: context.activeAgent,
        lastUpdated: context.metadata.lastUpdated,
        messageCount: context.comprehensiveHistory.length,
        tokenCount: context.metadata.totalTokens
      })

      localStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(sessionsIndex))
    } catch (error) {
      console.error('Error actualizando índice de sesiones:', error)
    }
  }
}