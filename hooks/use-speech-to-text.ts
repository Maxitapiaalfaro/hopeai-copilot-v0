"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition'

/**
 * Hook personalizado para Speech-to-Text integrado con HopeAI
 * 
 * Proporciona funcionalidad robusta de reconocimiento de voz con:
 * - Detección automática de soporte del navegador
 * - Manejo de estados de grabación y transcripción
 * - Integración con el input de chat existente
 * - Configuración optimizada para uso clínico
 * 
 * @author Arquitecto Principal de Sistemas de IA (A-PSI)
 * @version 1.0.0
 */

interface SpeechToTextConfig {
  language?: string
  continuous?: boolean
  interimResults?: boolean
  maxAlternatives?: number
  confidenceThreshold?: number
}

interface SpeechToTextState {
  isListening: boolean
  isSupported: boolean
  isMicrophoneAvailable: boolean
  transcript: string
  interimTranscript: string
  finalTranscript: string
  confidence: number
  error: string | null
  isProcessing: boolean
}

interface SpeechToTextActions {
  startListening: () => void
  stopListening: () => void
  resetTranscript: () => void
  appendToInput: (inputSetter: (value: string | ((prev: string) => string)) => void) => void
}

const DEFAULT_CONFIG: SpeechToTextConfig = {
  language: 'es-ES', // Español por defecto para psicólogos hispanohablantes
  continuous: true,
  interimResults: true,
  maxAlternatives: 1,
  confidenceThreshold: 0.7
}

export function useSpeechToText(
  config: Partial<SpeechToTextConfig> = {}
): SpeechToTextState & SpeechToTextActions {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  
  // Estados locales
  const [error, setError] = useState<string | null>(null)
  const [confidence, setConfidence] = useState<number>(0)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Referencias para manejo de timeouts
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Hook de react-speech-recognition
  const {
    transcript,
    interimTranscript,
    finalTranscript,
    listening,
    resetTranscript: resetSpeechTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
    browserSupportsContinuousListening
  } = useSpeechRecognition({
    transcribing: true,
    clearTranscriptOnListen: false
  })

  // Configurar SpeechRecognition nativo para mayor control
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition()
      
      recognition.lang = finalConfig.language
      recognition.continuous = finalConfig.continuous
      recognition.interimResults = finalConfig.interimResults
      recognition.maxAlternatives = finalConfig.maxAlternatives
      
      // Eventos para manejo de confianza y errores
      recognition.onresult = (event: any) => {
        const result = event.results[event.results.length - 1]
        if (result.isFinal && result[0].confidence) {
          setConfidence(result[0].confidence)
          
          // Verificar umbral de confianza
          if (result[0].confidence < finalConfig.confidenceThreshold!) {
            setError(`Confianza baja en el reconocimiento (${Math.round(result[0].confidence * 100)}%). Intenta hablar más claro.`)
          } else {
            setError(null)
          }
        }
      }
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setError(getErrorMessage(event.error))
        setIsProcessing(false)
      }
      
      recognition.onstart = () => {
        setIsProcessing(true)
        setError(null)
      }
      
      recognition.onend = () => {
        setIsProcessing(false)
      }
    }
  }, [finalConfig])

  // Manejo de timeouts para detección de silencio
  useEffect(() => {
    if (listening) {
      // Limpiar timeout anterior
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
      }
      
      // Configurar nuevo timeout de silencio (5 segundos)
      silenceTimeoutRef.current = setTimeout(() => {
        if (listening && !interimTranscript) {
          console.log('🔇 Silencio detectado, deteniendo grabación automáticamente')
          stopListening()
        }
      }, 5000)
    } else {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
        silenceTimeoutRef.current = null
      }
    }
    
    return () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
      }
    }
  }, [listening, interimTranscript])

  // Funciones de control
  const startListening = useCallback(() => {
    if (!browserSupportsSpeechRecognition) {
      setError('Tu navegador no soporta reconocimiento de voz. Prueba con Chrome, Edge o Safari.')
      return
    }
    
    if (!isMicrophoneAvailable) {
      setError('Micrófono no disponible. Verifica los permisos y que esté conectado.')
      return
    }
    
    setError(null)
    setIsProcessing(true)
    
    try {
      const options = {
        continuous: finalConfig.continuous && browserSupportsContinuousListening,
        language: finalConfig.language
      }
      
      SpeechRecognition.startListening(options)
      
      // Timeout de procesamiento (30 segundos máximo)
      processingTimeoutRef.current = setTimeout(() => {
        if (listening) {
          console.log('⏰ Timeout de grabación alcanzado')
          stopListening()
        }
      }, 30000)
      
    } catch (err) {
      console.error('Error starting speech recognition:', err)
      setError('Error al iniciar el reconocimiento de voz')
      setIsProcessing(false)
    }
  }, [browserSupportsSpeechRecognition, isMicrophoneAvailable, browserSupportsContinuousListening, finalConfig, listening])

  const stopListening = useCallback(() => {
    try {
      SpeechRecognition.stopListening()
      setIsProcessing(false)
      
      // Limpiar timeouts
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current)
        processingTimeoutRef.current = null
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
        silenceTimeoutRef.current = null
      }
    } catch (err) {
      console.error('Error stopping speech recognition:', err)
      setError('Error al detener el reconocimiento de voz')
    }
  }, [])

  const resetTranscript = useCallback(() => {
    resetSpeechTranscript()
    setError(null)
    setConfidence(0)
  }, [resetSpeechTranscript])

  // Función para integrar con el input del chat
  const appendToInput = useCallback((inputSetter: (value: string | ((prev: string) => string)) => void) => {
    if (finalTranscript.trim()) {
      inputSetter((prev: string) => {
        const newValue = prev.trim() ? `${prev} ${finalTranscript.trim()}` : finalTranscript.trim()
        return newValue
      })
      resetTranscript()
    }
  }, [finalTranscript, resetTranscript])

  // Limpiar timeouts al desmontar
  useEffect(() => {
    return () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
      }
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current)
      }
    }
  }, [])

  return {
    // Estado
    isListening: listening,
    isSupported: browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
    transcript,
    interimTranscript,
    finalTranscript,
    confidence,
    error,
    isProcessing,
    
    // Acciones
    startListening,
    stopListening,
    resetTranscript,
    appendToInput
  }
}

// Función auxiliar para mensajes de error más amigables
function getErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'no-speech':
      return 'No se detectó voz. Intenta hablar más cerca del micrófono.'
    case 'audio-capture':
      return 'Error de captura de audio. Verifica que el micrófono esté funcionando.'
    case 'not-allowed':
      return 'Permisos de micrófono denegados. Habilita el acceso al micrófono en tu navegador.'
    case 'network':
      return 'Error de red. Verifica tu conexión a internet.'
    case 'service-not-allowed':
      return 'Servicio de reconocimiento de voz no disponible.'
    case 'bad-grammar':
      return 'Error en la configuración del reconocimiento de voz.'
    case 'language-not-supported':
      return 'Idioma no soportado para reconocimiento de voz.'
    default:
      return `Error de reconocimiento de voz: ${errorCode}`
  }
}

// Tipos para extensión de Window (TypeScript)
declare global {
  interface Window {
    webkitSpeechRecognition: any
    SpeechRecognition: any
  }
}