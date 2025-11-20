const { connectToDatabase } = require('./../lib/database/mongodb')
const { decrypt } = require('./../lib/encryption-utils')
const crypto = require('crypto')

function stableStringify(obj) {
  const keys = []
  JSON.stringify(obj, (k, v) => { keys.push(k); return v })
  keys.sort()
  return JSON.stringify(obj, keys)
}

async function recoverOne(db, failedDoc) {
  const chatColl = db.collection('chatSessions')
  const failedColl = db.collection('failedChatSessions')
  const { sessionId, userId } = failedDoc

  const stored = await chatColl.findOne({ sessionId, userId })
  if (!stored) {
    await failedColl.updateOne({ _id: failedDoc._id }, { $set: { lastAttemptAt: new Date() }, $inc: { retryCount: 1 } })
    return { status: 'skipped', reason: 'not_found' }
  }

  try {
    const plaintext = decrypt(stored.encryptedData)
    const parsed = JSON.parse(plaintext)
    const checksum = crypto.createHash('sha256').update(stableStringify(parsed)).digest('hex')
    if (checksum !== stored.checksum) {
      await chatColl.updateOne(
        { sessionId, userId },
        { $set: { checksum, lastUpdated: new Date() } },
        { writeConcern: { w: 'majority' } }
      )
    }
    await failedColl.deleteOne({ _id: failedDoc._id })
    return { status: 'recovered' }
  } catch (e) {
    await failedColl.updateOne(
      { _id: failedDoc._id },
      { $set: { lastAttemptAt: new Date(), lastError: String(e && e.message || e) }, $inc: { retryCount: 1 } }
    )
    return { status: 'failed', error: String(e && e.message || e) }
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