'use client'

import type { AgentType, ClinicalMode, ChatMessage, ChatState, ReasoningBullet } from '@/types/clinical-types'
import { EnhancedIndexedDBAdapter } from '@/lib/storage/enhanced-indexeddb-adapter'
import { getEffectiveUserId } from '@/lib/user-identity'

type GroundingRef = Array<{ title: string; url: string; domain?: string }>

export class ClientHopeAISystem {
  private initialized = false
  public storageAdapter: EnhancedIndexedDBAdapter

  constructor() {
    // Configure a sane default client-side storage adapter
    this.storageAdapter = new EnhancedIndexedDBAdapter({
      enableEncryption: true,
      maxRetryAttempts: 3,
      syncInterval: 30000,
      offlineTimeout: 60000,
    })
  }

  async initialize(explicitUserId?: string): Promise<void> {
    if (this.initialized) return
    const userId = getEffectiveUserId(explicitUserId)
    await this.storageAdapter.initialize(userId)
    this.initialized = true
  }

  async getChatState(sessionId: string): Promise<ChatState | null> {
    await this.initialize()
    return await this.storageAdapter.loadChatSession(sessionId)
  }

  async createClinicalSession(
    userId: string,
    mode: ClinicalMode,
    agent: AgentType
  ): Promise<{ sessionId: string; chatState: ChatState }> {
    // Ensure adapter is initialized with the explicit userId for accurate change tracking
    await this.initialize(userId)

    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const chatState: ChatState = {
      sessionId,
      userId,
      mode,
      activeAgent: agent,
      history: [],
      metadata: {
        createdAt: new Date(),
        lastUpdated: new Date(),
        totalTokens: 0,
        fileReferences: [],
      },
      clinicalContext: {
        sessionType: mode,
        confidentialityLevel: 'high',
      },
    }

    await this.storageAdapter.saveChatSession(chatState)
    return { sessionId, chatState }
  }

  async addStreamingResponseToHistory(
    sessionId: string,
    responseContent: string,
    agent: AgentType,
    groundingUrls?: GroundingRef,
    reasoningBullets?: ReasoningBullet[]
  ): Promise<void> {
    await this.initialize()

    const current = (await this.storageAdapter.loadChatSession(sessionId)) || {
      sessionId,
      userId: 'demo_user',
      mode: 'clinical_supervision' as ClinicalMode,
      activeAgent: agent,
      history: [],
      metadata: { createdAt: new Date(), lastUpdated: new Date(), totalTokens: 0, fileReferences: [] },
      clinicalContext: { sessionType: 'clinical_supervision' as ClinicalMode, confidentialityLevel: 'high' },
    }

    // Align adapter user context with the session's user
    await this.storageAdapter.initialize(current.userId)

    const aiMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      content: responseContent,
      role: 'model',
      agent,
      timestamp: new Date(),
      groundingUrls: groundingUrls || [],
      reasoningBullets: reasoningBullets && reasoningBullets.length > 0 ? [...reasoningBullets] : undefined,
    }

    current.history.push(aiMessage)
    current.activeAgent = agent
    current.metadata.lastUpdated = new Date()

    await this.storageAdapter.saveChatSession(current)
  }
}

class ClientHopeAISystemSingleton {
  private static instance: ClientHopeAISystem | null = null

  static async getInitializedInstance(): Promise<ClientHopeAISystem> {
    if (!ClientHopeAISystemSingleton.instance) {
      ClientHopeAISystemSingleton.instance = new ClientHopeAISystem()
      await ClientHopeAISystemSingleton.instance.initialize()
    }
    return ClientHopeAISystemSingleton.instance
  }
}

// Named exports to mirror server file API for client usage
export const HopeAISystemSingleton = ClientHopeAISystemSingleton
export type HopeAISystem = ClientHopeAISystem