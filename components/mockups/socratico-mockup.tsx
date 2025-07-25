"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Brain, MessageCircle, Lightbulb, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function SocraticoMockup() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isTyping, setIsTyping] = useState(false)

  const conversationFlow = [
    {
      type: "user",
      message:
        "Tengo un paciente de 28 años con ansiedad generalizada. Se presenta muy ansioso en las sesiones y tiene dificultades para identificar sus pensamientos automáticos.",
      timestamp: "14:30",
    },
    {
      type: "agent-thinking",
      message: "Analizando contexto clínico... Activando HopeAI Socrático",
    },
    {
      type: "agent",
      message:
        "Comprendo que trabajas con un caso de ansiedad generalizada. Como tu agente socrático, me gustaría explorar esto más profundamente contigo.",
      timestamp: "14:31",
      questions: [
        "¿Qué patrones has observado en la forma en que tu paciente se relaciona con sus pensamientos ansiosos?",
        "¿Cómo crees que podrías ayudarle a desarrollar mayor conciencia de sus procesos cognitivos?",
        "¿Qué estrategias has considerado para crear un espacio seguro donde pueda explorar estos pensamientos?",
      ],
    },
    {
      type: "user",
      message:
        "He notado que tiende a evitar hablar de situaciones específicas que le generan ansiedad. Cuando lo hace, se pone muy tenso físicamente.",
      timestamp: "14:33",
    },
    {
      type: "agent",
      message:
        "Excelente observación. La tensión física puede ser una ventana hacia sus procesos internos. ¿Qué te dice esta conexión mente-cuerpo sobre su experiencia de la ansiedad?",
      timestamp: "14:34",
      reflections: [
        "La evitación como mecanismo de protección",
        "La manifestación somática de la ansiedad",
        "Oportunidades para la exploración corporal",
      ],
    },
  ]

  useEffect(() => {
    if (currentStep < conversationFlow.length - 1) {
      const timer = setTimeout(() => {
        if (conversationFlow[currentStep + 1].type === "agent-thinking") {
          setIsTyping(true)
          setTimeout(() => {
            setIsTyping(false)
            setCurrentStep(currentStep + 1)
          }, 2000)
        } else {
          setCurrentStep(currentStep + 1)
        }
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [currentStep])

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl">HopeAI Socrático en Acción</h2>
              <p className="text-sm text-blue-700 font-normal">Facilitando reflexión profunda y autoconocimiento</p>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chat Interface */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="bg-blue-50 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Sesión de Supervisión Clínica</span>
                </div>
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  Agente Socrático Activo
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="flex-1 p-4 overflow-y-auto">
              <div className="space-y-4">
                {conversationFlow.slice(0, currentStep + 1).map((item, index) => {
                  if (item.type === "agent-thinking") {
                    return (
                      <div key={index} className="flex justify-center">
                        <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm flex items-center gap-2">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                            <div
                              className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                              style={{ animationDelay: "0.1s" }}
                            ></div>
                            <div
                              className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                              style={{ animationDelay: "0.2s" }}
                            ></div>
                          </div>
                          {item.message}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={index} className={`flex ${item.type === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] p-4 rounded-lg ${
                          item.type === "user"
                            ? "bg-gray-600 text-white"
                            : "bg-blue-50 border border-blue-200 text-gray-800"
                        }`}
                      >
                        <div className="text-sm leading-relaxed">{item.message}</div>

                        {item.questions && (
                          <div className="mt-4 space-y-2">
                            <div className="flex items-center gap-2 text-blue-600 font-medium text-sm">
                              <Lightbulb className="h-4 w-4" />
                              Preguntas para la reflexión:
                            </div>
                            {item.questions.map((question, qIndex) => (
                              <div key={qIndex} className="bg-white p-3 rounded border-l-4 border-blue-400 text-sm">
                                {question}
                              </div>
                            ))}
                          </div>
                        )}

                        {item.reflections && (
                          <div className="mt-4 space-y-2">
                            <div className="flex items-center gap-2 text-blue-600 font-medium text-sm">
                              <MessageCircle className="h-4 w-4" />
                              Puntos de reflexión:
                            </div>
                            <div className="grid gap-2">
                              {item.reflections.map((reflection, rIndex) => (
                                <Badge key={rIndex} variant="outline" className="justify-start text-xs">
                                  {reflection}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {item.timestamp && <div className="text-xs opacity-70 mt-2">{item.timestamp}</div>}
                      </div>
                    </div>
                  )
                })}

                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg max-w-xs">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                          <div
                            className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0.1s" }}
                          ></div>
                          <div
                            className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0.2s" }}
                          ></div>
                        </div>
                        <span className="text-sm text-blue-600">HopeAI está reflexionando...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Agent Capabilities */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5 text-blue-600" />
                Capacidades Socráticas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Badge className="w-full justify-start bg-blue-100 text-blue-700 hover:bg-blue-200">
                  Preguntas estratégicas
                </Badge>
                <Badge className="w-full justify-start bg-blue-100 text-blue-700 hover:bg-blue-200">
                  Facilitación de insight
                </Badge>
                <Badge className="w-full justify-start bg-blue-100 text-blue-700 hover:bg-blue-200">
                  Exploración de patrones
                </Badge>
                <Badge className="w-full justify-start bg-blue-100 text-blue-700 hover:bg-blue-200">
                  Reflexión guiada
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Técnicas Activas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                <h4 className="font-medium text-sm text-blue-800">Mayéutica Digital</h4>
                <p className="text-xs text-blue-600 mt-1">
                  Preguntas que ayudan al profesional a descubrir insights sobre el caso
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                <h4 className="font-medium text-sm text-blue-800">Reflexión Estructurada</h4>
                <p className="text-xs text-blue-600 mt-1">Guía sistemática para el análisis de patrones clínicos</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Progreso de Sesión</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Exploración inicial</span>
                  <span className="text-green-600">✓</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Identificación de patrones</span>
                  <span className="text-blue-600">En progreso</span>
                </div>
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Síntesis de insights</span>
                  <span>Pendiente</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Demo Controls */}
      <Card className="bg-gray-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Demostración interactiva: Paso {currentStep + 1} de {conversationFlow.length}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                onClick={() => setCurrentStep(Math.min(conversationFlow.length - 1, currentStep + 1))}
                disabled={currentStep === conversationFlow.length - 1}
              >
                Siguiente
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
