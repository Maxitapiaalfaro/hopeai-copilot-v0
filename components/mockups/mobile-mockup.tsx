"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Smartphone, Brain, Upload, Mic } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function MobileMockup() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <Smartphone className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Experiencia Móvil</h2>
              <p className="text-sm text-blue-700 font-normal">Interfaz optimizada para smartphones y tablets</p>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Key Mobile Features */}
      <div className="grid md:grid-cols-2 gap-6">
        {[
          {
            title: "Navegación por Gestos",
            icon: Smartphone,
            description: "Desliza para cambiar entre agentes y conversaciones",
            color: "blue",
          },
          {
            title: "Entrada de Voz",
            icon: Mic,
            description: "Dictado clínico manos libres con transcripción automática",
            color: "amber",
          },
          {
            title: "Carga Rápida de Documentos",
            icon: Upload,
            description: "Usa la cámara o archivos locales para adjuntar documentos",
            color: "indigo",
          },
          {
            title: "Indicadores Claros de Agente",
            icon: Brain,
            description: "Colores y símbolos coherentes para cada especialista",
            color: "green",
          },
        ].map((item, idx) => {
          const Icon = item.icon
          return (
            <Card key={idx} className="flex">
              <CardContent className="flex gap-4 p-4 items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center bg-${item.color}-100 text-${item.color}-600`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-medium">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Mobile Chat Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-gray-600" />
            Vista Previa del Chat en Móvil
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="mx-auto w-[240px] h-[480px] rounded-[2rem] border-4 border-gray-800 overflow-hidden shadow-lg">
            <div className="h-8 bg-gray-800 flex items-center justify-center text-gray-100 text-xs">14:32</div>
            <div className="flex-1 p-3 space-y-2 overflow-y-auto bg-white">
              {/* User bubble */}
              <div className="flex justify-end">
                <div className="bg-blue-600 text-white rounded-lg p-2 text-xs max-w-[70%]">
                  ¿Me ayudas a resumir la sesión de hoy?
                </div>
              </div>
              {/* Agent bubble */}
              <div className="flex justify-start">
                <div className="bg-green-50 border border-green-200 text-gray-800 rounded-lg p-2 text-xs max-w-[70%]">
                  Claro, activando <strong>HopeAI&nbsp;Clínico</strong> para generar el resumen estructurado.
                </div>
              </div>
            </div>
            <div className="p-2 border-t flex items-center gap-2 bg-gray-50">
              <input
                disabled
                className="flex-1 h-8 bg-white border rounded px-2 text-xs"
                placeholder="Escribe un mensaje..."
              />
              <button className="p-1 bg-blue-600 rounded text-white">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
                </svg>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="bg-gray-50">
        <CardContent className="p-4 flex flex-wrap gap-2">
          <Badge className="bg-blue-100 text-blue-700">HopeAI Socrático</Badge>
          <Badge className="bg-green-100 text-green-700">HopeAI Clínico</Badge>
          <Badge className="bg-purple-100 text-purple-700">HopeAI Académico</Badge>
        </CardContent>
      </Card>
    </div>
  )
}
