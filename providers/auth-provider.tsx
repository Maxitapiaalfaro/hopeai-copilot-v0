"use client"

import { SessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'

interface AuthProviderProps {
  children: ReactNode
}

/**
 * NextAuth Session Provider wrapper
 * Provides NextAuth session context to the entire application
 * Required for useSession hook and OAuth functionality
 */
export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <SessionProvider 
      // Refetch session every 5 minutes
      refetchInterval={5 * 60}
      // Refetch session when window focuses
      refetchOnWindowFocus={true}
    >
      {children}
    </SessionProvider>
  )
}
