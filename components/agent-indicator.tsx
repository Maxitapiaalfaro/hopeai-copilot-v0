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

export function AgentIndicator({ activeAgent, isTyping, transitionState = 'idle' }: AgentIndicatorProps) {
  const config = getAgentVisualConfig(activeAgent)
  const IconComponent = config.icon

  const getTransitionConfig = () => {
    switch (transitionState) {
      case 'thinking':
        return {
          icon: Brain,
          message: 'HopeAI está pensando...',
          textColor: 'text-muted-foreground',
          bgColor: 'bg-secondary/80',
          borderColor: 'border-border'
        }
      case 'selecting_agent':
        return {
          icon: Search,
          message: 'HopeAI escogiendo el especialista...',
          textColor: 'text-muted-foreground',
          bgColor: 'bg-secondary/80',
          borderColor: 'border-border'
        }
      case 'specialist_responding':
        return {
          icon: MessageSquare,
          message: `${config.name} respondiendo...`,
          textColor: config.textColor,
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

  const displayConfig = transitionConfig || config
  const DisplayIcon = transitionConfig?.icon || IconComponent

  return (
    <div className={cn("transition-all duration-500 px-4 pb-2 pt-0 paper-noise color-fragment", displayConfig.bgColor || "bg-[hsl(var(--agent-orquestador-bg))]")}>
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <DisplayIcon className={cn("h-5 w-5 transition-all duration-300 animate-gentle-flicker", displayConfig.textColor)} />
            {showTyping && (
              <div className="absolute -top-1 -right-1">
                <Zap className="h-3 w-3 text-primary animate-pulse" />
              </div>
            )}
          </div>
          <div>
            <h3 className={cn("font-semibold text-sm transition-all duration-300 font-sans", displayConfig.textColor)}>
              {isInTransition ? 'HopeAI' : config.name}
            </h3>
            <p className="text-xs text-muted-foreground font-sans">
              {isInTransition ? transitionConfig?.message : config.description}
            </p>
          </div>
        </div>

        {showTyping && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-sans">
            <div className="flex gap-1">
              <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", config.typingDotColor)}></div>
              <div
                className={cn("w-1.5 h-1.5 rounded-full animate-pulse", config.typingDotColor)}
                style={{ animationDelay: "0.2s" }}
              ></div>
              <div
                className={cn("w-1.5 h-1.5 rounded-full animate-pulse", config.typingDotColor)}
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
