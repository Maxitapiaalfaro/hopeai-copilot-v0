"use client"

import { FileText, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { getAgentVisualConfig } from "@/config/agent-visual-config"
import { AgentType } from "@/types/clinical-types"

interface MobileNavProps {
  activeAgent: AgentType
  onToggleDocuments: () => void
  documentPanelOpen: boolean
}

export function MobileNav({ activeAgent, onToggleDocuments, documentPanelOpen }: MobileNavProps) {
  // Obtener configuración del agente activo desde la configuración centralizada
  const agentConfig = getAgentVisualConfig(activeAgent)
  const IconComponent = agentConfig.icon

  return (
    <div className="bg-white border-b border-gray-200 p-2 md:hidden">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {/* Indicador del agente activo (solo lectura) */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md",
            agentConfig.bgColor,
            agentConfig.textColor
          )}>
            <IconComponent className={cn("h-4 w-4", agentConfig.textColor)} />
            <span className="text-xs font-medium">
              {agentConfig.name}
            </span>
          </div>
        </div>

        <Button
          variant={documentPanelOpen ? "default" : "outline"}
          size="sm"
          onClick={onToggleDocuments}
          className="p-2"
        >
          {documentPanelOpen ? <X className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
