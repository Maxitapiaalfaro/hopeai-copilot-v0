"use client"

import { AuthProvider } from '@/contexts/auth-context'

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}