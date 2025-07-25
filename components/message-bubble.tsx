"use client"

import { Card } from "@/components/ui/card"
import { Brain, BookOpen, Stethoscope, User, FileText, ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type AgentType = "socratico" | "clinico" | "academico"

interface Message {
  id: string
  content: string
  sender: "user" | "ai"
  agent?: AgentType
  timestamp: Date
  attachments?: Array<{
    name: string
    type: string
    size: number
  }>
}

interface MessageBubbleProps {
  message: Message
}

const agentConfig = {
  socratico: {
    name: "HopeAI Socrático",
    icon: Brain,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  clinico: {
    name: "HopeAI Clínico",
    icon: Stethoscope,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  academico: {
    name: "HopeAI Académico",
    icon: BookOpen,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.sender === "user"
  const config = message.agent ? agentConfig[message.agent] : null
  const IconComponent = config?.icon || User

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return ImageIcon
    return FileText
  }

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
            config?.bgColor || "bg-gray-100",
            config?.borderColor || "border-gray-200",
            "border",
          )}
        >
          <IconComponent className={cn("h-4 w-4", config?.color || "text-gray-600")} />
        </div>
      )}

      <div className={cn("max-w-[70%] space-y-1", isUser && "items-end")}>
        {!isUser && config && <div className="text-xs font-medium text-gray-600 px-1">{config.name}</div>}

        <Card
          className={cn(
            "p-4 shadow-sm",
            isUser ? "bg-blue-600 text-white" : config?.bgColor || "bg-white",
            !isUser && config?.borderColor && `border ${config.borderColor}`,
          )}
        >
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</div>

          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {message.attachments.map((attachment, index) => {
                const FileIcon = getFileIcon(attachment.type)
                return (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded border",
                      isUser ? "bg-blue-500 border-blue-400" : "bg-gray-50 border-gray-200",
                    )}
                  >
                    <FileIcon className="h-4 w-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{attachment.name}</div>
                      <div className="text-xs opacity-75">{formatFileSize(attachment.size)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <div className={cn("text-xs text-gray-500 px-1", isUser && "text-right")}>
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0 mt-1">
          <User className="h-4 w-4 text-white" />
        </div>
      )}
    </div>
  )
}
