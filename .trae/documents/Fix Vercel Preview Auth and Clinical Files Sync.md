## Summary

Local works but Vercel preview shows 401 on `/api/auth/login`, repeated 400 on `/api/storage/clinical-files`, plus occasional 404 and 429 on monitoring.

## Likely Causes (Top 5)

1. User records without `encryptionKey` or incompatible hash → login 401. Evidence: checks in `app/api/auth/login/route.ts:32–38` reject missing/invalid `encryptionKey`.
2. Invalid clinical-file payload (missing `id` or malformed JSON) → 400. Evidence: validation at `app/api/storage/clinical-files/route.ts:47–50`.
3. Token not persisted/sent in Authorization on preview → downstream unauthorized/sync failures. Identity requires `Authorization: Bearer <access>` before NextAuth fallback (`lib/auth/server-identity.ts:21–39, 41–55`).
4. MongoDB connected to different DB (`MONGODB_DB_NAME`) → users/files data differ across envs. Connection and index setup in `lib/database/mongodb.ts:4–6, 167–206`.
5. Runtime mismatch or build differences → bcryptjs/crypto behave differently, or adapter drops undefined `id` in minified build. `bcryptjs.compare` at `app/api/auth/login/route.ts:35` depends on consistent hashing.

## Diagnostic Plan

* Verify preview DB and collection contents

  * Console `users.findOne({ email })` on preview; confirm `encryptionKey` exists and is bcrypt hash.

  * Confirm `MONGODB_URI` and `MONGODB_DB_NAME` are identical to local.

* Inspect login path

  * Add temporary structured logs of login payload shape and user doc presence around `app/api/auth/login/route.ts:10–15, 25–38`.

  * If `encryptionKey` missing, verify registration flow at `app/api/auth/register/route.ts:48–61` on preview.

* Inspect clinical-files payload

  * Log `payload` and derived `file` at `app/api/storage/clinical-files/route.ts:39–50` to capture missing `id` / JSON.

  * Confirm client adapter sends `Authorization`, `Content-Type: application/json` and `ClinicalFile` with `id` (`lib/storage/api-client-adapter.ts`).

* Confirm runtime/config

  * Explicitly set `export const runtime = 'nodejs'` in auth/storage routes if any edge constraints surface.

  * Ensure `NEXTAUTH_SECRET` is set consistently (even if bearer tokens are primary).

* Add clearer error messages

  * Return reason strings for 400/401 (e.g., "missing id" vs "invalid JSON").

## Fix Plan

* If user docs lack `encryptionKey`: migrate/rehash or regenerate via register; block login until set.

* If payload missing `id`: normalize client before POST; optionally accept `fileId` alias server-side.

* If Authorization missing: ensure login response tokens are stored and attached on every request.

* If DB mismatch: align `MONGODB_URI`/`MONGODB_DB_NAME` and re-run index creation (`lib/database/mongodb.ts:createIndexes`).

* If runtime issues: pin to Node and avoid edge-incompatible APIs.

## Verification

* Deploy preview, repeat register→login→upload flow.

* Confirm status codes: login 200; clinical-files POST 200 returning normalized file; no 400/401.

* Monitor logs without sensitive data, check index creation and DB pings.

## Rollback/Guardrails

* Keep changes behind debug logging flags.

* Avoid modifying token format; ensure compatibility across environments.

* No schema changes; only validation/normalization and configuration checks.

