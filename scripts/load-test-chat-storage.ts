import { connectToDatabase } from '@/lib/database/mongodb'
import { encrypt } from '@/lib/encryption-utils'
import crypto from 'crypto'
import { Db } from 'mongodb'

type ChatMessage = {
  id: string
  content: string
  role: 'user' | 'model'
  timestamp: Date
}

type ChatState = {
  sessionId: string
  userId: string
  mode: string
  activeAgent: string
  history: ChatMessage[]
  metadata: { createdAt: Date; lastUpdated: Date; totalTokens: number; fileReferences: string[] }
  clinicalContext: { sessionType: string; confidentialityLevel: 'high' | 'medium' | 'low'; patientId?: string }
}

function stableStringify(obj: any): string {
  const keys: string[] = []
  JSON.stringify(obj, (k, v) => { keys.push(k); return v })
  keys.sort()
  return JSON.stringify(obj, keys)
}

function checksum(state: ChatState): string {
  return crypto.createHash('sha256').update(stableStringify(state)).digest('hex')
}

async function runLoadTest(db: Db, iterations = 1000, concurrency = 20) {
  const coll = db.collection('chatSessions')
  const now = new Date()
  let completed = 0
  let failed = 0
  const latencies: number[] = []

  function makeState(i: number): ChatState {
    return {
      sessionId: `lt-${Date.now()}-${i}`,
      userId: 'loadtest-user',
      mode: 'therapeutic_assistance',
      activeAgent: 'clinico',
      history: [
        { id: `m-${i}-1`, content: 'Hola', role: 'user', timestamp: new Date() },
        { id: `m-${i}-2`, content: 'Respuesta', role: 'model', timestamp: new Date() },
      ],
      metadata: { createdAt: now, lastUpdated: now, totalTokens: 42, fileReferences: [] },
      clinicalContext: { sessionType: 'individual', confidentialityLevel: 'high' },
    }
  }

  const tasks: (() => Promise<void>)[] = []
  for (let i = 0; i < iterations; i++) {
    tasks.push(async () => {
      const start = performance.now()
      const state = makeState(i)
      const data = Buffer.from(JSON.stringify(state), 'utf8')
      const encryptedData = encrypt(data)
      const doc = {
        sessionId: state.sessionId,
        userId: state.userId,
        patientId: state.clinicalContext.patientId,
        encryptedData,
        checksum: checksum(state),
        messageCount: state.history.length,
        totalTokens: state.metadata.totalTokens,
        createdAt: state.metadata.createdAt,
        lastUpdated: new Date(),
        mode: state.mode,
        activeAgent: state.activeAgent,
      }
      try {
        await coll.updateOne(
          { sessionId: doc.sessionId, userId: doc.userId },
          { $set: doc },
          { upsert: true, writeConcern: { w: 'majority' } }
        )
        const end = performance.now()
        latencies.push(end - start)
        completed++
      } catch (e) {
        failed++
      }
    })
  }

  async function runConcurrent(batch: (() => Promise<void>)[]) {
    await Promise.all(batch.map((fn) => fn()))
  }

  for (let i = 0; i < tasks.length; i += concurrency) {
    const slice = tasks.slice(i, i + concurrency)
    await runConcurrent(slice)
  }

  latencies.sort((a, b) => a - b)
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0
  const p90 = latencies[Math.floor(latencies.length * 0.9)] || 0
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0

  console.log('Load Test Results:')
  console.log({ completed, failed, p50, p90, p99 })
}

async function main() {
  const db = await connectToDatabase()
  const iterations = Number(process.env.LOAD_TEST_ITERATIONS || 1000)
  const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY || 20)
  await runLoadTest(db, iterations, concurrency)
}

// Only execute if run directly
if (require.main === module) {
  main().catch((e) => {
    console.error('Load test failed:', e)
    process.exit(1)
  })
}