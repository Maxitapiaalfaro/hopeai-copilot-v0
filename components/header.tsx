"use client"

import { Button } from "@/components/ui/button"
import { Menu, Brain, Sparkles, FileText, X } from "lucide-react"

interface HeaderProps {
  onToggleSidebar: () => void
  onToggleDocuments: () => void
  documentPanelOpen: boolean
}

export function Header({ onToggleSidebar, onToggleDocuments, documentPanelOpen }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onToggleSidebar} className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Brain className="h-8 w-8 text-blue-600" />
            <Sparkles className="h-3 w-3 text-amber-500 absolute -top-1 -right-1" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">HopeAI</h1>
            <p className="text-xs text-gray-500">Copilot Clínico</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          Sistema activo
        </div>

        <Button
          variant={documentPanelOpen ? "default" : "outline"}
          size="sm"
          onClick={onToggleDocuments}
          className="flex items-center gap-1"
        >
          {documentPanelOpen ? <X className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          <span className="hidden sm:inline">{documentPanelOpen ? "Cerrar documentos" : "Documentos"}</span>
        </Button>
      </div>
    </header>
  )
}
