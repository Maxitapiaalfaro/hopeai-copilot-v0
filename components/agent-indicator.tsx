"use client"

import { Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { getAgentVisualConfig } from "@/config/agent-visual-config"
import type { AgentType } from "@/types/clinical-types"

interface AgentIndicatorProps {
  activeAgent: AgentType
  isTyping: boolean
}

// Configuración de agentes ahora centralizada en agent-visual-config.ts

export function AgentIndicator({ activeAgent, isTyping }: AgentIndicatorProps) {
  const config = getAgentVisualConfig(activeAgent)
  const IconComponent = config.icon

  return (
    <div className={cn("border-b transition-all duration-300 px-4 py-3", config.bgColor, config.borderColor)}>
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <IconComponent className={cn("h-5 w-5", config.textColor)} />
            {isTyping && (
              <div className="absolute -top-1 -right-1">
                <Zap className="h-3 w-3 text-amber-500 animate-pulse" />
              </div>
            )}
          </div>
          <div>
            <h3 className={cn("font-semibold text-sm", config.textColor)}>{config.name}</h3>
            <p className="text-xs text-gray-600">{config.description}</p>
          </div>
        </div>

        {isTyping && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <div className="flex gap-1">
              <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", `bg-${config.color}-500`)}></div>
              <div
                className={cn("w-1.5 h-1.5 rounded-full animate-pulse", `bg-${config.color}-500`)}
                style={{ animationDelay: "0.2s" }}
              ></div>
              <div
                className={cn("w-1.5 h-1.5 rounded-full animate-pulse", `bg-${config.color}-500`)}
                style={{ animationDelay: "0.4s" }}
              ></div>
            </div>
            <span>Procesando...</span>
          </div>
        )}
      </div>
    </div>
  )
}
