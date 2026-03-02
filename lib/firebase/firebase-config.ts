/**
 * Firebase Configuration — Aurora Sidecar
 *
 * Initializes the Firebase app lazily (client-side only).
 * This module is the single source of truth for the Firebase SDK instance.
 * It has ZERO dependencies on IndexedDB, SyncOrchestrator, or any Aurora
 * business logic — it is a pure infrastructure module.
 *
 * Required environment variables (NEXT_PUBLIC_ prefix for client exposure):
 *   NEXT_PUBLIC_FIREBASE_API_KEY
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 *   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 *   NEXT_PUBLIC_FIREBASE_APP_ID
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

/**
 * Returns true if all required Firebase environment variables are present.
 * When false, the Sidecar will be skipped gracefully and the app falls back
 * to the existing NextAuth / AuthService flow.
 */
export function isFirebaseConfigured(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  )
}

/**
 * Returns the singleton Firebase App instance, initializing it on first call.
 * Safe to call multiple times — uses Firebase's own idempotency guard.
 */
export function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) return getApp()
  return initializeApp(firebaseConfig)
}

/**
 * Returns the Firebase Auth instance bound to the singleton app.
 */
export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp())
}
