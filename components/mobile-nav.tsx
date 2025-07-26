"use client"

import { Brain, Stethoscope, BookOpen, FileText, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface MobileNavProps {
  activeAgent: "socratico" | "clinico" | "academico"
  onToggleDocuments: () => void
  documentPanelOpen: boolean
}

const agents = [
  {
    id: "socratico",
    icon: Brain,
    color: "blue",
  },
  {
    id: "clinico",
    icon: Stethoscope,
    color: "green",
  },
  {
    id: "academico",
    icon: BookOpen,
    color: "purple",
  },
]

export function MobileNav({ activeAgent, onToggleDocuments, documentPanelOpen }: MobileNavProps) {
  // Encontrar el agente activo para mostrar solo su indicador
  const currentAgent = agents.find(agent => agent.id === activeAgent)
  const IconComponent = currentAgent?.icon || Brain
  const agentColor = currentAgent?.color || "blue"

  return (
    <div className="bg-white border-b border-gray-200 p-2 md:hidden">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {/* Indicador del agente activo (solo lectura) */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md",
            agentColor === "blue" && "bg-blue-100 text-blue-700",
            agentColor === "green" && "bg-green-100 text-green-700",
            agentColor === "purple" && "bg-purple-100 text-purple-700",
          )}>
            <IconComponent
              className={cn(
                "h-4 w-4",
                agentColor === "blue" && "text-blue-600",
                agentColor === "green" && "text-green-600",
                agentColor === "purple" && "text-purple-600",
              )}
            />
            <span className="text-xs font-medium capitalize">
              {activeAgent === "socratico" && "Socrático"}
              {activeAgent === "clinico" && "Clínico"}
              {activeAgent === "academico" && "Académico"}
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
