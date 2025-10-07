"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Paperclip, Mic, MicOff, User, Zap, ChevronDown, Brain, Search, Stethoscope, BookOpen, Maximize2, Minimize2, FileText, Copy, Check, ThumbsUp, ThumbsDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AgentType, ChatState, ClinicalFile, ReasoningBullet } from "@/types/clinical-types"
import { VoiceInputButton, VoiceStatus } from "@/components/voice-input-button"
import { useSpeechToText } from "@/hooks/use-speech-to-text"
import { MarkdownRenderer, StreamingMarkdownRenderer } from "@/components/markdown-renderer"
import { getAgentVisualConfig, getAgentVisualConfigSafe } from "@/config/agent-visual-config"
import { trackMessage } from "@/lib/sentry-metrics-tracker"
import { parseMarkdown } from "@/lib/markdown-parser"
import { toast } from "@/hooks/use-toast"
import { FileUploadButton } from "@/components/file-upload-button"
import { MessageFileAttachments } from "@/components/message-file-attachments"
import { getFilesByIds } from "@/lib/hopeai-system"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import * as Sentry from "@sentry/nextjs"
import type { TransitionState } from "@/hooks/use-hopeai-system"
import { ReasoningBullets } from "@/components/reasoning-bullets"
import type { ReasoningBulletsState } from "@/types/clinical-types"
import { useDisplayPreferences, getFontSizeClass, getMessageWidthClass, getMessageSpacingClass, getChatContainerWidthClass } from "@/providers/display-preferences-provider"
import { motion } from "framer-motion"

interface ChatInterfaceProps {
  activeAgent: AgentType
  isProcessing: boolean
  isUploading?: boolean
  currentSession: ChatState | null
  sendMessage: (message: string, useStreaming?: boolean, attachedFiles?: ClinicalFile[]) => Promise<any>
  uploadDocument: (file: File) => Promise<any>
  addStreamingResponseToHistory?: (
    responseContent: string,
    agent: AgentType,
    groundingUrls?: Array<{title: string, url: string, domain?: string}>,
    reasoningBulletsForThisResponse?: ReasoningBullet[]
  ) => Promise<void>
  pendingFiles?: ClinicalFile[]
  onRemoveFile?: (fileId: string) => void
  transitionState?: TransitionState
  routingInfo?: {
    detectedIntent: string
    targetAgent: AgentType
    confidence: number
    extractedEntities: any[]
  }
  onGenerateFichaClinica?: () => void
  onCancelFichaGeneration?: () => void
  onDiscardFicha?: () => void
  onOpenFichaClinica?: (tab?: "ficha" | "insights") => void
  onOpenPatientLibrary?: () => void
  hasExistingFicha?: boolean
  fichaLoading?: boolean
  generateLoading?: boolean
  canRevertFicha?: boolean
  reasoningBullets?: ReasoningBulletsState
}

// Configuración de agentes ahora centralizada en agent-visual-config.ts

// Componente para el botón deshabilitado de Ficha Clínica con tooltip
function FichaClinicaDisabledButton({ 
  onOpenPatientLibrary, 
  config 
}: { 
  onOpenPatientLibrary?: () => void
  config: any 
}) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window)
  }, [])

  return (
    <div 
      className="relative"
      onMouseEnter={() => !isTouchDevice && setShowTooltip(true)}
      onMouseLeave={() => !isTouchDevice && setShowTooltip(false)}
    >
      <Button
        size="icon"
        variant="ghost"
        className={cn(
          "h-10 md:h-12 px-3 w-auto", 
          config.ghostButton.hoverBg, 
          config.ghostButton.text,
          "opacity-50 cursor-not-allowed"
        )}
        disabled={true}
        onClick={() => isTouchDevice && setShowTooltip(!showTooltip)}
        onTouchStart={(e) => {
          e.preventDefault()
          setShowTooltip(!showTooltip)
        }}
        title="Crea o selecciona un paciente para acceder a la Ficha Clínica"
      >
        <span className="text-sm font-medium">Ficha Clínica</span>
      </Button>
      
      {/* Puente invisible para mantener hover activo en desktop */}
      {showTooltip && (
        <div className="hidden md:block absolute top-full left-0 right-0 h-3 z-40" />
      )}
      
      {/* Tooltip Popover */}
      {showTooltip && (
        <div 
          className="absolute bottom-full left-0 mb-0.5 z-50"
          onMouseEnter={() => !isTouchDevice && setShowTooltip(true)}
        >
          {/* Popover Card - Light Academia Palette con acento amarillo */}
          <div className="relative bg-card/95 backdrop-blur-2xl border-2 border-border/80 rounded-2xl shadow-[0_20px_70px_-10px_rgba(0,0,0,0.12)] w-[290px] sm:w-[310px] animate-in fade-in slide-in-from-bottom-3 zoom-in-95 duration-300 paper-noise">
            {/* Subtle warm overlay complementando el amarillo */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.02] via-transparent to-amber-600/[0.03] rounded-2xl pointer-events-none" />
            
            <div className="relative p-5">
              {/* Header con diseño académico */}
              <div className="flex items-start gap-3 mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-50/80 dark:bg-amber-900/20 ring-1 ring-amber-200/60 dark:ring-amber-700/40 shadow-sm">
                  <FileText className="h-5 w-5 text-amber-700 dark:text-amber-400" />
                </div>
                <div className="flex-1 pt-0.5">
                  <h3 className="text-base font-sans font-semibold tracking-tight text-foreground mb-0.5">
                    Documentación Clínica
                  </h3>
                  <p className="text-xs text-muted-foreground font-sans">
                    Requiere paciente activo
                  </p>
                </div>
              </div>
              
              {/* Divider sutil con tono cálido academia */}
              <div className="h-px bg-gradient-to-r from-transparent via-amber-200/40 dark:via-amber-700/30 to-transparent mb-4" />
              
              {/* Descripción */}
              <p className="text-[13px] text-muted-foreground font-sans leading-relaxed mb-5">
                Selecciona un paciente de tu biblioteca para acceder a herramientas de documentación clínica profesional
              </p>
              
              {/* Action button con verde sage academia */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowTooltip(false);
                  if (onOpenPatientLibrary) {
                    onOpenPatientLibrary();
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold rounded-xl bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 ring-1 ring-primary/30"
              >
                <User className="h-3.5 w-3.5 text-white" />
                <span className="tracking-wide">Abrir Biblioteca de Pacientes</span>
                <ChevronRight className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
            
            {/* Arrow mejorada para desktop con colores academia */}
            <div className="hidden md:block absolute top-full left-6 w-0 h-0 border-l-[7px] border-r-[7px] border-t-[7px] border-l-transparent border-r-transparent border-t-border"></div>
            <div className="hidden md:block absolute top-full left-6 w-0 h-0 border-l-[7px] border-r-[7px] border-t-[7px] border-l-transparent border-r-transparent border-t-card/95 translate-y-[-1px]"></div>
          </div>
        </div>
      )}
    </div>
  )
}

export function ChatInterface({ activeAgent, isProcessing, isUploading = false, currentSession, sendMessage, uploadDocument, addStreamingResponseToHistory, pendingFiles = [], onRemoveFile, transitionState = 'idle', routingInfo, onGenerateFichaClinica, onCancelFichaGeneration, onDiscardFicha, onOpenFichaClinica, onOpenPatientLibrary, hasExistingFicha = false, fichaLoading = false, generateLoading = false, canRevertFicha = false, reasoningBullets }: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("")
  const [streamingResponse, setStreamingResponse] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [forceUpdate, setForceUpdate] = useState(0)
  const [autoScroll, setAutoScroll] = useState(true)
  const [visibleMessageCount, setVisibleMessageCount] = useState(20)
  const [streamingGroundingUrls, setStreamingGroundingUrls] = useState<Array<{title: string, url: string, domain?: string}>>([])  
  const [messageFiles, setMessageFiles] = useState<Record<string, ClinicalFile[]>>({})
  const [isInputExpanded, setIsInputExpanded] = useState(false)
  const [capabilityIndex, setCapabilityIndex] = useState(0)
  const [typedHint, setTypedHint] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [viewportInset, setViewportInset] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [previewAgent, setPreviewAgent] = useState<AgentType | null>(null)
  // Collapse states for reasoning bullets
  const [areBulletsCollapsed, setAreBulletsCollapsed] = useState(false)
  const [collapsedMessageBullets, setCollapsedMessageBullets] = useState<Record<string, boolean>>({})
  const [shouldScrollOnce, setShouldScrollOnce] = useState(false)

  const toggleExternalBullets = () => setAreBulletsCollapsed(prev => !prev)
  const toggleMessageBullets = (id: string) => setCollapsedMessageBullets(prev => ({ ...prev, [id]: !prev[id] }))
  
  // Hook para preferencias de visualización
  const { preferences } = useDisplayPreferences()
  const fontSizeClass = getFontSizeClass(preferences.fontSize)
  const messageWidthClass = getMessageWidthClass(preferences.messageWidth)
  const messageSpacingClass = getMessageSpacingClass(preferences.messageSpacing)
  const chatContainerWidthClass = getChatContainerWidthClass(preferences.messageWidth)
  
  // AUTO-COLAPSAR bullets INMEDIATAMENTE cuando comienza el streaming
  // y RESETEAR cuando termina para el siguiente mensaje
  useEffect(() => {
    if (isStreaming) {
      setAreBulletsCollapsed(true)
    } else {
      // Reset para que el siguiente mensaje muestre bullets expandidos inicialmente
      setAreBulletsCollapsed(false)
    }
  }, [isStreaming])
  // Snapshot of reasoning bullets for current streaming response
  const bulletsSnapshotRef = useRef<ReasoningBullet[]>([])
  
  // Hook para speech-to-text
  const { isListening, interimTranscript, error: speechError} = useSpeechToText({
    language: 'es-ES'
  })

  // Load files for messages with fileReferences
  useEffect(() => {
    const loadMessageFiles = async () => {
      const newMessageFiles: Record<string, ClinicalFile[]> = {}
      
      for (const message of currentSession?.history || []) {
        if (message.fileReferences && message.fileReferences.length > 0) {
          try {
            const files = await getFilesByIds(message.fileReferences)
            if (files.length > 0) {
              newMessageFiles[message.id] = files
            }
          } catch (error) {
            console.error('Error loading files for message:', message.id, error)
          }
        }
      }
      
      setMessageFiles(newMessageFiles)
    }

    loadMessageFiles()
  }, [currentSession?.history])

  // Keep snapshot of reasoning bullets during streaming cycle
  useEffect(() => {
    if (isStreaming && reasoningBullets && reasoningBullets.bullets) {
      bulletsSnapshotRef.current = [...reasoningBullets.bullets]
    }
  }, [isStreaming, reasoningBullets?.bullets])

  // Default-collapse reasoning inside the freshly added model message (post-stream commit)
  useEffect(() => {
    const last = currentSession?.history && currentSession.history[currentSession.history.length - 1]
    if (!last) return
    if (last.role === 'model' && last.reasoningBullets && last.reasoningBullets.length > 0) {
      setCollapsedMessageBullets(prev => (prev[last.id] === undefined ? { ...prev, [last.id]: true } : prev))
    }
  }, [currentSession?.history?.length])

  // Auto-scroll ÚNICO cuando el usuario envía un mensaje
  // Solo se activa una vez por mensaje del usuario, no bloquea al usuario durante el streaming
  useEffect(() => {
    if (shouldScrollOnce) {
      // Usar requestAnimationFrame para asegurar que el DOM se actualizó
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      })
      setShouldScrollOnce(false)
    }
  }, [shouldScrollOnce])

  // NO hacer auto-scroll automático durante streaming - el usuario tiene control total del scroll
  // Botón flotante "Ir al final" disponible cuando el usuario no está al fondo

  // Auto-resize textarea when input value changes
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const maxHeight = isInputExpanded ? 400 : 200
      const newHeight = Math.min(textarea.scrollHeight, maxHeight)
      textarea.style.height = `${newHeight}px`
    }
  }, [inputValue, isInputExpanded])

  // Detect on-screen keyboard via VisualViewport to adjust bottom padding precisely
  useEffect(() => {
    const vv: any = (window as any).visualViewport
    if (!vv) return
    const handler = () => {
      const vh = window.innerHeight
      const inset = Math.max(0, vh - vv.height - (vv.offsetTop || 0))
      setViewportInset(inset)
    }
    handler()
    vv.addEventListener('resize', handler)
    vv.addEventListener('scroll', handler)
    return () => {
      vv.removeEventListener('resize', handler)
      vv.removeEventListener('scroll', handler)
    }
  }, [])

  // Minimal, unobtrusive rotating capability hint for new sessions
  const capabilityHints = [
    // Documentación clínica estructurada - Muestra organización y síntesis profesional
    '"Sintetiza: sesión inicial, ansiedad, 25 años."',
    '"Crea una nota SOAP: progreso depresión."',
    '"Estructura plan de tratamiento para TEPT."',
    // Investigación académica basada en evidencia - Demuestra búsqueda y validación científica
    '"Investigación: EMDR vs exposición para trauma."',
    '"Meta-análisis sobre mindfulness en depresión."',
    '"Estudios recientes: TCC para trastorno bipolar."',
    // Exploración socrática reflexiva - Demuestra análisis profundo y preguntas reflexivas
    '"Analiza este patrón: paciente evita hablar."',
    '"¿Qué revela mi frustración mi paciente?"',
    '"Explora hipótesis: apego ansioso en adolescente."'
  ]

  useEffect(() => {
    const isNewSession = !currentSession?.history || currentSession.history.length === 0
    if (!isNewSession) return
    if (inputValue.trim()) return

    const fullText = capabilityHints[capabilityIndex]
    let timeoutId: any

    if (!isDeleting) {
      if (typedHint.length < fullText.length) {
        timeoutId = setTimeout(() => {
          setTypedHint(fullText.slice(0, typedHint.length + 1))
        }, 20)
      } else {
        // Calm pause: double the previous pulse total (~2.4s * 2 = ~4.8s)
        timeoutId = setTimeout(() => setIsDeleting(true), 4800)
      }
    } else {
      if (typedHint.length > 0) {
        timeoutId = setTimeout(() => {
          setTypedHint(fullText.slice(0, typedHint.length - 1))
        }, 6)
      } else {
        setIsDeleting(false)
        setCapabilityIndex((i) => (i + 1) % capabilityHints.length)
      }
    }

    return () => clearTimeout(timeoutId)
  }, [capabilityIndex, typedHint, isDeleting, currentSession?.history, inputValue])

  // Manejar scroll manual para detectar si el usuario está en el fondo
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget
    const { scrollTop, scrollHeight, clientHeight } = target
    const isAtBottom = scrollHeight - scrollTop <= clientHeight + 50
    const isAtTop = scrollTop < 100
    
    setAutoScroll(isAtBottom)
    
    // Cargar más mensajes cuando se llega al top
    if (isAtTop && currentSession?.history && visibleMessageCount < currentSession.history.length) {
      setVisibleMessageCount(prev => Math.min(prev + 10, currentSession.history?.length || 0))
    }
  }



  // Función para ir al final de la conversación
  const scrollToBottom = () => {
    setAutoScroll(true)
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = async (explicitMessage?: string) => {
    console.log('🔄 Frontend: Iniciando envío de mensaje...', {
      hasInput: !!inputValue.trim(),
      hasSession: !!currentSession,
      sessionId: currentSession?.sessionId,
      pendingFilesCount: pendingFiles.length
    })
    
    const messageToSend = (explicitMessage ?? inputValue).trim()
    if (!messageToSend) {
      console.log('❌ Frontend: Envío cancelado - falta input o sesión')
      return
    }

    const message = messageToSend
    
    // Limpiar input y preparar UI para streaming
    setInputValue("")
    setIsStreaming(true)
    bulletsSnapshotRef.current = []
    setStreamingResponse("")
    
    // Activar scroll único para mostrar el mensaje del usuario
    setShouldScrollOnce(true)

    console.log('📤 Frontend: Enviando mensaje:', message.substring(0, 50) + '...')

    // Instrumentación Sentry para envío de mensaje desde UI
    return Sentry.startSpan(
      {
        op: "message.ui.send",
        name: "Send Message from Chat Interface",
      },
      async (span) => {
        const startTime = Date.now()
        
        try {
          span.setAttribute("message.length", message.length)
          span.setAttribute("message.agent", activeAgent)
          span.setAttribute("session.id", currentSession?.sessionId)
          span.setAttribute("session.message_count", currentSession?.history?.length || 0)
          span.setAttribute("ui.streaming_enabled", true)
          
          // Tracking de mensaje enviado
          trackMessage({
            agentType: activeAgent,
            messageLength: message.length,
            responseTime: 0, // Se actualizará cuando llegue la respuesta
            isStreaming: true
          })
          
          // CRITICAL: Capturar archivos adjuntos antes del envío para mostrar en historial
          const attachedFilesForMessage = [...pendingFiles]
          
          const response = await sendMessage(message, true, attachedFilesForMessage)
          
          // ARCHITECTURAL FIX: Limpiar estado visual inmediatamente después del envío exitoso
          // Los archivos ya están en el contexto de sesión, no necesitamos mostrarlos más en UI
          console.log('🧹 Frontend: Limpiando estado visual de archivos adjuntos post-envío')
          
          const responseTime = Date.now() - startTime
          
          span.setAttribute("message.response_time", responseTime)
          span.setAttribute("response.received", true)
          
          console.log('✅ Frontend: Respuesta recibida:', response)
          console.log('📊 Frontend: Estado de sesión actual:', currentSession?.history?.length, 'mensajes')

          // Verificar si la respuesta tiene un AsyncGenerator (streaming)
          if (response && typeof response[Symbol.asyncIterator] === 'function') {
            console.log('🔄 Frontend: Procesando respuesta streaming...')
            
            // Extraer routingInfo si está disponible
            if (response.routingInfo) {
              console.log('🧠 Frontend: Información de enrutamiento extraída:', response.routingInfo)
              span.setAttribute("routing.target_agent", response.routingInfo.targetAgent)
              span.setAttribute("routing.confidence", response.routingInfo.confidence || 0)
            }
            
            let fullResponse = ""
            let accumulatedGroundingUrls: Array<{title: string, url: string, domain?: string}> = []
            let chunkCount = 0
            const streamingStartTime = Date.now()
            
            try {
              for await (const chunk of response) {
                chunkCount++
                if (chunk.text) {
                  fullResponse += chunk.text
                  setStreamingResponse(fullResponse)
                }
                // Capturar groundingUrls de los chunks
                if (chunk.groundingUrls && chunk.groundingUrls.length > 0) {
                  accumulatedGroundingUrls = [...accumulatedGroundingUrls, ...chunk.groundingUrls]
                  setStreamingGroundingUrls(accumulatedGroundingUrls)
                }
              }
              
              const streamingDuration = Date.now() - streamingStartTime
              
              // Métricas de streaming
              span.setAttribute("streaming.chunk_count", chunkCount)
              span.setAttribute("streaming.duration", streamingDuration)
              span.setAttribute("streaming.response_length", fullResponse.length)
              span.setAttribute("streaming.grounding_urls_count", accumulatedGroundingUrls.length)
              
              // Tracking adicional de mensaje con métricas de streaming
              trackMessage({
                agentType: response?.routingInfo?.targetAgent || activeAgent,
                messageLength: fullResponse.length,
                responseTime: responseTime,
                isStreaming: true,
                chunkCount,
                groundingUrlsCount: accumulatedGroundingUrls.length
              })
              
              console.log('✅ Frontend: Streaming completado')
              
              // Agregar la respuesta completa al historial
              if (fullResponse.trim() && addStreamingResponseToHistory) {
                try {
                  // Usar el agente de la información de enrutamiento si está disponible,
                  // de lo contrario usar el agente activo actual
                  const responseAgent = response?.routingInfo?.targetAgent || activeAgent
                  await addStreamingResponseToHistory(fullResponse, responseAgent, accumulatedGroundingUrls, bulletsSnapshotRef.current)
                  console.log('✅ Frontend: Respuesta agregada al historial con agente:', responseAgent)
                } catch (historyError) {
                  console.error('❌ Frontend: Error agregando al historial:', historyError)
                  Sentry.captureException(historyError)
                }
              }
              
              setStreamingResponse("")
              setStreamingGroundingUrls([])
              setIsStreaming(false)
              span.setStatus({ code: 1, message: "Streaming completed successfully" })
            } catch (streamError) {
              console.error('❌ Frontend: Error en streaming:', streamError)
              span.setStatus({ code: 2, message: "Streaming failed" })
              Sentry.captureException(streamError)
              setIsStreaming(false)
              setStreamingResponse("")
            }
          } else if (response && response.text) {
            // Respuesta no streaming o respuesta con function calls procesadas
            console.log('✅ Frontend: Respuesta con texto recibida:', response.text.substring(0, 100) + '...')
            
            span.setAttribute("response.type", "non_streaming")
            span.setAttribute("response.length", response.text.length)
            span.setAttribute("response.grounding_urls_count", response.groundingUrls?.length || 0)
            
            // Si hay function calls, mostrar información adicional
            if (response.functionCalls) {
              console.log('🔧 Frontend: Function calls detectadas:', response.functionCalls.length)
              span.setAttribute("response.function_calls_count", response.functionCalls.length)
            }
            
            // Tracking de mensaje no streaming
            trackMessage({
              agentType: response?.routingInfo?.targetAgent || activeAgent,
              messageLength: response.text.length,
              responseTime: responseTime,
              isStreaming: false,
              groundingUrlsCount: response.groundingUrls?.length || 0,
              functionCallsCount: response.functionCalls?.length || 0
            })
            
            // Agregar la respuesta al historial
            if (response.text.trim() && addStreamingResponseToHistory) {
              try {
                // Usar el agente de la información de enrutamiento si está disponible,
                // de lo contrario usar el agente activo actual
                const responseAgent = response?.routingInfo?.targetAgent || activeAgent
                await addStreamingResponseToHistory(response.text, responseAgent, response.groundingUrls || [])
                console.log('✅ Frontend: Respuesta agregada al historial con agente:', responseAgent)
              } catch (historyError) {
                console.error('❌ Frontend: Error agregando al historial:', historyError)
                Sentry.captureException(historyError)
              }
            }
            
            setIsStreaming(false)
            span.setStatus({ code: 1, message: "Non-streaming response processed successfully" })
          } else {
            console.log('⚠️ Frontend: Respuesta inesperada o nula:', response)
            span.setAttribute("response.type", "unexpected")
            span.setStatus({ code: 2, message: "Unexpected or null response" })
            setIsStreaming(false)
          }
        } catch (error) {
          console.error("❌ Frontend: Error sending message:", error)
          span.setStatus({ code: 2, message: "Message send failed" })
          Sentry.captureException(error)
          setIsStreaming(false)
          setStreamingResponse("")
        }
      }
    )
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      try {
        await uploadDocument(file)
      } catch (error) {
        console.error("Error uploading file:", error)
      }
    }
  }

  // Manejar transcripción de voz
  const handleVoiceTranscript = (transcript: string) => {
    setInputValue(prev => {
      const newValue = prev.trim() ? `${prev} ${transcript}` : transcript
      return newValue
    })
  }

  // (removed quick-start tips handler; capabilities are now informational only)

  const handleSelectHint = () => {
    const fullText = capabilityHints[capabilityIndex]
    const cleaned = fullText.replace(/^"(.*)"$/, '$1')
    setInputValue(cleaned)
    requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (textarea) {
        textarea.focus()
        const len = cleaned.length
        textarea.setSelectionRange(len, len)
      }
    })
  }

  const copyMessageContent = async (markdownContent: string, messageId?: string) => {
    const htmlContent = parseMarkdown(markdownContent)

    const fallbackCopyPlainText = (text: string): boolean => {
      try {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.top = '0'
        textarea.style.left = '0'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        const successful = document.execCommand('copy')
        document.body.removeChild(textarea)
        return successful
      } catch {
        return false
      }
    }

    let copied = false
    try {
      const clipboard: any = (navigator as any).clipboard
      const ClipboardItemCtor: any = (window as any).ClipboardItem
      if (clipboard && typeof clipboard.write === 'function' && ClipboardItemCtor) {
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' })
        const textBlob = new Blob([markdownContent], { type: 'text/plain' })
        const item = new ClipboardItemCtor({ 'text/html': htmlBlob, 'text/plain': textBlob })
        await clipboard.write([item])
        copied = true
      }
    } catch {
      // ignore and try next method
    }

    if (!copied) {
      try {
        await navigator.clipboard.writeText(markdownContent)
        copied = true
      } catch {
        // fallback for iOS Safari and older browsers
        copied = fallbackCopyPlainText(markdownContent)
      }
    }

    if (copied && messageId) {
      setCopiedMessageId(messageId)
      setTimeout(() => setCopiedMessageId((id) => (id === messageId ? null : id)), 1500)
    }
  }

  // Available agents for cycling
  const availableAgents: AgentType[] = ["socratico", "clinico", "academico", "orquestador"]
  
  // Cycle to next agent for preview
  const cycleToNextAgent = () => {
    const currentIndex = availableAgents.indexOf(previewAgent || activeAgent)
    const nextIndex = (currentIndex + 1) % availableAgents.length
    setPreviewAgent(availableAgents[nextIndex])
  }

  // Reset preview when tooltip is hidden
  const resetPreview = () => {
    setPreviewAgent(null)
  }

  // Badge always shows active agent, only tooltip shows preview
  const config = getAgentVisualConfig(activeAgent)
  const IconComponent = config.icon
  
  // Tooltip shows preview agent or active agent
  const tooltipAgent = previewAgent || activeAgent
  const tooltipConfig = getAgentVisualConfig(tooltipAgent)
  const TooltipIconComponent = tooltipConfig.icon
  
  // Determine if the latest model message already contains persisted reasoning bullets
  const lastHistoryMessage = currentSession?.history && currentSession.history.length > 0
    ? currentSession.history[currentSession.history.length - 1]
    : undefined
  const lastModelMessageHasBullets = !!(
    lastHistoryMessage &&
    lastHistoryMessage.role === 'model' &&
    lastHistoryMessage.reasoningBullets &&
    lastHistoryMessage.reasoningBullets.length > 0
  )

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden font-sans paper-noise">
      <ScrollArea
        className={cn("flex-1 pt-0 overscroll-contain")}
        style={{
          paddingBottom:
            (isInputFocused || viewportInset > 20)
              ? `calc(env(safe-area-inset-bottom) + ${Math.min(120, viewportInset + 12)}px)`
              : `calc(env(safe-area-inset-bottom) + 4px)`
        }}
        onScrollCapture={handleScroll}
      >
        <div className={cn("w-full mx-auto h-full flex flex-col space-y-4 md:space-y-8 pt-1 md:pt-2", chatContainerWidthClass)}>
          {/* Indicador de mensajes anteriores */}
          {currentSession?.history && currentSession.history.length > visibleMessageCount && (
            <div className="text-center py-2">
              <div className="text-sm text-muted-foreground bg-secondary/50 rounded-lg p-2">
                Mostrando {visibleMessageCount} de {currentSession.history.length} mensajes
                <br />
                <span className="text-xs">Desplázate hacia arriba para cargar más</span>
              </div>
            </div>
          )}

          {/* Welcome greeting with minimal rotating capability hint */}
          {(!currentSession?.history || currentSession.history.length === 0) && (
            <div className="flex-1 min-h-[55svh] md:min-h-[65svh] animate-in fade-in duration-700 ease-out flex flex-col items-center justify-center text-center color-fragment px-2">
              <h1 className="font-sans text-5xl md:text-6xl tracking-tight text-foreground">
                Sistema de Asistencia Clínica
              </h1>
              <div className="mt-8 md:mt-12 flex items-center gap-2 text-sm font-sans max-w-xl animate-in fade-in duration-500 ease-out h-5">
                <p
                  className="text-muted-foreground cursor-pointer hover:underline underline-offset-4 decoration-muted-foreground/50 hover:text-foreground transition-colors duration-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-border rounded-sm px-0.5"
                  role="button"
                  tabIndex={0}
                  onClick={handleSelectHint}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectHint() } }}
                  title="Usar este ejemplo"
                >
                  {typedHint || '\u00A0'}
                </p>
                {typedHint && (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center h-6 w-6 rounded-md hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors transition-transform active:scale-95 select-none"
                    onClick={handleSelectHint}
                    aria-label="Usar este ejemplo"
                    title="Usar este ejemplo"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Chat History - Solo mensajes visibles */}
          {currentSession?.history?.slice(-visibleMessageCount).map((message, index) => {
            // Usar la configuración del agente que generó el mensaje, no el agente activo
            const messageAgentConfig = getAgentVisualConfigSafe(message.agent);
            const MessageIconComponent = messageAgentConfig.icon;
            const isFirstMessage = index === 0;
            
            return (
              <div key={message.id} className={cn(
                "flex items-start gap-4",
                message.role === "user" ? "justify-end" : "justify-start",
                isFirstMessage ? "pt-6" : messageSpacingClass
              )}>
                {/* Desktop: Icon outside message, Mobile: Icon inside message corner */}
                {message.role === "model" && (
                  <div className={cn("hidden sm:flex w-8 h-8 rounded-full items-center justify-center flex-shrink-0 mt-1 border", messageAgentConfig.bgColor, messageAgentConfig.borderColor)}>
                    <MessageIconComponent className={cn("h-4 w-4", messageAgentConfig.textColor)} />
                  </div>
                )}

                <div
                  className={cn(
                    "relative rounded-lg border ring-1 ring-transparent overflow-visible",
                    messageWidthClass,
                    fontSizeClass,
                    message.role === "user"
                      ? "text-[hsl(var(--user-bubble-text))] bg-[hsl(var(--user-bubble-bg))] border-[hsl(var(--user-bubble-bg))] shadow-[0_3px_12px_rgba(0,0,0,0.12)]"
                      : `${messageAgentConfig.bgColor} ${messageAgentConfig.borderColor}`,
                  )}
                >
                  {/* Mobile: Agent icon in corner */}
                  {message.role === "model" && (
                    <div className={cn("mobile-icon-corner mobile-icon-left absolute -top-2.5 -left-2.5 sm:hidden w-5 h-5 rounded-full flex items-center justify-center border-2 border-background shadow-sm z-10", messageAgentConfig.bgColor, messageAgentConfig.borderColor)}>
                      <MessageIconComponent className={cn("h-2.5 w-2.5", messageAgentConfig.textColor)} />
                    </div>
                  )}
                  
                  {/* Mobile: User icon in corner */}
                  {message.role === "user" && (
                    <div className="mobile-icon-corner mobile-icon-right absolute -top-2.5 -right-2.5 sm:hidden w-5 h-5 rounded-full flex items-center justify-center border-2 border-background bg-primary dark:bg-emerald-600 shadow-sm z-10">
                      <User className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                  {/* Agent Context Header for AI responses */}
                  {message.role === "model" && (
                    <div className="px-3 md:px-4 pt-3 pb-2 border-b border-border/50">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={cn("text-sm font-semibold font-sans tracking-wide", messageAgentConfig.textColor)}>
                          {message.agent === 'socratico' && 'Análisis Psicoterapéutico'}
                    {message.agent === 'clinico' && 'Documentación Clínica Especializada'}
                          {message.agent === 'academico' && 'Revisión de Literatura Científica'}
                          {message.agent === 'orquestador' && 'Sistema de Coordinación'}
                          {!message.agent && 'Sistema de Coordinación'}
                        </span>
                        {message.reasoningBullets && message.reasoningBullets.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleMessageBullets(message.id)}
                            className="inline-flex items-center justify-center h-7 px-2 text-xs rounded-md hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={collapsedMessageBullets[message.id] ? 'Expandir razonamiento' : 'Colapsar razonamiento'}
                            title={collapsedMessageBullets[message.id] ? 'Mostrar razonamiento' : 'Ocultar razonamiento'}
                          >
                            {collapsedMessageBullets[message.id] ? 'Mostrar razonamiento' : 'Ocultar razonamiento'}
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                        {message.agent === 'socratico' && 'Análisis de proceso terapéutico y formulación de caso'}
                        {message.agent === 'clinico' && 'Elaboración de documentación con estándares clínicos'}
                        {message.agent === 'academico' && 'Integración de evidencia empírica y literatura revisada por pares'}
                        {message.agent === 'orquestador' && 'Sistema de coordinación multi-agente'}
                        {!message.agent && 'Respuesta del sistema'}
                      </p>
                    </div>
                  )}
                  {/* Reasoning bullets at the top of AI message with per-message collapse */}
                  {message.role === 'model' && message.reasoningBullets && message.reasoningBullets.length > 0 && !collapsedMessageBullets[message.id] && (
                    <div className="p-3 md:p-4">
                      <ReasoningBullets 
                        bullets={message.reasoningBullets}
                        isGenerating={false}
                        showHeader={false}
                        className="text-sm"
                      />
                    </div>
                  )}
                  <div className="p-3 md:p-4">
                    <MarkdownRenderer 
                      content={message.content}
                      className="leading-relaxed"
                      trusted={message.role === "model"}
                    />
                  </div>
                  {/* Mostrar archivos adjuntos si existen */}
                  {messageFiles[message.id] && messageFiles[message.id].length > 0 && (
                        <div className="p-3 md:p-4 border-t border-border/80">
                          <MessageFileAttachments 
                            files={messageFiles[message.id]} 
                            variant="compact"
                            isUserMessage={message.role === 'user'}
                          />
                        </div>
                      )}
                  {/* Mostrar referencias de grounding si existen */}
                  {message.groundingUrls && message.groundingUrls.length > 0 && (
                    <div className="p-3 md:p-4 border-t border-border/80">
                      <div className="text-xs font-sans font-medium text-muted-foreground mb-2">Referencias:</div>
                      <div className="space-y-1">
                        {message.groundingUrls.map((ref, index) => (
                          <div key={index} className="text-sm font-sans break-words overflow-hidden">
                            <a 
                              href={ref.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline break-words hyphens-auto"
                              style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                            >
                              {ref.title}
                            </a>
                            {ref.domain && (
                              <span className="text-muted-foreground ml-1 break-words">({ref.domain})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Copy to clipboard for AI messages */}
                  {message.role === 'model' && (
                    <div className="p-2 md:p-3 border-t border-border/80">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => copyMessageContent(message.content, message.id)}
                          className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors transition-transform active:scale-95 select-none touch-manipulation"
                          aria-label="Copiar contenido"
                          title="Copiar contenido"
                        >
                          {copiedMessageId === message.id ? (
                            <Check className="h-4 w-4 text-green-600 animate-in fade-in zoom-in-50 duration-150" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => { toast({ description: "Gracias por tu feedback." }); }}
                          className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors transition-transform active:scale-95 select-none touch-manipulation"
                          aria-label="Me gusta"
                          title="Me gusta"
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { toast({ description: "Gracias por tu feedback." }); }}
                          className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors transition-transform active:scale-95 select-none touch-manipulation"
                          aria-label="No me gusta"
                          title="No me gusta"
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {message.role === "user" && (
                  <div className="hidden sm:flex w-8 h-8 rounded-full bg-[hsl(var(--user-bubble-bg))] items-center justify-center flex-shrink-0 mt-1 shadow-[0_3px_12px_rgba(0,0,0,0.12)]">
                    <User className="h-4 w-4 text-[hsl(var(--user-bubble-text))]" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Streaming Response - aparece inmediatamente cuando comienza isStreaming */}
          {isStreaming && (() => {
            // 🎯 DETERMINAR EL AGENTE REAL que está respondiendo
            const realAgent = routingInfo?.targetAgent || activeAgent
            const realConfig = getAgentVisualConfig(realAgent)
            const RealIconComponent = realConfig.icon
            
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className={cn("flex items-start gap-4", messageSpacingClass)}
              >
                {/* Desktop: Icon outside message - USA AGENTE REAL CON ANIMACIÓN */}
                <motion.div 
                  key={`desktop-icon-${realAgent}`}
                  initial={{ scale: 0.8, rotate: -15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className={cn("hidden sm:flex w-8 h-8 rounded-full items-center justify-center flex-shrink-0 mt-1 border", realConfig.bgColor, realConfig.borderColor)}
                >
                  <RealIconComponent className={cn("h-4 w-4 transition-colors duration-300", realConfig.textColor)} />
                </motion.div>
                <motion.div 
                  animate={{
                    borderColor: realConfig.borderColor,
                    backgroundColor: realConfig.bgColor
                  }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                  className={cn("relative rounded-lg border", messageWidthClass, fontSizeClass, realConfig.bgColor, realConfig.borderColor)}
                >
                  {/* Mobile: Agent icon in corner - USA AGENTE REAL CON ANIMACIÓN */}
                  <motion.div 
                    key={`mobile-icon-${realAgent}`}
                    initial={{ scale: 0.6, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className={cn("mobile-icon-corner mobile-icon-left absolute -top-2 -left-2 sm:hidden w-6 h-6 rounded-full flex items-center justify-center border-2 border-background", realConfig.bgColor, realConfig.borderColor)}
                  >
                    <RealIconComponent className={cn("h-3 w-3 transition-colors duration-300", realConfig.textColor)} />
                  </motion.div>
                  {/* Agent Context Header - MUESTRA AGENTE REAL CON ANIMACIÓN */}
                  <div className="px-4 pt-3 pb-2 border-b border-border/50">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <motion.span 
                        key={`agent-name-${realAgent}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="text-sm font-semibold font-sans tracking-wide"
                      >
                        {realAgent === 'socratico' && 'Análisis Psicoterapéutico'}
                        {realAgent === 'clinico' && 'Documentación Clínica Especializada'}
                        {realAgent === 'academico' && 'Revisión de Literatura Científica'}
                        {realAgent === 'orquestador' && 'Sistema de Coordinación'}
                      </motion.span>
                      {reasoningBullets && reasoningBullets.bullets.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setAreBulletsCollapsed(prev => !prev)}
                          className="inline-flex items-center justify-center h-7 px-2 text-xs rounded-md hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={areBulletsCollapsed ? 'Expandir razonamiento' : 'Colapsar razonamiento'}
                          title={areBulletsCollapsed ? 'Mostrar razonamiento' : 'Ocultar razonamiento'}
                        >
                          {areBulletsCollapsed ? 'Mostrar Razonamiento' : 'Ocultar Razonamiento'}
                        </button>
                      )}
                    </div>
                    <motion.p 
                      key={`agent-desc-${realAgent}`}
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
                      className="text-xs text-muted-foreground font-sans leading-relaxed"
                    >
                      {realAgent === 'socratico' && 'Análisis de proceso terapéutico y formulación de caso'}
                      {realAgent === 'clinico' && 'Elaboración de documentación con estándares clínicos'}
                      {realAgent === 'academico' && 'Integración de evidencia empírica y literatura revisada por pares'}
                      {realAgent === 'orquestador' && 'Sistema de coordinación multi-agente'}
                    </motion.p>
                  </div>
                {/* Reasoning Bullets DENTRO de la burbuja de streaming */}
                {reasoningBullets && reasoningBullets.bullets.length > 0 && !areBulletsCollapsed && (
                  <div className="px-4 pt-4 pb-2">
                    <ReasoningBullets
                      bullets={reasoningBullets.bullets}
                      isGenerating={reasoningBullets.isGenerating}
                      className="w-full"
                      showHeader={false}
                    />
                  </div>
                )}
                {/* Indicador clínico contextual - refleja el proceso REAL según transitionState CON ANIMACIONES */}
                {!streamingResponse && (() => {
                  // Determinar el agente que REALMENTE está respondiendo
                  const respondingAgent = routingInfo?.targetAgent || activeAgent
                  
                  // Mensajes contextuales según la fase real del proceso
                  let statusMessage = ''
                  let statusKey = ''
                  
                  if (transitionState === 'thinking' || transitionState === 'selecting_agent') {
                    statusMessage = 'Evaluando consulta y determinando modalidad de análisis...'
                    statusKey = 'selecting'
                  } else if (transitionState === 'specialist_responding') {
                    // Mostrar el agente que REALMENTE fue seleccionado - mensaje genérico
                    if (respondingAgent === 'socratico') {
                      statusMessage = 'procesando análisis...'
                      statusKey = 'socratico-responding'
                    } else if (respondingAgent === 'clinico') {
                      statusMessage = 'procesando análisis...'
                      statusKey = 'clinico-responding'
                    } else if (respondingAgent === 'academico') {
                      statusMessage = 'procesando análisis...'
                      statusKey = 'academico-responding'
                    } else {
                      statusMessage = 'procesando análisis...'
                      statusKey = 'preparing'
                    }
                  } else {
                    statusMessage = 'Inicializando sistema...'
                    statusKey = 'idle'
                  }
                  
                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="p-4 flex items-center gap-3 text-muted-foreground/80"
                    >
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ 
                          duration: 1.2, 
                          repeat: Infinity, 
                          ease: "linear" 
                        }}
                        className="relative flex items-center justify-center w-5 h-5"
                      >
                        <div className="absolute w-full h-full rounded-full border-2 border-muted-foreground/20"></div>
                        <div className="absolute w-full h-full rounded-full border-2 border-t-muted-foreground/60"></div>
                      </motion.div>
                      <motion.span 
                        key={statusKey}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="text-sm font-sans"
                      >
                        {statusMessage}
                      </motion.span>
                    </motion.div>
                  )
                })()}
                {/* Contenido de streaming - solo cuando hay texto */}
                {streamingResponse && (
                  <div className="p-4">
                    <StreamingMarkdownRenderer
                      content={streamingResponse}
                      className="text-base leading-relaxed"
                      showTypingIndicator={true}
                    />
                  </div>
                )}
                {streamingGroundingUrls && streamingGroundingUrls.length > 0 && (
                  <div className="mx-4 mb-4 pt-3 border-t border-border/80 animate-in fade-in duration-300 ease-out">
                    <div className="text-xs font-sans font-medium text-muted-foreground mb-2">Referencias:</div>
                    <div className="space-y-1">
                      {streamingGroundingUrls.map((ref, index) => (
                        <div key={index} className="text-sm font-sans animate-in fade-in duration-200 ease-out" style={{ animationDelay: `${index * 100}ms` }}>
                          <a 
                            href={ref.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {ref.title}
                          </a>
                          {ref.domain && (
                            <span className="text-muted-foreground ml-1">({ref.domain})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </motion.div>
              </motion.div>
            )
          })()}

          {/* Reasoning Bullets EXTERNOS - Solo cuando NO hay streaming activo CON ANIMACIÓN */}
          {!isStreaming && reasoningBullets && (
            reasoningBullets.isGenerating || (reasoningBullets.bullets.length > 0 && !lastModelMessageHasBullets)
          ) && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex items-start gap-4 pt-4"
            >
              {/* Desktop: Icon outside message CON ANIMACIÓN */}
              <motion.div 
                initial={{ scale: 0.8, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={cn("hidden sm:flex w-8 h-8 rounded-full items-center justify-center flex-shrink-0 mt-1 border", config.bgColor, config.borderColor)}
              >
                <IconComponent className={cn("h-4 w-4 transition-colors duration-300", config.textColor)} />
              </motion.div>
              <motion.div 
                initial={{ scale: 0.98 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={cn("relative rounded-lg border", messageWidthClass, fontSizeClass, config.bgColor, config.borderColor)}
              >
                {/* Mobile: Agent icon in corner */}
                <div className={cn("mobile-icon-corner mobile-icon-left absolute -top-2 -left-2 sm:hidden w-6 h-6 rounded-full flex items-center justify-center border-2 border-background", config.bgColor, config.borderColor)}>
                  <IconComponent className={cn("h-3 w-3", config.textColor)} />
                </div>
                {/* Agent Context Header */}
                <div className="px-4 pt-3 pb-2 border-b border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold font-sans tracking-wide">
                      {activeAgent === 'socratico' && 'Análisis Psicoterapéutico'}
                  {activeAgent === 'clinico' && 'Documentación Clínica Especializada'}
                      {activeAgent === 'academico' && 'Revisión de Literatura Científica'}
                      {activeAgent === 'orquestador' && 'Sistema de Coordinación'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                    {activeAgent === 'socratico' && 'Análisis de proceso terapéutico y formulación de caso'}
                    {activeAgent === 'clinico' && 'Elaboración de documentación con estándares clínicos'}
                    {activeAgent === 'academico' && 'Integración de evidencia empírica y literatura revisada por pares'}
                    {activeAgent === 'orquestador' && 'Sistema de coordinación multi-agente'}
                  </p>
                </div>
                <div className="p-4">
                  <ReasoningBullets
                    bullets={reasoningBullets.bullets}
                    isGenerating={reasoningBullets.isGenerating}
                    className="w-full"
                    showHeader={false}
                  />
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Removed typing indicator; reasoning bullets serve as the only thinking indicator */}

          <div ref={messagesEndRef} />
        </div>

        {/* Botón flotante para ir al final - Siempre disponible cuando no está al fondo */}
        {!autoScroll && (
          <Button
            onClick={scrollToBottom}
            className={cn(
              "absolute bottom-32 right-4 md:right-8 rounded-full w-12 h-12 shadow-xl transition-all hover:scale-110",
              isStreaming && "ring-2 ring-primary/50 shadow-primary/20"
            )}
            size="icon"
            variant="default"
            title={isStreaming ? "Nuevo contenido - Ir al final" : "Ir al final de la conversación"}
          >
            <ChevronDown className="h-6 w-6" />
            {isStreaming && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-primary border-2 border-background"></span>
              </span>
            )}
          </Button>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="py-3 md:py-4 pt-1">
        {/* Ficha Clínica controls moved into input toolbar */}
        <div className={cn("w-full mx-auto", chatContainerWidthClass)}>
          <div className="relative">
            {/* Pending files compact bar (overlay above input, no extra bottom space) */}
            {pendingFiles.length > 0 && !isStreaming && (
              <div className="absolute -top-10 left-0 right-0 px-1 md:px-0">
                <div className="max-w-full overflow-x-auto no-scrollbar">
                  <div className="inline-flex items-center gap-2 bg-secondary/60 border border-border/80 rounded-lg px-2 py-1">
                    {pendingFiles.map((file) => (
                      <div key={file.id} className="flex items-center gap-1 text-[11px] font-sans bg-card/70 border border-border/70 rounded px-1.5 py-0.5 whitespace-nowrap">
                        <Paperclip className="h-3 w-3 text-muted-foreground" />
                        <span className="max-w-[140px] truncate">{file.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className={cn(
                "rounded-lg border bg-card transition-all",
                "border-border",
                config.focusWithinBorderColor
              )}>
              {/* Text Input Section */}
              <div className="relative">
                <Textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  placeholder="Escribe tu mensaje o pregunta..."
                  className="w-full min-h-[52px] resize-none border-0 bg-transparent px-3 md:px-4 py-3 md:pr-32 text-base placeholder:text-muted-foreground focus:ring-0 focus-visible:ring-0 font-sans"
                  rows={1}
                  disabled={isProcessing || isStreaming || isUploading}
                  style={{ 
                    boxShadow: 'none',
                  }}
                />
              </div>
              
              {/* Buttons Section - Both mobile and desktop: Full width row below input */}
              <div className="flex items-center justify-between gap-2 md:gap-3 px-3 pb-3 border-t border-border/50 pt-3">
                {/* Left side buttons (mobile) / All buttons (desktop) */}
                <div className="flex items-center gap-1.5 md:gap-2">
                  <FileUploadButton
                    onFilesSelected={(files) => {
                      // Append to pendingFiles visual list via parent state already provided
                      // No-op here; parent hook updates pendingFiles after uploadDocument
                    }}
                    uploadDocument={uploadDocument}
                    disabled={isProcessing || isStreaming || isUploading}
                    pendingFiles={pendingFiles}
                    onRemoveFile={onRemoveFile}
                    buttonClassName={cn(config.ghostButton.hoverBg, config.ghostButton.text)}
                  />

                  {(onOpenFichaClinica || onGenerateFichaClinica) ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className={cn(
                            "h-10 md:h-12 px-3 w-auto", 
                            config.ghostButton.hoverBg, 
                            config.ghostButton.text
                          )}
                          title="Ficha Clínica"
                        >
                          <span className="text-sm font-medium">Ficha Clínica</span>
                          {(fichaLoading || generateLoading) && (
                            <span className="absolute -top-1 -right-1 inline-flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                            </span>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 font-sans">
                        <DropdownMenuItem
                          disabled={!onOpenFichaClinica}
                          onSelect={() => { if (!fichaLoading) onOpenFichaClinica && onOpenFichaClinica("ficha") }}
                        >
                          {fichaLoading ? 'Abriendo…' : 'Ver Ficha Clínica'}
                        </DropdownMenuItem>
                        
                        <DropdownMenuItem
                          disabled={!onOpenFichaClinica}
                          onSelect={() => { if (!fichaLoading) onOpenFichaClinica && onOpenFichaClinica("insights") }}
                        >
                          Ver Análisis Longitudinal
                        </DropdownMenuItem>
                        
                        {generateLoading && (
                          <DropdownMenuItem
                            disabled={!onCancelFichaGeneration}
                            onSelect={() => { onCancelFichaGeneration && onCancelFichaGeneration() }}
                            className="text-red-600 focus:text-white"
                          >
                            ✋ Cancelar Generación
                          </DropdownMenuItem>
                        )}
                        
                        {canRevertFicha && !generateLoading && (
                          <DropdownMenuItem
                            disabled={!onDiscardFicha}
                            onSelect={() => { onDiscardFicha && onDiscardFicha() }}
                            className="text-orange-600 focus:text-white"
                          >
                            ↩️ Descartar y Volver a Anterior
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <FichaClinicaDisabledButton 
                      onOpenPatientLibrary={onOpenPatientLibrary}
                      config={config}
                    />
                  )}
                  
                </div>

                {/* Right side buttons (voice and send) */}
                <div className="flex items-center gap-1.5">
                  <VoiceInputButton
                    onTranscriptUpdate={handleVoiceTranscript}
                    disabled={isProcessing || isStreaming || isUploading}
                    size="lg"
                    variant="ghost"
                    language="es-ES"
                    className={cn("h-10 w-10 md:h-12 md:w-12", config.ghostButton.hoverBg, config.ghostButton.text)}
                    iconClassName={cn(config.ghostButton.text, 'group-hover:opacity-90 h-5 w-5')}
                  />
                  <Button
                    onClick={() => handleSendMessage()}
                    disabled={
                      !inputValue.trim() || 
                      isProcessing || 
                      isStreaming ||
                      isUploading ||
                      pendingFiles.some(file => 
                        (file as any).processingStatus && 
                        (file as any).processingStatus === 'processing'
                      )
                    }
                    size="icon"
                    className={cn("h-10 w-10 md:h-12 md:w-12", config.button.bg, config.button.hoverBg, config.button.text)}
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>

          </div>

          {/* Removed bottom pending files block to avoid extra space */}

          
        </div>
      </div>
      
      {/* Overlay de estado de voz para móviles */}
      <VoiceStatus 
        isListening={isListening}
        interimTranscript={interimTranscript}
        confidence={0}
        error={speechError}
      />
    </div>
  )
}
