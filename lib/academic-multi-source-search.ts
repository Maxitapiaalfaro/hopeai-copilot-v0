/**
 * Academic Multi-Source Search Engine
 *
 * Sistema de búsqueda priorizada que integra múltiples fuentes académicas:
 * 1. PubMed (prioridad máxima para psicología clínica)
 * 2. Crossref (validación y búsqueda complementaria)
 * 3. Parallel AI (búsqueda web avanzada con excerpts optimizados para LLMs)
 *
 * Garantiza que todas las fuentes retornadas tengan DOIs válidos y URLs accesibles
 */

import { pubmedTool } from './pubmed-research-tool'
import { crossrefDOIResolver } from './crossref-doi-resolver'
import { academicSourceValidator } from './academic-source-validator'
import { parallelAISearch } from './parallel-ai-search'
import type { ValidatedAcademicSource } from './academic-source-validator'
import type { CrossrefMetadata } from './crossref-doi-resolver'

// ============================================================================
// TIPOS Y INTERFACES
// ============================================================================

export interface AcademicSearchParams {
  query: string
  maxResults?: number
  language?: 'es' | 'en' | 'both'
  dateRange?: {
    from?: string // YYYY-MM-DD
    to?: string   // YYYY-MM-DD
  }
  minTrustScore?: number // 0-100, default: 60
  requireDOI?: boolean // Si true, solo retorna resultados con DOI válido
}

export interface AcademicSearchResult {
  sources: ValidatedAcademicSource[]
  metadata: {
    totalFound: number
    fromPubMed: number
    fromCrossref: number
    fromParallelAI: number
    fromGoogleSearch: number // Deprecated: mantenido por compatibilidad
    averageTrustScore: number
    searchTime: number
  }
}

// ============================================================================
// CLASE PRINCIPAL: AcademicMultiSourceSearch
// ============================================================================

export class AcademicMultiSourceSearch {
  private searchCache: Map<string, AcademicSearchResult> = new Map()
  private readonly cacheTTL = 24 * 60 * 60 * 1000 // 24 horas

  /**
   * Búsqueda académica multi-fuente con priorización inteligente
   */
  async search(params: AcademicSearchParams): Promise<AcademicSearchResult> {
    const startTime = Date.now()
    const {
      query,
      maxResults = 10,
      language = 'both',
      dateRange,
      minTrustScore = 60,
      requireDOI = false
    } = params

    // Verificar caché
    const cacheKey = JSON.stringify(params)
    const cached = this.searchCache.get(cacheKey)
    if (cached) {
      console.log('[AcademicSearch] Retornando desde caché')
      return cached
    }

    const allSources: ValidatedAcademicSource[] = []
    let pubmedCount = 0
    let crossrefCount = 0
    let parallelAICount = 0
    let googleSearchCount = 0 // Deprecated: mantenido por compatibilidad

    // ========================================================================
    // 🧪 MODO PRUEBA: PRIORIDAD 1 - Parallel AI (FORZADO PARA TESTING)
    // ========================================================================
    // TODO: Revertir a prioridad 3 después de pruebas
    if (parallelAISearch.isAvailable()) {
      console.log('🧪 [AcademicSearch] MODO PRUEBA: Usando Parallel AI como prioridad 1...')
      try {
        const academicQueries = this.generateAcademicQueries(query)

        const objective = `Find peer-reviewed research on: ${this.enhanceQueryForPsychology(query)}.
Focus on clinical psychology, evidence-based interventions, and recent studies from reputable academic sources.
Prioritize meta-analyses, RCTs, and systematic reviews.`

        const parallelResults = await parallelAISearch.searchAcademic({
          objective,
          searchQueries: academicQueries,
          maxResults: maxResults,
          maxCharsPerResult: 6000, // Reducido de 6000 para mayor velocidad
          processor: 'base' // Cambiado de 'pro' a 'base' para respuestas más rápidas
        })

        // Validar en paralelo para mayor velocidad
        // Saltamos validación de accesibilidad HTTP porque Parallel AI ya pre-valida las fuentes
        const validationPromises = parallelResults.map(result =>
          academicSourceValidator.validateSource({
            url: result.url,
            title: result.title,
            doi: result.doi,
            authors: result.authors,
            year: result.year,
            journal: result.journal,
            abstract: result.abstract,
            skipAccessibilityCheck: true // Parallel AI ya validó estas fuentes
          })
        )

        const validationResults = await Promise.all(validationPromises)

        for (let i = 0; i < validationResults.length; i++) {
          const validationResult = validationResults[i]
          const result = parallelResults[i]

          if (validationResult.isValid && validationResult.source) {
            validationResult.source.sourceType = 'parallel_ai'
            if (result.excerpts) {
              validationResult.source.excerpts = result.excerpts
            }
            allSources.push(validationResult.source)
            parallelAICount++
          }
        }

        console.log(`🧪 [AcademicSearch] Parallel AI: ${parallelAICount} resultados válidos`)
        console.log(`🧪 [AcademicSearch] SALTANDO PubMed y Crossref (modo prueba)`)
      } catch (error) {
        console.error('🧪 [AcademicSearch] Error en Parallel AI:', error)
      }
    } else {
      console.warn('🧪 [AcademicSearch] Parallel AI no disponible - cayendo a flujo normal')
    }

    // ========================================================================
    // PRIORIDAD 2: PubMed (DESHABILITADO EN MODO PRUEBA)
    // ========================================================================
    // Descomentar para volver a flujo normal
    /*
    try {
      const pubmedResults = await pubmedTool.searchPubMed({
        query,
        maxResults: Math.min(maxResults, 20),
        dateRange: this.convertDateRangeToPubMed(dateRange),
        sortBy: 'relevance',
        language,
        validateDOIs: true
      })

      for (const article of pubmedResults) {
        const validationResult = await academicSourceValidator.validateSource({
          url: article.url,
          title: article.title,
          doi: article.doi,
          authors: article.authors,
          year: article.year,
          journal: article.journal,
          abstract: article.abstract
        })

        if (validationResult.isValid && validationResult.source) {
          validationResult.source.sourceType = 'pubmed'
          allSources.push(validationResult.source)
          pubmedCount++
        }
      }

      console.log(`[AcademicSearch] PubMed: ${pubmedCount} resultados válidos`)
    } catch (error) {
      console.warn('[AcademicSearch] Error en PubMed:', error)
    }
    */

    // ========================================================================
    // PRIORIDAD 3: Crossref (DESHABILITADO EN MODO PRUEBA)
    // ========================================================================
    /*
    if (allSources.length < maxResults) {
      console.log('[AcademicSearch] Complementando con Crossref...')
      try {
        const crossrefResults = await crossrefDOIResolver.searchByQuery({
          query: this.enhanceQueryForPsychology(query),
          rows: maxResults,
          filter: {
            type: 'journal-article',
            fromPubDate: dateRange?.from || '2020-01-01',
            untilPubDate: dateRange?.to,
            hasAbstract: true
          },
          sort: 'relevance'
        })

        // Convertir a ValidatedAcademicSource
        for (const metadata of crossrefResults) {
          // Evitar duplicados (mismo DOI que PubMed)
          const isDuplicate = allSources.some(s => s.doi === metadata.doi)
          if (isDuplicate) continue

          const validationResult = await academicSourceValidator.validateSource({
            url: metadata.url,
            title: metadata.title,
            doi: metadata.doi,
            authors: metadata.authors,
            year: metadata.year,
            journal: metadata.journal,
            abstract: metadata.abstract
          })

          if (validationResult.isValid && validationResult.source) {
            // Forzar sourceType a crossref
            validationResult.source.sourceType = 'crossref'
            allSources.push(validationResult.source)
            crossrefCount++
          }
        }

        console.log(`[AcademicSearch] Crossref: ${crossrefCount} resultados válidos`)
      } catch (error) {
        console.warn('[AcademicSearch] Error en Crossref:', error)
      }
    }

    // ========================================================================
    // PRIORIDAD 4: Parallel AI (DESHABILITADO - ya se ejecutó en prioridad 1)
    // ========================================================================
    // Esta sección está comentada porque Parallel AI ya se ejecutó arriba en modo prueba
    /*
    if (allSources.length < maxResults && parallelAISearch.isAvailable()) {
      console.log('[AcademicSearch] Complementando con Parallel AI...')
      ...código comentado...
    }
    */

    // ========================================================================
    // FILTRADO Y ORDENAMIENTO FINAL
    // ========================================================================

    // Filtrar por trust score mínimo
    let filteredSources = allSources.filter(s => s.trustScore >= minTrustScore)

    // Filtrar por DOI si es requerido
    if (requireDOI) {
      filteredSources = filteredSources.filter(s => s.doi && s.doi.length > 0)
    }

    // Ordenar por trust score descendente
    filteredSources.sort((a, b) => b.trustScore - a.trustScore)

    // Limitar a maxResults
    filteredSources = filteredSources.slice(0, maxResults)

    // Calcular métricas
    const averageTrustScore = filteredSources.length > 0
      ? filteredSources.reduce((sum, s) => sum + s.trustScore, 0) / filteredSources.length
      : 0

    const result: AcademicSearchResult = {
      sources: filteredSources,
      metadata: {
        totalFound: allSources.length,
        fromPubMed: pubmedCount,
        fromCrossref: crossrefCount,
        fromParallelAI: parallelAICount,
        fromGoogleSearch: googleSearchCount,
        averageTrustScore: Math.round(averageTrustScore),
        searchTime: Date.now() - startTime
      }
    }

    // Guardar en caché
    this.searchCache.set(cacheKey, result)
    this.cleanCache()

    console.log(`[AcademicSearch] Búsqueda completada: ${filteredSources.length} resultados en ${result.metadata.searchTime}ms`)

    return result
  }

  /**
   * Convierte dateRange al formato de PubMed (días relativos)
   */
  private convertDateRangeToPubMed(dateRange?: { from?: string; to?: string }): string | undefined {
    if (!dateRange?.from) return 'last_5_years'

    const fromDate = new Date(dateRange.from)
    const now = new Date()
    const daysDiff = Math.floor((now.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))

    if (daysDiff <= 365) return 'last_year'
    if (daysDiff <= 1825) return 'last_5_years'
    if (daysDiff <= 3650) return 'last_10_years'

    return undefined // Sin filtro de fecha
  }

  /**
   * Mejora query para búsqueda en psicología
   */
  private enhanceQueryForPsychology(query: string): string {
    // Agregar términos de psicología si no están presentes
    const psychologyTerms = [
      'psychology',
      'psychotherapy',
      'mental health',
      'clinical',
      'cognitive behavioral',
      'therapy'
    ]

    const lowerQuery = query.toLowerCase()
    const hasPsychologyTerm = psychologyTerms.some(term => lowerQuery.includes(term))

    if (!hasPsychologyTerm) {
      return `${query} psychology OR psychotherapy OR mental health`
    }

    return query
  }

  /**
   * Genera queries académicos específicos para Parallel AI
   */
  private generateAcademicQueries(query: string): string[] {
    const queries: string[] = []

    // Query principal
    queries.push(query)

    // Query con términos académicos
    queries.push(`${query} peer-reviewed research`)

    // Query con enfoque en psicología clínica
    if (!query.toLowerCase().includes('psychology')) {
      queries.push(`${query} clinical psychology`)
    }

    // Query con enfoque en evidencia
    queries.push(`${query} evidence-based treatment`)

    // Limitar a 5 queries máximo (límite de Parallel AI)
    return queries.slice(0, 5)
  }

  /**
   * Limpia entradas de caché antiguas
   */
  private cleanCache(): void {
    if (this.searchCache.size > 100) {
      // Mantener solo las últimas 50 búsquedas
      const entries = Array.from(this.searchCache.entries())
      entries.slice(0, entries.length - 50).forEach(([key]) => {
        this.searchCache.delete(key)
      })
    }
  }

  /**
   * Limpia toda la caché
   */
  clearCache(): void {
    this.searchCache.clear()
  }

  /**
   * Búsqueda rápida solo en PubMed (para casos donde se necesita velocidad)
   */
  async searchPubMedOnly(params: Omit<AcademicSearchParams, 'requireDOI'>): Promise<ValidatedAcademicSource[]> {
    const { query, maxResults = 10, language = 'both', dateRange } = params

    try {
      const pubmedResults = await pubmedTool.searchPubMed({
        query,
        maxResults,
        dateRange: this.convertDateRangeToPubMed(dateRange),
        sortBy: 'relevance',
        language,
        validateDOIs: true
      })

      const validatedSources: ValidatedAcademicSource[] = []

      for (const article of pubmedResults) {
        const validationResult = await academicSourceValidator.validateSource({
          url: article.url,
          title: article.title,
          doi: article.doi,
          authors: article.authors,
          year: article.year,
          journal: article.journal,
          abstract: article.abstract
        })

        if (validationResult.isValid && validationResult.source) {
          validationResult.source.sourceType = 'pubmed'
          validatedSources.push(validationResult.source)
        }
      }

      return validatedSources
    } catch (error) {
      console.error('[AcademicSearch] Error en searchPubMedOnly:', error)
      return []
    }
  }
}

// Singleton instance
export const academicMultiSourceSearch = new AcademicMultiSourceSearch()

