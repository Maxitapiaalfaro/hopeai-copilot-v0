export type AgentType = "socratico" | "clinico" | "academico"

export type ClinicalMode = "therapeutic_assistance" | "clinical_supervision" | "research_support"

export interface ChatMessage {
  id: string
  content: string
  role: "user" | "model"
  agent?: AgentType
  timestamp: Date
  attachments?: ClinicalFile[]
  groundingUrls?: Array<{title: string, url: string, domain?: string}>
}

export interface ClinicalFile {
  id: string
  name: string
  type: string
  size: number
  uploadDate: Date
  status: "uploading" | "processing" | "processed" | "error"
  geminiFileId?: string
  sessionId?: string
}

export interface ChatState {
  sessionId: string
  userId: string
  mode: ClinicalMode
  activeAgent: AgentType
  history: ChatMessage[]
  metadata: {
    createdAt: Date
    lastUpdated: Date
    totalTokens: number
    fileReferences: string[]
  }
  clinicalContext: {
    patientId?: string
    supervisorId?: string
    sessionType: string
    confidentialityLevel: "high" | "medium" | "low"
  }
}

export interface AgentConfig {
  name: string
  systemInstruction: string
  tools: any[]
  config: any
  color: string
  description: string
}

// Interfaces para paginación optimizada
export interface PaginationOptions {
  pageSize?: number
  pageToken?: string
  sortBy?: 'lastUpdated' | 'created'
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  items: T[]
  nextPageToken?: string
  totalCount: number
  hasNextPage: boolean
}

// Interface para adaptadores de storage con paginación
export interface StorageAdapter {
  initialize(): Promise<void>
  saveChatSession(chatState: ChatState): Promise<void>
  loadChatSession(sessionId: string): Promise<ChatState | null>
  getUserSessions(userId: string): Promise<ChatState[]>
  getUserSessionsPaginated(userId: string, options?: PaginationOptions): Promise<PaginatedResponse<ChatState>>
  deleteChatSession(sessionId: string): Promise<void>
  saveClinicalFile(file: ClinicalFile): Promise<void>
  getClinicalFiles(sessionId: string): Promise<ClinicalFile[]>
  clearAllData(): Promise<void>
}
