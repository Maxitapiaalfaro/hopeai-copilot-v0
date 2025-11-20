import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Test e2e del flujo SSE multiagente en una misma conversación
 * - Mockea el prewarm para evitar inicialización real
 * - Mockea getGlobalOrchestrationSystem para devolver un sistema falso
 * - Envía dos mensajes en la misma sesión y valida selección de agentes,
 *   streaming de chunks, respuesta final y evento de completo.
 */

/** Helper para crear una Request de Next con body JSON */
function makeJsonRequest(url: string, body: any) {
  return new NextRequest(
    new Request(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  )
}

/** Parser sencillo de eventos SSE que extrae las líneas `data: ...` como JSON */
function parseSSE(input: string): any[] {
  const blocks = input.split('\n\n').filter(Boolean)
  const events: any[] = []
  for (const block of blocks) {
    const trimmed = block.trim()
    if (trimmed.startsWith('data: ')) {
      const jsonStr = trimmed.replace(/^data:\s*/, '')
      try {
        events.push(JSON.parse(jsonStr))
      } catch {
        // ignorar bloques malformados
      }
    }
  }
  return events
}

describe('Flujo e2e SSE multiagente en misma conversación', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('mantiene selección de agentes y streaming en la misma sesión', async () => {
    // Estado de sesiones simulado para persistencia entre llamadas
    const sessions = new Map<string, { activeAgent: string; history: any[] }>()

    // Sistema falso que simula selección de agente y streaming de chunks
    const fakeSystem = {
      async sendMessage(
        sessionId: string,
        message: string,
        useStreaming: boolean,
        suggestedAgent?: string,
        sessionMeta?: any,
        onBulletUpdate?: (b: any) => void,
        onAgentSelected?: (i: { targetAgent: string; confidence: number; reasoning: string }) => void
      ): Promise<{ response: AsyncGenerator<any, void, unknown> & { routingInfo?: any }; updatedState: any }> {
        const existing = sessions.get(sessionId) || { activeAgent: 'socratico', history: [] }

        // Regla simple: primer turno -> socrático; segundo turno o si el mensaje contiene "investigar" -> académico
        let nextAgent = existing.history.length >= 1 || /investigar/i.test(message) ? 'academico' : 'socratico'
        if (suggestedAgent) nextAgent = suggestedAgent

        // Emitir bullet y selección de agente a través de callbacks
        onBulletUpdate?.({ id: 'b1', content: 'Analizando objetivo clínico', category: 'routing', confidence: 0.95 })
        onAgentSelected?.({ targetAgent: nextAgent, confidence: 0.9, reasoning: 'Simulación de enrutamiento' })

        // Generador streaming con tres chunks simples
        const chunks = [{ text: 'Hola ' }, { text: 'mundo' }, { text: '!' }]
        const generator = Object.assign(
          (async function* () {
            for (const c of chunks) {
              // Simula pequeño retraso entre chunks
              await new Promise((r) => setTimeout(r, 1))
              yield c
            }
          })(),
          {
            routingInfo: { detectedIntent: 'test', targetAgent: nextAgent, confidence: 0.9 },
          }
        )

        // Actualizar estado de sesión simulado
        existing.activeAgent = nextAgent
        existing.history.push({ role: 'user', content: message, timestamp: new Date().toISOString(), id: `msg_${existing.history.length + 1}` })
        sessions.set(sessionId, existing)

        const updatedState = {
          sessionId,
          activeAgent: existing.activeAgent,
          userId: 'user-123',
          history: existing.history,
          metadata: { createdAt: new Date().toISOString(), lastUpdated: new Date().toISOString(), totalTokens: 0, fileReferences: [] },
          mode: 'general',
          clinicalContext: { patientId: sessionMeta?.patient?.reference, sessionType: 'general', confidentialityLevel: 'high' },
        }

        return { response: generator, updatedState }
      },
    }

    // Mockear el prewarm para evitar inicialización real al importar la ruta
    vi.doMock('@/lib/server-prewarm', () => ({
      getPrewarmStatus: vi.fn(() => ({ isPrewarming: false, isPrewarmed: false })),
      waitForPrewarm: vi.fn(async () => false),
    }))

    // Mockear el sistema HopeAI para que devuelva nuestro fakeSystem
    vi.doMock('@/lib/hopeai-system', () => ({
      getGlobalOrchestrationSystem: vi.fn(async () => fakeSystem),
      hopeAI: {},
    }))

    const { POST } = await import('@/app/api/send-message/route')

    const sessionId = 'sess-multi-01'
    const baseBody = { sessionId, useStreaming: true, userId: 'user-1' }

    // Primer turno: debería seleccionar 'socratico'
    const req1 = makeJsonRequest('http://localhost/api/send-message', { ...baseBody, message: 'Hola Aurora' })
    const res1 = await POST(req1)
    expect(res1.headers.get('Content-Type')).toContain('text/event-stream')
    const sseText1 = await (res1 as any).text()
    const events1 = parseSSE(sseText1)

    const agentSel1 = events1.find((e) => e.type === 'agent_selected')
    expect(agentSel1).toBeTruthy()
    expect(agentSel1.info.targetAgent).toBe('socratico')

    const chunks1 = events1.filter((e) => e.type === 'chunk').map((e) => e.chunk.text)
    expect(chunks1.join('')).toBe('Hola mundo!')

    const response1 = events1.find((e) => e.type === 'response')
    expect(response1).toBeTruthy()
    expect(response1.result.updatedState.activeAgent).toBe('socratico')
    expect(response1.result.response.text).toBe('Hola mundo!')
    expect(response1.result.sessionId).toBe(sessionId)

    // Segundo turno: misma sesión, ahora debería seleccionar 'academico'
    const req2 = makeJsonRequest('http://localhost/api/send-message', { ...baseBody, message: 'Necesito investigar evidencia.' })
    const res2 = await POST(req2)
    const sseText2 = await (res2 as any).text()
    const events2 = parseSSE(sseText2)

    const agentSel2 = events2.find((e) => e.type === 'agent_selected')
    expect(agentSel2).toBeTruthy()
    expect(agentSel2.info.targetAgent).toBe('academico')

    const response2 = events2.find((e) => e.type === 'response')
    expect(response2).toBeTruthy()
    expect(response2.result.updatedState.activeAgent).toBe('academico')
    expect(response2.result.updatedState.sessionId).toBe(sessionId)

    const hasComplete2 = events2.some((e) => e.type === 'complete')
    expect(hasComplete2).toBe(true)
  })
})