'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Circle, AlertCircle, Loader2 } from 'lucide-react'
import type { ReasoningBullet } from '@/types/clinical-types'

interface ReasoningBulletsProps {
  bullets: ReasoningBullet[]
  isGenerating?: boolean
  className?: string
  showHeader?: boolean
}

export function ReasoningBullets({ bullets, isGenerating = false, className = '', showHeader = true }: ReasoningBulletsProps) {
  // ⚠️ BULLETS INHABILITADOS: No mostrar nada (optimización de latencia)
  // Los bullets añadían ~500-1000ms de latencia al streaming
  return null

  // Si no hay bullets y no está generando, no mostrar nada
  if (!bullets || (bullets.length === 0 && !isGenerating)) {
    return null
  }

  const getBulletIcon = (bullet: ReasoningBullet) => {
    // ARQUITECTURA MEJORADA: Manejo de separadores visuales
    if (bullet.type === 'separator') {
      return null // Los separadores no tienen icono
    }
    
    switch (bullet.status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-serene-teal-500 dark:text-serene-teal-400 flex-shrink-0" />
      case 'generating':
        return <Loader2 className="w-4 h-4 text-clarity-blue-500 dark:text-clarity-blue-400 animate-spin flex-shrink-0" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0" />
      default:
        return <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    }
  }

  const getBulletTextColor = (bullet: ReasoningBullet) => {
    // ARQUITECTURA MEJORADA: Estilo especial para separadores
    if (bullet.type === 'separator') {
      return 'text-muted-foreground text-xs font-medium border-t border-border pt-2 mt-2'
    }
    
    switch (bullet.status) {
      case 'completed':
        return 'text-foreground'
      case 'generating':
        return 'text-clarity-blue-600 dark:text-clarity-blue-400'
      case 'error':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-muted-foreground'
    }
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Header intentionally removed to avoid showing fixed label text */}
      
      <div className="space-y-1">
        <AnimatePresence>
          {bullets.map((bullet, index) => (
            <motion.div
              key={bullet.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ 
                duration: 0.2, 
                delay: index * 0.05
              }}
              className={bullet.type === 'separator' 
                ? "py-1" 
                : "flex items-start gap-2 py-1 w-full"
              }
            >
              {bullet.type === 'separator' ? (
                <div className="text-xs text-muted-foreground font-semibold tracking-wide uppercase opacity-80 mt-1">
                  {bullet.content}
                </div>
              ) : (
                <>
                  <div className="w-1 h-1 rounded-full bg-muted-foreground/40 mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="block text-xs text-muted-foreground leading-relaxed break-words whitespace-pre-wrap hyphens-auto">
                      {bullet.content}
                    </span>
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 py-1"
          >
            <Loader2 className="w-3 h-3 text-muted-foreground animate-spin flex-shrink-0" />
            <span className="text-xs text-muted-foreground italic">
              Analizando...
            </span>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default ReasoningBullets