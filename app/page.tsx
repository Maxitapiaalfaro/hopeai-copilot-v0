"use client"
import { MainInterfaceOptimizedWithAuth } from "@/components/main-interface-optimized"
import { AuthLayout } from "./auth-layout"

export default function HopeAIPage() {
  return (
    <AuthLayout>
      <div className="min-h-screen">
        <MainInterfaceOptimizedWithAuth />
      </div>
    </AuthLayout>
  )
}
