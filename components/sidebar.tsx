"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Plus, Clock, Brain, BookOpen, Stethoscope, ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
}

interface Conversation {
  id: string
  title: string
  timestamp: string
  agent: "socratico" | "clinico" | "academico"
  preview: string
}

const mockConversations: Conversation[] = [
  {
    id: "1",
    title: "Caso de ansiedad generalizada",
    timestamp: "2 horas",
    agent: "socratico",
    preview: "Explorando patrones de pensamiento catastrófico...",
  },
  {
    id: "2",
    title: "Síntesis sesión María P.",
    timestamp: "1 día",
    agent: "clinico",
    preview: "Resumen estructurado de la sesión terapéutica...",
  },
  {
    id: "3",
    title: "Investigación TCC para TOC",
    timestamp: "3 días",
    agent: "academico",
    preview: "Revisión de literatura sobre terapia cognitivo-conductual...",
  },
  {
    id: "4",
    title: "Caso de depresión resistente",
    timestamp: "1 semana",
    agent: "socratico",
    preview: "Análisis de factores mantenedores y estrategias...",
  },
  {
    id: "5",
    title: "Informe psicológico Juan G.",
    timestamp: "2 semanas",
    agent: "clinico",
    preview: "Evaluación completa y recomendaciones terapéuticas...",
  },
]

const agentIcons = {
  socratico: Brain,
  clinico: Stethoscope,
  academico: BookOpen,
}

const agentColors = {
  socratico: "text-blue-600",
  clinico: "text-green-600",
  academico: "text-purple-600",
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)

  const filteredConversations = mockConversations.filter(
    (conv) =>
      conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.preview.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div
      className={cn(
        "bg-white border-r border-gray-200 flex flex-col transition-all duration-300 shadow-lg relative",
        isOpen ? "w-80" : "w-0 overflow-hidden md:w-16",
      )}
    >
      {/* Toggle button */}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onToggle} 
        className={cn(
          "absolute top-3 z-10 transition-all duration-300",
          isOpen ? "right-3" : "right-2 md:right-1"
        )}
      >
        <ChevronLeft className={cn("h-5 w-5 transition-transform duration-300", !isOpen && "rotate-180")} />
      </Button>

      <div className={cn("border-b border-gray-100 transition-all duration-300", isOpen ? "p-4" : "p-2")}>
        <Button className={cn(
          "bg-blue-600 hover:bg-blue-700 transition-all duration-300",
          isOpen ? "w-full justify-start gap-2" : "w-full justify-center p-2"
        )}>
          <Plus className="h-4 w-4" />
          {isOpen && "Nueva Conversación"}
        </Button>
      </div>

      {isOpen && (
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar conversaciones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredConversations.map((conversation) => {
            const IconComponent = agentIcons[conversation.agent]
            return (
              <Button
                key={conversation.id}
                variant={selectedConversation === conversation.id ? "secondary" : "ghost"}
                className={cn(
                  "w-full mb-2 transition-all duration-300",
                  isOpen ? "justify-start p-3 h-auto text-left" : "justify-center p-2 h-10",
                  selectedConversation === conversation.id && "bg-blue-50 border-l-4 border-blue-600",
                )}
                onClick={() => setSelectedConversation(conversation.id)}
                title={!isOpen ? conversation.title : undefined}
              >
                {isOpen ? (
                  <div className="flex items-start gap-3 w-full">
                    <IconComponent className={cn("h-4 w-4 mt-1 flex-shrink-0", agentColors[conversation.agent])} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">{conversation.title}</div>
                      <div className="text-xs text-gray-500 mt-1 line-clamp-2">{conversation.preview}</div>
                      <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                        <Clock className="h-3 w-3" />
                        hace {conversation.timestamp}
                      </div>
                    </div>
                  </div>
                ) : (
                  <IconComponent className={cn("h-4 w-4", agentColors[conversation.agent])} />
                )}
              </Button>
            )
          })}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-gray-100">
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>HopeAI Socrático</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>HopeAI Clínico</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            <span>HopeAI Académico</span>
          </div>
        </div>
      </div>
    </div>
  )
}
