"use client"

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { AuthService } from '@/lib/auth/auth-service'
import { AuthResult, LoginCredentials, SignupData } from '@/lib/auth/auth-service'
import { UserProfile } from '@/lib/auth/user-profile'
import { syncOrchestrator, SyncOrchestrator } from '@/lib/sync/sync-orchestrator'

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
  loginWithOAuth: (provider: 'google' | 'github') => Promise<AuthResult>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login')

  const checkAuthStatus = useCallback(async () => {
    try {
      setIsLoading(true)
      const authService = AuthService.getInstance()
      
      if (authService.isAuthenticated()) {
        const currentUser = authService.getCurrentUser()
        setUser(currentUser)
        setIsAuthenticated(true)
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
  }, [])

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
      setUser(null)
      setIsAuthenticated(false)
    }
  }, [])

  const openAuthModal = useCallback(() => {
    setIsAuthModalOpen(true)
  }, [])

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false)
  }, [])

  const loginWithOAuth = useCallback(async (provider: 'google' | 'github'): Promise<AuthResult> => {
    try {
      const authService = AuthService.getInstance()
      const result = await authService.loginWithOAuth(provider)
      setUser(result.user)
      setIsAuthenticated(true)

      // Initialize hybrid sync after successful OAuth login (sin bloquear)
      ;(async () => {
        try {
          await syncOrchestrator.initialize(result.tokens.access)
          await syncOrchestrator.startSync()
        } catch (e) {
          console.error('Failed to initialize/start sync after OAuth login:', e)
        }
      })()

      closeAuthModal()
      return result
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