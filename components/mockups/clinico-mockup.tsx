"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Stethoscope, FileText, CheckCircle, Clock, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

export function ClinicoMockup() {
  const [synthesisStep, setSynthesisStep] = useState(0)

  const synthesisSteps = [
    "Analizando información de sesión...",
    "Identificando elementos clave...",
    "Estructurando resumen clínico...",
    "Generando recomendaciones...",
    "Síntesis completa",
  ]

  const clinicalSummary = {
    patient: {
      initials: "M.P.",
      age: 34,
      session: 8,
      date: "15 de Noviembre, 2024",
    },
    presenting_issues: [
      "Episodios de ansiedad en situaciones sociales",
      "Pensamientos rumiativos sobre rendimiento laboral",
      "Dificultades para establecer límites interpersonales",
    ],
    session_focus: "Exploración de patrones cognitivos y estrategias de afrontamiento",
    interventions: [
      {
        technique: "Reestructuración cognitiva",
        target: "Pensamientos catastrofistas sobre evaluación social",
        response: "Paciente logró identificar 3 pensamientos automáticos específicos",
      },
      {
        technique: "Técnicas de relajación",
        target: "Síntomas físicos de ansiedad",
        response: "Práctica de respiración diafragmática, reporta reducción de tensión",
      },
    ],
    homework: [
      "Registro diario de pensamientos automáticos (formato ABC)",
      "Práctica de relajación 10 min/día",
      "Implementar una situación de establecimiento de límites",
    ],
    progress_indicators: [
      { area: "Conciencia de síntomas", score: 8, change: "+2" },
      { area: "Estrategias de afrontamiento", score: 6, change: "+1" },
      { area: "Funcionamiento social", score: 5, change: "0" },
    ],
    next_session_focus: [
      "Revisión de tareas asignadas",
      "Profundizar en técnicas de exposición gradual",
      "Explorar dinámicas familiares relacionadas con ansiedad social",
    ],
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
              <Stethoscope className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl">HopeAI Clínico - Síntesis Automática</h2>
              <p className="text-sm text-green-700 font-normal">Documentación estructurada y análisis clínico</p>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Synthesis Process */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-600" />
                Proceso de Síntesis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {synthesisSteps.map((step, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                        index <= synthesisStep
                          ? "bg-green-600 text-white"
                          : index === synthesisStep + 1
                            ? "bg-green-200 text-green-600 animate-pulse"
                            : "bg-gray-200 text-gray-400"
                      }`}
                    >
                      {index < synthesisStep ? <CheckCircle className="h-3 w-3" /> : index + 1}
                    </div>
                    <span className={`text-sm ${index <= synthesisStep ? "text-gray-900" : "text-gray-400"}`}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Progreso</span>
                  <span>{Math.round(((synthesisStep + 1) / synthesisSteps.length) * 100)}%</span>
                </div>
                <Progress value={((synthesisStep + 1) / synthesisSteps.length) * 100} className="h-2" />
              </div>

              <Button
                size="sm"
                className="w-full"
                onClick={() => setSynthesisStep(Math.min(synthesisSteps.length - 1, synthesisStep + 1))}
                disabled={synthesisStep === synthesisSteps.length - 1}
              >
                Siguiente Paso
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Clinical Summary */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="bg-green-50 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-green-600" />
                  Resumen Clínico Estructurado
                </CardTitle>
                <Badge className="bg-green-100 text-green-700">Sesión #{clinicalSummary.patient.session}</Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>Paciente: {clinicalSummary.patient.initials}</span>
                <span>Edad: {clinicalSummary.patient.age} años</span>
                <span>Fecha: {clinicalSummary.patient.date}</span>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Presenting Issues */}
              <div>
                <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Motivos de Consulta Actuales
                </h3>
                <div className="space-y-2">
                  {clinicalSummary.presenting_issues.map((issue, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg border-l-4 border-green-400 text-sm">
                      {issue}
                    </div>
                  ))}
                </div>
              </div>

              {/* Session Focus */}
              <div>
                <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Enfoque de la Sesión
                </h3>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm">{clinicalSummary.session_focus}</p>
                </div>
              </div>

              {/* Interventions */}
              <div>
                <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Intervenciones Realizadas
                </h3>
                <div className="space-y-4">
                  {clinicalSummary.interventions.map((intervention, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {intervention.technique}
                        </Badge>
                      </div>
                      <div className="text-sm space-y-1">
                        <p>
                          <strong>Objetivo:</strong> {intervention.target}
                        </p>
                        <p>
                          <strong>Respuesta:</strong> {intervention.response}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress Indicators */}
              <div>
                <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Indicadores de Progreso
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {clinicalSummary.progress_indicators.map((indicator, index) => (
                    <div key={index} className="p-4 bg-white border border-gray-200 rounded-lg">
                      <div className="text-sm font-medium mb-2">{indicator.area}</div>
                      <div className="flex items-center gap-2">
                        <div className="text-2xl font-bold text-green-600">{indicator.score}/10</div>
                        <Badge
                          variant={indicator.change.startsWith("+") ? "default" : "secondary"}
                          className={
                            indicator.change.startsWith("+")
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }
                        >
                          {indicator.change}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Homework */}
              <div>
                <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Tareas Asignadas
                </h3>
                <div className="space-y-2">
                  {clinicalSummary.homework.map((task, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border-l-4 border-amber-400"
                    >
                      <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
                      <span className="text-sm">{task}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next Session */}
              <div>
                <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Próxima Sesión - Enfoque Sugerido
                </h3>
                <div className="space-y-2">
                  {clinicalSummary.next_session_focus.map((focus, index) => (
                    <div key={index} className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400 text-sm">
                      {focus}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Export Options */}
      <Card className="bg-gray-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Resumen generado automáticamente • Tiempo de procesamiento: 2.3 segundos
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">
                Exportar PDF
              </Button>
              <Button size="sm" variant="outline">
                Copiar al Portapapeles
              </Button>
              <Button size="sm">Guardar en Historial</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
