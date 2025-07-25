"use client"

import { useState, useEffect } from "react"
import { MainInterface } from "@/components/main-interface"
import { MainInterfaceOptimized } from "@/components/main-interface-optimized"
import { DebugToggle } from "@/components/debug-toggle"
import { useOptimizationConfig, optimizedLog, OptimizationFeatures } from "@/config/optimization-config"

// Componente de control de migración (solo en desarrollo)
function MigrationControls({ 
  useOptimized, 
  onToggle,
  showDebugElements,
  onToggleDebugElements
}: { 
  useOptimized: boolean
  onToggle: (optimized: boolean) => void
  showDebugElements: boolean
  onToggleDebugElements: (show: boolean) => void
}) {
  if (process.env.NODE_ENV !== 'development' || !showDebugElements) return null

  return (
    <div className="fixed top-4 left-4 z-10 bg-black/90 text-white p-3 rounded-lg shadow-lg pointer-events-auto">
      <div className="text-sm font-semibold mb-2">🔧 Control de Migración</div>
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="optimization-toggle"
            checked={useOptimized}
            onChange={(e) => onToggle(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="optimization-toggle" className="text-xs">
            Usar Implementación Optimizada
          </label>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="debug-toggle"
            checked={showDebugElements}
            onChange={(e) => onToggleDebugElements(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="debug-toggle" className="text-xs">
            Mostrar Elementos de Debug
          </label>
        </div>
        <div className="text-xs text-gray-300">
          {useOptimized ? '🚀 Optimizado (Fase 1)' : '📝 Original'}
        </div>
        <div className="text-xs text-gray-400">
          Contexto: {OptimizationFeatures.isOptimizedContextEnabled() ? 'Optimizado' : 'Original'}
        </div>
        <div className="text-xs text-gray-400">
          GenAI: {OptimizationFeatures.isNativeGenAIEnabled() ? 'Nativo' : 'Wrapper'}
        </div>
      </div>
    </div>
  )
}

// Componente de estado de optimización
function OptimizationStatus({ isOptimized, showDebugElements }: { isOptimized: boolean, showDebugElements: boolean }) {
  if (process.env.NODE_ENV !== 'development' || !showDebugElements) return null

  return (
    <div className="fixed bottom-4 left-4 z-10 bg-blue-600/90 text-white px-3 py-1 rounded-full text-xs font-medium pointer-events-none">
      {isOptimized ? '🚀 Optimizado' : '📝 Original'}
    </div>
  )
}

export function MigrationWrapper() {
  const config = useOptimizationConfig()
  const [useOptimized, setUseOptimized] = useState(config.useOptimizedContext)
  const [showDebugElements, setShowDebugElements] = useState(config.development.showDebugElements)
  const [isReady, setIsReady] = useState(false)

  // Inicialización
  useEffect(() => {
    optimizedLog('INFO', 'MigrationWrapper inicializando...', {
      configuredOptimization: config.useOptimizedContext,
      currentSelection: useOptimized,
      showDebugElements: showDebugElements,
      isDevelopment: process.env.NODE_ENV === 'development'
    })
    
    setIsReady(true)
  }, [])

  // Manejar cambio de implementación
  const handleToggleImplementation = (optimized: boolean) => {
    optimizedLog('INFO', `Cambiando a implementación: ${optimized ? 'optimizada' : 'original'}`)
    setUseOptimized(optimized)
    
    // Guardar preferencia en localStorage para desarrollo
    if (process.env.NODE_ENV === 'development') {
      localStorage.setItem('hopeai_use_optimized', optimized.toString())
    }
  }

  // Manejar cambio de elementos de debug
  const handleToggleDebugElements = (show: boolean) => {
    optimizedLog('INFO', `${show ? 'Mostrando' : 'Ocultando'} elementos de debug`)
    setShowDebugElements(show)
    
    // Guardar preferencia en localStorage para desarrollo
    if (process.env.NODE_ENV === 'development') {
      localStorage.setItem('hopeai_show_debug', show.toString())
    }
  }

  // Restaurar preferencias en desarrollo
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const savedOptimized = localStorage.getItem('hopeai_use_optimized')
      const savedDebug = localStorage.getItem('hopeai_show_debug')
      
      if (savedOptimized !== null) {
        const shouldUseOptimized = savedOptimized === 'true'
        setUseOptimized(shouldUseOptimized)
        optimizedLog('INFO', 'Preferencia de optimización restaurada', { useOptimized: shouldUseOptimized })
      }
      
      if (savedDebug !== null) {
        const shouldShowDebug = savedDebug === 'true'
        setShowDebugElements(shouldShowDebug)
        optimizedLog('INFO', 'Preferencia de debug restaurada', { showDebugElements: shouldShowDebug })
      }
    }
  }, [])

  // Pantalla de carga
  if (!isReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Inicializando HopeAI...</p>
          <p className="text-sm text-gray-500 mt-2">
            {config.useOptimizedContext ? 'Cargando optimizaciones avanzadas' : 'Cargando interfaz estándar'}
          </p>
        </div>
      </div>
    )
  }

  // Renderizar la implementación seleccionada
  // Renderizar la implementación seleccionada sin elementos superpuestos que interfieran
  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Implementación seleccionada */}
      {useOptimized ? (
        <MainInterfaceOptimized key="optimized" showDebugElements={showDebugElements} />
      ) : (
        <MainInterface key="original" />
      )}
      
      {/* Elementos de debug solo si están habilitados y no interfieren */}
      {showDebugElements && (
        <>
          {/* Toggle de debug (acceso rápido) */}
          <DebugToggle 
            showDebugElements={showDebugElements}
            onToggle={handleToggleDebugElements}
          />
          
          {/* Controles de migración (solo desarrollo) */}
          <MigrationControls 
            useOptimized={useOptimized} 
            onToggle={handleToggleImplementation}
            showDebugElements={showDebugElements}
            onToggleDebugElements={handleToggleDebugElements}
          />
          
          {/* Estado de optimización */}
          <OptimizationStatus 
            isOptimized={useOptimized} 
            showDebugElements={showDebugElements}
          />
        </>
      )}
    </div>
  )
}

// Hook para verificar qué implementación está activa
export function useImplementationStatus() {
  const config = useOptimizationConfig()
  const [useOptimized, setUseOptimized] = useState(config.useOptimizedContext)
  
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const saved = localStorage.getItem('hopeai_use_optimized')
      if (saved !== null) {
        setUseOptimized(saved === 'true')
      }
    }
  }, [])
  
  return {
    isOptimized: useOptimized,
    isOriginal: !useOptimized,
    implementationName: useOptimized ? 'Optimizada (Fase 1)' : 'Original',
    features: {
      optimizedContext: useOptimized && OptimizationFeatures.isOptimizedContextEnabled(),
      nativeGenAI: useOptimized && OptimizationFeatures.isNativeGenAIEnabled(),
      compression: useOptimized && OptimizationFeatures.isCompressionEnabled(),
      performanceMetrics: useOptimized && OptimizationFeatures.isPerformanceMetricsEnabled()
    }
  }
}