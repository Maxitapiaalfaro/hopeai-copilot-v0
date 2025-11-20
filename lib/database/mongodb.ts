import { MongoClient, Db } from 'mongodb';
import { loggers } from '@/lib/logger';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'aurora_clinic';
const disableLocalFallback = String(process.env.MONGODB_DISABLE_LOCAL_FALLBACK).toLowerCase() === 'true';

let client: MongoClient;
let db: Db;
let connecting = false;

export async function connectToDatabase(): Promise<Db> {
  if (db) {
    return db;
  }
  if (connecting) {
    while (connecting && !db) {
      await new Promise(r => setTimeout(r, 50));
    }
    if (db) return db;
  }

  const logger = loggers.storage.child({ component: 'mongodb', dbName });
  const maxAttempts = Number(process.env.MONGODB_MAX_RETRIES || 4);
  const baseDelayMs = Number(process.env.MONGODB_RETRY_DELAY_MS || 500);
  let attempt = 0;
  connecting = true;

  try {
    if (!uri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    while (attempt < maxAttempts) {
      attempt++;
      try {
        const useUri = uri;
        const serverSelectionTimeoutMS = Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 15000);
        const connectTimeoutMS = Number(process.env.MONGODB_CONNECT_TIMEOUT_MS || 15000);
        const socketTimeoutMS = Number(process.env.MONGODB_SOCKET_TIMEOUT_MS || 45000);
        const maxPoolSize = Number(process.env.MONGODB_MAX_POOL_SIZE || 10);
        const minPoolSize = Number(process.env.MONGODB_MIN_POOL_SIZE || 2);
        const maxIdleTimeMS = Number(process.env.MONGODB_MAX_IDLE_TIME_MS || 0);
        const retryWrites = String(process.env.MONGODB_RETRY_WRITES || 'true').toLowerCase() === 'true';
        const tls = String(process.env.MONGODB_TLS || '').toLowerCase() === 'true' ? true : undefined;
        const compressors = process.env.MONGODB_COMPRESSORS || undefined;
        const appName = process.env.MONGODB_APPNAME || 'aurora-clinic';
        client = new MongoClient(useUri, {
          serverSelectionTimeoutMS,
          connectTimeoutMS,
          socketTimeoutMS,
          maxPoolSize,
          minPoolSize,
          maxIdleTimeMS,
          retryWrites,
          tls,
          compressors,
          appName,
        });
        logger.info('Connecting to MongoDB', { attempt, uri: sanitizeUri(useUri), env: process.env.NODE_ENV });
        await client.connect();
        const candidateDb = client.db(dbName);
        await candidateDb.command({ ping: 1 });
        db = candidateDb;
        logger.info('MongoDB connected', { attempt });
        await createIndexes();
        return db;
      } catch (error) {
        const code = (error as any)?.code ?? (error as any)?.name;
        const msg = String((error as any)?.message || '');
        logger.warn('MongoDB connection attempt failed', { attempt, code, message: truncate(msg, 300) });

        const isAuthError = code === 18 || /auth/i.test(msg);
        const isSrvDnsError = msg.includes('querySrv ENOTFOUND') || msg.includes('ENOTFOUND');
        const isNetworkError = /ECONNREFUSED|ETIMEDOUT|ETIMEOUT|EHOSTUNREACH|ENETUNREACH/i.test(msg);

        if ((isSrvDnsError || isNetworkError) && process.env.NODE_ENV !== 'production' && !disableLocalFallback) {
          try {
            const fallbackUri = 'mongodb://127.0.0.1:27017';
            const fallbackClient = new MongoClient(fallbackUri, { serverSelectionTimeoutMS: 3000 });
            logger.warn('Falling back to local MongoDB', { fallbackUri });
            await fallbackClient.connect();
            const candidateDb = fallbackClient.db(dbName);
            await candidateDb.command({ ping: 1 });
            client = fallbackClient;
            db = candidateDb;
            logger.info('Local MongoDB fallback connected');
            await createIndexes();
            return db;
          } catch (fallbackError) {
            const fmsg = String((fallbackError as any)?.message || '');
            logger.error('Local MongoDB fallback failed', fallbackError, { message: truncate(fmsg, 300) });
          }
        }

        if (isAuthError) {
          throw error;
        }

        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise(r => setTimeout(r, Math.min(delay, 4000)));
        if (attempt >= maxAttempts && (isNetworkError || isSrvDnsError)) {
          throw error;
        }
      }
    }
    throw new Error('MongoDB connection retries exhausted');
  } finally {
    connecting = false;
  }
}

// Helper to compare key specs like { email: 1 } with existing index.key
function keysMatch(a: Record<string, number>, b: Record<string, number>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (b[k] !== a[k]) return false;
  }
  return true;
}

// Ensure an index exists; if an index with the same key spec already exists,
// skip creation to avoid IndexOptionsConflict noise.
async function ensureIndex(
  collectionName: string,
  keys: Record<string, number>,
  options?: Record<string, any>
) {
  const coll = db.collection(collectionName);
  let existing: any[] = [];
  try {
    existing = await coll.listIndexes().toArray();
  } catch (e) {
    // If listing indexes fails (permissions, etc.), attempt to create and rely on driver handling
    existing = [];
  }

  const match = existing.find(ix => keysMatch(keys, ix.key as Record<string, number>));
  if (match) {
    // If options differ (e.g., unique or expireAfterSeconds), log once and skip auto-changes
    const desiredUnique = options?.unique;
    const desiredTTL = options?.expireAfterSeconds;
    const currentUnique = (match as any).unique;
    const currentTTL = (match as any).expireAfterSeconds;
    if (
      (desiredUnique !== undefined && desiredUnique !== currentUnique) ||
      (desiredTTL !== undefined && desiredTTL !== currentTTL)
    ) {
      console.warn(
        `Index '${collectionName}' keys ${JSON.stringify(keys)} exist with different options (current: {unique: ${currentUnique}, ttl: ${currentTTL}}; desired: {unique: ${desiredUnique}, ttl: ${desiredTTL}}). Leaving as-is.`
      );
    }
    return; // Already present, avoid conflict
  }

  try {
    await coll.createIndex(keys, options as any);
  } catch (error) {
    console.error(`Error creating index on '${collectionName}' with keys ${JSON.stringify(keys)}:`, error);
  }
}

export async function createIndexes() {
  if (!db) return;

  try {
    // Users collection indexes
    await ensureIndex('users', { email: 1 }, { unique: true, name: 'email_unique' });
    await ensureIndex('users', { 'devices.deviceId': 1 }, { name: 'device_id_index' });

    // Sessions collection indexes
    await ensureIndex('sessions', { userId: 1, deviceId: 1 }, { name: 'user_device_index' });
    await ensureIndex('sessions', { expiresAt: 1 }, { expireAfterSeconds: 0, name: 'session_expiry_ttl' });

    // Patients collection indexes
    await ensureIndex('patients', { userId: 1 }, { name: 'patients_user_index' });
    // Unique composite index excluding docs where patientId is null/missing using $type
    await ensureIndex('patients', { userId: 1, patientId: 1 }, {
      unique: true,
      name: 'user_patient_unique',
      partialFilterExpression: { patientId: { $type: 'string' } }
    });

    // Files collection indexes
    await ensureIndex('files', { userId: 1 }, { name: 'files_user_index' });
    // Unique composite index excluding docs where fileId is null/missing using $type
    await ensureIndex('files', { userId: 1, fileId: 1 }, {
      unique: true,
      name: 'user_file_unique',
      partialFilterExpression: { fileId: { $type: 'string' } }
    });

    // Change logs collection indexes
    await ensureIndex('changeLogs', { userId: 1, timestamp: -1 }, { name: 'changeLogs_user_ts' });
    await ensureIndex('changeLogs', { userId: 1, entityType: 1, entityId: 1 }, { name: 'changeLogs_user_entity' });

    // Sync conflicts collection indexes
    // Use isResolved to align with model and health checks
    await ensureIndex('syncConflicts', { userId: 1, isResolved: 1 }, { name: 'syncConflicts_user_resolved' });
    await ensureIndex('syncConflicts', { userId: 1, timestamp: -1 }, { name: 'syncConflicts_user_ts' });

    // Chat sessions collection indexes
    await ensureIndex('chatSessions', { sessionId: 1 }, { unique: true, name: 'chat_sessionId_unique' });
    await ensureIndex('chatSessions', { userId: 1, lastUpdated: -1 }, { name: 'chat_user_lastUpdated' });
    await ensureIndex('chatSessions', { patientId: 1 }, { name: 'chat_patient_index', partialFilterExpression: { patientId: { $type: 'string' } } });
    await ensureIndex('chatSessions', { checksum: 1 }, { name: 'chat_checksum_index' });

    // Failed chat sessions (recovery queue)
    await ensureIndex('failedChatSessions', { userId: 1, createdAt: -1 }, { name: 'failed_chat_user_createdAt' });
    await ensureIndex('failedChatSessions', { sessionId: 1 }, { name: 'failed_chat_sessionId' });

    console.log('Database indexes ensured successfully');
  } catch (error) {
    console.error('Error creating indexes:', error);
  }
}

export async function closeDatabaseConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = null as any;
    db = null as any;
    loggers.storage.info('MongoDB disconnected');
  }
}

export { db };

function sanitizeUri(u: string): string {
  try {
    const parsed = new URL(u);
    if (parsed.username || parsed.password) {
      parsed.username = '';
      parsed.password = '';
    }
    return parsed.toString();
  } catch {
    return u.replace(/:\/\/[\w%]+:[^@]+@/, '://[redacted]@');
  }
}

function truncate(s: string, max = 200): string {
  if (!s) return s;
  return s.length > max ? s.slice(0, max) + '…' : s;
}
