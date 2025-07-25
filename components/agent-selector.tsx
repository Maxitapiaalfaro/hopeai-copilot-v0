"use client"

import { Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AGENT_VISUAL_CONFIG } from "@/config/agent-visual-config"

interface AgentSelectorProps {
  activeAgent: "socratico" | "clinico" | "academico"
  onAgentChange: (agent: "socratico" | "clinico" | "academico") => void
  isProcessing: boolean
}

// Configuración de agentes ahora centralizada en agent-visual-config.ts
const agents = Object.entries(AGENT_VISUAL_CONFIG).map(([id, config]) => ({
  id,
  name: config.name,
  description: config.description,
  icon: config.icon,
  color: config.color,
}))

export function AgentSelector({ activeAgent, onAgentChange, isProcessing }: AgentSelectorProps) {
  return (
    <div className="bg-white border-b border-gray-200 p-2">
      <div className="flex justify-center">
        <TooltipProvider>
          <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
            {agents.map((agent) => {
              const IconComponent = agent.icon
              const isActive = activeAgent === agent.id
              const agentConfig = AGENT_VISUAL_CONFIG[agent.id as keyof typeof AGENT_VISUAL_CONFIG]

              return (
                <Tooltip key={agent.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-md transition-all",
                        isActive && agentConfig.bgColor && agentConfig.textColor,
                      )}
                      onClick={() => onAgentChange(agent.id as "socratico" | "clinico" | "academico")}
                      disabled={isProcessing}
                    >
                      <div className="relative">
                        <IconComponent
                          className={cn(
                            "h-5 w-5",
                            isActive && agentConfig.textColor,
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
