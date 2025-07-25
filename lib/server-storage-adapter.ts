import type { ChatState, ClinicalFile } from "@/types/clinical-types"

/**
 * Adaptador de almacenamiento para el servidor que simula el comportamiento
 * de IndexedDB usando memoria en lugar de persistencia real.
 * Esto permite que el sistema funcione en el entorno del servidor para pruebas.
 */
export class ServerStorageAdapter {
  private chatSessions = new Map<string, ChatState>()
  private clinicalFiles = new Map<string, ClinicalFile>()
  private userPreferences = new Map<string, any>()
  private initialized = false

  async initialize(): Promise<void> {
    // En el servidor, simplemente marcamos como inicializado
    this.initialized = true
    console.log("Server storage adapter initialized (in-memory)")
  }

  async saveChatSession(chatState: ChatState): Promise<void> {
    if (!this.initialized) throw new Error("Storage not initialized")
    
    const updatedState = {
      ...chatState,
      metadata: {
        ...chatState.metadata,
        lastUpdated: new Date(),
      },
    }
    
    this.chatSessions.set(chatState.sessionId, updatedState)
  }

  async loadChatSession(sessionId: string): Promise<ChatState | null> {
    if (!this.initialized) throw new Error("Storage not initialized")
    return this.chatSessions.get(sessionId) || null
  }

  async getUserSessions(userId: string): Promise<ChatState[]> {
    if (!this.initialized) throw new Error("Storage not initialized")
    
    const sessions = Array.from(this.chatSessions.values())
      .filter(session => session.userId === userId)
      .sort((a, b) => 
        new Date(b.metadata.lastUpdated).getTime() - new Date(a.metadata.lastUpdated).getTime()
      )
    
    return sessions
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    if (!this.initialized) throw new Error("Storage not initialized")
    this.chatSessions.delete(sessionId)
  }

  async saveClinicalFile(file: ClinicalFile): Promise<void> {
    if (!this.initialized) throw new Error("Storage not initialized")
    this.clinicalFiles.set(file.id, file)
  }

  async getClinicalFiles(sessionId?: string): Promise<ClinicalFile[]> {
    if (!this.initialized) throw new Error("Storage not initialized")
    
    const files = Array.from(this.clinicalFiles.values())
    
    if (sessionId) {
      return files.filter(file => file.sessionId === sessionId)
    }
    
    return files
  }

  async clearAllData(): Promise<void> {
    if (!this.initialized) throw new Error("Storage not initialized")
    
    this.chatSessions.clear()
    this.clinicalFiles.clear()
    this.userPreferences.clear()
  }
}

// Función para detectar si estamos en el servidor o en el cliente
export function isServerEnvironment(): boolean {
  return typeof window === 'undefined'
}

// Declarar el tipo para globalThis
declare global {
  var __hopeai_storage_adapter__: ServerStorageAdapter | undefined
}

// Función para obtener el adaptador de almacenamiento correcto
export async function getStorageAdapter() {
  if (isServerEnvironment()) {
    // Usar singleton global verdadero para mantener el estado entre llamadas API
    if (!globalThis.__hopeai_storage_adapter__) {
      console.log('🔧 Creando nueva instancia del ServerStorageAdapter (Singleton Global)')
      globalThis.__hopeai_storage_adapter__ = new ServerStorageAdapter()
      await globalThis.__hopeai_storage_adapter__.initialize()
    } else {
      console.log('♻️ Reutilizando instancia existente del ServerStorageAdapter (Singleton Global)')
    }
    return globalThis.__hopeai_storage_adapter__
  } else {
    // En el cliente, usar el almacenamiento original con IndexedDB
    const { clinicalStorage } = require('./clinical-context-storage')
    // Asegurar que el storage del cliente esté inicializado
    await clinicalStorage.initialize()
    return clinicalStorage
  }
}