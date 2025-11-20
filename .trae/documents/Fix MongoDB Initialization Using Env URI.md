## Overview
- Root cause: DNS SRV resolution to Atlas times out (querySrv ETIMEOUT), and code falls back to localhost which then fails. We must strictly use the env `MONGODB_URI` and make connection more resilient while honoring env flags.

## Changes
1. Enforce `MONGODB_URI` usage
- Require `process.env.MONGODB_URI` and remove implicit default `mongodb://localhost:27017`.
- If missing, throw a clear error indicating the env variable must be set.

2. Honor fallback flag
- Respect `MONGODB_DISABLE_LOCAL_FALLBACK`. When `true`, never attempt localhost fallback even in development.

3. Improve connection robustness
- Increase `serverSelectionTimeoutMS` from `5000` to `15000`.
- Add `connectTimeoutMS: 15000` to the client options.
- Keep retry loop but surface clearer diagnostics (attempt number, sanitized URI, env).

4. Safer logging
- Keep sanitized URI logging (no credentials), include `dbName` and `NODE_ENV` already present.
- Keep detection for SRV/network errors so callers return 503 quickly during login.

## Files
- Edit `lib/database/mongodb.ts` to:
  - Use only `MONGODB_URI` for connection.
  - Respect `MONGODB_DISABLE_LOCAL_FALLBACK`.
  - Update timeouts.

## Verification
- Run app in dev and hit `POST /api/auth/login` to confirm DB init succeeds or fails fast without localhost fallback.
- Observe `[STORAGE]` logs show connection using env URI and no local fallback.

## Notes
- We will not switch to a direct `mongodb://` multi-host URI nor placeholders; we will use the actual `MONGODB_URI` from `.env.local` as requested.
- If SRV DNS timeouts persist due to network, we will report clear diagnostics but remain compliant with the env policy (no direct URI).