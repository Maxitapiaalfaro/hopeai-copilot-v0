import type { ChatState, ClinicalFile } from "@/types/clinical-types"

export class ClinicalContextStorage {
  private dbName = "hopeai_clinical_db"
  private version = 1
  private db: IDBDatabase | null = null

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Store for chat sessions
        if (!db.objectStoreNames.contains("chat_sessions")) {
          const chatStore = db.createObjectStore("chat_sessions", {
            keyPath: "sessionId",
          })
          chatStore.createIndex("userId", "userId", { unique: false })
          chatStore.createIndex("lastUpdated", "metadata.lastUpdated", { unique: false })
          chatStore.createIndex("mode", "mode", { unique: false })
        }

        // Store for clinical files
        if (!db.objectStoreNames.contains("clinical_files")) {
          const filesStore = db.createObjectStore("clinical_files", {
            keyPath: "id",
          })
          filesStore.createIndex("sessionId", "sessionId", { unique: false })
          filesStore.createIndex("status", "status", { unique: false })
        }

        // Store for user preferences
        if (!db.objectStoreNames.contains("user_preferences")) {
          const prefsStore = db.createObjectStore("user_preferences", {
            keyPath: "userId",
          })
        }
      }
    })
  }

  async saveChatSession(chatState: ChatState): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(["chat_sessions"], "readwrite")
    const store = transaction.objectStore("chat_sessions")

    return new Promise<void>((resolve, reject) => {
      const request = store.put({
        ...chatState,
        metadata: {
          ...chatState.metadata,
          lastUpdated: new Date(),
        },
      })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async loadChatSession(sessionId: string): Promise<ChatState | null> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(["chat_sessions"], "readonly")
    const store = transaction.objectStore("chat_sessions")

    return new Promise((resolve, reject) => {
      const request = store.get(sessionId)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  // Obtener todas las sesiones de un usuario (método legacy - mantener compatibilidad)
  async getUserSessions(userId: string): Promise<ChatState[]> {
    const result = await this.getUserSessionsPaginated(userId, { pageSize: 1000 })
    return result.items
  }

  // Obtener sesiones paginadas de un usuario
  async getUserSessionsPaginated(
    userId: string, 
    options: {
      pageSize?: number
      pageToken?: string
      sortBy?: 'lastUpdated' | 'created'
      sortOrder?: 'asc' | 'desc'
    } = {}
  ): Promise<{
    items: ChatState[]
    nextPageToken?: string
    totalCount: number
    hasNextPage: boolean
  }> {
    if (!this.db) throw new Error("Database not initialized")

    try {
      const {
        pageSize = 20,
        pageToken,
        sortBy = 'lastUpdated',
        sortOrder = 'desc'
      } = options

      const transaction = this.db.transaction(["chat_sessions"], "readonly")
      const store = transaction.objectStore("chat_sessions")
      const index = store.index("userId")
      
      return new Promise((resolve, reject) => {
        const request = index.getAll(userId)
        
        request.onsuccess = () => {
          let sessions = request.result || []
          
          // Ordenar sesiones
          sessions.sort((a, b) => {
            const aValue = sortBy === 'lastUpdated' ? new Date(a.metadata.lastUpdated).getTime() : new Date(a.metadata.created).getTime()
            const bValue = sortBy === 'lastUpdated' ? new Date(b.metadata.lastUpdated).getTime() : new Date(b.metadata.created).getTime()
            return sortOrder === 'desc' ? bValue - aValue : aValue - bValue
          })

          const totalCount = sessions.length
          
          // Implementar cursor-based pagination
          let startIndex = 0
          if (pageToken) {
            try {
              const decodedToken = JSON.parse(atob(pageToken))
              startIndex = decodedToken.offset || 0
            } catch (error) {
              console.warn('Token de página inválido, comenzando desde el inicio')
            }
          }

          const endIndex = startIndex + pageSize
          const paginatedSessions = sessions.slice(startIndex, endIndex)
          const hasNextPage = endIndex < totalCount
          
          let nextPageToken: string | undefined
          if (hasNextPage) {
            nextPageToken = btoa(JSON.stringify({ offset: endIndex }))
          }

          resolve({
            items: paginatedSessions,
            nextPageToken,
            totalCount,
            hasNextPage
          })
        }
        
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error obteniendo sesiones paginadas del usuario:', error)
      return {
        items: [],
        totalCount: 0,
        hasNextPage: false
      }
    }
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(["chat_sessions"], "readwrite")
    const store = transaction.objectStore("chat_sessions")

    return new Promise<void>((resolve, reject) => {
      const request = store.delete(sessionId)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async saveClinicalFile(file: ClinicalFile): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(["clinical_files"], "readwrite")
    const store = transaction.objectStore("clinical_files")

    return new Promise<void>((resolve, reject) => {
      const request = store.put(file)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getClinicalFiles(sessionId?: string): Promise<ClinicalFile[]> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(["clinical_files"], "readonly")
    const store = transaction.objectStore("clinical_files")

    return new Promise((resolve, reject) => {
      if (sessionId) {
        const index = store.index("sessionId")
        const request = index.getAll(sessionId)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      } else {
        const request = store.getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      }
    })
  }

  async clearAllData(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")

    const transaction = this.db.transaction(["chat_sessions", "clinical_files", "user_preferences"], "readwrite")

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore("chat_sessions").clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore("clinical_files").clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore("user_preferences").clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }),
    ])
  }
}

// Singleton instance
export const clinicalStorage = new ClinicalContextStorage()
