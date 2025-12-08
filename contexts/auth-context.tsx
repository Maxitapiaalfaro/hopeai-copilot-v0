"use client"

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { signIn, signOut, useSession } from 'next-auth/react'
import { AuthService } from '@/lib/auth/auth-service'
import { AuthResult, LoginCredentials, SignupData } from '@/lib/auth/auth-service'
import { UserProfile } from '@/lib/auth/user-profile'
import { syncOrchestrator, SyncOrchestrator } from '@/lib/sync/sync-orchestrator'
import { setCurrentUserId, clearCurrentUserId, getCurrentUserId } from '@/lib/user-identity'

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  user: UserProfile | null
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  // NextAuth session for OAuth users
  const { data: session, status: sessionStatus } = useSession()
  
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login')

  // Sync NextAuth session with local state (for OAuth users)
  React.useEffect(() => {
    if (sessionStatus === 'loading') return
    
    if (session?.user) {
      // OAuth user authenticated via NextAuth
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

  const checkAuthStatus = useCallback(async () => {
    try {
      setIsLoading(true)
      
      // Check NextAuth session first (for OAuth users)
      if (session?.user) {
        // Already handled by useEffect above
        setIsLoading(false)
        return
      }
      
      // Check credentials-based auth (AuthService)
      const authService = AuthService.getInstance()
      
      if (authService.isAuthenticated()) {
        const currentUser = authService.getCurrentUser()
        setUser(currentUser)
        setIsAuthenticated(true)
        
        // Sync localStorage userId with authenticated user to prevent mismatches
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
        // Note: Don't clear userId here - it will be cleared on explicit logout
        // This prevents clearing valid userId on page refresh when AuthService
        // hasn't restored session state yet
      }
    } catch (error) {
      console.error('Error checking auth status:', error)
      setIsAuthenticated(false)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [session])

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const authService = AuthService.getInstance()
      const result = await authService.login(email, password)
      setUser(result.user)
      setIsAuthenticated(true)

      // Initialize hybrid sync after successful login (no bloquear el flujo)
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

      // Initialize hybrid sync after successful signup (sin bloquear)
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

  const logout = useCallback(async () => {
    try {
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
      // Stop background sync and reset orchestrator state on logout
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
      setUser(null)
      setIsAuthenticated(false)
    }
  }, [session])

  const openAuthModal = useCallback(() => {
    setIsAuthModalOpen(true)
  }, [])

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false)
  }, [])

  const loginWithOAuth = useCallback(async (provider: 'google' | 'github' | 'auth0'): Promise<AuthResult> => {
    try {
      // Use NextAuth's signIn for real OAuth flow
      const result = await signIn(provider, { 
        redirect: false,
        callbackUrl: window.location.origin 
      })
      
      if (result?.error) {
        throw new Error(result.error)
      }
      
      // If successful, NextAuth handles session - we'll sync state via useSession
      // Return a placeholder result since NextAuth manages the actual auth
      const placeholderResult: AuthResult = {
        user: {
          id: 'pending',
          email: '',
          displayName: '',
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
        },
        tokens: { access: '', refresh: '' },
        deviceId: ''
      }
      
      closeAuthModal()
      
      // Reload page to sync NextAuth session state
      if (result?.ok && !result?.error) {
        window.location.reload()
      }
      
      return placeholderResult
    } catch (error) {
      console.error('OAuth login error:', error)
      throw error
    }
  }, [])

  React.useEffect(() => {
    // Activar API real en cliente para usar endpoints /api
    try {
      const authService = AuthService.getInstance()
      authService.enableRealApi(process.env.NEXT_PUBLIC_API_URL)
    } catch {}
    checkAuthStatus()
  }, [checkAuthStatus])

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    login,
    signup,
    logout,
    checkAuthStatus,
    isAuthModalOpen,
    openAuthModal,
    closeAuthModal,
    authModalMode,
    setAuthModalMode,
    loginWithOAuth
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