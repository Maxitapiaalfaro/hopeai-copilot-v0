"use client"

import { Brain, Stethoscope, BookOpen, FileText, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface MobileNavProps {
  activeAgent: "socratico" | "clinico" | "academico"
  onAgentChange: (agent: "socratico" | "clinico" | "academico") => void
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

export function MobileNav({ activeAgent, onAgentChange, onToggleDocuments, documentPanelOpen }: MobileNavProps) {
  return (
    <div className="bg-white border-b border-gray-200 p-2 md:hidden">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1">
          {agents.map((agent) => {
            const IconComponent = agent.icon
            const isActive = activeAgent === agent.id

            return (
              <Button
                key={agent.id}
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-md transition-all p-2",
                  isActive && `bg-${agent.color}-100 text-${agent.color}-700`,
                  isActive && agent.color === "blue" && "bg-blue-100 text-blue-700",
                  isActive && agent.color === "green" && "bg-green-100 text-green-700",
                  isActive && agent.color === "purple" && "bg-purple-100 text-purple-700",
                )}
                onClick={() => onAgentChange(agent.id as "socratico" | "clinico" | "academico")}
              >
                <IconComponent
                  className={cn(
                    "h-5 w-5",
                    isActive && agent.color === "blue" && "text-blue-600",
                    isActive && agent.color === "green" && "text-green-600",
                    isActive && agent.color === "purple" && "text-purple-600",
                  )}
                />
              </Button>
            )
          })}
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
