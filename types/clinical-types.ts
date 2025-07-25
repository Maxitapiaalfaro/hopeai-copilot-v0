export type AgentType = "socratico" | "clinico" | "academico"

export type ClinicalMode = "therapeutic_assistance" | "clinical_supervision" | "research_support"

export interface ChatMessage {
  id: string
  content: string
  role: "user" | "model"
  agent?: AgentType
  timestamp: Date
  attachments?: ClinicalFile[]
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
