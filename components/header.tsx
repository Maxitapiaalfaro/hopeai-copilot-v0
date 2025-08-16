"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { History, User } from "lucide-react"
import type { PatientSessionMeta } from "@/types/clinical-types"
import { usePatientRecord } from "@/hooks/use-patient-library"

interface HeaderProps {
  onHistoryToggle?: () => void
  sessionMeta?: PatientSessionMeta | null
}

export function Header({ onHistoryToggle, sessionMeta }: HeaderProps) {
  // Obtener información del paciente usando el ID de referencia
  const patientId = sessionMeta?.patient?.reference
  const { patient } = usePatientRecord(patientId || null)
  
  // Solo mostrar el indicador si hay sesión de paciente Y se pudo cargar el paciente
  const isPatientSession = !!(sessionMeta && patient)
  const patientName = patient?.displayName

  return (
    <header className="px-6 py-6 flex items-center justify-between border-b border-gray-100">
      <div className="flex items-center gap-4">
        {/* Botón de historial en móvil - donde antes estaba el toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden p-2 h-8 w-8"
          onClick={onHistoryToggle}
        >
          <History className="h-4 w-4" />
        </Button>
        
        {/* Logo y título con estilo limpio y coherente */}
        <div className="flex items-center gap-3">
          {/* Indicador visual minimalista */}
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 opacity-80"></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">HopeAI</h1>
            <p className="text-sm text-gray-600 font-medium -mt-1">Copilot Clínico</p>
          </div>
        </div>
        
        {/* Indicador de Paciente Activo */}
        {isPatientSession && (
          <div className="flex items-center gap-2 ml-4">
            <div className="h-4 w-px bg-gray-300"></div>
            <Badge 
              variant="secondary" 
              className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors"
            >
              <User className="h-3 w-3" />
              <span className="text-xs font-medium">{patientName}</span>
            </Badge>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">


      </div>
    </header>
  )
}
