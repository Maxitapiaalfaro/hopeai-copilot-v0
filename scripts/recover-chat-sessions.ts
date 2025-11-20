import { connectToDatabase } from '@/lib/database/mongodb'
import { decrypt, encrypt } from '@/lib/encryption-utils'
import crypto from 'crypto'

function stableStringify(obj: any): string {
  const keys: string[] = []
  JSON.stringify(obj, (k, v) => { keys.push(k); return v })
  keys.sort()
  return JSON.stringify(obj, keys)
}

async function recoverOne(db: any, failedDoc: any) {
  const chatColl = db.collection('chatSessions')
  const failedColl = db.collection('failedChatSessions')
  const { sessionId, userId } = failedDoc

  // Attempt strategy: if document exists but checksum mismatch, recompute checksum and re-write
  const stored = await chatColl.findOne({ sessionId, userId })
  if (!stored) {
    // Nothing to recover yet; skip
    await failedColl.updateOne({ _id: failedDoc._id }, { $set: { lastAttemptAt: new Date() }, $inc: { retryCount: 1 } })
    return { status: 'skipped', reason: 'not_found' }
  }

  try {
    const plaintext = decrypt(stored.encryptedData)
    const parsed = JSON.parse(plaintext)
    const checksum = crypto.createHash('sha256').update(stableStringify(parsed)).digest('hex')
    if (checksum !== stored.checksum) {
      // Re-write with corrected checksum
      await chatColl.updateOne(
        { sessionId, userId },
        { $set: { checksum, lastUpdated: new Date() } },
        { writeConcern: { w: 'majority' } }
      )
    }
    await failedColl.deleteOne({ _id: failedDoc._id })
    return { status: 'recovered' }
  } catch (e) {
    // If decryption fails, re-encrypt from parsed if possible or mark permanent
    try {
      // If plaintext was malformed previously, we cannot reconstruct without a source
      await failedColl.updateOne(
        { _id: failedDoc._id },
        { $set: { lastAttemptAt: new Date(), lastError: String((e as any)?.message || e) }, $inc: { retryCount: 1 } }
      )
    } catch {}
    return { status: 'failed', error: String((e as any)?.message || e) }
  }
}

async function main() {
  const db = await connectToDatabase()
  const failedColl = db.collection('failedChatSessions')
  const cursor = failedColl.find({}).sort({ createdAt: 1 })
  let recovered = 0
  let skipped = 0
  let failed = 0
  for await (const doc of cursor) {
    const result = await recoverOne(db, doc)
    if (result.status === 'recovered') recovered++
    else if (result.status === 'skipped') skipped++
    else failed++
  }
  console.log({ recovered, skipped, failed })
}

if (require.main === module) {
  main().catch((e) => {
    console.error('Recovery job failed:', e)
    process.exit(1)
  })
}