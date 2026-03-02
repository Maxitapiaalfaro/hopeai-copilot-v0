/**
 * Firebase Auth Sidecar — Aurora
 *
 * This module is the ONLY point of contact between Firebase Auth and the
 * rest of the Aurora application. It exposes a minimal, stable API surface
 * that the AuthContext consumes.
 *
 * ISOLATION CONTRACT:
 *   - This module NEVER imports from IndexedDB adapters, SyncOrchestrator,
 *     or any Aurora business logic layer.
 *   - The only Aurora utility it uses is `setCurrentUserId` / `clearCurrentUserId`
 *     from `lib/user-identity`, which writes to localStorage — the agreed
 *     identity bus between Firebase Auth and IndexedDB.
 *   - All Firebase operations are fire-and-forget from IndexedDB's perspective.
 */

'use client'

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOutSDK,
  onAuthStateChanged,
  type User,
  type Unsubscribe,
  type UserCredential,
} from 'firebase/auth'
import { getFirebaseAuth, isFirebaseConfigured } from './firebase-config'
import { setCurrentUserId, clearCurrentUserId } from '@/lib/user-identity'

// ─── Public Types ────────────────────────────────────────────────────────────

export interface FirebaseSidecarUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  /** Raw Firebase User object for advanced consumers */
  raw: User
}

export interface FirebaseSidecarResult {
  user: FirebaseSidecarUser
  idToken: string
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function mapUser(user: User): FirebaseSidecarUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    raw: user,
  }
}

async function extractResult(credential: UserCredential): Promise<FirebaseSidecarResult> {
  const idToken = await credential.user.getIdToken()
  return { user: mapUser(credential.user), idToken }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Sign in with email and password via Firebase Auth.
 * On success, writes the Firebase UID to the Aurora identity bus (localStorage).
 */
export async function firebaseSignInWithEmail(
  email: string,
  password: string
): Promise<FirebaseSidecarResult> {
  const auth = getFirebaseAuth()
  const credential = await signInWithEmailAndPassword(auth, email, password)
  const result = await extractResult(credential)
  setCurrentUserId(result.user.uid)
  return result
}

/**
 * Register a new user with email and password via Firebase Auth.
 * On success, writes the Firebase UID to the Aurora identity bus.
 */
export async function firebaseSignUpWithEmail(
  email: string,
  password: string
): Promise<FirebaseSidecarResult> {
  const auth = getFirebaseAuth()
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  const result = await extractResult(credential)
  setCurrentUserId(result.user.uid)
  return result
}

/**
 * Sign in with Google via a popup window.
 * On success, writes the Firebase UID to the Aurora identity bus.
 */
export async function firebaseSignInWithGoogle(): Promise<FirebaseSidecarResult> {
  const auth = getFirebaseAuth()
  const provider = new GoogleAuthProvider()
  // Request profile and email scopes
  provider.addScope('profile')
  provider.addScope('email')
  const credential = await signInWithPopup(auth, provider)
  const result = await extractResult(credential)
  setCurrentUserId(result.user.uid)
  return result
}

/**
 * Sign out from Firebase Auth and clear the Aurora identity bus.
 * This does NOT touch IndexedDB — local clinical data is preserved.
 */
export async function firebaseSignOut(): Promise<void> {
  const auth = getFirebaseAuth()
  await firebaseSignOutSDK(auth)
  clearCurrentUserId()
}

/**
 * Subscribes to Firebase Auth state changes.
 *
 * On each emission:
 *   - If a user is present: writes their UID to the Aurora identity bus.
 *   - If null (signed out): clears the identity bus.
 *
 * Returns an unsubscribe function. MUST be called on component unmount to
 * prevent memory leaks.
 *
 * @param onUser  Called with the mapped user when authenticated.
 * @param onSignedOut  Called when the user signs out or session expires.
 */
export function subscribeToFirebaseAuthState(
  onUser: (user: FirebaseSidecarUser, idToken: string) => void,
  onSignedOut: () => void
): Unsubscribe {
  if (!isFirebaseConfigured()) {
    // Firebase not configured — invoke onSignedOut immediately so the gate
    // resolves and the app falls back to the existing auth flow.
    onSignedOut()
    return () => {}
  }

  const auth = getFirebaseAuth()

  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        const idToken = await firebaseUser.getIdToken()
        // Write UID to the identity bus BEFORE notifying the context.
        // This guarantees that any subsequent call to getEffectiveUserId()
        // (e.g., from use-hopeai-system.ts initialization) will resolve
        // the Firebase UID and not the anonymous fallback.
        setCurrentUserId(firebaseUser.uid)
        onUser(mapUser(firebaseUser), idToken)
      } catch (err) {
        console.error('[FirebaseSidecar] Failed to get ID token:', err)
        onSignedOut()
      }
    } else {
      clearCurrentUserId()
      onSignedOut()
    }
  })
}

/**
 * Returns true if Firebase Auth is configured and available.
 * Consumers can use this to conditionally render Firebase-specific UI.
 */
export { isFirebaseConfigured }
