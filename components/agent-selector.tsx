"use client"

import { Brain, Stethoscope, BookOpen, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface AgentSelectorProps {
  activeAgent: "socratico" | "clinico" | "academico"
  onAgentChange: (agent: "socratico" | "clinico" | "academico") => void
  isProcessing: boolean
}

const agents = [
  {
    id: "socratico",
    name: "HopeAI Socrático",
    description: "Diálogo terapéutico y reflexión profunda",
    icon: Brain,
    color: "blue",
  },
  {
    id: "clinico",
    name: "HopeAI Clínico",
    description: "Síntesis y documentación clínica",
    icon: Stethoscope,
    color: "green",
  },
  {
    id: "academico",
    name: "HopeAI Académico",
    description: "Investigación y evidencia científica",
    icon: BookOpen,
    color: "purple",
  },
]

export function AgentSelector({ activeAgent, onAgentChange, isProcessing }: AgentSelectorProps) {
  return (
    <div className="bg-white border-b border-gray-200 p-2">
      <div className="flex justify-center">
        <TooltipProvider>
          <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
            {agents.map((agent) => {
              const IconComponent = agent.icon
              const isActive = activeAgent === agent.id

              return (
                <Tooltip key={agent.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-md transition-all",
                        isActive && `bg-${agent.color}-100 text-${agent.color}-700`,
                        isActive && agent.color === "blue" && "bg-blue-100 text-blue-700",
                        isActive && agent.color === "green" && "bg-green-100 text-green-700",
                        isActive && agent.color === "purple" && "bg-purple-100 text-purple-700",
                      )}
                      onClick={() => onAgentChange(agent.id as "socratico" | "clinico" | "academico")}
                      disabled={isProcessing}
                    >
                      <div className="relative">
                        <IconComponent
                          className={cn(
                            "h-5 w-5",
                            isActive && agent.color === "blue" && "text-blue-600",
                            isActive && agent.color === "green" && "text-green-600",
                            isActive && agent.color === "purple" && "text-purple-600",
                          )}
                        />
                        {isActive && isProcessing && (
                          <Zap className="h-3 w-3 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
                        )}
                      </div>
                      <span>{agent.name}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{agent.description}</p>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </TooltipProvider>
      </div>
    </div>
  )
}
