"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  FileText,
  ImageIcon,
  Upload,
  X,
  Search,
  Eye,
  Download,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useHopeAI } from "@/hooks/use-hopeai"
import type { ChatState, ClinicalFile } from "@/types/clinical-types"

interface DocumentPanelProps {
  isOpen: boolean
  onClose: () => void
  currentSession: ChatState | null
}

export function DocumentPanel({ isOpen, onClose, currentSession }: DocumentPanelProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [documents, setDocuments] = useState<ClinicalFile[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const { uploadDocument } = useHopeAI()

  // Load documents when session changes
  useEffect(() => {
    const loadDocuments = async () => {
      if (currentSession) {
        setIsLoading(true)
        try {
          // Por ahora, usar una lista vacía hasta implementar la API de documentos
          // TODO: Implementar endpoint /api/documents para obtener archivos de la sesión
          setDocuments([])
        } catch (error) {
          console.error("Error loading documents:", error)
        } finally {
          setIsLoading(false)
        }
      }
    }

    loadDocuments()
  }, [currentSession])

  const filteredDocuments = documents.filter((doc) => doc.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = Array.from(e.dataTransfer.files)
    await handleFileUpload(files)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    await handleFileUpload(files)
  }

  const handleFileUpload = async (files: File[]) => {
    if (!currentSession) return

    for (const file of files) {
      try {
        const uploadedFile = await uploadDocument(file)
        if (uploadedFile) {
          setDocuments((prev) => [...prev, uploadedFile])
        }
      } catch (error) {
        console.error("Error uploading file:", error)
      }
    }
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return ImageIcon
    return FileText
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "processed":
        return (
          <Badge className="bg-green-100 text-green-700 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> Procesado
          </Badge>
        )
      case "processing":
        return (
          <Badge className="bg-blue-100 text-blue-700 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Procesando
          </Badge>
        )
      case "uploading":
        return (
          <Badge className="bg-yellow-100 text-yellow-700 flex items-center gap-1">
            <Upload className="h-3 w-3" /> Subiendo
          </Badge>
        )
      case "error":
        return (
          <Badge className="bg-red-100 text-red-700 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Error
          </Badge>
        )
      default:
        return null
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return (
    <div
      className={cn(
        "bg-white border-l border-gray-200 flex flex-col transition-all duration-300 shadow-lg",
        isOpen ? "w-80 md:w-96" : "w-0 overflow-hidden",
      )}
    >
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold">Documentos Clínicos</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="all" className="flex-1 flex flex-col">
        <div className="px-4 pt-2">
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">
              Todos ({documents.length})
            </TabsTrigger>
            <TabsTrigger value="processed" className="flex-1">
              Procesados ({documents.filter((d) => d.status === "processed").length})
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex-1">
              Subir
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all" className="flex-1 flex flex-col mt-0">
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar documentos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2">
              {isLoading ? (
                <div className="text-center p-4 text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  Cargando documentos...
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="text-center p-4 text-gray-500">
                  {searchQuery ? "No se encontraron documentos" : "No hay documentos subidos"}
                </div>
              ) : (
                filteredDocuments.map((doc) => {
                  const IconComponent = getFileIcon(doc.type)
                  const isSelected = selectedDocument === doc.id

                  return (
                    <Card
                      key={doc.id}
                      className={cn(
                        "mb-2 cursor-pointer hover:bg-gray-50 transition-colors",
                        isSelected && "ring-2 ring-blue-500 bg-blue-50",
                      )}
                      onClick={() => setSelectedDocument(isSelected ? null : doc.id)}
                    >
                      <div className="p-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center",
                              doc.type.includes("pdf") && "bg-red-100 text-red-700",
                              doc.type.includes("word") && "bg-blue-100 text-blue-700",
                              doc.type.includes("image") && "bg-green-100 text-green-700",
                              doc.type.includes("text") && "bg-gray-100 text-gray-700",
                            )}
                          >
                            <IconComponent className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{doc.name}</div>
                            <div className="flex items-center justify-between mt-1">
                              <div className="text-xs text-gray-500">{formatFileSize(doc.size)}</div>
                              <div className="text-xs text-gray-500">{doc.uploadDate.toLocaleDateString()}</div>
                            </div>
                            <div className="mt-2">{getStatusBadge(doc.status)}</div>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="mt-3 flex justify-between">
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0 bg-transparent">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0 bg-transparent">
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 bg-transparent"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="processed" className="flex-1 flex flex-col mt-0">
          <ScrollArea className="flex-1">
            <div className="p-4">
              {documents
                .filter((doc) => doc.status === "processed")
                .map((doc) => {
                  const IconComponent = getFileIcon(doc.type)

                  return (
                    <Card key={doc.id} className="mb-3 p-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            doc.type.includes("pdf") && "bg-red-100 text-red-700",
                            doc.type.includes("word") && "bg-blue-100 text-blue-700",
                            doc.type.includes("image") && "bg-green-100 text-green-700",
                            doc.type.includes("text") && "bg-gray-100 text-gray-700",
                          )}
                        >
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{doc.name}</div>
                          <div className="text-xs text-gray-500 mt-1">{doc.uploadDate.toLocaleDateString()}</div>
                        </div>
                      </div>
                    </Card>
                  )
                })}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="upload" className="flex-1 flex flex-col mt-0">
          <div className="p-4 flex-1 flex flex-col justify-center">
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors h-64 flex flex-col items-center justify-center",
                dragActive ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400",
              )}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 text-gray-400 mb-4" />
              <div className="space-y-2">
                <p className="text-lg font-medium text-gray-900">Arrastra archivos aquí</p>
                <p className="text-sm text-gray-500">PDF, Word, imágenes • Máx. 10MB</p>
              </div>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="hidden"
                id="document-upload"
              />
              <Button className="mt-4" onClick={() => document.getElementById("document-upload")?.click()}>
                Seleccionar Archivos
              </Button>
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-800">
                  <p className="font-medium mb-1">Procesamiento Inteligente:</p>
                  <p>
                    Los documentos serán analizados automáticamente y el sistema activará el agente especialista más
                    apropiado para tu consulta.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
