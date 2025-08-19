export type AgentType = "socratico" | "clinico" | "academico" | "orquestador"

export type ClinicalMode = "therapeutic_assistance" | "clinical_supervision" | "research_support"

export interface ChatMessage {
  id: string
  content: string
  role: "user" | "model"
  agent?: AgentType
  timestamp: Date
  // ARQUITECTURA OPTIMIZADA: Archivos se referencian por ID, no objetos completos
  // Esto previene la acumulación exponencial que causa RESOURCE_EXHAUSTED
  fileReferences?: string[]  // IDs de archivos, no objetos completos
  groundingUrls?: Array<{title: string, url: string, domain?: string}>
  // ELIMINADO: attachments duplicados - usar solo fileReferences por ID
}

export interface ClinicalFile {
  id: string
  name: string
  type: string
  size: number
  uploadDate: Date
  status: "uploading" | "processing" | "processed" | "error"
  geminiFileId?: string
  geminiFileUri?: string  // URI real para createPartFromUri
  sessionId?: string
  processingStatus?: "processing" | "active" | "error" | "timeout"
  // Índice ligero para optimizar referencias contextuales
  summary?: string
  outline?: string
  keywords?: string[]
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

export interface FichaClinicaState {
  fichaId: string
  pacienteId: string
  estado: 'generando' | 'completado' | 'error' | 'actualizando'
  contenido: string
  version: number
  ultimaActualizacion: Date
  historialVersiones: { version: number, fecha: Date }[]
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
  // Fichas clínicas
  saveFichaClinica(ficha: FichaClinicaState): Promise<void>
  getFichaClinicaById(fichaId: string): Promise<FichaClinicaState | null>
  getFichasClinicasByPaciente(pacienteId: string): Promise<FichaClinicaState[]>
  clearAllData(): Promise<void>
}

// Patient Library Types - Phase 1 Implementation
export interface PatientDemographics {
  ageRange?: string
  gender?: string
  occupation?: string
  location?: string
}

export interface PatientAttachment {
  id: string
  name: string
  type: string
  uri?: string
  hash?: string
  uploadDate: Date
  size?: number
}

export interface PatientSummaryCache {
  text: string
  version: number
  updatedAt: string // ISO string
  tokenCount?: number
}

export interface PatientConfidentiality {
  pii: boolean
  redactionRules?: string[]
  accessLevel: "high" | "medium" | "low"
}

export interface PatientRecord {
  id: string
  displayName: string
  demographics?: PatientDemographics
  tags?: string[] // conditions, therapy focus areas
  notes?: string // clinician notes
  attachments?: PatientAttachment[]
  summaryCache?: PatientSummaryCache
  confidentiality?: PatientConfidentiality
  createdAt: Date
  updatedAt: Date
}

// Patient session metadata for orchestrator injection
export interface PatientSessionMeta {
  sessionId: string
  userId: string
  patient: {
    reference: string
    summaryHash: string
    version: number
    confidentialityLevel: "high" | "medium" | "low"
  }
  clinicalMode: string
  activeAgent: string
  createdAt: string
}

// Enhanced ChatState to support patient context
export interface PatientChatState extends ChatState {
  patientContext?: {
    patientId: string
    patientSummary: string
    sessionMeta: PatientSessionMeta
  }
}

// Patient storage adapter interface
export interface PatientStorageAdapter {
  initialize(): Promise<void>
  savePatientRecord(patient: PatientRecord): Promise<void>
  loadPatientRecord(patientId: string): Promise<PatientRecord | null>
  getAllPatients(): Promise<PatientRecord[]>
  searchPatients(query: string): Promise<PatientRecord[]>
  deletePatientRecord(patientId: string): Promise<void>
  updatePatientSummaryCache(patientId: string, summary: PatientSummaryCache): Promise<void>
  clearAllPatients(): Promise<void>
}
