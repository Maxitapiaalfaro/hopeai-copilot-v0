## Diagnosis

* The failure shows `querySrv ETIMEOUT _mongodb._tcp.cluster0.lw4tod5.mongodb.net`, which happens before authentication and indicates a DNS SRV lookup timeout for `mongodb+srv`.

* Connection code uses `process.env.MONGODB_URI` and logs a sanitized URI, so credentials not appearing in logs is expected (`lib/database/mongodb.ts:39,210-219`).

* Current logic falls back to local Mongo in development when SRV/network errors are detected (`lib/database/mongodb.ts:56-73`). With `MONGODB_DISABLE_LOCAL_FALLBACK=true` present in `.env.local`, the code does not currently honor that flag.

* `.env.local` already includes a `MONGODB_DIRECT_URI`, but it contains placeholders and is not used by the code.

## Proposed Fix

* Add a robust fallback path for Atlas when SRV DNS fails: if `MONGODB_URI` starts with `mongodb+srv://` and the error matches SRV/network, attempt `MONGODB_DIRECT_URI` (standard, non-SRV seedlist) before trying local fallback.

* Respect `MONGODB_DISABLE_LOCAL_FALLBACK`: when true, skip the local `127.0.0.1` fallback entirely.

* Improve error classification to include `querySrv ETIMEOUT` as SRV DNS error (currently only `ENOTFOUND` is explicitly checked).

* Increase `serverSelectionTimeoutMS` modestly (e.g., to 10000) to reduce flakiness without masking DNS issues.

## Implementation Steps

1. Update connection logic in `lib/database/mongodb.ts`:

   * Detect `mongodb+srv://` and capture SRV/DNS/network failures (`lib/database/mongodb.ts:47-55`).

   * If failure:

     * If `process.env.MONGODB_DIRECT_URI` is defined, try connecting with it using the same pool/timeouts; log using `sanitizeUri`.

     * Only if direct URI is absent or fails, and `process.env.NODE_ENV !== 'production'` and `MONGODB_DISABLE_LOCAL_FALLBACK !== 'true'`, try local fallback (`mongodb://127.0.0.1:27017`).

   * Treat messages containing `querySrv ETIMEOUT` as SRV DNS errors alongside `ENOTFOUND`.
2. Keep index creation and ping checks unchanged (`lib/database/mongodb.ts:41-46,144-197`).
3. Do not log raw credentials; continue using `sanitizeUri` (`lib/database/mongodb.ts:210-219`).

## Configuration Updates

* In `.env.local`, replace `MONGODB_DIRECT_URI` with the actual “Standard connection string (without SRV)” from Atlas (no placeholders): it must include seedlist hosts, `ssl=true`, `replicaSet=<yourClusterReplicaSetName>`, `authSource=admin`, `retryWrites=true&w=majority`, and optionally `appName`.

* Leave `MONGODB_DB_NAME=test` as-is; the code selects the database via `client.db(dbName)`.

* Keep `MONGODB_URI` as the official `mongodb+srv` string; the app will attempt it first and only fall back when SRV fails.

## Validation

* Network check: from your dev machine, run `nslookup -type=SRV _mongodb._tcp.cluster0.lw4tod5.mongodb.net` to confirm SRV resolution. If it times out, expect the direct URI to be required.

* Start dev and call `POST /api/auth/login`; confirm logs:

  * `Connecting to MongoDB` with sanitized URI, then `MongoDB connected`.

  * If SRV fails, you should see `MongoDB connection attempt failed` followed by `Connecting to MongoDB` using the sanitized direct URI.

* Verify indexes are created and no `IndexOptionsConflict` errors are emitted.

## Contingencies

* If direct URI also times out, increase `serverSelectionTimeoutMS` to 10000 and verify outbound connectivity/firewall/proxy settings to `*.mongodb.net` over DNS and TLS.

* If credentials include special characters like `@:/?&=`, URL-encode the username/password in the connection strings.

## Rollout

* Make the code change, update `.env.local` with a valid direct URI, run dev, and verify login works.

* No migration required; collections and indexes are auto-managed on first successful connect.

