Technical Specification: Identity, Security, Storage, and Orchestration Architecture for Aurora

Executive Summary
Aurora aims to be the indispensable clinical intelligence system for psychologists in Latin America. This specification outlines a secure, device-scoped, HIPAA-aligned architecture for authentication, authorization, orchestration, storage, and synchronization. It prioritizes confidentiality, clinician workflow, and reliability while integrating the multi-agent orchestration model with dynamic UI changes and academic search via ParallelAI. The deliverable includes architecture diagrams, sequence flows, implementation milestones, and risk mitigation strategies for each major component.

Goals
- Enforce server-side identity and device scoping across API routes.
- Unify token strategies (NextAuth + custom JWTManager) with device-aware claims.
- Prevent trusting client-provided identifiers (X-User-Id, X-Device-Id) without verification.
- Ensure at-rest encryption for clinical data with robust key management.
- Apply tiered rate limiting and security controls across endpoints.
- Strengthen audit logging and monitoring with per-device traceability.
- Maintain usability aligned with psychologists’ workflow, preserving empathy and autonomy.

Non-goals
- Replacing NextAuth entirely (we will extend it).
- Implementing full-blown distributed storage (SQLite is kept for HIPAA local persistence; cloud integrations are proposed but scoped for a later phase).
- User interface redesign (only minimal changes needed for identity token propagation).

Architecture Overview
Component Model (simplified)

[Frontend (Next.js)]
  - NextAuth session (JWT strategy)
  - SSE client for streaming
  - File upload form (Gemini Files API client usage) 
  - Client Identity Utils (local userId/deviceId only for fallback; not authoritative)

[Server/API Routes]
  - Authentication: NextAuth (server-side getToken) + JWTManager for device-aware API tokens
  - Security Middleware: global headers, admin auth for protected endpoints, suspicious activity detection
  - Rate Limiter: tiered per endpoint type
  - Orchestration: HopeAISystemSingleton + Dynamic Orchestrator + Academic Agent (ParallelAI)
  - HIPAA Storage: Encrypted SQLite + hot cache + audit logs
  - Sync: push/pull endpoints; conflict resolution
  - Upload: Document ingestion and linkage to sessions and HIPAA storage

[External]
  - Google GenAI (Files API via API key; Vertex AI for models)
  - Sentry (monitoring/logging)
  - Optional Redis/Upstash (distributed rate limiting)

High-Level ASCII Diagram

                     +---------------------------+
                     |        Frontend UI        |
                     |  - NextAuth Client        |
                     |  - SSE Streaming          |
                     |  - File Upload (Gemini)   |
                     +-----------+---------------+
                                 |
                                 | HTTPS (Authorization: Bearer, cookies)
                                 v
+---------------------+  Middleware  +---------------------------+  +------------------------------+
|   Security Layer    |------------->|          API Routes       |->|      Orchestration System   |
|  - Security Headers |              | - /send-message (SSE)     |  | - Dynamic Orchestrator      |
|  - Rate Limiting    |              | - /sessions               |  | - Academic Agent (Parallel) |
|  - Admin Auth       |              | - /upload-document        |  | - Agent selection           |
|  - Suspicious Check |              | - /sync/*                 |  +------------------------------+
+----------+----------+              | - /patients/*, /documents |
           |                         +---------------------------+
           |                                             |
           |                                             v
           |                                 +---------------------------+
           |                                 |   HIPAA Storage (SQLite) |
           |                                 | - AES-256-GCM encryption  |
           |                                 | - Hot Cache + Audit Logs |
           |                                 +---------------------------+
           |
           v
+--------------------+
| Identity & Auth    |
| - NextAuth (JWT)   |
| - JWTManager       |
| - Device Registry  |
+--------------------+
           |
           v
+------------------------------+
| External Services            |
| - Google GenAI (Files API)   |
| - Vertex AI (LLM inference) |
| - Sentry                    |
+------------------------------+

Identity and Authentication
Current Findings
- NextAuth adds id and role to JWT/session but does not include deviceId.
- JWTManager tokens include userId and deviceId; auth-service generates deviceId during login/signup and registers devices.
- Several API routes accept userId via body/query or rely on headers X-User-Id/X-Device-Id set by APIClientAdapter, which is insecure without verification.

Status Update (Phase 1A Implementation)
- Implemented ClinicalValidationService and integrated into `/api/sync/push` to validate patient/session/file changes (duration, types, sizes, notes length, identifiers, and clinical info sanity).
- Implemented HIPAAComplianceService to sanitize incoming change payloads, trimming strings and removing server-controlled fields (`_id`, `id`, `userId`, `deviceId`, `createdAt`, `updatedAt`) before storage.
- Implemented DeviceTrustService to register devices on first sight and provide a basic trust evaluation. `/api/sync/push` now ensures device registration and includes a `deviceTrust` snapshot in responses for audit/observability.
- Extended NextAuth credentials provider to accept `deviceId` and register the device during login, and updated JWT/session callbacks to include `deviceId` when available.
- No breaking changes introduced: validation and sanitation are soft-enforced with clear failure logging in `changeLogs` and conflict detection preserved.

Proposed Strategy
- Include deviceId in NextAuth JWT via callbacks when available; generate/assign on server as part of login/signup; register device through auth-service.
- Normalize identity extraction server-side:
  - Prefer Authorization: Bearer API tokens (JWTManager) for device-bound APIs.
  - Fallback to NextAuth getToken for authenticated web flows.
  - Derive userId and deviceId exclusively server-side; ignore client-provided userId/deviceId in body/query/headers unless verified.
- Introduce a server-managed HttpOnly cookie (Aurora-Device-Id) for device consistency after initial registration. Used only as auxiliary input if NextAuth lacks device claim; must be reconciled against server records to prevent tampering.

Request Verification Pipeline
- New helper: userIdentityFromRequest(req)
  - If Authorization header present: verify via authService/JWTManager (userId + deviceId).
  - Else: getToken(req) via NextAuth and read token.id, token.deviceId (after callback updates).
  - Else: reject with 401 requiring authentication.
- Endpoint decorators/wrappers to enforce identity and device scoping. Example: requireUserAuth(handler), requireUserDeviceScope(handler).
- Update endpoints to remove trust in X-User-Id/X-Device-Id headers.

Sequence Flows

1) Sign-in and Device Registration
Frontend -> /api/auth/[...nextauth] -> NextAuth Provider
Server:
- On login/signup, auth-service generates deviceId, stores linkage (userId-deviceId), and issues JWTManager tokens with userId + deviceId.
- NextAuth callbacks augment token with deviceId (and role).
- Set HttpOnly cookie Aurora-Device-Id = deviceId; optional for continuity.

ASCII Sequence
User Browser
  -> NextAuth Login
     -> auth-service: generate deviceId, register device
     <- NextAuth token: { id, role, deviceId }
     <- HttpOnly cookie: Aurora-Device-Id

2) Create Clinical Session (/api/sessions POST)
Client sends POST (no userId in body).
Middleware applies security and rate limits.
Handler:
- userIdentityFromRequest -> { userId, deviceId }
- hopeAISystem.createClinicalSession(userId, mode, agent, undefined, patientSessionMeta)
- Save session in HIPAA storage with encrypted data and audit log.

3) Send Message SSE (/api/send-message POST)
Client sends message with Authorization or NextAuth session.
Server:
- userIdentityFromRequest -> { userId, deviceId }
- getGlobalOrchestrationSystem() returns orchestrator with multi-agent capabilities.
- Streams SSE:
  - bullet events
  - agent_selected events
  - chunk events
  - final response event
- Update Sentry metrics with userId/sessionId/agent; log audit.

ASCII SSE Sequence
Client                    API /send-message                  Orchestrator
  POST (Authorization) -> validate identity -> getGlobalSystem
  <- : connected
  <- bullet/agent_selected/chunk events (streamed)
                                               -> agent selection & streaming generator
  <- response final with updatedState
  <- complete

4) Upload Document (/api/upload-document POST)
Client sends file and sessionId (userId is NOT accepted).
Server:
- userIdentityFromRequest -> { userId, deviceId }
- Validate file type/size (ClinicalFileManager).
- Call HopeAISystemSingleton.uploadDocument(sessionId, file, userId) and store clinical file (encrypted) with linkage to session.
- Optionally use Google GenAI Files client with API key for ingestion; DO NOT use Vertex for files.upload.

5) Sync Push/Pull (/api/sync/*)
Server:
- userIdentityFromRequest -> { userId, deviceId }
- Enforce device-scoped records and conflict resolution policies.
- Use UnifiedStorageInterface schema with userId + deviceId fields.

Data Storage and Encryption
- HIPAACompliantStorage (lib/hipaa-compliant-storage.ts):
  - AES-256-GCM encryption via lib/encryption-utils.ts, requiring AURORA_ENCRYPTION_KEY.
  - Hot cache for performance and SQLite persistence with audit logs.
- Encryption Utilities:
  - Secure key management via env var AURORA_ENCRYPTION_KEY; development-only deterministic fallback; production requires proper key length and configuration.
  - VerifyEncryptionSetup is called on storage initialization for sanity.
- Key Management:
  - Remove reliance on aurora-encryption-key.json in production; use environment variables or KMS.
  - Files client uses API key; Vertex AI is used for inference only and requires GOOGLE_CLOUD_PROJECT/CLOUD_LOCATION with service account via env JSON, not local paths.

Rate Limiting and Security
- Global Middleware (middleware.ts):
  - Security headers (CSP, HSTS in production).
  - Admin auth via admin-auth.ts for protected endpoints.
  - Suspicious activity detection and audit logging.
  - Tiered rate limits via rate-limiter.ts:
    - messaging: /api/send-message
    - upload: /api/upload-document
    - admin: orchestrator/system-status
    - public: other endpoints
- Recommended Enhancements:
  - Distributed rate limiter (Upstash Redis) for serverless multi-region to avoid per-instance memory limitations.
  - Per-identity rate limiting keyed on (userId, deviceId) when available, falling back to IP+UA in development.
  - CSRF protection (if browser-originating POSTs) via double-submit cookie or NextAuth integrated CSRF on non-API pages.

Observability and Audit
- Sentry metrics and audit logger to capture:
  - Authentication success/failure.
  - Unauthorized access attempts.
  - Rate limit exceedance.
  - Suspicious activity.
- HIPAA audit logs per sessionId and userId, including IP and metadata. Ensure logs never include plaintext clinical content.

Implementation Milestones
Phase 1: Identity and Token Strategy (1 week)
- Add deviceId to NextAuth JWT via callbacks. [Done]
- Expose auth-service endpoints for device registration and token minting (already present; confirm integration).
- Implement userIdentityFromRequest helper and integrate with middleware where needed. [Done]
- Acceptance:
  - NextAuth getToken includes deviceId. [Done]
  - Authorization tokens verify userId + deviceId via JWTManager.

Phase 2: API Route Enforcement (1–2 weeks)
- Update /api/sessions (POST/GET) to derive userId from token; remove body/query userId reliance.
- Update /api/send-message to derive identity; propagate userId for Sentry and orchestration; remove any trust in requestBody.userId.
- Update /api/upload-document to derive identity; enforce device scope in HIPAA storage.
- Acceptance:
  - All routes reject missing/invalid tokens with 401.
  - No route uses X-User-Id or X-Device-Id without verification.

Phase 3: Encryption and Key Management (1 week)
- Enforce AURORA_ENCRYPTION_KEY in production; prevent development fallback in prod.
- Remove/test references to aurora-encryption-key.json from any production path; update docs to use env JSON for Google.
- Acceptance:
  - HIPAA storage initializes only with valid key.
  - VerifyEncryptionSetup passes in prod.

Phase 4: Rate Limiting and Security Hardening (1 week)
- Map endpoints to appropriate limiter tiers; introduce distributed limiter in serverless if needed.
- Expand suspicious patterns and WAF-like controls (e.g., known bad IPs/user-agents).
- Acceptance:
  - 429 responses are consistent across cold/warm instances.
  - Admin endpoints enforced via Authorization.

Phase 5: Sync Endpoints and Conflict Resolution (1–2 weeks)
- Validate server-side identity and device scoping for /api/sync/push and /api/sync/pull. [In progress for /api/sync/push: device registration + trust snapshot]
- Implement deterministic conflict resolution rules and auditing of merges. [Ongoing]
- Acceptance:
  - Sync respects userId + deviceId.
  - Conflict logs created with clear resolution strategy.

Phase 6: Observability and Runbooks (1 week)
- Add dashboards for rate limiting, auth failures, suspicious activity, and storage health.
- Create runbooks for key rotation, token revocation, and incident response.
- Acceptance:
  - Sentry dashboards reflect key security metrics.
  - Documentation available for on-call procedures.

Phase 7: Compliance Review and UX (ongoing)
- Review HIPAA alignment and refine audit log schemas.
- Ensure UX surfaces errors empathetically and clearly, aligned with psychologist workflow.

Detailed API Changes (Examples)
- /api/sessions POST:
  - Old: expects { userId, mode, agent, patientSessionMeta } in body.
  - New: expects { mode, agent, patientSessionMeta }; userId derived via userIdentityFromRequest.
- /api/sessions GET:
  - Old: expects ?userId= query param.
  - New: no query param for userId; derive server-side; optionally paginate with pageToken.
- /api/send-message POST:
  - Old: body may include userId.
  - New: identity derived; body must include sessionId, message; optional suggestedAgent/sessionMeta.
- /api/upload-document POST:
  - Old: formData includes file, sessionId, userId.
  - New: formData includes file, sessionId; userId derived server-side.

Risk Assessment and Mitigations

1) Trusting Client-Provided Identifiers
- Risk: Spoofing userId/deviceId via headers or body.
- Mitigation: Derive identity via NextAuth getToken or JWTManager; ignore X-User-Id/X-Device-Id unless verified; add deviceId to NextAuth token.

2) Device Binding and Token Theft
- Risk: Token reuse from another device; session hijacking.
- Mitigation: Include deviceId in tokens; enforce token verification with device match; optional proof-of-possession cookie binding; revoke device tokens via auth-service.revokeDevice.

3) Distributed Rate Limiting
- Risk: In-memory limiter fails across serverless instances, allowing abuse.
- Mitigation: Use Redis/Upstash or similar; key by userId+deviceId; fallback to IP+UA in dev.

4) Encryption Key Exposure
- Risk: AURORA_ENCRYPTION_KEY missing or improperly managed; accidental use of local files in prod.
- Mitigation: Enforce env var presence; use KMS or secret manager; remove local key files from prod; rotate keys with planned migration.

5) HIPAA Compliance Gaps
- Risk: Logs accidentally include PHI; audit logs insufficient or inconsistent.
- Mitigation: Scrub logs; confine PHI to encrypted storage only; maintain HIPAA audit log schemas; periodic compliance reviews.

6) SSE Reliability and Backpressure
- Risk: Streaming stalls under proxy/buffer conditions.
- Mitigation: Continue sending SSE comment keep-alives (already implemented); monitor stream throughput; implement graceful timeouts and backoff.

7) File Upload Security
- Risk: Vertex AI files.upload not supported; misuse of API key; large file memory pressure.
- Mitigation: Use Google GenAI Files via API key only; strict file type/size checks; server-side streaming upload; limit concurrency; enforce rate limiting for /upload-document.

8) Path Traversal / XSS / SQLi Attempts
- Risk: Injection attacks across routes.
- Mitigation: Global middleware includes suspicious activity detection; augment patterns; input validation middleware; strict CSP/HSTS; avoid eval/unsafe string concatenation.

9) Admin Endpoint Exposure
- Risk: Unauthorized admin access.
- Mitigation: Require Authorization: Bearer ADMIN_API_TOKEN; enforce in middleware; audit all access attempts.

10) Data Migration Issues
- Risk: Loss or corruption during local-to-remote migration.
- Mitigation: Encrypted backups with checksum; rollback capabilities in LocalDataMigrator; dry-run mode; batch retries with backoff.

Testing and Acceptance Criteria
- Unit tests for userIdentityFromRequest covering Authorization tokens and NextAuth fallback.
- Integration tests for sessions, send-message, upload-document ensuring identity is derived server-side.
- Security tests:
  - Attempt requests with forged X-User-Id/X-Device-Id – must be rejected or ignored.
  - Rate limiter tests per endpoint tier.
  - Encryption setup verification in production.
- End-to-end tests with SSE streaming verifying initial : connected, chunk emission, final response.

Open Questions / Dependencies
- Should deviceId be fully opaque and server-generated only, or can client-suggested IDs be reconciled if registered earlier? Recommendation: server-generated; client-stored values used only for continuity; never authoritative without server verification.
- Distributed rate limiter service choice (Upstash Redis vs Vercel KV or other).
- Multi-region deployment strategy for HIPAA storage (SQLite is local; cloud DB integration may be required longer term for replication/compliance reporting).

Appendix: Alignment with Aurora Principles
- Confidentiality first: Server-side identity and encryption ensure a “silent sanctuary” of clinical data.
- Psychologist workflow: Eliminates friction (no manual userId passing), SSE gives fast, empathetic feedback while preserving autonomy and reflection.
- Academic agent transparency: UI communicates which agent is responding; architecture preserves this trust by clean orchestration and audit trails.
- Latinoamérica context: Works reliably in serverless environments; rate limiting and authentication choices respect resource constraints and accessibility.

Next Steps
- Approve the specification.
- Execute Phase 1–2 milestones with code changes to auth options, middleware, and API routes. [Started: NextAuth deviceId + /api/sync/push integration]
- Schedule compliance review and security tests.

If you want, I can create a small change plan with code pointers for Phase 1–2, or prepare a checklist in your repo’s docs folder.
        