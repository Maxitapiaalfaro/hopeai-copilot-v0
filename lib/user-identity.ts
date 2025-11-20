/**
 * Enhanced User Identity Provider
 * - Provides a stable, persistent userId for both authenticated and anonymous users
 * - Generates a device-based anonymous ID when no explicit user identity exists
 * - Safe for client-side usage only (guards against SSR)
 */

const USER_ID_KEY = 'aurora_user_id';
const DEVICE_ID_KEY = 'aurora_device_id';

/**
 * Returns the stored current userId, or null if not set.
 */
export function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(USER_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * Persists the current authenticated userId. Call this after login.
 */
export function setCurrentUserId(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USER_ID_KEY, userId);
  } catch {
    // noop
  }
}

/**
 * Computes a lightweight, deterministic device fingerprint.
 */
function computeDeviceFingerprint(): string {
  if (typeof window === 'undefined') return 'server';

  const nav = navigator;
  const scr = window.screen;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';

  const raw = [
    nav.userAgent,
    nav.platform,
    (nav.languages || []).join(','),
    scr ? `${scr.width}x${scr.height}x${scr.colorDepth}` : 'no-screen',
    tz,
    (nav.hardwareConcurrency || 0).toString()
  ].join('|');

  // DJB2 hash (fast, deterministic)
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) + raw.charCodeAt(i);
    hash = hash & 0xffffffff;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Returns a stable deviceId, creating and persisting it if missing.
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const fingerprint = computeDeviceFingerprint();
    const deviceId = `dev_${fingerprint}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    return deviceId;
  } catch {
    // Fallback if localStorage fails
    return `dev_${computeDeviceFingerprint()}`;
  }
}

/**
 * Returns a stable anonymous userId derived from the deviceId.
 */
export function getOrCreateAnonymousUserId(): string {
  const deviceId = getDeviceId();
  return `anon_${deviceId}`;
}

/**
 * Returns the effective userId in priority order:
 * - Provided explicit userId
 * - Persisted current userId (authenticated)
 * - Anonymous device-based userId
 */
export function getEffectiveUserId(explicitUserId?: string): string {
  if (explicitUserId && explicitUserId.trim().length > 0) return explicitUserId;
  const stored = getCurrentUserId();
  if (stored) return stored;
  return getOrCreateAnonymousUserId();
}

/**
 * Clears the stored authenticated userId (does not remove deviceId).
 */
export function clearCurrentUserId(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(USER_ID_KEY);
  } catch {
    // noop
  }
}

export default {
  getCurrentUserId,
  setCurrentUserId,
  clearCurrentUserId,
  getDeviceId,
  getOrCreateAnonymousUserId,
  getEffectiveUserId,
};