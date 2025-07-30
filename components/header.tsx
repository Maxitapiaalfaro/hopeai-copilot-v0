"use client"

import { Button } from "@/components/ui/button"
import { History } from "lucide-react"

interface HeaderProps {
  onHistoryToggle?: () => void
}

export function Header({ onHistoryToggle }: HeaderProps) {
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
      </div>
      <div className="flex items-center gap-3">


      </div>
    </header>
  )
}
