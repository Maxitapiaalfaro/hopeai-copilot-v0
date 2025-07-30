"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Paperclip, Mic, MicOff, User, Zap, ChevronDown, Brain, Search, Stethoscope, BookOpen, Maximize2, Minimize2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AgentType, ChatState, ClinicalFile } from "@/types/clinical-types"
import { VoiceInputButton, VoiceStatus } from "@/components/voice-input-button"
import { useSpeechToText } from "@/hooks/use-speech-to-text"
import { MarkdownRenderer, StreamingMarkdownRenderer } from "@/components/markdown-renderer"
import { getAgentVisualConfig, getAgentVisualConfigSafe } from "@/config/agent-visual-config"
import { trackMessage } from "@/lib/sentry-metrics-tracker"
import { FileUploadButton } from "@/components/file-upload-button"
import { MessageFileAttachments } from "@/components/message-file-attachments"
import { getFilesByIds } from "@/lib/hopeai-system"
import * as Sentry from "@sentry/nextjs"
import type { TransitionState } from "@/hooks/use-hopeai-system"

interface ChatInterfaceProps {
  activeAgent: AgentType
  isProcessing: boolean
  isUploading?: boolean
  currentSession: ChatState | null
  sendMessage: (message: string, useStreaming?: boolean, attachedFiles?: ClinicalFile[]) => Promise<any>
  uploadDocument: (file: File) => Promise<any>
  addStreamingResponseToHistory?: (responseContent: string, agent: AgentType, groundingUrls?: Array<{title: string, url: string, domain?: string}>) => Promise<void>
  pendingFiles?: ClinicalFile[]
  onRemoveFile?: (fileId: string) => void
  transitionState?: TransitionState
}

// Configuración de agentes ahora centralizada en agent-visual-config.ts

export function ChatInterface({ activeAgent, isProcessing, isUploading = false, currentSession, sendMessage, uploadDocument, addStreamingResponseToHistory, pendingFiles = [], onRemoveFile, transitionState = 'idle' }: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("")
  const [streamingResponse, setStreamingResponse] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [forceUpdate, setForceUpdate] = useState(0)
  const [autoScroll, setAutoScroll] = useState(true)
  const [visibleMessageCount, setVisibleMessageCount] = useState(20)
  const [streamingGroundingUrls, setStreamingGroundingUrls] = useState<Array<{title: string, url: string, domain?: string}>>([])  
  const [messageFiles, setMessageFiles] = useState<Record<string, ClinicalFile[]>>({})
  const [isInputExpanded, setIsInputExpanded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [currentSession?.history, streamingResponse, autoScroll])

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

  const handleSendMessage = async () => {
    console.log('🔄 Frontend: Iniciando envío de mensaje...', {
      hasInput: !!inputValue.trim(),
      hasSession: !!currentSession,
      sessionId: currentSession?.sessionId,
      pendingFilesCount: pendingFiles.length
    })
    
    if (!inputValue.trim() || !currentSession) {
      console.log('❌ Frontend: Envío cancelado - falta input o sesión')
      return
    }

    const message = inputValue.trim()
    
    // Limpiar input y preparar UI para streaming
    setInputValue("")
    setIsStreaming(true)
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
                  await addStreamingResponseToHistory(fullResponse, responseAgent, accumulatedGroundingUrls)
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

  const config = getAgentVisualConfig(activeAgent)
  const IconComponent = config.icon

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4 relative scrollbar-hide" onScrollCapture={handleScroll} style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Indicador de mensajes anteriores */}
          {currentSession?.history && currentSession.history.length > visibleMessageCount && (
            <div className="text-center py-2">
              <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-2">
                Mostrando {visibleMessageCount} de {currentSession.history.length} mensajes
                <br />
                <span className="text-xs">Desplázate hacia arriba para cargar más</span>
              </div>
            </div>
          )}

          {/* Welcome suggestions if no history */}
          {(!currentSession?.history || currentSession.history.length === 0) && (
            <div className="space-y-8 animate-in fade-in duration-700 ease-out">
              {/* Mensaje de bienvenida minimalista */}
              <div className="text-center space-y-3">
                <div className="space-y-1">
                  <h2 className="text-lg font-medium text-gray-900">¿En qué puedo ayudarte hoy?</h2>
                  <p className="text-sm text-gray-500">Explora estas opciones para comenzar</p>
                </div>
              </div>
              
              {/* Sugerencias predefinidas - Diseño minimalista */}
              <div className="grid gap-3 max-w-xl mx-auto">
                {/* Socrático suggestion */}
                <button
                  onClick={() => setInputValue("Ayúdame a explorar las emociones y pensamientos de mi paciente con ansiedad social")}
                  className="animate-slide-up group relative overflow-hidden rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-blue-200 transition-all duration-300 ease-out hover:shadow-sm"
                  style={{ animationDelay: '0.1s', animationFillMode: 'both' }}
                >
                  <div className="flex items-center gap-4 p-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 group-hover:scale-105 transition-all duration-300">
                      <Brain className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-medium text-gray-900 mb-1 group-hover:text-blue-900 transition-colors">Exploración Socrática</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">Explora emociones y pensamientos con técnicas socráticas</p>
                    </div>
                    <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <span className="text-xs text-gray-600">→</span>
                    </div>
                  </div>
                </button>
                
                {/* Clínico suggestion */}
                <button
                  onClick={() => setInputValue("Genera un resumen clínico de la sesión con mi paciente que presenta síntomas de depresión")}
                  className="animate-slide-up group relative overflow-hidden rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-green-200 transition-all duration-300 ease-out hover:shadow-sm"
                  style={{ animationDelay: '0.2s', animationFillMode: 'both' }}
                >
                  <div className="flex items-center gap-4 p-4">
                    <div className="w-10 h-10 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0 group-hover:bg-green-100 group-hover:scale-105 transition-all duration-300">
                      <Stethoscope className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-medium text-gray-900 mb-1 group-hover:text-green-900 transition-colors">Documentación Clínica</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">Genera resúmenes y documentación profesional</p>
                    </div>
                    <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <span className="text-xs text-gray-600">→</span>
                    </div>
                  </div>
                </button>
                
                {/* Académico suggestion */}
                <button
                  onClick={() => setInputValue("Busca evidencia científica reciente sobre terapia cognitivo-conductual para trastorno de pánico")}
                  className="animate-slide-up group relative overflow-hidden rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-purple-200 transition-all duration-300 ease-out hover:shadow-sm"
                  style={{ animationDelay: '0.3s', animationFillMode: 'both' }}
                >
                  <div className="flex items-center gap-4 p-4">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-100 group-hover:scale-105 transition-all duration-300">
                      <BookOpen className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-medium text-gray-900 mb-1 group-hover:text-purple-900 transition-colors">Investigación Académica</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">Busca evidencia científica y estudios recientes</p>
                    </div>
                    <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <span className="text-xs text-gray-600">→</span>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Chat History - Solo mensajes visibles */}
          {currentSession?.history?.slice(-visibleMessageCount).map((message) => {
            // Usar la configuración del agente que generó el mensaje, no el agente activo
            const messageAgentConfig = getAgentVisualConfigSafe(message.agent);
            const MessageIconComponent = messageAgentConfig.icon;
            
            return (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "model" && (
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 border",
                      messageAgentConfig.bgColor,
                      messageAgentConfig.borderColor,
                    )}
                  >
                    <MessageIconComponent className={cn("h-4 w-4", messageAgentConfig.textColor)} />
                  </div>
                )}

                <div
                  className={cn(
                    "max-w-[80%] mx-2 p-4 rounded-lg",
                    message.role === "user" ? "bg-blue-600 text-white" : `${messageAgentConfig.bgColor} border ${messageAgentConfig.borderColor}`,
                  )}
                >
                  <MarkdownRenderer 
                    content={message.content}
                    className="text-sm"
                    trusted={message.role === "model"}
                  />
                  {/* Mostrar archivos adjuntos si existen */}
                  {messageFiles[message.id] && messageFiles[message.id].length > 0 && (
                        <MessageFileAttachments 
                          files={messageFiles[message.id]} 
                          variant="compact"
                          isUserMessage={message.role === 'user'}
                        />
                      )}
                  {/* Mostrar referencias de grounding si existen */}
                  {message.groundingUrls && message.groundingUrls.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-gray-200">
                      <div className="text-xs font-medium text-gray-600 mb-2">Referencias:</div>
                      <div className="space-y-1">
                        {message.groundingUrls.map((ref, index) => (
                          <div key={index} className="text-xs">
                            <a 
                              href={ref.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline"
                            >
                              {ref.title}
                            </a>
                            {ref.domain && (
                              <span className="text-gray-500 ml-1">({ref.domain})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className={cn("text-xs mt-1", message.role === "user" ? "text-blue-100" : "text-gray-500")}>
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>

                {message.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Streaming Response */}
          {isStreaming && streamingResponse && (
            <div className="flex justify-start animate-in fade-in slide-in-from-left-2 duration-500 ease-out">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 border transition-all duration-300 ease-out",
                  config.bgColor,
                  config.borderColor,
                )}
              >
                <IconComponent className={cn("h-4 w-4 transition-all duration-300 ease-out", config.textColor)} />
              </div>
              <div className={cn("max-w-[80%] mx-2 p-4 rounded-lg transition-all duration-300 ease-out", config.bgColor, `border ${config.borderColor}`)}>                <StreamingMarkdownRenderer                   content={streamingResponse}                  className="text-sm"                  showTypingIndicator={true}                />                {/* Mostrar referencias de grounding durante streaming si existen */}
                {streamingGroundingUrls && streamingGroundingUrls.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-gray-200 animate-in fade-in duration-300 ease-out">
                    <div className="text-xs font-medium text-gray-600 mb-2">Referencias:</div>
                    <div className="space-y-1">
                      {streamingGroundingUrls.map((ref, index) => (
                        <div key={index} className="text-xs animate-in fade-in duration-200 ease-out" style={{ animationDelay: `${index * 100}ms` }}>
                          <a 
                            href={ref.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline transition-colors duration-200"
                          >
                            {ref.title}
                          </a>
                          {ref.domain && (
                            <span className="text-gray-500 ml-1">({ref.domain})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}              </div>
            </div>
          )}

          {/* Typing Indicator with Transition States */}
          {(isProcessing || isStreaming) && !streamingResponse && (
            <div className="flex justify-start">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 border transition-all duration-500 ease-in-out",
                  transitionState === 'thinking' ? "bg-blue-50 border-blue-200" :
                  transitionState === 'selecting_agent' ? "bg-purple-50 border-purple-200" :
                  transitionState === 'specialist_responding' ? config.bgColor : config.bgColor,
                  transitionState === 'thinking' ? "border-blue-200" :
                  transitionState === 'selecting_agent' ? "border-purple-200" :
                  transitionState === 'specialist_responding' ? config.borderColor : config.borderColor,
                )}
              >
                <div className="transition-all duration-700 ease-out">
                  {transitionState === 'thinking' && <Brain className="h-4 w-4 text-blue-600" style={{ animation: 'gentle-pulse 2s ease-in-out infinite' }} />}
                  {transitionState === 'selecting_agent' && <Search className="h-4 w-4 text-purple-600" style={{ animation: 'gentle-fade 1.5s ease-in-out infinite alternate' }} />}
                  {(transitionState === 'specialist_responding' || transitionState === 'idle') && <IconComponent className={cn("h-4 w-4", config.textColor)} />}
                </div>
              </div>
              <div className={cn(
                "max-w-[80%] mx-2 p-4 rounded-lg transition-all duration-500 ease-in-out",
                transitionState === 'thinking' ? "bg-blue-50 border border-blue-200" :
                transitionState === 'selecting_agent' ? "bg-purple-50 border border-purple-200" :
                transitionState === 'specialist_responding' ? `${config.bgColor} border ${config.borderColor}` :
                `${config.bgColor} border ${config.borderColor}`
              )}>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <div 
                      className={cn(
                        "w-2 h-2 rounded-full transition-colors duration-500",
                        transitionState === 'thinking' ? "bg-blue-400" :
                        transitionState === 'selecting_agent' ? "bg-purple-400" :
                        config.typingDotColor
                      )}
                      style={{ animation: 'gentle-bounce 2s ease-in-out infinite' }}
                    ></div>
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full transition-colors duration-500",
                        transitionState === 'thinking' ? "bg-blue-400" :
                        transitionState === 'selecting_agent' ? "bg-purple-400" :
                        config.typingDotColor
                      )}
                      style={{ animation: 'gentle-bounce 2s ease-in-out infinite', animationDelay: "0.4s" }}
                    ></div>
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full transition-colors duration-500",
                        transitionState === 'thinking' ? "bg-blue-400" :
                        transitionState === 'selecting_agent' ? "bg-purple-400" :
                        config.typingDotColor
                      )}
                      style={{ animation: 'gentle-bounce 2s ease-in-out infinite', animationDelay: "0.8s" }}
                    ></div>
                  </div>
                  <span className={cn(
                    "text-sm transition-all duration-300 ease-in-out",
                    transitionState === 'thinking' ? "text-blue-600" :
                    transitionState === 'selecting_agent' ? "text-purple-600" :
                    config.textColor
                  )}>
                    {transitionState === 'thinking' && 'HopeAI analizando tu consulta...'}
                    {transitionState === 'selecting_agent' && 'HopeAI activando capacidades especializadas...'}
                    {(transitionState === 'specialist_responding' || transitionState === 'idle') && `HopeAI generando respuesta...`}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Botón flotante para ir al final */}
        {!autoScroll && (
          <Button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 rounded-full w-12 h-12 bg-blue-600 hover:bg-blue-700 shadow-lg"
            size="sm"
          >
            <ChevronDown className="h-5 w-5" />
          </Button>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Input container con estilo Gemini adaptado al agente activo */}
            <div className={cn(
              "relative bg-gray-50 rounded-3xl border transition-all duration-300 ease-in-out",
              config.borderColor,
              `hover:${config.borderColor.replace('border-', 'border-').replace('-200', '-300')}`,
              `focus-within:${config.borderColor.replace('border-', 'border-').replace('-200', '-400')} focus-within:bg-white`,
              isInputExpanded && "rounded-2xl"
            )}>
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Pregúntale a HopeAI"
                className={cn(
                  "w-full min-h-[60px] resize-none border-0 bg-transparent px-6 py-4 pr-32 pb-12 text-base placeholder:text-gray-500 focus:outline-none focus:ring-0 focus:border-transparent focus-visible:outline-none focus-visible:ring-0 overflow-y-auto transition-all duration-200 ease-out scrollbar-hide",
                  isInputExpanded ? "max-h-[400px]" : "max-h-[200px]"
                )}
                rows={1}
                disabled={isProcessing || isStreaming || isUploading}
                style={{ 
                  outline: 'none', 
                  boxShadow: 'none',
                  height: 'auto',
                  lineHeight: '1.5'
                }}
              />
              
              {/* Botones dentro del input - estilo Gemini */}
              <div className="absolute bottom-2 right-2 flex items-center gap-2">
                <FileUploadButton
                  onFilesSelected={() => {}} // Los archivos se manejan automáticamente por uploadDocument
                  uploadDocument={uploadDocument}
                  disabled={isProcessing || isStreaming || isUploading}
                  pendingFiles={pendingFiles}
                  onRemoveFile={onRemoveFile}
                />
                <VoiceInputButton
                  onTranscriptUpdate={handleVoiceTranscript}
                  disabled={isProcessing || isStreaming || isUploading}
                  size="sm"
                  variant="ghost"
                  language="es-ES"
                />
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Expand button clicked, current state:', isInputExpanded);
                    setIsInputExpanded(!isInputExpanded);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  size="sm"
                  variant="ghost"
                  className="h-10 w-10 md:h-8 md:w-8 p-0 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 touch-manipulation select-none"
                  title={isInputExpanded ? "Contraer input" : "Expandir input"}
                >
                  {isInputExpanded ? <Minimize2 className="h-5 w-5 md:h-4 md:w-4" /> : <Maximize2 className="h-5 w-5 md:h-4 md:w-4" />}
                </Button>
                <Button
                  onClick={handleSendMessage}
                  disabled={
                    !inputValue.trim() || 
                    isProcessing || 
                    isStreaming ||
                    isUploading ||
                    pendingFiles.some(file => 
                      (file as any).processingStatus && 
                      (file as any).processingStatus !== 'active'
                    )
                  }
                  size="sm"
                  className={cn(
                    "h-10 w-10 md:h-8 md:w-8 p-0 rounded-full transition-all duration-300 ease-in-out text-white touch-manipulation",
                    config.buttonBgColor,
                    config.buttonHoverColor,
                    // Estado disabled
                    (!inputValue.trim() || isProcessing || isStreaming || isUploading) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Send className="h-5 w-5 md:h-4 md:w-4" />
                </Button>
              </div>
            </div>

          </div>

          {/* Indicador de estado de archivos */}
          {pendingFiles.length > 0 && !isStreaming && (
            <div className="mt-2 p-2 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Archivos adjuntos:</div>
              <div className="space-y-1">
                {pendingFiles.map((file) => {
                  const processingStatus = (file as any).processingStatus
                  const isProcessing = processingStatus === 'processing'
                  const isError = processingStatus === 'error' || processingStatus === 'timeout'
                  const isActive = processingStatus === 'active'
                  
                  return (
                    <div key={file.id} className="flex items-center gap-2 text-xs">
                      <Paperclip className="h-3 w-3 text-gray-400" />
                      <span className="flex-1 truncate">{file.name}</span>
                      {isProcessing && (
                        <div className="flex items-center gap-1 text-amber-600">
                          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
                          <span>Procesando...</span>
                        </div>
                      )}
                      {isActive && (
                        <div className="flex items-center gap-1 text-green-600">
                          <div className="w-2 h-2 rounded-full bg-green-400"></div>
                          <span>Listo</span>
                        </div>
                      )}
                      {isError && (
                        <div className="flex items-center gap-1 text-red-600">
                          <div className="w-2 h-2 rounded-full bg-red-400"></div>
                          <span>Error</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {pendingFiles.some(file => 
                (file as any).processingStatus && 
                (file as any).processingStatus !== 'active'
              ) && (
                <div className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                  ⏳ Esperando a que los archivos terminen de procesarse antes de enviar el mensaje
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>Presiona Enter para enviar, Shift+Enter para nueva línea</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Agente activo:</span>
              <span className={cn("font-medium", config.textColor)}>
                {activeAgent === "socratico" && "Socrático"}
                {activeAgent === "clinico" && "Clínico"}
                {activeAgent === "academico" && "Académico"}
              </span>
            </div>
          </div>
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
