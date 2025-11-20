# Chat Sessions Schema (MongoDB)

This document describes the MongoDB schema used to persist Aurora chat sessions with HIPAA-aware encryption and data integrity verification.

## Collection: `chatSessions`

- `sessionId` (string, unique): Conversation identifier.
- `userId` (string, indexed): Owner user.
- `patientId` (string, optional, indexed): Related patient.
- `encryptedData` (binary): AES-256-GCM encrypted JSON of `ChatState`.
- `checksum` (string): SHA256 of decrypted JSON for integrity verification.
- `messageCount` (number): Derived from `history.length`.
- `totalTokens` (number): Derived from `metadata.totalTokens`.
- `createdAt` (Date): From `metadata.createdAt`.
- `lastUpdated` (Date, indexed): Write timestamp.
- `mode` (string): Clinical mode.
- `activeAgent` (string): Active agent.

### Indexes
- Unique: `{ sessionId: 1 }`.
- Compound: `{ userId: 1, lastUpdated: -1 }`.
- Partial: `{ patientId: 1 }` with `patientId` type string.
- `{ checksum: 1 }` for fast verification lookups.

## Collection: `failedChatSessions`

- `sessionId` (string): Affected session.
- `userId` (string): Owner user.
- `reason` (string): `validation_failed` | `checksum_mismatch` | `decrypt_or_parse_error` | `not_found_after_write`.
- `lastError` (string, optional): Diagnostic detail.
- `createdAt` (Date): When failure was logged.
- `retryCount` (number, optional): Number of recovery attempts.
- `lastAttemptAt` (Date, optional): Last recovery attempt timestamp.

### Indexes
- `{ userId: 1, createdAt: -1 }`.
- `{ sessionId: 1 }`.

## Data Model (ChatState)

`ChatState` includes:
- `sessionId`, `userId`, `mode`, `activeAgent`.
- `history[]` with messages: `{ id, content, role, timestamp, fileReferences?, groundingUrls?, reasoningBullets? }`.
- `metadata`: `{ createdAt, lastUpdated, totalTokens, fileReferences[] }`.
- `clinicalContext`: `{ sessionType, confidentialityLevel, patientId?, supervisorId? }`.
- `riskState?`: `{ isRiskSession, riskLevel, detectedAt, riskType?, lastRiskCheck, consecutiveSafeTurns }`.

All dates are normalized to `Date` on write.

## Write Path

1. Validate `ChatState` (Zod) and normalize dates.
2. Encrypt JSON with AES-256-GCM.
3. Upsert with `writeConcern: { w: 'majority' }`.
4. Verify by reading back, decrypting, and comparing `checksum`.
5. Log failures into `failedChatSessions` for recovery.

## Recovery

Use `scripts/recover-chat-sessions.ts` to:
- Recompute checksum for existing documents.
- Fix mismatches and delete recovered failures.
- Track `retryCount` and `lastAttemptAt`.

## Load Testing

Use `scripts/load-test-chat-storage.ts` with environment variables:
- `LOAD_TEST_ITERATIONS` (default: `1000`).
- `LOAD_TEST_CONCURRENCY` (default: `20`).

Outputs latency percentiles (p50/p90/p99), successes, and failures.