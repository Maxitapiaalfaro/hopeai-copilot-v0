"use client"

import { Zap, Brain, Search, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { getAgentVisualConfig } from "@/config/agent-visual-config"
import type { AgentType } from "@/types/clinical-types"
import type { TransitionState } from "@/hooks/use-hopeai-system"

interface AgentIndicatorProps {
  activeAgent: AgentType
  isTyping: boolean
  transitionState?: TransitionState
}

// Configuración de agentes ahora centralizada en agent-visual-config.ts

export function AgentIndicator({ activeAgent, isTyping, transitionState = 'idle' }: AgentIndicatorProps) {
  const config = getAgentVisualConfig(activeAgent)
  const IconComponent = config.icon

  // Configuración de estados de transición
  const getTransitionConfig = () => {
    switch (transitionState) {
      case 'thinking':
        return {
          icon: Brain,
          message: 'HopeAI está pensando...',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200'
        }
      case 'selecting_agent':
        return {
          icon: Search,
          message: 'HopeAI escogiendo el especialista...',
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200'
        }
      case 'specialist_responding':
        return {
          icon: MessageSquare,
          message: `${config.name} respondiendo...`,
          color: config.textColor,
          bgColor: config.bgColor,
          borderColor: config.borderColor
        }
      default:
        return null
    }
  }

  const transitionConfig = getTransitionConfig()
  const isInTransition = transitionState !== 'idle'
  const showTyping = isTyping || isInTransition

  // Usar configuración de transición si está activa, sino usar configuración del agente
  const displayConfig = transitionConfig || config
  const DisplayIcon = transitionConfig?.icon || IconComponent

  return (
    <div className={cn("border-b transition-all duration-500 px-4 py-3", displayConfig.bgColor, displayConfig.borderColor)}>
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <DisplayIcon className={cn("h-5 w-5 transition-all duration-300", displayConfig.color)} />
            {showTyping && (
              <div className="absolute -top-1 -right-1">
                <Zap className="h-3 w-3 text-amber-500 animate-pulse" />
              </div>
            )}
          </div>
          <div>
            <h3 className={cn("font-semibold text-sm transition-all duration-300", displayConfig.color)}>
              {isInTransition ? 'HopeAI' : config.name}
            </h3>
            <p className="text-xs text-gray-600">
              {isInTransition ? transitionConfig?.message : config.description}
            </p>
          </div>
        </div>

        {showTyping && (
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
            <span className="animate-pulse">
              {transitionConfig?.message || 'Procesando...'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
