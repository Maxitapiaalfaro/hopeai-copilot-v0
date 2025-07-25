"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, Search, ExternalLink, Star, Calendar, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

export function AcademicoMockup() {
  const [searchQuery, setSearchQuery] = useState("terapia cognitivo conductual trastorno obsesivo compulsivo")
  const [isSearching, setIsSearching] = useState(false)

  const researchResults = [
    {
      title: "Effectiveness of Cognitive Behavioral Therapy for Obsessive-Compulsive Disorder: A Meta-Analysis",
      authors: "Öst, L. G., Havnen, A., Hansen, B., & Kvale, G.",
      journal: "Clinical Psychology Review",
      year: 2015,
      impact_factor: 8.9,
      citations: 342,
      relevance: 95,
      abstract:
        "This meta-analysis examined the effectiveness of CBT for OCD across 16 randomized controlled trials...",
      key_findings: [
        "CBT mostró efectos grandes (d = 1.31) comparado con lista de espera",
        "ERP (Exposición y Prevención de Respuesta) fue el componente más efectivo",
        "Efectos se mantuvieron en seguimientos de 6-12 meses",
      ],
      clinical_implications: [
        "CBT debe ser tratamiento de primera línea para TOC",
        "Componente de ERP es esencial para efectividad",
        "Mínimo 12-16 sesiones recomendadas",
      ],
    },
    {
      title: "Internet-delivered cognitive behavior therapy for obsessive-compulsive disorder: A systematic review",
      authors: "Andersson, E., Hedman, E., Ljótsson, B., & Rück, C.",
      journal: "Journal of Obsessive-Compulsive and Related Disorders",
      year: 2017,
      impact_factor: 3.2,
      citations: 128,
      relevance: 88,
      abstract: "Systematic review of internet-delivered CBT interventions for OCD treatment effectiveness...",
      key_findings: [
        "iCBT mostró efectividad comparable a CBT presencial",
        "Tasas de abandono menores en formato digital",
        "Costo-efectividad superior en poblaciones rurales",
      ],
      clinical_implications: [
        "iCBT viable para pacientes con acceso limitado",
        "Requiere adaptaciones específicas para TOC",
        "Supervisión profesional sigue siendo necesaria",
      ],
    },
    {
      title: "Acceptance and Commitment Therapy for Obsessive-Compulsive Disorder: A Systematic Review",
      authors: "Twohig, M. P., Hayes, S. C., Plumb, J. C., & Pruitt, L. D.",
      journal: "Behavior Therapy",
      year: 2010,
      impact_factor: 4.8,
      citations: 267,
      relevance: 82,
      abstract: "Review of ACT interventions for OCD, examining effectiveness and mechanisms of change...",
      key_findings: [
        "ACT mostró efectividad prometedora como alternativa a CBT",
        "Especialmente efectiva para casos resistentes a tratamiento",
        "Enfoque en flexibilidad psicológica vs. control de síntomas",
      ],
      clinical_implications: [
        "Considerar ACT para casos complejos o resistentes",
        "Puede combinarse con elementos de ERP",
        "Útil cuando hay evitación experiencial alta",
      ],
    },
  ]

  const handleSearch = () => {
    setIsSearching(true)
    setTimeout(() => setIsSearching(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl">HopeAI Académico - Investigación Científica</h2>
              <p className="text-sm text-purple-700 font-normal">Acceso a evidencia científica actualizada</p>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Search Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-purple-600" />
            Búsqueda de Literatura Científica
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Describe tu consulta de investigación..."
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={isSearching} className="bg-purple-600 hover:bg-purple-700">
              {isSearching ? "Buscando..." : "Buscar"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="cursor-pointer hover:bg-purple-50">
              Terapia Cognitivo Conductual
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-purple-50">
              Trastorno Obsesivo Compulsivo
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-purple-50">
              Meta-análisis
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-purple-50">
              Ensayos Controlados
            </Badge>
          </div>

          {isSearching && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-3 text-purple-600">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
                <span>Analizando bases de datos académicas...</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Research Results */}
      {!isSearching && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Resultados de Investigación</h3>
            <Badge className="bg-purple-100 text-purple-700">{researchResults.length} estudios encontrados</Badge>
          </div>

          {researchResults.map((study, index) => (
            <Card key={index} className="border-l-4 border-purple-400">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg leading-tight mb-2">{study.title}</CardTitle>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {study.authors}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {study.year}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Badge variant="outline">{study.journal}</Badge>
                      <span className="text-gray-500">IF: {study.impact_factor}</span>
                      <span className="text-gray-500">{study.citations} citas</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium">{study.relevance}% relevante</span>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1 bg-transparent">
                      <ExternalLink className="h-3 w-3" />
                      Ver completo
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-purple-800 mb-2">Resumen</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">{study.abstract}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-purple-800 mb-2 flex items-center gap-1">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      Hallazgos Clave
                    </h4>
                    <ul className="space-y-1">
                      {study.key_findings.map((finding, fIndex) => (
                        <li key={fIndex} className="text-sm text-gray-700 flex items-start gap-2">
                          <div className="w-1 h-1 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                          {finding}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-purple-800 mb-2 flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      Implicaciones Clínicas
                    </h4>
                    <ul className="space-y-1">
                      {study.clinical_implications.map((implication, iIndex) => (
                        <li key={iIndex} className="text-sm text-gray-700 flex items-start gap-2">
                          <div className="w-1 h-1 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                          {implication}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Research Tools */}
      <Card className="bg-purple-50">
        <CardHeader>
          <CardTitle className="text-lg">Herramientas de Investigación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2 bg-transparent">
              <BookOpen className="h-6 w-6 text-purple-600" />
              <div className="text-center">
                <div className="font-medium">Generar Bibliografía</div>
                <div className="text-xs text-gray-500">Formato APA automático</div>
              </div>
            </Button>

            <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2 bg-transparent">
              <Search className="h-6 w-6 text-purple-600" />
              <div className="text-center">
                <div className="font-medium">Alertas de Investigación</div>
                <div className="text-xs text-gray-500">Notificaciones de nuevos estudios</div>
              </div>
            </Button>

            <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2 bg-transparent">
              <Star className="h-6 w-6 text-purple-600" />
              <div className="text-center">
                <div className="font-medium">Guardar Referencias</div>
                <div className="text-xs text-gray-500">Biblioteca personal</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
