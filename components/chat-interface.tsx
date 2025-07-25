"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Paperclip, Mic, MicOff, Brain, Stethoscope, BookOpen, User, Zap, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AgentType, ChatState } from "@/types/clinical-types"
import { VoiceInputButton, VoiceStatus } from "@/components/voice-input-button"
import { MarkdownRenderer, StreamingMarkdownRenderer } from "@/components/markdown-renderer"

interface ChatInterfaceProps {
  activeAgent: AgentType
  isProcessing: boolean
  currentSession: ChatState | null
  sendMessage: (message: string, useStreaming?: boolean) => Promise<any>
  uploadDocument: (file: File) => Promise<any>
  addStreamingResponseToHistory?: (responseContent: string, agent: AgentType) => Promise<void>
}

const agentConfig = {
  socratico: {
    name: "HopeAI Socrático",
    icon: Brain,
    color: "blue",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
  },
  clinico: {
    name: "HopeAI Clínico",
    icon: Stethoscope,
    color: "green",
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    borderColor: "border-green-200",
  },
  academico: {
    name: "HopeAI Académico",
    icon: BookOpen,
    color: "purple",
    bgColor: "bg-purple-50",
    textColor: "text-purple-700",
    borderColor: "border-purple-200",
  },
}

export function ChatInterface({ activeAgent, isProcessing, currentSession, sendMessage, uploadDocument, addStreamingResponseToHistory }: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("")
  const [streamingResponse, setStreamingResponse] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [forceUpdate, setForceUpdate] = useState(0)
  const [autoScroll, setAutoScroll] = useState(true)
  const [visibleMessageCount, setVisibleMessageCount] = useState(20)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [currentSession?.history, streamingResponse, autoScroll])

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
      sessionId: currentSession?.sessionId
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

    try {
      const response = await sendMessage(message, true)
      console.log('✅ Frontend: Respuesta recibida:', response)
      console.log('📊 Frontend: Estado de sesión actual:', currentSession?.history?.length, 'mensajes')

      // Verificar si la respuesta tiene un AsyncGenerator (streaming)
      if (response && typeof response[Symbol.asyncIterator] === 'function') {
        console.log('🔄 Frontend: Procesando respuesta streaming...')
        
        // Extraer routingInfo si está disponible
        if (response.routingInfo) {
          console.log('🧠 Frontend: Información de enrutamiento extraída:', response.routingInfo)
        }
        
        let fullResponse = ""
        
        try {
          for await (const chunk of response) {
            if (chunk.text) {
              fullResponse += chunk.text
              setStreamingResponse(fullResponse)
            }
          }
          
          console.log('✅ Frontend: Streaming completado')
          
          // Agregar la respuesta completa al historial
          if (fullResponse.trim() && addStreamingResponseToHistory) {
            try {
              await addStreamingResponseToHistory(fullResponse, activeAgent)
              console.log('✅ Frontend: Respuesta agregada al historial')
            } catch (historyError) {
              console.error('❌ Frontend: Error agregando al historial:', historyError)
            }
          }
          
          setStreamingResponse("")
          setIsStreaming(false)
        } catch (streamError) {
          console.error('❌ Frontend: Error en streaming:', streamError)
          setIsStreaming(false)
          setStreamingResponse("")
        }
      } else if (response && response.text) {
        // Respuesta no streaming o respuesta con function calls procesadas
        console.log('✅ Frontend: Respuesta con texto recibida:', response.text.substring(0, 100) + '...')
        
        // Si hay function calls, mostrar información adicional
        if (response.functionCalls) {
          console.log('🔧 Frontend: Function calls detectadas:', response.functionCalls.length)
        }
        
        // Agregar la respuesta al historial
        if (response.text.trim() && addStreamingResponseToHistory) {
          try {
            await addStreamingResponseToHistory(response.text, activeAgent)
            console.log('✅ Frontend: Respuesta agregada al historial')
          } catch (historyError) {
            console.error('❌ Frontend: Error agregando al historial:', historyError)
          }
        }
        
        setIsStreaming(false)
      } else {
        console.log('⚠️ Frontend: Respuesta inesperada o nula:', response)
        setIsStreaming(false)
      }
    } catch (error) {
      console.error("❌ Frontend: Error sending message:", error)
      setIsStreaming(false)
      setStreamingResponse("")
    }
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

  const config = agentConfig[activeAgent]
  const IconComponent = config.icon

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-b from-white to-gray-50 h-full overflow-hidden">
      {/* Agent Indicator */}
      <div className={cn("border-b transition-all duration-300 px-4 py-3", config.bgColor, config.borderColor)}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <IconComponent className={cn("h-5 w-5", config.textColor)} />
              {(isProcessing || isStreaming) && (
                <div className="absolute -top-1 -right-1">
                  <Zap className="h-3 w-3 text-amber-500 animate-pulse" />
                </div>
              )}
            </div>
            <div>
              <h3 className={cn("font-semibold text-sm", config.textColor)}>{config.name}</h3>
              <p className="text-xs text-gray-600">
                {activeAgent === "socratico" && "Especialista en diálogo terapéutico y reflexión profunda"}
                {activeAgent === "clinico" && "Especialista en síntesis y documentación clínica"}
                {activeAgent === "academico" && "Especialista en investigación y evidencia científica"}
              </p>
            </div>
          </div>

          {(isProcessing || isStreaming) && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <div className="flex gap-1">
                <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", `bg-${config.color}-500`)}></div>
                <div
                  className={cn("w-1.5 h-1.5 rounded-full animate-pulse", `bg-${config.color}-500`)}
                  style={{ animationDelay: "0.2s" }}
                ></div>
                <div
                  className={cn("w-1.5 h-1.5 rounded-full animate-pulse", `bg-${config.color}-500`)}
                  style={{ animationDelay: "0.4s" }}
                ></div>
              </div>
              <span>Procesando...</span>
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4 relative" onScrollCapture={handleScroll}>
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

          {/* Welcome message if no history */}
          {(!currentSession?.history || currentSession.history.length === 0) && (
            <div className="flex justify-start">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 border",
                  config.bgColor,
                  config.borderColor,
                )}
              >
                <IconComponent className={cn("h-4 w-4", config.textColor)} />
              </div>
              <div className={cn("max-w-[80%] mx-2 p-4 rounded-lg", config.bgColor, `border ${config.borderColor}`)}>                <MarkdownRenderer                   content={`Hola, soy **${config.name}**, tu copiloto clínico especializado. ¿En qué puedo ayudarte hoy?`}                  className="text-sm"                />
                <div className="text-xs text-gray-500 mt-1">
                  {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          )}

          {/* Chat History - Solo mensajes visibles */}
          {currentSession?.history?.slice(-visibleMessageCount).map((message) => {
            // Usar la configuración del agente que generó el mensaje, no el agente activo
            const messageAgentConfig = message.agent ? agentConfig[message.agent] : config;
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
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {message.attachments.map((file, index) => (
                        <div key={index} className="text-xs opacity-75 flex items-center gap-1">
                          <Paperclip className="h-3 w-3" />
                          {file.name}
                        </div>
                      ))}
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
            <div className="flex justify-start">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 border",
                  config.bgColor,
                  config.borderColor,
                )}
              >
                <IconComponent className={cn("h-4 w-4", config.textColor)} />
              </div>
              <div className={cn("max-w-[80%] mx-2 p-4 rounded-lg", config.bgColor, `border ${config.borderColor}`)}>                <StreamingMarkdownRenderer                   content={streamingResponse}                  className="text-sm"                  showTypingIndicator={true}                />              </div>
            </div>
          )}

          {/* Typing Indicator */}
          {(isProcessing || isStreaming) && !streamingResponse && (
            <div className="flex justify-start">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 border",
                  config.bgColor,
                  config.borderColor,
                )}
              >
                <IconComponent className={cn("h-4 w-4", config.textColor)} />
              </div>
              <div className={cn("max-w-[80%] mx-2 p-4 rounded-lg", config.bgColor, `border ${config.borderColor}`)}>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className={cn("w-2 h-2 rounded-full animate-bounce", `bg-${config.color}-400`)}></div>
                    <div
                      className={cn("w-2 h-2 rounded-full animate-bounce", `bg-${config.color}-400`)}
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className={cn("w-2 h-2 rounded-full animate-bounce", `bg-${config.color}-400`)}
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                  <span className={cn("text-sm", config.textColor)}>HopeAI está escribiendo...</span>
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
      <div className="border-t border-gray-200 p-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Describe tu consulta clínica, sube documentos o solicita asistencia especializada..."
                className="min-h-[60px] max-h-32 resize-none pr-20"
                rows={2}
                disabled={isProcessing || isStreaming}
              />
              <div className="absolute right-2 bottom-2 flex gap-1">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                  id="file-upload"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => document.getElementById("file-upload")?.click()}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <VoiceInputButton
                  onTranscriptUpdate={handleVoiceTranscript}
                  disabled={isProcessing || isStreaming}
                  size="sm"
                  variant="ghost"
                  language="es-ES"
                />
              </div>
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isProcessing || isStreaming}
              className={cn(
                "h-[60px] px-6",
                activeAgent === "socratico" && "bg-blue-600 hover:bg-blue-700",
                activeAgent === "clinico" && "bg-green-600 hover:bg-green-700",
                activeAgent === "academico" && "bg-purple-600 hover:bg-purple-700",
              )}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

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
    </div>
  )
}
