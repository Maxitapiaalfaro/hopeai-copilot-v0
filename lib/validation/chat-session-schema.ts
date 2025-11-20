import { z } from 'zod'
import type { ChatState } from '@/types/clinical-types'

export const GroundingUrlSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  domain: z.string().optional(),
  doi: z.string().optional(),
  authors: z.string().optional(),
  year: z.number().optional(),
  journal: z.string().optional(),
})

export const ChatMessageSchema = z.object({
  id: z.string(),
  content: z.string(),
  role: z.union([z.literal('user'), z.literal('model')]),
  agent: z.string().optional(),
  timestamp: z.date(),
  fileReferences: z.array(z.string()).optional(),
  groundingUrls: z.array(GroundingUrlSchema).optional(),
  reasoningBullets: z
    .array(
      z.object({
        id: z.string(),
        content: z.string(),
        status: z.union([z.literal('generating'), z.literal('completed'), z.literal('error')]),
        timestamp: z.date(),
        order: z.number().optional(),
        type: z.union([z.literal('reasoning'), z.literal('separator')]).optional(),
      })
    )
    .optional(),
})

export const ChatStateSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  mode: z.string(),
  activeAgent: z.string(),
  history: z.array(ChatMessageSchema),
  title: z.string().optional(),
  metadata: z.object({
    createdAt: z.date(),
    lastUpdated: z.date(),
    totalTokens: z.number(),
    fileReferences: z.array(z.string()),
  }),
  clinicalContext: z.object({
    patientId: z.string().optional(),
    supervisorId: z.string().optional(),
    sessionType: z.string(),
    confidentialityLevel: z.union([z.literal('high'), z.literal('medium'), z.literal('low')]),
  }),
  riskState: z
    .object({
      isRiskSession: z.boolean(),
      riskLevel: z.union([z.literal('low'), z.literal('medium'), z.literal('high'), z.literal('critical')]),
      detectedAt: z.date(),
      riskType: z.union([z.literal('risk'), z.literal('stress'), z.literal('sensitive_content')]).optional(),
      lastRiskCheck: z.date(),
      consecutiveSafeTurns: z.number(),
    })
    .optional(),
})

export function validateChatState(state: ChatState) {
  // Normalizar fechas antes de validar
  const normalizeDate = (d: any) => (d instanceof Date ? d : new Date(d))
  const normalized: ChatState = {
    ...state,
    history: (state.history || []).map((m) => ({
      ...m,
      timestamp: normalizeDate(m.timestamp),
    })),
    metadata: {
      ...state.metadata,
      createdAt: normalizeDate(state.metadata.createdAt),
      lastUpdated: normalizeDate(state.metadata.lastUpdated),
    },
    riskState: state.riskState
      ? {
          ...state.riskState,
          detectedAt: normalizeDate(state.riskState.detectedAt),
          lastRiskCheck: normalizeDate(state.riskState.lastRiskCheck),
        }
      : undefined,
  }

  return ChatStateSchema.safeParse(normalized)
}