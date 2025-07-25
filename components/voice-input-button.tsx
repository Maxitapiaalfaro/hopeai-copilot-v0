"use client"

import React, { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, Volume2, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSpeechToText } from '@/hooks/use-speech-to-text'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { VoiceStatusIndicator } from '@/components/voice-status-indicator'

/**
 * Componente de Botón de Entrada de Voz para HopeAI
 * 
 * Proporciona una interfaz intuitiva para speech-to-text con:
 * - Estados visuales claros (inactivo, grabando, procesando, error)
 * - Integración automática con el input de chat
 * - Feedback visual y de confianza en tiempo real
 * - Manejo robusto de errores
 * 
 * @author Arquitecto Principal de Sistemas de IA (A-PSI)
 * @version 1.0.0
 */

interface VoiceInputButtonProps {
  /** Función para actualizar el valor del input de chat */
  onTranscriptUpdate: (transcript: string) => void
  /** Estado de procesamiento del chat (deshabilita el botón si está enviando mensaje) */
  disabled?: boolean
  /** Tamaño del botón */
  size?: 'sm' | 'md' | 'lg'
  /** Variante visual */
  variant?: 'default' | 'ghost' | 'outline'
  /** Configuración de idioma (por defecto es-ES) */
  language?: string
  /** Clase CSS adicional */
  className?: string
}

export function VoiceInputButton({
  onTranscriptUpdate,
  disabled = false,
  size = 'md',
  variant = 'ghost',
  language = 'es-ES',
  className
}: VoiceInputButtonProps) {
  
  const {
    isListening,
    isSupported,
    isMicrophoneAvailable,
    transcript,
    interimTranscript,
    finalTranscript,
    confidence,
    error,
    isProcessing,
    startListening,
    stopListening,
    resetTranscript
  } = useSpeechToText({ language })

  // Efecto para actualizar el input cuando hay transcripción final
  useEffect(() => {
    if (finalTranscript.trim()) {
      onTranscriptUpdate(finalTranscript.trim())
      resetTranscript()
    }
  }, [finalTranscript, onTranscriptUpdate, resetTranscript])

  // Manejar click del botón
  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  // Determinar el estado visual del botón
  const getButtonState = () => {
    if (!isSupported) return 'unsupported'
    if (!isMicrophoneAvailable) return 'no-mic'
    if (error) return 'error'
    if (isListening) return 'listening'
    if (isProcessing) return 'processing'
    return 'ready'
  }

  const buttonState = getButtonState()

  // Configuración visual por estado
  const stateConfig = {
    ready: {
      icon: Mic,
      className: 'text-gray-600 hover:text-blue-600 hover:bg-blue-50',
      tooltip: 'Hacer clic para comenzar a grabar'
    },
    listening: {
      icon: Volume2,
      className: 'text-red-600 bg-red-50 hover:bg-red-100 animate-pulse',
      tooltip: 'Grabando... Hacer clic para detener'
    },
    processing: {
      icon: MicOff,
      className: 'text-amber-600 bg-amber-50',
      tooltip: 'Procesando audio...'
    },
    error: {
      icon: AlertCircle,
      className: 'text-red-600 bg-red-50',
      tooltip: error || 'Error en el reconocimiento de voz'
    },
    unsupported: {
      icon: MicOff,
      className: 'text-gray-400 cursor-not-allowed',
      tooltip: 'Reconocimiento de voz no soportado en este navegador'
    },
    'no-mic': {
      icon: MicOff,
      className: 'text-gray-400 cursor-not-allowed',
      tooltip: 'Micrófono no disponible'
    }
  }

  const config = stateConfig[buttonState]
  const IconComponent = config.icon

  // Determinar si el botón debe estar deshabilitado
  const isButtonDisabled = disabled || 
    buttonState === 'unsupported' || 
    buttonState === 'no-mic' || 
    buttonState === 'processing'

  // Tamaños del botón
  const sizeClasses = {
    sm: 'h-6 w-6 p-0',
    md: 'h-8 w-8 p-0',
    lg: 'h-10 w-10 p-0'
  }

  // Tamaños del icono
  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }

  return (
    <TooltipProvider>
      <div className={cn("relative", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={variant}
              size={size === 'md' ? 'default' : size}
              onClick={handleVoiceToggle}
              disabled={isButtonDisabled}
              className={cn(
                sizeClasses[size],
                config.className,
                'transition-all duration-200'
              )}
            >
              {isProcessing ? (
                <Loader2 className={cn(iconSizes[size], "animate-spin")} />
              ) : (
                <IconComponent className={iconSizes[size]} />
              )}
            </Button>
          </TooltipTrigger>
          
          <TooltipContent side="top" className="max-w-sm p-0">
            <VoiceStatusIndicator
              isListening={isListening}
              isSupported={isSupported}
              isMicrophoneAvailable={isMicrophoneAvailable}
              confidence={confidence}
              transcript={transcript}
              interimTranscript={interimTranscript}
              error={error}
              className="border-0 bg-white shadow-lg"
            />
          </TooltipContent>
        </Tooltip>
        
        {/* Indicador de grabación activa */}
        {isListening && (
          <div className="absolute -top-1 -right-1">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
            </div>
          </div>
        )}
        
        {/* Indicador de error cuando no está grabando */}
        {error && !isListening && (
          <div className="absolute -top-1 -right-1">
            <div className="w-3 h-3 bg-red-500 rounded-full" />
          </div>
        )}
        
        {/* Indicador de confianza alta */}
        {confidence > 0.8 && finalTranscript && (
          <div className="absolute -top-1 -right-1">
            <CheckCircle className="w-3 h-3 text-green-500" />
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

// Componente de estado de voz para mostrar información adicional
export function VoiceStatus({ 
  isListening, 
  interimTranscript, 
  confidence, 
  error 
}: {
  isListening: boolean
  interimTranscript: string
  confidence: number
  error: string | null
}) {
  if (!isListening && !error) return null

  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
      {isListening && (
        <>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span>Grabando...</span>
          </div>
          
          {interimTranscript && (
            <div className="flex-1 truncate">
              <span className="italic">"{ interimTranscript}"</span>
            </div>
          )}
          
          {confidence > 0 && (
            <div className="text-xs">
              {Math.round(confidence * 100)}%
            </div>
          )}
        </>
      )}
      
      {error && (
        <div className="flex items-center gap-1 text-red-600">
          <AlertCircle className="w-3 h-3" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}