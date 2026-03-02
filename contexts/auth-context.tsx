"use client"

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { signIn, signOut, useSession } from 'next-auth/react'
import { AuthService } from '@/lib/auth/auth-service'
import { AuthResult, LoginCredentials, SignupData } from '@/lib/auth/auth-service'
import { UserProfile } from '@/lib/auth/user-profile'
import { syncOrchestrator, SyncOrchestrator } from '@/lib/sync/sync-orchestrator'
import { setCurrentUserId, clearCurrentUserId, getCurrentUserId } from '@/lib/user-identity'
// ─── Firebase Auth Sidecar ────────────────────────────────────────────────────
// Imported lazily to avoid SSR issues. The sidecar is client-only.
import {
  subscribeToFirebaseAuthState,
  firebaseSignInWithEmail,
  firebaseSignUpWithEmail,
  firebaseSignInWithGoogle,
  firebaseSignOut as firebaseSidecarSignOut,
  isFirebaseConfigured,
  type FirebaseSidecarUser,
} from '@/lib/firebase/firebase-auth-sidecar'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  /**
   * True once Firebase Auth has resolved its initial state (either a user or
   * null). The UI gate blocks rendering of the main interface until this is
   * true, preventing IndexedDB from initializing with an anonymous UID when
   * a Firebase session is actually present.
   */
  isFirebaseReady: boolean
  user: UserProfile | null
  /** The raw Firebase user object, available when authenticated via Firebase. */
  firebaseUser: FirebaseSidecarUser | null
  login: (email: string, password: string) => Promise<AuthResult>
  signup: (email: string, password: string, name: string, licenseNumber?: string) => Promise<AuthResult>
  logout: () => Promise<void>
  checkAuthStatus: () => Promise<void>
  isAuthModalOpen: boolean
  openAuthModal: () => void
  closeAuthModal: () => void
  authModalMode: 'login' | 'register'
  setAuthModalMode: (mode: 'login' | 'register') => void
  loginWithOAuth: (provider: 'google' | 'github' | 'auth0') => Promise<AuthResult>
  /** Sign in with Google via Firebase popup. */
  loginWithFirebaseGoogle: () => Promise<void>
  /** Sign in with email/password via Firebase. */
  loginWithFirebaseEmail: (email: string, password: string) => Promise<void>
  /** Register with email/password via Firebase. */
  signupWithFirebaseEmail: (email: string, password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ─── Internal helper: map FirebaseSidecarUser → UserProfile ──────────────────

function mapFirebaseUserToProfile(fbUser: FirebaseSidecarUser): UserProfile {
  return {
    id: fbUser.uid,
    email: fbUser.email || '',
    displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuario',
    avatar: fbUser.photoURL || undefined,
    metadata: {
      createdAt: new Date(),
      lastLoginAt: new Date(),
      subscriptionType: 'free',
      betaFeatures: [],
    },
    preferences: {
      language: 'es',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Santiago',
      dataRetention: '90d',
    },
    security: {
      twoFactorEnabled: false,
      lastPasswordChange: new Date(),
      loginAttempts: 0,
    },
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  // NextAuth session for OAuth users (existing flow — untouched)
  const { data: session, status: sessionStatus } = useSession()

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login')

  // ── Firebase Sidecar state ──────────────────────────────────────────────────
  const [firebaseUser, setFirebaseUser] = useState<FirebaseSidecarUser | null>(null)
  /**
   * isFirebaseReady: starts as false, becomes true once onAuthStateChanged
   * fires for the first time (regardless of whether a user is present).
   * This is the gate that prevents the race condition described in the design.
   *
   * If Firebase is not configured, we set it to true immediately so the app
   * falls back to the existing auth flow without any delay.
   */
  const [isFirebaseReady, setIsFirebaseReady] = useState(!isFirebaseConfigured())

  // ── Firebase Auth Sidecar subscription ─────────────────────────────────────
  // Runs once on mount. The subscription is non-blocking: it does NOT await
  // any IndexedDB operation. It only writes to localStorage via setCurrentUserId.
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      // Firebase not configured — skip sidecar, gate is already open.
      return
    }

    const unsubscribe = subscribeToFirebaseAuthState(
      // onUser: Firebase has a valid session
      (fbUser, idToken) => {
        const profile = mapFirebaseUserToProfile(fbUser)
        setFirebaseUser(fbUser)
        setUser(profile)
        setIsAuthenticated(true)
        // setCurrentUserId is already called inside subscribeToFirebaseAuthState
        // before this callback fires — UID is guaranteed to be in localStorage.
        setIsFirebaseReady(true)
        setIsLoading(false)

        // Kick off background sync non-blockingly (same pattern as existing login)
        ;(async () => {
          try {
            await syncOrchestrator.initialize(idToken)
            await syncOrchestrator.startSync()
          } catch (e) {
            console.error('[FirebaseSidecar] Failed to start sync:', e)
          }
        })()
      },
      // onSignedOut: no Firebase session (or session expired)
      () => {
        setFirebaseUser(null)
        // Only clear auth state if there is no active NextAuth/AuthService session.
        // This prevents the Firebase "no session" signal from overriding a valid
        // credentials-based login.
        if (!session?.user && !AuthService.getInstance().isAuthenticated()) {
          setIsAuthenticated(false)
          setUser(null)
        }
        setIsFirebaseReady(true)
        setIsLoading(false)
      }
    )

    return () => unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Intentionally empty: subscribe once on mount, unsubscribe on unmount.

  // ── Existing: Sync NextAuth session with local state (OAuth users) ──────────
  // This block is UNCHANGED from the original implementation.
  useEffect(() => {
    if (sessionStatus === 'loading') return

    if (session?.user) {
      const oauthUser: UserProfile = {
        id: session.user.id || session.user.email || '',
        email: session.user.email || '',
        displayName: session.user.name || session.user.email?.split('@')[0] || '',
        avatar: session.user.image || undefined,
        metadata: {
          createdAt: new Date(),
          lastLoginAt: new Date(),
          subscriptionType: 'free',
          betaFeatures: []
        },
        preferences: {
          language: 'es',
          timezone: 'America/Santiago',
          dataRetention: '90d'
        },
        security: {
          twoFactorEnabled: false,
          lastPasswordChange: new Date(),
          loginAttempts: 0
        }
      }

      setUser(oauthUser)
      setIsAuthenticated(true)
      setCurrentUserId(oauthUser.id)
      setIsLoading(false)
      console.log('✅ OAuth session synced:', session.user.email)
    }
  }, [session, sessionStatus])

  // ── Existing: checkAuthStatus (credentials-based auth) ─────────────────────
  // UNCHANGED from original.
  const checkAuthStatus = useCallback(async () => {
    try {
      setIsLoading(true)

      if (session?.user) {
        setIsLoading(false)
        return
      }

      const authService = AuthService.getInstance()

      if (authService.isAuthenticated()) {
        const currentUser = authService.getCurrentUser()
        setUser(currentUser)
        setIsAuthenticated(true)

        if (currentUser?.id) {
          const storedUserId = getCurrentUserId()
          if (storedUserId !== currentUser.id) {
            console.log('🔄 Syncing localStorage userId with authenticated user:', currentUser.id)
            setCurrentUserId(currentUser.id)
          }
        }
      } else {
        setIsAuthenticated(false)
        setUser(null)
      }
    } catch (error) {
      console.error('Error checking auth status:', error)
      setIsAuthenticated(false)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [session])

  // ── Existing: login (credentials) ──────────────────────────────────────────
  // UNCHANGED from original.
  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const authService = AuthService.getInstance()
      const result = await authService.login(email, password)
      setUser(result.user)
      setIsAuthenticated(true)

      ;(async () => {
        try {
          await syncOrchestrator.initialize(result.tokens.access)
          await syncOrchestrator.startSync()
        } catch (e) {
          console.error('Failed to initialize/start sync after login:', e)
        }
      })()

      closeAuthModal()
      return result
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }, [])

  // ── Existing: signup (credentials) ─────────────────────────────────────────
  // UNCHANGED from original.
  const signup = useCallback(async (email: string, password: string, name: string, licenseNumber?: string): Promise<AuthResult> => {
    try {
      const authService = AuthService.getInstance()
      const result = await authService.signup(email, password, {
        displayName: name,
        language: 'es',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        clinicalSpecialty: licenseNumber || ''
      })
      setUser(result.user)
      setIsAuthenticated(true)

      ;(async () => {
        try {
          await syncOrchestrator.initialize(result.tokens.access)
          await syncOrchestrator.startSync()
        } catch (e) {
          console.error('Failed to initialize/start sync after signup:', e)
        }
      })()

      closeAuthModal()
      return result
    } catch (error) {
      console.error('Signup error:', error)
      throw error
    }
  }, [])

  // ── Existing: logout ────────────────────────────────────────────────────────
  // Extended to also sign out from Firebase if active.
  const logout = useCallback(async () => {
    try {
      // Sign out from Firebase Sidecar (if active)
      if (firebaseUser && isFirebaseConfigured()) {
        try {
          await firebaseSidecarSignOut()
        } catch (e) {
          console.error('[FirebaseSidecar] Error signing out from Firebase:', e)
        }
      }

      // Sign out from NextAuth (handles OAuth sessions)
      if (session) {
        await signOut({ redirect: false })
      }

      // Also sign out from credentials-based auth
      const authService = AuthService.getInstance()
      await authService.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      try {
        await syncOrchestrator.stopSync()
      } catch (e) {
        // ignore
      }
      try {
        SyncOrchestrator.resetInstance()
      } catch (e) {
        // ignore
      }
      clearCurrentUserId()
      setFirebaseUser(null)
      setUser(null)
      setIsAuthenticated(false)
    }
  }, [session, firebaseUser])

  // ── Existing: OAuth login via NextAuth/Auth0 ────────────────────────────────
  // UNCHANGED from original.
  const loginWithOAuth = useCallback(async (provider: 'google' | 'github' | 'auth0'): Promise<AuthResult> => {
    try {
      await signIn('auth0', {
        callbackUrl: window.location.origin
      })

      return {
        user: { id: '', email: '', displayName: '', metadata: { createdAt: new Date(), lastLoginAt: new Date(), subscriptionType: 'free', betaFeatures: [] }, preferences: { language: 'es', timezone: 'America/Santiago', dataRetention: '90d' }, security: { twoFactorEnabled: false, lastPasswordChange: new Date(), loginAttempts: 0 } },
        tokens: { access: '', refresh: '' },
        deviceId: ''
      }
    } catch (error) {
      console.error('OAuth login error:', error)
      throw error
    }
  }, [])

  // ── Firebase Sidecar: new login methods ─────────────────────────────────────

  const loginWithFirebaseGoogle = useCallback(async (): Promise<void> => {
    try {
      const result = await firebaseSignInWithGoogle()
      // onAuthStateChanged will fire and update state via the subscription above.
      // We call closeAuthModal here as a UX convenience.
      closeAuthModal()
      console.log('✅ [FirebaseSidecar] Google sign-in successful:', result.user.email)
    } catch (error) {
      console.error('[FirebaseSidecar] Google sign-in error:', error)
      throw error
    }
  }, [])

  const loginWithFirebaseEmail = useCallback(async (email: string, password: string): Promise<void> => {
    try {
      const result = await firebaseSignInWithEmail(email, password)
      closeAuthModal()
      console.log('✅ [FirebaseSidecar] Email sign-in successful:', result.user.email)
    } catch (error) {
      console.error('[FirebaseSidecar] Email sign-in error:', error)
      throw error
    }
  }, [])

  const signupWithFirebaseEmail = useCallback(async (email: string, password: string): Promise<void> => {
    try {
      const result = await firebaseSignUpWithEmail(email, password)
      closeAuthModal()
      console.log('✅ [FirebaseSidecar] Email sign-up successful:', result.user.email)
    } catch (error) {
      console.error('[FirebaseSidecar] Email sign-up error:', error)
      throw error
    }
  }, [])

  // ── Modal helpers ───────────────────────────────────────────────────────────

  const openAuthModal = useCallback(() => {
    setIsAuthModalOpen(true)
  }, [])

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false)
  }, [])

  // ── Initial auth check on mount ─────────────────────────────────────────────
  // UNCHANGED from original — runs credentials-based check.
  useEffect(() => {
    try {
      const authService = AuthService.getInstance()
      authService.enableRealApi(process.env.NEXT_PUBLIC_API_URL)
    } catch {}
    checkAuthStatus()
  }, [checkAuthStatus])

  // ── Context value ───────────────────────────────────────────────────────────

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    isFirebaseReady,
    user,
    firebaseUser,
    login,
    signup,
    logout,
    checkAuthStatus,
    isAuthModalOpen,
    openAuthModal,
    closeAuthModal,
    authModalMode,
    setAuthModalMode,
    loginWithOAuth,
    loginWithFirebaseGoogle,
    loginWithFirebaseEmail,
    signupWithFirebaseEmail,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider')
  }
  return context
}
