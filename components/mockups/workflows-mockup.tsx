"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, FileText, ImageIcon, CheckCircle, ArrowRight, Zap } from "lucide-react"

export function WorkflowsMockup() {
  const [uploadStep, setUploadStep] = useState(0)
  const [dragActive, setDragActive] = useState(false)

  const workflowSteps = [
    {
      title: "Carga de Documento",
      description: "Arrastra y suelta archivos clínicos",
      icon: Upload,
      status: "completed",
    },
    {
      title: "Procesamiento IA",
      description: "Análisis automático del contenido",
      icon: Zap,
      status: uploadStep >= 1 ? "completed" : "pending",
    },
    {
      title: "Detección de Agente",
      description: "Selección del especialista apropiado",
      icon: CheckCircle,
      status: uploadStep >= 2 ? "completed" : "pending",
    },
    {
      title: "Asistencia Clínica",
      description: "Respuesta especializada generada",
      icon: ArrowRight,
      status: uploadStep >= 3 ? "completed" : "pending",
    },
  ]

  const sampleDocuments = [
    {
      name: "Evaluación_Inicial_Paciente_MP.pdf",
      type: "application/pdf",
      size: "2.4 MB",
      status: "processed",
      agent: "clinico",
      insights: ["Síntomas de ansiedad identificados", "Historia familiar relevante", "Objetivos terapéuticos claros"],
    },
    {
      name: "Notas_Sesion_8_MP.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: "156 KB",
      status: "processing",
      agent: "socratico",
      insights: [],
    },
    {
      name: "Test_Ansiedad_Beck.jpg",
      type: "image/jpeg",
      size: "892 KB",
      status: "queued",
      agent: null,
      insights: [],
    },
  ]

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return ImageIcon
    return FileText
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "processed":
        return "bg-green-100 text-green-700"
      case "processing":
        return "bg-blue-100 text-blue-700"
      case "queued":
        return "bg-gray-100 text-gray-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  const getAgentColor = (agent: string | null) => {
    switch (agent) {
      case "socratico":
        return "bg-blue-100 text-blue-700"
      case "clinico":
        return "bg-green-100 text-green-700"
      case "academico":
        return "bg-purple-100 text-purple-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-indigo-50 to-blue-100 border-indigo-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center">
              <Upload className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl">Flujos de Trabajo Principales</h2>
              <p className="text-sm text-indigo-700 font-normal">Gestión inteligente de documentos y continuidad de sesiones</p>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Document Upload Workflow */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Gestión de Documentos Clínicos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drag and Drop Area */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                }`}
                onDragEnter={() => setDragActive(true)}
                onDragLeave={() => setDragActive(false)}
                onDrop={() => {
                  setDragActive(false)
                  setUploadStep(1)
                }}
              >
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <div className="space-y-2">
                  <p className="text-lg font-medium text-gray-900">Arrastra archivos aquí</p>
                  <p className="text-sm text-gray-500">PDF, Word, imágenes • Máx. 10MB</p>
                </div>
                <Button className="mt-4" onClick={() => setUploadStep(1)}>
                  Seleccionar Archivos
                </Button>
              </div>

              {/* Workflow Steps */}
              <div className="space-y-3">
                {workflowSteps.map((step, index) => {
                  const IconComponent = step.icon
