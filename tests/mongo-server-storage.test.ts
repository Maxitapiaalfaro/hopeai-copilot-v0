import { describe, it, expect, beforeAll } from 'vitest'
import { MongoServerStorage } from '@/lib/storage/mongo-server-storage'
import { generateEncryptionKey } from '@/lib/encryption-utils'
import { connectToDatabase } from '@/lib/database/mongodb'
import type { ChatState } from '@/types/clinical-types'

function createTestChatState(sessionId: string, title: string = 'Sesión de prueba'): ChatState {
  const now = new Date()
  return {
    sessionId,
    userId: 'vitest-user-001',
    mode: 'therapeutic_assistance',
    activeAgent: 'clinico',
    history: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hola Aurora, necesito ayuda clínica',
        timestamp: now,
      },
      {
        id: 'msg-2',
        role: 'model',
        content: 'Entiendo, cuéntame más sobre el caso',
        timestamp: now,
      },
    ],
    title,
    metadata: {
      createdAt: now,
      lastUpdated: now,
      totalTokens: 42,
      fileReferences: [],
    },
    clinicalContext: {
      patientId: 'patient-vitest-001',
      sessionType: 'individual_therapy',
      confidentialityLevel: 'high',
      supervisorId: undefined,
    },
    riskState: {
      isRiskSession: false,
      riskLevel: 'low',
      detectedAt: now,
      lastRiskCheck: now,
      consecutiveSafeTurns: 1,
    },
  }
}

describe('MongoServerStorage', () => {
  beforeAll(() => {
    // Proveer clave de cifrado válida para pruebas
    if (!process.env.AURORA_ENCRYPTION_KEY) {
      process.env.AURORA_ENCRYPTION_KEY = generateEncryptionKey()
    }
  })

  it('inserta y carga una sesión de chat en MongoDB', async () => {
    const storage = new MongoServerStorage()
    await storage.initialize()

    const sessionId = `vitest-${Date.now()}`
    const original = createTestChatState(sessionId)

    await storage.saveChatSession(original)

    const loaded = await storage.loadChatSession(sessionId)
    expect(loaded).not.toBeNull()
    expect(loaded!.sessionId).toBe(original.sessionId)
    expect(loaded!.userId).toBe(original.userId)
    expect(loaded!.mode).toBe(original.mode)
    expect(loaded!.activeAgent).toBe(original.activeAgent)
    expect(loaded!.history.length).toBe(original.history.length)
    expect(loaded!.clinicalContext.sessionType).toBe(original.clinicalContext.sessionType)
    expect(loaded!.clinicalContext.confidentialityLevel).toBe('high')
  })

  it('registra fallo por validación cuando totalTokens es inválido', async () => {
    const storage = new MongoServerStorage()
    await storage.initialize()

    const sessionId = `vitest-invalid-${Date.now()}`
    const invalidState = createTestChatState(sessionId)
    // Forzar error de validación: totalTokens debe ser número
    ;(invalidState.metadata as any).totalTokens = 'oops'

    let threw = false
    try {
      await storage.saveChatSession(invalidState)
    } catch (e) {
      threw = true
    }
    expect(threw).toBe(true)

    // Verificar que se registró en failedChatSessions
    const db = await connectToDatabase()
    const failed = await db.collection('failedChatSessions').findOne({ sessionId })
    expect(failed).not.toBeNull()
    expect(failed!.reason).toBe('validation_failed')
  })

  it('getUserSessions devuelve las sesiones de un usuario', async () => {
    const storage = new MongoServerStorage()
    await storage.initialize()

    const userId = `vitest-user-get-${Date.now()}`
    const s1Id = `vitest-get-1-${Date.now()}`
    const s2Id = `vitest-get-2-${Date.now()}`

    const s1 = createTestChatState(s1Id, 'Sesión 1')
    const s2 = createTestChatState(s2Id, 'Sesión 2')
    s1.userId = userId
    s2.userId = userId

    await storage.saveChatSession(s1)
    await storage.saveChatSession(s2)

    const sessions = await storage.getUserSessions(userId)
    expect(Array.isArray(sessions)).toBe(true)
    expect(sessions.length).toBeGreaterThanOrEqual(2)
    const ids = new Set(sessions.map((x) => x.sessionId))
    expect(ids.has(s1Id)).toBe(true)
    expect(ids.has(s2Id)).toBe(true)
    for (const sess of sessions) {
      expect(sess.userId).toBe(userId)
      expect(sess.history.length).toBeGreaterThan(0)
    }
  })
})