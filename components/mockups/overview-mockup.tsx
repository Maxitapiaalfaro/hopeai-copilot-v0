"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Brain, Stethoscope, BookOpen, ArrowRight, Zap, Users, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function OverviewMockup() {
  const [activeAgent, setActiveAgent] = useState<string | null>(null)

  const agents = [
    {
      id: "socratico",
      name: "HopeAI Socrático",
      icon: Brain,
      color: "blue",
      description: "Especialista en diálogo terapéutico",
      capabilities: ["Preguntas estratégicas", "Reflexión profunda", "Autoconocimiento", "Proceso terapéutico"],
      scenario: "Facilitando la exploración de patrones de pensamiento en un caso de ansiedad",
    },
    {
      id: "clinico",
      name: "HopeAI Clínico",
      icon: Stethoscope,
      color: "green",
      description: "Especialista en síntesis clínica",
      capabilities: ["Resúmenes estructurados", "Documentación", "Organización de casos", "Planes de tratamiento"],
      scenario: "Generando un resumen completo de sesión con recomendaciones de seguimiento",
    },
    {
      id: "academico",
      name: "HopeAI Académico",
      icon: BookOpen,
      color: "purple",
      description: "Especialista en evidencia científica",
      capabilities: ["Búsqueda de literatura", "Análisis de evidencia", "Referencias actualizadas", "Investigación"],
      scenario: "Proporcionando evidencia científica sobre intervenciones para trastorno bipolar",
    },
  ]

  return (
    <div className="space-y-8">
      {/* System Architecture */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            <Zap className="h-6 w-6 text-blue-600" />
            Arquitectura de Tres Agentes Especialistas
          </CardTitle>
          <p className="text-gray-600">Sistema inteligente de enrutamiento automático</p>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            {agents.map((agent) => {
              const IconComponent = agent.icon
              const isActive = activeAgent === agent.id

              return (
                <Card
                  key={agent.id}
                  className={`cursor-pointer transition-all duration-300 hover:shadow-lg ${
                    isActive ? `ring-2 ring-${agent.color}-500 bg-${agent.color}-50` : ""
                  }`}
                  onClick={() => setActiveAgent(isActive ? null : agent.id)}
                >
                  <CardContent className="p-6">
                    <div className="text-center space-y-4">
                      <div
                        className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center bg-${agent.color}-100`}
                      >
                        <IconComponent className={`h-8 w-8 text-${agent.color}-600`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{agent.name}</h3>
                        <p className="text-sm text-gray-600">{agent.description}</p>
                      </div>

                      {isActive && (
                        <div className="space-y-3 animate-in slide-in-from-top-2">
                          <div className="space-y-2">
                            {agent.capabilities.map((capability, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {capability}
                              </Badge>
                            ))}
                          </div>
                          <div className="p-3 bg-white rounded-lg border text-xs text-left">
                            <strong>Escenario de uso:</strong>
                            <p className="mt-1">{agent.scenario}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Key Features */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-6 text-center">
            <Brain className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="font-bold mb-2">Enrutamiento Inteligente</h3>
            <p className="text-sm text-gray-600">Detección automática de intención y activación del agente apropiado</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-6 text-center">
            <FileText className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="font-bold mb-2">Gestión de Documentos</h3>
            <p className="text-sm text-gray-600">Procesamiento nativo de PDF, Word e imágenes clínicas</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-6 text-center">
            <Users className="h-12 w-12 text-purple-600 mx-auto mb-4" />
            <h3 className="font-bold mb-2">Continuidad de Sesiones</h3>
            <p className="text-sm text-gray-600">Contexto clínico preservado entre conversaciones</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100">
          <CardContent className="p-6 text-center">
            <Zap className="h-12 w-12 text-amber-600 mx-auto mb-4" />
            <h3 className="font-bold mb-2">Input de Voz Nativo</h3>
            <p className="text-sm text-gray-600">Integración completa de comandos de voz en el flujo clínico</p>
          </CardContent>
        </Card>
      </div>

      {/* Demo Flow */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Plan de Demostración Interactiva
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-blue-600">Escenarios de Demostración</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    Caso de ansiedad generalizada (Agente Socrático)
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Síntesis de sesión terapéutica (Agente Clínico)
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    Investigación sobre TCC para TOC (Agente Académico)
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-700">Flujos de Trabajo Clave</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                    Carga de documentos por arrastrar y soltar
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                    Transición automática entre agentes
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                    Historial de conversaciones con búsqueda
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
