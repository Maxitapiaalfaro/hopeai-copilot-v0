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
  onGenerateFichaClinica?: () => void
  onOpenFichaClinica?: () => void
  onOpenPatientLibrary?: () => void
  hasExistingFicha?: boolean
  fichaLoading?: boolean
  generateLoading?: boolean
  reasoningBullets?: ReasoningBulletsState
}

// Configuración de agentes ahora centralizada en agent-visual-config.ts

export function ChatInterface({ activeAgent, isProcessing, isUploading = false, currentSession, sendMessage, uploadDocument, addStreamingResponseToHistory, pendingFiles = [], onRemoveFile, transitionState = 'idle', onGenerateFichaClinica, onOpenFichaClinica, onOpenPatientLibrary, hasExistingFicha = false, fichaLoading = false, generateLoading = false, reasoningBullets }: ChatInterfaceProps) {
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

  const toggleExternalBullets = () => setAreBulletsCollapsed(prev => !prev)
  const toggleMessageBullets = (id: string) => setCollapsedMessageBullets(prev => ({ ...prev, [id]: !prev[id] }))
  // Snapshot of reasoning bullets for current streaming response
  const bulletsSnapshotRef = useRef<ReasoningBullet[]>([])
  
  // Hook para speech-to-text
  const { isListening, interimTranscript, error: speechError } = useSpeechToText({
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

  // Auto-scroll only when new content arrives (not on first render or welcome state)
  const prevHistoryLenRef = useRef<number>(0)
  useEffect(() => {
    const currentLen = currentSession?.history?.length || 0
    const hasNewMessage = currentLen > prevHistoryLenRef.current
    const hasStreaming = !!streamingResponse
    if (autoScroll && (hasNewMessage || hasStreaming)) {
      messagesEndRef.current?.scrollIntoView({ behavior: prevHistoryLenRef.current === 0 ? 'auto' : 'smooth' })
    }
    prevHistoryLenRef.current = currentLen
  }, [currentSession?.history?.length, streamingResponse, autoScroll])

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
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden font-serif paper-noise">
      <ScrollArea
        className={cn("flex-1 px-4 md:px-6 pt-0 overscroll-contain")}
        style={{
          paddingBottom:
            (isInputFocused || viewportInset > 20)
              ? `calc(env(safe-area-inset-bottom) + ${Math.min(120, viewportInset + 12)}px)`
              : `calc(env(safe-area-inset-bottom) + 4px)`
        }}
        onScrollCapture={handleScroll}
      >
        <div className="w-full md:max-w-3xl md:mx-auto h-full flex flex-col space-y-4 md:space-y-8 pt-1 md:pt-2">
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
              <h1 className="font-serif text-5xl md:text-6xl tracking-tight text-foreground">
                Bienvenido a HopeAI
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
              <div key={message.id} className={`flex items-start sm:gap-4 gap-0 sm:px-0 px-2 ${message.role === "user" ? "justify-end" : "justify-start"} ${isFirstMessage ? "pt-6" : "pt-4"}`}>
                {/* Desktop: Icon outside message, Mobile: Icon inside message corner */}
                {message.role === "model" && (
                  <div className={cn("hidden sm:flex w-8 h-8 rounded-full items-center justify-center flex-shrink-0 mt-1 border", messageAgentConfig.bgColor, messageAgentConfig.borderColor)}>
                    <MessageIconComponent className={cn("h-4 w-4", messageAgentConfig.textColor)} />
                  </div>
                )}

                <div
                  className={cn(
                    "relative max-w-[95%] sm:max-w-[80%] rounded-lg border ring-1 ring-transparent overflow-visible",
                    message.role === "user"
                      ? "text-[hsl(var(--user-bubble-text))] bg-[hsl(var(--user-bubble-bg))] border-[hsl(var(--user-bubble-bg))] shadow-[0_3px_12px_rgba(0,0,0,0.12)]"
                      : `${messageAgentConfig.bgColor} ${messageAgentConfig.borderColor}`,
                  )}
                >
                  {/* Mobile: Agent icon in corner */}
                  {message.role === "model" && (
                    <div className={cn("absolute -top-2.5 -left-2.5 sm:hidden w-5 h-5 rounded-full flex items-center justify-center border-2 border-background shadow-sm z-10", messageAgentConfig.bgColor, messageAgentConfig.borderColor)}>
                      <MessageIconComponent className={cn("h-2.5 w-2.5", messageAgentConfig.textColor)} />
                    </div>
                  )}
                  
                  {/* Mobile: User icon in corner */}
                  {message.role === "user" && (
                    <div className="absolute -top-2.5 -right-2.5 sm:hidden w-5 h-5 rounded-full flex items-center justify-center border-2 border-background bg-primary dark:bg-emerald-600 shadow-sm z-10">
                      <User className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                  {/* Agent Context Header for AI responses */}
                  {message.role === "model" && (
                    <div className="px-3 md:px-4 pt-3 pb-2 border-b border-border/50">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={cn("text-sm font-bold font-sans", messageAgentConfig.textColor)}>
                          {message.agent === 'socratico' && 'Supervisor Clínico'}
                    {message.agent === 'clinico' && 'Especialista en Documentación'}
                          {message.agent === 'academico' && 'Investigador Académico'}
                          {message.agent === 'orquestador' && 'HopeAI'}
                          {!message.agent && 'HopeAI'}
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
                      <p className="text-xs text-muted-foreground font-sans">
                        {message.agent === 'socratico' && 'Diálogo terapéutico y exploración reflexiva'}
                        {message.agent === 'clinico' && 'Documentación clínica y síntesis profesional'}
                        {message.agent === 'academico' && 'Investigación científica y evidencia académica'}
                        {message.agent === 'orquestador' && 'Asistente principal coordinando respuesta'}
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
                      className="text-base leading-relaxed"
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

          {/* Streaming Response */}
          {isStreaming && streamingResponse && (
            <div className="flex items-start sm:gap-4 gap-0 sm:px-0 px-2 pt-4 animate-in fade-in slide-in-from-left-2 duration-500 ease-out">
              {/* Desktop: Icon outside message */}
              <div className={cn("hidden sm:flex w-8 h-8 rounded-full items-center justify-center flex-shrink-0 mt-1 border", config.bgColor, config.borderColor)}>
                <IconComponent className={cn("h-4 w-4", config.textColor)} />
              </div>
              <div className={cn("relative max-w-[95%] sm:max-w-[80%] rounded-lg border", config.bgColor, config.borderColor)}>
                {/* Mobile: Agent icon in corner */}
                <div className={cn("absolute -top-2 -left-2 sm:hidden w-6 h-6 rounded-full flex items-center justify-center border-2 border-background", config.bgColor, config.borderColor)}>
                  <IconComponent className={cn("h-3 w-3", config.textColor)} />
                </div>
                {/* Agent Context Header with collapse control */}
                <div className="px-4 pt-3 pb-2 border-b border-border/50">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium font-sans">
                      {activeAgent === 'socratico' && 'Supervisor Clínico'}
                  {activeAgent === 'clinico' && 'Especialista en Documentación'}
                      {activeAgent === 'academico' && 'Investigador Académico'}
                      {activeAgent === 'orquestador' && 'Orquestador'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAreBulletsCollapsed(prev => !prev)}
                      className="inline-flex items-center justify-center h-7 px-2 text-xs rounded-md hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={areBulletsCollapsed ? 'Expandir razonamiento' : 'Colapsar razonamiento'}
                      title={areBulletsCollapsed ? 'Mostrar razonamiento' : 'Ocultar razonamiento'}
                    >
                      {areBulletsCollapsed ? 'Mostrar Razonamiento' : 'Ocultar Razonamiento'}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground font-sans">
                    {activeAgent === 'socratico' && 'Especialista en diálogo terapéutico y exploración reflexiva'}
                    {activeAgent === 'clinico' && 'Especialista en documentación clínica y síntesis profesional'}
                    {activeAgent === 'academico' && 'Especialista en investigación científica y evidencia académica'}
                    {activeAgent === 'orquestador' && 'Coordinando respuesta entre especialistas'}
                  </p>
                </div>
                <div className="p-4">
                  <StreamingMarkdownRenderer
                    content={streamingResponse}
                    className="text-base leading-relaxed"
                    showTypingIndicator={true}
                  />
                </div>
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
              </div>
            </div>
          )}

          {/* Reasoning Bullets - primary indicator replacing typing indicator, styled like AI message */}
          {reasoningBullets && (
            reasoningBullets.isGenerating || (reasoningBullets.bullets.length > 0 && !lastModelMessageHasBullets)
          ) && (
            <div className="flex items-start sm:gap-4 gap-0 sm:px-0 px-2 pt-4">
              {/* Desktop: Icon outside message */}
              <div className={cn("hidden sm:flex w-8 h-8 rounded-full items-center justify-center flex-shrink-0 mt-1 border", config.bgColor, config.borderColor)}>
                <IconComponent className={cn("h-4 w-4", config.textColor)} />
              </div>
              <div className={cn("relative max-w-[95%] sm:max-w-[80%] rounded-lg border", config.bgColor, config.borderColor)}>
                {/* Mobile: Agent icon in corner */}
                <div className={cn("absolute -top-2 -left-2 sm:hidden w-6 h-6 rounded-full flex items-center justify-center border-2 border-background", config.bgColor, config.borderColor)}>
                  <IconComponent className={cn("h-3 w-3", config.textColor)} />
                </div>
                {/* Agent Context Header */}
                <div className="px-4 pt-3 pb-2 border-b border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium font-sans">
                      {activeAgent === 'socratico' && 'Supervisor Clínico'}
                  {activeAgent === 'clinico' && 'Especialista en Documentación'}
                      {activeAgent === 'academico' && 'Investigador Académico'}
                      {activeAgent === 'orquestador' && 'Orquestador'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-sans">
                    {activeAgent === 'socratico' && 'Especialista en diálogo terapéutico y exploración reflexiva'}
                    {activeAgent === 'clinico' && 'Especialista en documentación clínica y síntesis profesional'}
                    {activeAgent === 'academico' && 'Especialista en investigación científica y evidencia académica'}
                    {activeAgent === 'orquestador' && 'Coordinando respuesta entre especialistas'}
                  </p>
                </div>
                {!areBulletsCollapsed && (
                  <div className="p-4">
                    <ReasoningBullets
                      bullets={reasoningBullets.bullets}
                      isGenerating={reasoningBullets.isGenerating}
                      className="w-full"
                      showHeader={false}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Removed typing indicator; reasoning bullets serve as the only thinking indicator */}

          <div ref={messagesEndRef} />
        </div>

        {/* Botón flotante para ir al final */}
        {!autoScroll && (
          <Button
            onClick={scrollToBottom}
            className="absolute bottom-32 right-8 rounded-full w-10 h-10 shadow-lg"
            size="icon"
            variant="default"
          >
            <ChevronDown className="h-5 w-5" />
          </Button>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="p-3 md:p-4 pt-1">
        {/* Ficha Clínica controls moved into input toolbar */}
        <div className="max-w-3xl mx-auto">
          {/* Minimal active agent indicator with tooltip */}
          <div className="mb-1 flex items-center justify-end px-1 md:px-0">
            <div className="relative group">
              {/* Expanded hover area that covers badge + bridge + tooltip */}
              <div className="absolute -inset-2 -top-[120px] opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto z-30"></div>
              
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1 cursor-help select-none touch-manipulation relative z-40" 
                   onTouchStart={(e) => e.preventDefault()}
                   onMouseDown={(e) => e.preventDefault()}>
                <IconComponent className={cn("h-3.5 w-3.5", config.textColor)} />
                <span className="text-xs font-sans select-none pointer-events-none">
                  {activeAgent === "socratico" && "Socrático"}
                  {activeAgent === "clinico" && "Clínico"}
                  {activeAgent === "academico" && "Académico"}
                  {activeAgent === "orquestador" && "HopeAI"}
                </span>
              </div>
              
              {/* Enhanced tooltip with agent cycling */}
              <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto z-50">
                <div className="bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[280px] max-w-[320px] sm:max-w-[380px]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TooltipIconComponent className={cn("h-4 w-4", tooltipConfig.textColor)} />
                      <span className="text-sm font-medium font-sans">
                        {tooltipAgent === 'socratico' && 'Supervisor Clínico'}
                      {tooltipAgent === 'clinico' && 'Especialista en Documentación'}
                        {tooltipAgent === 'academico' && 'Investigador Académico'}
                        {tooltipAgent === 'orquestador' && 'HopeAI'}
                      </span>
                    </div>
                    <button
                      onClick={cycleToNextAgent}
                      className="inline-flex items-center justify-center h-6 w-6 rounded-md hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors select-none"
                      title="Ver siguiente agente"
                      aria-label="Ver siguiente agente"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                    {tooltipAgent === 'socratico' && 'Especialista en diálogo terapéutico y exploración reflexiva'}
                    {tooltipAgent === 'clinico' && 'Especialista en documentación clínica y síntesis profesional'}
                    {tooltipAgent === 'academico' && 'Especialista en investigación científica y evidencia académica'}
                    {tooltipAgent === 'orquestador' && 'Asistente principal que coordina las respuestas'}
                  </p>
                  {previewAgent && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <p className="text-xs text-muted-foreground font-sans">
                        {tooltipAgent === activeAgent ? 'Agente actual' : 'Vista previa - HopeAI selecciona automáticamente el mejor especialista'}
                      </p>
                    </div>
                  )}
                  {/* Tooltip arrow */}
                  <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-border"></div>
                  <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-popover translate-y-[-1px]"></div>
                </div>
              </div>
            </div>
          </div>
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
                          {/* Mobile: Show text, Desktop: Show icon */}
                          <span className="md:hidden text-sm font-medium">Ficha Clínica</span>
                          <FileText className="hidden md:block h-5 w-5" />
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
                          onSelect={(e) => { e.preventDefault(); if (!fichaLoading) onOpenFichaClinica && onOpenFichaClinica() }}
                        >
                          {fichaLoading ? 'Abriendo…' : 'Ver Ficha Clínica'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!onGenerateFichaClinica}
                          onSelect={(e) => { e.preventDefault(); if (!generateLoading) onGenerateFichaClinica && onGenerateFichaClinica() }}
                          className={hasExistingFicha ? 'text-amber-700 focus:text-amber-800' : ''}
                        >
                          {generateLoading ? 'Generando…' : hasExistingFicha ? 'Re-generar Ficha (sobrescribe)' : 'Generar Ficha Clínica'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <div className="relative group">
                      {/* Expanded hover area that covers button + tooltip */}
                      <div className="absolute -inset-2 -top-[60px] opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto z-30"></div>
                      
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn(
                          "h-10 md:h-12 px-3 w-auto relative z-40", 
                          config.ghostButton.hoverBg, 
                          config.ghostButton.text,
                          "opacity-50 cursor-not-allowed"
                        )}
                        disabled={true}
                        title="Crea o selecciona un paciente para acceder a la Ficha Clínica"
                      >
                        {/* Mobile: Show text, Desktop: Show icon */}
                        <span className="md:hidden text-sm font-medium">Ficha Clínica</span>
                        <FileText className="hidden md:block h-5 w-5" />
                      </Button>
                      
                      {/* Mobile tooltip for disabled state */}
                      <div className="absolute bottom-full left-0 mb-2 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto group-active:pointer-events-auto z-50">
                        <div className="bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[280px] max-w-[320px] sm:max-w-[380px] select-none">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-muted-foreground">💡</span>
                            <span className="text-sm font-medium font-sans">Ficha Clínica</span>
                          </div>
                          <p className="text-xs text-muted-foreground font-sans leading-relaxed mb-3">
                            Crea o selecciona un paciente para acceder a la documentación clínica
                          </p>
                          <div className="flex justify-end">
                            <button
                              onClick={() => {
                                console.log('Button clicked, onOpenPatientLibrary:', onOpenPatientLibrary);
                                if (onOpenPatientLibrary) {
                                  onOpenPatientLibrary();
                                } else {
                                  console.log('onOpenPatientLibrary is not available');
                                }
                              }}
                              className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors", config.button.bg, config.button.text, config.button.hoverBg)}
                            >
                              <span>Ir a Pacientes</span>
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                          <div className="absolute top-full left-4 border-4 border-transparent border-t-popover"></div>
                        </div>
                      </div>
                    </div>
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
