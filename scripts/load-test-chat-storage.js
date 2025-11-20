const { MongoClient } = require('mongodb')
const crypto = require('crypto')

function stableStringify(obj) {
  const keys = []
  JSON.stringify(obj, (k, v) => { keys.push(k); return v })
  keys.sort()
  return JSON.stringify(obj, keys)
}

function checksum(state) {
  return crypto.createHash('sha256').update(stableStringify(state)).digest('hex')
}

function getEncryptionKey() {
  const key = process.env.AURORA_ENCRYPTION_KEY
  if (!key) {
    const devSeed = 'aurora-dev-encryption-seed-do-not-use-in-production'
    return crypto.scryptSync(devSeed, 'salt', 32)
  }
  const keyBuffer = Buffer.from(key, 'base64')
  if (keyBuffer.length !== 32) throw new Error('Invalid AURORA_ENCRYPTION_KEY length')
  return keyBuffer
}

function encrypt(plaintext) {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 })
  const buffer = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted])
}

async function runLoadTest(db, iterations = 500, concurrency = 20) {
  const coll = db.collection('chatSessions')
  const now = new Date()
  let completed = 0
  let failed = 0
  const latencies = []

  function makeState(i) {
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

  const tasks = []
  for (let i = 0; i < iterations; i++) {
    tasks.push(async () => {
      const start = Date.now()
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
        const end = Date.now()
        latencies.push(end - start)
        completed++
      } catch (e) {
        failed++
      }
    })
  }

  async function runConcurrent(batch) {
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
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017'
  const dbName = process.env.MONGODB_DB_NAME || 'aurora_clinic'
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 })
  await client.connect()
  const db = client.db(dbName)
  const iterations = Number(process.env.LOAD_TEST_ITERATIONS || 500)
  const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY || 20)
  await runLoadTest(db, iterations, concurrency)
  await client.close()
}

if (require.main === module) {
  main().catch((e) => {
    console.error('Load test failed:', e)
    process.exit(1)
  })
}