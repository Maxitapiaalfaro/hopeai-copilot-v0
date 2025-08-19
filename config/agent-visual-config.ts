import { Brain, Stethoscope, BookOpen, Zap } from "lucide-react"
import type { AgentType } from "@/types/clinical-types"

const agentVisuals = {
    // Iteration: Socrático → terracotta/ochre (amber cream)
    socratico: {
        name: "HopeAI Socrático",
        description: "Diálogo terapéutico y reflexión profunda",
        icon: Brain,
        textColor: 'text-amber-900 dark:text-amber-200',
        bgColor: 'bg-amber-50 dark:bg-amber-950/40 paper-noise color-fragment',
        borderColor: 'border-amber-200 dark:border-amber-800 brush-border',
        focusWithinBorderColor: 'focus-within:border-amber-300 dark:focus-within:border-amber-700',
        typingDotColor: 'bg-amber-500 dark:bg-amber-400',
        button: {
            bg: 'bg-amber-200 dark:bg-amber-900/50',
            hoverBg: 'hover:bg-amber-300 dark:hover:bg-amber-800/60',
            text: 'text-amber-900 dark:text-amber-100',
        },
        ghostButton: {
            text: 'text-amber-800 dark:text-amber-200',
            hoverBg: 'hover:bg-amber-100 dark:hover:bg-amber-900/40',
        }
    },
    // Iteration: Clínico → sage/olive cream (lime family)
    clinico: {
        name: "HopeAI Clínico",
        description: "Síntesis y documentación clínica",
        icon: Stethoscope,
        textColor: 'text-lime-900 dark:text-lime-200',
        bgColor: 'bg-lime-50 dark:bg-lime-950/40 paper-noise color-fragment',
        borderColor: 'border-lime-200 dark:border-lime-800 brush-border',
        focusWithinBorderColor: 'focus-within:border-lime-200 dark:focus-within:border-lime-700',
        typingDotColor: 'bg-lime-600 dark:bg-lime-400',
        button: {
            bg: 'bg-lime-200 dark:bg-lime-900/50',
            hoverBg: 'hover:bg-lime-300 dark:hover:bg-lime-800/60',
            text: 'text-lime-900 dark:text-lime-100',
        },
        ghostButton: {
            text: 'text-lime-800 dark:text-lime-200',
            hoverBg: 'hover:bg-lime-50 dark:hover:bg-lime-900/40',
        }
    },
    // Iteration: Académico → taupe/stone cream (earthy, dark academic)
    academico: {
        name: "HopeAI Académico",
        description: "Investigación y evidencia científica",
        icon: BookOpen,
        textColor: 'text-stone-700 dark:text-stone-200',
        bgColor: 'bg-stone-50 dark:bg-stone-900/40 paper-noise color-fragment',
        borderColor: 'border-stone-200 dark:border-stone-700 brush-border',
        focusWithinBorderColor: 'focus-within:border-stone-200 dark:focus-within:border-stone-600',
        typingDotColor: 'bg-stone-500 dark:bg-stone-300',
        button: {
            bg: 'bg-stone-200 dark:bg-stone-800/50',
            hoverBg: 'hover:bg-stone-300 dark:hover:bg-stone-700/60',
            text: 'text-stone-900 dark:text-stone-100',
        },
        ghostButton: {
            text: 'text-stone-800 dark:text-stone-200',
            hoverBg: 'hover:bg-stone-50 dark:hover:bg-stone-800/40',
        }
    },
    orquestador: {
        name: "HopeAI Orquestador",
        description: "Coordinación inteligente de especialistas",
        icon: Zap,
        // Neutral warm stone to sit between amber and cool agents
        textColor: 'text-stone-800 dark:text-stone-200',
        bgColor: 'bg-stone-100 dark:bg-stone-900/40 paper-noise color-fragment',
        borderColor: 'border-stone-200 dark:border-stone-700 brush-border',
        focusWithinBorderColor: 'focus-within:border-stone-300 dark:focus-within:border-stone-600',
        typingDotColor: 'bg-stone-500 dark:bg-stone-300',
        button: {
            // Subtle primary: light background, dark text
            bg: 'bg-stone-200 dark:bg-stone-800/50',
            hoverBg: 'hover:bg-stone-300 dark:hover:bg-stone-700/60',
            text: 'text-stone-900 dark:text-stone-100',
        },
        ghostButton: {
            text: 'text-stone-700 dark:text-stone-200',
            hoverBg: 'hover:bg-stone-200 dark:hover:bg-stone-800/40',
        }
    },
    desconocido: {
        name: "HopeAI",
        description: "Procesando su solicitud...",
        icon: Brain,
        textColor: 'text-stone-800 dark:text-stone-200',
        bgColor: 'bg-stone-100 dark:bg-stone-900/40 paper-noise color-fragment',
        borderColor: 'border-stone-200 dark:border-stone-700 brush-border',
        focusWithinBorderColor: 'focus-within:border-stone-300 dark:focus-within:border-stone-600',
        typingDotColor: 'bg-stone-500 dark:bg-stone-300',
        button: {
            bg: 'bg-stone-700 dark:bg-stone-800',
            hoverBg: 'hover:bg-stone-800 dark:hover:bg-stone-700',
            text: 'text-stone-50 dark:text-stone-100',
        },
        ghostButton: {
            text: 'text-stone-700 dark:text-stone-200',
            hoverBg: 'hover:bg-stone-200 dark:hover:bg-stone-800/40',
        }
    }
};

export const getAgentVisualConfig = (agent: AgentType) => {
    return agentVisuals[agent] || agentVisuals.desconocido;
};

export const getAgentVisualConfigSafe = (agent?: AgentType) => {
    if (!agent || !(agent in agentVisuals)) {
        return agentVisuals.desconocido;
    }
    return agentVisuals[agent];
};