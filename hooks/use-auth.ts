import { useAuth as useAuthContext } from '@/contexts/auth-context'

export function useAuth() {
  const context = useAuthContext()
  return context
}