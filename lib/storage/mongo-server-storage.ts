import { Db } from 'mongodb'
import { connectToDatabase } from '@/lib/database/mongodb'
import { encrypt, decrypt, verifyEncryptionSetup } from '@/lib/encryption-utils'
import { validateChatState } from '@/lib/validation/chat-session-schema'
import type { ChatState, ClinicalFile, FichaClinicaState, PaginationOptions, PaginatedResponse } from '@/types/clinical-types'
import crypto from 'crypto'
import { loggers } from '@/lib/logger'

type MongoDoc = {
  _id?: any
  sessionId: string
  userId: string
  patientId?: string
  encryptedData: Buffer
  checksum: string
  messageCount: number
  totalTokens: number
  createdAt: Date
  lastUpdated: Date
  mode: string
  activeAgent: string
}

function normalizeDates(chat: ChatState): ChatState {
  const normalizeDate = (d: any) => (d instanceof Date ? d : new Date(d))
  return {
    ...chat,
    history: (chat.history || []).map((m) => ({
      ...m,
      timestamp: normalizeDate(m.timestamp),
    })),
    metadata: {
      ...chat.metadata,
      createdAt: normalizeDate(chat.metadata.createdAt),
      lastUpdated: normalizeDate(chat.metadata.lastUpdated),
    },
    riskState: chat.riskState
      ? {
          ...chat.riskState,
          detectedAt: normalizeDate(chat.riskState.detectedAt),
          lastRiskCheck: normalizeDate(chat.riskState.lastRiskCheck),
        }
      : undefined,
  }
}

function stableStringify(obj: any): string {
  const allKeys: string[] = []
  JSON.stringify(obj, (key, value) => {
    allKeys.push(key)
    return value
  })
  allKeys.sort()
  return JSON.stringify(obj, allKeys)
}

function calculateChecksum(chat: ChatState): string {
  const json = stableStringify(chat)
  return crypto.createHash('sha256').update(json).digest('hex')
}

function toBuffer(data: any): Buffer {
  if (!data) throw new Error('Encrypted data missing')
  if (Buffer.isBuffer(data)) return data
  if (data instanceof Uint8Array) return Buffer.from(data)
  if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data))
  if (data && data.buffer != null) {
    const b = data.buffer
    if (Buffer.isBuffer(b)) return b as Buffer
    if (b instanceof Uint8Array) return Buffer.from(b)
    if (b instanceof ArrayBuffer) return Buffer.from(new Uint8Array(b))
  }
  if (data && typeof (data as any).value === 'function') {
    try {
      const v = (data as any).value(true)
      if (Buffer.isBuffer(v)) return v
      if (v instanceof Uint8Array) return Buffer.from(v)
    } catch {}
  }
  if (data && Array.isArray((data as any).data) && (data as any).type === 'Buffer') {
    return Buffer.from((data as any).data)
  }
  if (typeof data === 'string') {
    const s = data.trim()
    // Intentar JSON del formato antiguo { data, iv, tag }
    if (s.startsWith('{') && s.endsWith('}')) {
      try {
        const parsed = JSON.parse(s)
        return toBuffer(parsed)
      } catch {
        // continuar con base64/utf8
      }
    }
    try {
      return Buffer.from(s, 'base64')
    } catch {
      return Buffer.from(s, 'utf8')
    }
  }
  // Objeto con campos del antiguo EncryptionService
  if (data && typeof data === 'object') {
    const maybe = data as any
    if (maybe.data && maybe.iv && maybe.tag) {
      const decode = (x: string): Buffer => {
        if (typeof x !== 'string') return Buffer.from([])
        const hex = /^[0-9a-fA-F]+$/.test(x)
        if (hex && x.length % 2 === 0) return Buffer.from(x, 'hex')
        try { return Buffer.from(x, 'base64') } catch { return Buffer.from(x, 'utf8') }
      }
      const iv = decode(maybe.iv)
      const tag = decode(maybe.tag)
      const ct = decode(maybe.data)
      return Buffer.concat([iv, tag, ct])
    }
  }
  throw new Error('Encrypted data is not a Buffer/Binary/Uint8Array')
}

export class MongoServerStorage {
  private db: Db | null = null
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return
    const ok = verifyEncryptionSetup()
    if (!ok) {
      // En dev se permite una clave derivada temporal, verifyEncryptionSetup ya muestra advertencias
    }
    this.db = await connectToDatabase()
    loggers.storage.info('Mongo storage initialized')
    this.initialized = true
  }

  private get coll() {
    if (!this.db) throw new Error('Mongo storage not initialized')
    return this.db.collection('chatSessions')
  }

  private get failedColl() {
    if (!this.db) throw new Error('Mongo storage not initialized')
    return this.db.collection('failedChatSessions')
  }

  async saveChatSession(chatState: ChatState): Promise<void> {
    if (!this.initialized) throw new Error('Storage not initialized')
    loggers.storage.debug('saveChatSession called', { sessionId: chatState.sessionId, userId: chatState.userId })
    const normalized = normalizeDates(chatState)
    const valid = validateChatState(normalized)
    if (!valid.success) {
      const issues = valid.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
      await this.failedColl.insertOne({
        sessionId: normalized.sessionId,
        userId: normalized.userId,
        reason: 'validation_failed',
        createdAt: new Date(),
        lastError: issues,
      })
      loggers.storage.warn('Validation failed for chat session', { sessionId: normalized.sessionId, userId: normalized.userId })
      throw new Error(`Validation failed: ${issues}`)
    }

    // Cálculos de metadatos
    const messageCount = normalized.history?.length || 0
    const totalTokens = normalized.metadata?.totalTokens || 0
    const checksum = calculateChecksum(normalized)

    const encryptedData = encrypt(JSON.stringify(normalized))

    const doc: MongoDoc = {
      sessionId: normalized.sessionId,
      userId: normalized.userId,
      patientId: normalized.clinicalContext?.patientId,
      encryptedData,
      checksum,
      messageCount,
      totalTokens,
      createdAt: normalized.metadata.createdAt,
      lastUpdated: new Date(),
      mode: normalized.mode,
      activeAgent: normalized.activeAgent,
    }

    const res = await this.coll.updateOne(
      { sessionId: doc.sessionId, userId: doc.userId },
      { $set: doc },
      { upsert: true, writeConcern: { w: 'majority' } }
    )
    loggers.storage.debug('Upsert result', { matchedCount: res.matchedCount, modifiedCount: res.modifiedCount, upsertedId: (res as any).upsertedId })

    // Verificación post-escritura
    const stored = await this.coll.findOne({ sessionId: doc.sessionId, userId: doc.userId })
    if (!stored) {
      await this.failedColl.insertOne({
        sessionId: doc.sessionId,
        userId: doc.userId,
        reason: 'not_found_after_write',
        createdAt: new Date(),
        lastError: 'Document not found after upsert',
      })
      loggers.storage.error('Verification failed: not found after write', undefined, { sessionId: doc.sessionId, userId: doc.userId })
      throw new Error('Verification failed: document not found after write')
    }

    try {
      const plaintext = decrypt(toBuffer(stored.encryptedData))
      const parsed: ChatState = JSON.parse(plaintext)
      const verifyChecksum = calculateChecksum(parsed)
      if (verifyChecksum !== stored.checksum) {
        await this.failedColl.insertOne({
          sessionId: doc.sessionId,
          userId: doc.userId,
          reason: 'checksum_mismatch',
          createdAt: new Date(),
          lastError: `expected ${doc.checksum}, got ${verifyChecksum}`,
        })
        loggers.storage.error('Verification failed: checksum mismatch', undefined, { sessionId: doc.sessionId, userId: doc.userId })
        throw new Error('Verification failed: checksum mismatch')
      }
      loggers.storage.info('Chat session saved and verified', { sessionId: doc.sessionId, userId: doc.userId })
    } catch (e) {
      await this.failedColl.insertOne({
        sessionId: doc.sessionId,
        userId: doc.userId,
        reason: 'decrypt_or_parse_error',
        createdAt: new Date(),
        lastError: String((e as any)?.message || e),
      })
      loggers.storage.error('Verification failed: decrypt/parse error', e, { sessionId: doc.sessionId, userId: doc.userId })
      throw e
    }
  }

  async loadChatSession(sessionId: string): Promise<ChatState | null> {
    if (!this.initialized) throw new Error('Storage not initialized')
    loggers.storage.debug('loadChatSession called', { sessionId })
    const stored = await this.coll.findOne({ sessionId })
    if (!stored) return null
    const plaintext = decrypt(toBuffer(stored.encryptedData))
    const parsed: ChatState = normalizeDates(JSON.parse(plaintext))
    loggers.storage.info('Chat session loaded', { sessionId })
    return parsed
  }

  async getUserSessions(userId: string): Promise<ChatState[]> {
    if (!this.initialized) throw new Error('Storage not initialized')
    loggers.storage.debug('getUserSessions called', { userId })
    const cursor = this.coll.find({ userId }).sort({ lastUpdated: -1 })
    const sessions: ChatState[] = []
    for await (const doc of cursor) {
      try {
        const plaintext = decrypt(toBuffer(doc.encryptedData))
        sessions.push(normalizeDates(JSON.parse(plaintext)))
      } catch (e) {
        try {
          await this.failedColl.insertOne({
            sessionId: (doc as any)?.sessionId,
            userId: (doc as any)?.userId || userId,
            reason: 'decrypt_or_parse_error_list',
            createdAt: new Date(),
            lastError: String((e as any)?.message || e),
          })
        } catch {}
        loggers.storage.error('Decrypt/parse error while listing sessions', e, { sessionId: (doc as any)?.sessionId, userId })
      }
    }
    loggers.storage.info('User sessions fetched', { userId, count: sessions.length })
    return sessions
  }

  async getUserSessionsPaginated(
    userId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResponse<ChatState>> {
    const { pageSize = 20, pageToken, sortBy = 'lastUpdated', sortOrder = 'desc' } = options
    const sortField = sortBy === 'created' ? 'createdAt' : 'lastUpdated'
    const sortValue = sortOrder === 'asc' ? 1 : -1

    const query: Record<string, any> = { userId }
    if (pageToken) {
      // pageToken es ISO date del último elemento leído
      const tokenDate = new Date(pageToken)
      if (sortOrder === 'desc') {
        query[sortField] = { $lt: tokenDate }
      } else {
        query[sortField] = { $gt: tokenDate }
      }
    }

    const totalCount = await this.coll.countDocuments({ userId })
    const docs = await this.coll
      .find(query)
      .sort({ [sortField]: sortValue })
      .limit(pageSize)
      .toArray()

    const items: ChatState[] = []
    for (const d of docs) {
      try {
        const buf = toBuffer(d.encryptedData)
        const text = decrypt(buf)
        items.push(normalizeDates(JSON.parse(text)))
      } catch (e) {
        try {
          await this.failedColl.insertOne({
            sessionId: (d as any)?.sessionId,
            userId: (d as any)?.userId || userId,
            reason: 'decrypt_or_parse_error_list',
            createdAt: new Date(),
            lastError: String((e as any)?.message || e),
          })
        } catch {}
        loggers.storage.error('Decrypt/parse error during pagination', e, { sessionId: (d as any)?.sessionId, userId })
      }
    }
    const last = docs[docs.length - 1]
    const nextPageToken = last ? (last[sortField] as Date).toISOString() : undefined

    loggers.storage.info('Paginated sessions fetched', { userId, pageSize, returned: items.length, totalCount, hasNextPage: !!nextPageToken })
    return {
      items,
      nextPageToken,
      totalCount,
      hasNextPage: !!nextPageToken,
    }
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    if (!this.initialized) throw new Error('Storage not initialized')
    loggers.storage.debug('deleteChatSession called', { sessionId })
    await this.coll.deleteOne({ sessionId })
    loggers.storage.info('Chat session deleted', { sessionId })
  }

  // --- Clinical Files: store metadata in existing 'files' collection ---
  async saveClinicalFile(file: ClinicalFile): Promise<void> {
    if (!this.db) throw new Error('Storage not initialized')
    const checksum = crypto.createHash('sha256').update(`${file.id}:${file.name}:${file.size}`).digest('hex')
    await this.db.collection('files').updateOne(
      { fileId: file.id },
      {
        $set: {
          fileId: file.id,
          userId: (file as any).userId || 'unknown',
          sessionId: file.sessionId,
          fileName: file.name,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          checksum,
          isActive: true,
          createdAt: file.uploadDate || new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true, writeConcern: { w: 'majority' } }
    )
  }

  async getClinicalFiles(sessionId?: string): Promise<ClinicalFile[]> {
    if (!this.db) throw new Error('Storage not initialized')
    const query = sessionId ? { sessionId } : {}
    const docs = await this.db.collection('files').find(query).sort({ createdAt: -1 }).toArray()
    return docs.map((d) => ({
      id: d.fileId,
      name: d.fileName,
      type: d.mimeType,
      size: d.size,
      uploadDate: d.createdAt,
      status: 'processed',
      sessionId: d.sessionId,
    }))
  }

  async getClinicalFileById(fileId: string): Promise<ClinicalFile | null> {
    if (!this.db) throw new Error('Storage not initialized')
    const d = await this.db.collection('files').findOne({ fileId })
    if (!d) return null
    return {
      id: d.fileId,
      name: d.fileName,
      type: d.mimeType,
      size: d.size,
      uploadDate: d.createdAt,
      status: d.isActive ? 'processed' : 'error',
      sessionId: d.sessionId,
    }
  }

  async deleteClinicalFile(fileId: string): Promise<void> {
    if (!this.db) throw new Error('Storage not initialized')
    await this.db.collection('files').deleteOne({ fileId })
  }

  // ---- Fichas Clínicas (minimal Mongo storage) ----
  async saveFichaClinica(ficha: FichaClinicaState): Promise<void> {
    if (!this.db) throw new Error('Storage not initialized')
    await this.db.collection('fichasClinicas').updateOne(
      { fichaId: ficha.fichaId },
      {
        $set: {
          fichaId: ficha.fichaId,
          pacienteId: ficha.pacienteId,
          estado: ficha.estado,
          contenido: ficha.contenido,
          version: ficha.version,
          ultimaActualizacion: ficha.ultimaActualizacion,
          createdAt: new Date(),
        },
      },
      { upsert: true, writeConcern: { w: 'majority' } }
    )
  }

  async getFichaClinicaById(fichaId: string): Promise<FichaClinicaState | null> {
    if (!this.db) throw new Error('Storage not initialized')
    const d = await this.db.collection('fichasClinicas').findOne({ fichaId })
    return (d as any) || null
  }

  async getFichasClinicasByPaciente(pacienteId: string): Promise<FichaClinicaState[]> {
    if (!this.db) throw new Error('Storage not initialized')
    const docs = await this.db.collection('fichasClinicas').find({ pacienteId }).toArray()
    return docs as any
  }

  async clearAllData(): Promise<void> {
    if (!this.db) throw new Error('Storage not initialized')
    await this.db.collection('chatSessions').deleteMany({})
  }
}
