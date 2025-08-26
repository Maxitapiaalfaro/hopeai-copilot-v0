"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Menu, User, BookText, Sun, Moon } from "lucide-react"
import { useTheme } from "next-themes"
import type { PatientSessionMeta } from "@/types/clinical-types"
import { usePatientRecord } from "@/hooks/use-patient-library"

interface HeaderProps {
  onHistoryToggle?: () => void
  sessionMeta?: PatientSessionMeta | null
}

export function Header({ onHistoryToggle, sessionMeta }: HeaderProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const patientId = sessionMeta?.patient?.reference
  const { patient } = usePatientRecord(patientId || null)
  
  const isPatientSession = !!(sessionMeta && patient)
  const patientName = patient?.displayName

  return (
    <header className="sticky top-0 left-0 right-0 px-6 py-4 flex items-center justify-between bg-background/95 backdrop-blur-sm z-10 paper-noise border-b border-border/80">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8"
          onClick={onHistoryToggle}
        >
          <Menu className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-3">
          <BookText className="h-6 w-6 text-foreground/70" />
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-wide font-serif">HopeAI</h1>
            <p className="text-sm text-muted-foreground -mt-1 font-sans">Estudio Clínico</p>
          </div>
        </div>
        
        {isPatientSession && (
          <div className="flex items-center gap-2 ml-4">
            <div className="h-4 w-px bg-border"></div>
            <Badge 
              variant="outline" 
              className="flex items-center gap-1.5 px-2.5 py-1"
            >
              <User className="h-3 w-3" />
              <span className="text-xs font-medium">{patientName}</span>
            </Badge>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setTheme((resolvedTheme === 'dark' || theme === 'dark') ? 'light' : 'dark')}
          title={(resolvedTheme === 'dark' || theme === 'dark') ? 'Cambiar a claro' : 'Cambiar a oscuro'}
        >
          {(resolvedTheme === 'dark' || theme === 'dark') ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
      </div>
    </header>
  )
}
