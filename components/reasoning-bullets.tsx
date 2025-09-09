'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Circle, AlertCircle, Loader2 } from 'lucide-react'
import type { ReasoningBullet, ReasoningBulletsState } from '@/types/clinical-types'

interface ReasoningBulletsProps {
  bullets: ReasoningBullet[]
  isGenerating: boolean
  className?: string
}

export function ReasoningBullets({ bullets, isGenerating, className = '' }: ReasoningBulletsProps) {
  const [visibleBullets, setVisibleBullets] = useState<ReasoningBullet[]>([])

  useEffect(() => {
    // Animar la aparición de nuevos bullets
    if (bullets.length > visibleBullets.length) {
      const newBullets = bullets.slice(visibleBullets.length)
      newBullets.forEach((bullet, index) => {
        setTimeout(() => {
          setVisibleBullets(prev => [...prev, bullet])
        }, index * 300) // Stagger animation
      })
    }
  }, [bullets, visibleBullets.length])

  const getBulletIcon = (bullet: ReasoningBullet) => {
    switch (bullet.status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
      case 'generating':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
      default:
        return <Circle className="w-4 h-4 text-gray-400 flex-shrink-0" />
    }
  }

  const getBulletTextColor = (bullet: ReasoningBullet) => {
    switch (bullet.status) {
      case 'completed':
        return 'text-gray-700 dark:text-gray-300'
      case 'generating':
        return 'text-blue-600 dark:text-blue-400'
      case 'error':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-gray-500 dark:text-gray-400'
    }
  }

  if (!isGenerating && visibleBullets.length === 0) {
    return null
  }

  return (
    <div className={`reasoning-bullets ${className}`}>
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800/50">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-2">
            {isGenerating ? (
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 text-green-500" />
            )}
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {isGenerating ? 'Procesando...' : 'Análisis completado'}
            </span>
          </div>
        </div>
        
        <div className="space-y-2">
          <AnimatePresence>
            {visibleBullets.map((bullet, index) => (
              <motion.div
                key={bullet.id}
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                transition={{ 
                  duration: 0.4, 
                  delay: index * 0.1,
                  type: "spring",
                  stiffness: 100,
                  damping: 15
                }}
                className="flex items-start gap-3 p-2 rounded-md hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors"
              >
                {getBulletIcon(bullet)}
                <span className={`text-sm leading-relaxed ${getBulletTextColor(bullet)}`}>
                  {bullet.content}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isGenerating && visibleBullets.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 p-2 rounded-md"
            >
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
              <span className="text-sm text-blue-600 dark:text-blue-400 italic">
                Pensando...
              </span>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReasoningBullets