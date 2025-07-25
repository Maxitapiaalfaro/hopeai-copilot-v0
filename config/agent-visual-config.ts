import { Brain, Stethoscope, BookOpen } from "lucide-react"
import type { AgentType } from "@/types/clinical-types"

export interface AgentVisualConfig {
  name: string
  description: string
  icon: any
  color: string
  bgColor: string
  textColor: string
  borderColor: string
  buttonBgColor: string
  buttonHoverColor: string
  typingDotColor: string
}

export const AGENT_VISUAL_CONFIG: Record<AgentType, AgentVisualConfig> = {
  socratico: {
    name: "HopeAI Socrático",
    description: "Diálogo terapéutico y reflexión profunda",
    icon: Brain,
    color: "blue",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    buttonBgColor: "bg-blue-600",
    buttonHoverColor: "hover:bg-blue-700",
    typingDotColor: "bg-blue-400",
  },
  clinico: {
    name: "HopeAI Clínico",
    description: "Síntesis y documentación clínica",
    icon: Stethoscope,
    color: "green",
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    borderColor: "border-green-200",
    buttonBgColor: "bg-green-600",
    buttonHoverColor: "hover:bg-green-700",
    typingDotColor: "bg-green-400",
  },
  academico: {
    name: "HopeAI Académico",
    description: "Investigación y evidencia científica",
    icon: BookOpen,
    color: "purple",
    bgColor: "bg-purple-50",
    textColor: "text-purple-700",
    borderColor: "border-purple-200",
    buttonBgColor: "bg-purple-600",
    buttonHoverColor: "hover:bg-purple-700",
    typingDotColor: "bg-purple-400",
  },
}

/**
 * Obtiene la configuración visual para un agente específico
 * @param agent - Tipo de agente
 * @returns Configuración visual del agente
 */
export function getAgentVisualConfig(agent: AgentType): AgentVisualConfig {
  return AGENT_VISUAL_CONFIG[agent]
}

/**
 * Obtiene la configuración visual para un agente con fallback al agente socrático
 * @param agent - Tipo de agente (puede ser undefined)
 * @returns Configuración visual del agente o del agente socrático como fallback
 */
export function getAgentVisualConfigSafe(agent?: AgentType): AgentVisualConfig {
  return AGENT_VISUAL_CONFIG[agent || 'socratico']
}