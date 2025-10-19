/**
 * Parallel AI Search Integration
 *
 * Sistema de búsqueda web avanzada usando Parallel AI para investigación académica.
 * Optimizado para retornar excerpts comprimidos y rankeados específicamente para LLMs.
 *
 * Ventajas sobre Google Search:
 * - Excerpts optimizados para consumo de LLMs
 * - Búsqueda semántica con objective + search_queries
 * - Control granular de dominios (include/exclude)
 * - Procesadores especializados (base/pro)
 * - Rate limits generosos (600 req/min)
 *
 * 🧪 MODO PRUEBA: Sin restricción de dominios (source_policy deshabilitado)
 * Last modified: 2025-01-18 - Removed domain restrictions
 */

import Parallel from 'parallel-web'
import type { ValidatedAcademicSource } from './academic-source-validator'

// ============================================================================
// INTERFACES
// ============================================================================

export interface ParallelSearchParams {
  objective: string
  searchQueries?: string[]
  maxResults?: number
  maxCharsPerResult?: number
  processor?: 'base' | 'pro'
  sourceDomains?: {
    include?: string[]
    exclude?: string[]
  }
}

export interface ParallelSearchResult {
  url: string
  title: string
  excerpts: string[]
}

// ============================================================================
// DOMINIOS ACADÉMICOS CONFIABLES
// ============================================================================

const TRUSTED_ACADEMIC_DOMAINS = {
  tier1: [
    'pubmed.ncbi.nlm.nih.gov',
    'apa.org',
    'psycnet.apa.org',
    'cochrane.org',
    'nature.com',
    'science.org',
    'thelancet.com',
    'bmj.com',
    'jamanetwork.com'
  ],
  tier2: [
    'sciencedirect.com',
    'springer.com',
    'wiley.com',
    'tandfonline.com',
    'sagepub.com',
    'frontiersin.org',
    'plos.org',
    'mdpi.com',
    'cambridge.org',
    'oxford.org'
  ],
  tier3: [
    'researchgate.net',
    'academia.edu',
    'scholar.google.com',
    'semanticscholar.org',
    'arxiv.org',
    'biorxiv.org',
    'psyarxiv.com'
  ]
}

// Dominios a excluir por defecto
const EXCLUDED_DOMAINS = [
  'reddit.com',
  'quora.com',
  'facebook.com',
  'twitter.com',
  'instagram.com',
  'tiktok.com',
  'youtube.com',
  'pinterest.com'
]

// ============================================================================
// CLASE PRINCIPAL: ParallelAISearch
// ============================================================================

export class ParallelAISearch {
  private client: Parallel | null = null
  private searchCache: Map<string, ParallelSearchResult[]> = new Map()
  private readonly cacheTTL = 24 * 60 * 60 * 1000 // 24 horas

  constructor(apiKey?: string) {
    // Solo inicializar si hay API key
    if (apiKey && apiKey.length > 0) {
      try {
        this.client = new Parallel({ apiKey })
        console.log('[ParallelAI] Cliente inicializado correctamente')
      } catch (error) {
        console.error('[ParallelAI] Error al inicializar cliente:', error)
        this.client = null
      }
    } else {
      console.warn('[ParallelAI] No se proporcionó API key. Búsqueda deshabilitada.')
    }
  }

  /**
   * Verifica si el cliente está disponible
   */
  isAvailable(): boolean {
    return this.client !== null
  }

  /**
   * Búsqueda académica usando Parallel AI
   */
  async searchAcademic(params: ParallelSearchParams): Promise<ValidatedAcademicSource[]> {
    if (!this.client) {
      console.warn('[ParallelAI] Cliente no disponible. Retornando array vacío.')
      return []
    }

    const {
      objective,
      searchQueries = [],
      maxResults = 10,
      maxCharsPerResult = 6000,
      processor = 'pro', // Usar 'pro' por defecto para investigación académica
      sourceDomains
    } = params

    // Verificar caché
    const cacheKey = JSON.stringify(params)
    const cached = this.searchCache.get(cacheKey)
    if (cached) {
      console.log('[ParallelAI] Retornando desde caché')
      return this.transformToAcademicSources(cached)
    }

    try {
      console.log('🔍 [ParallelAI] === INICIANDO BÚSQUEDA ACADÉMICA ===')
      console.log(`  📝 Objective: ${objective.substring(0, 100)}...`)
      console.log(`  🔎 Queries: ${searchQueries.join(', ')}`)
      console.log(`  ⚙️  Processor: ${processor}`)

      // 🧪 MODO PRUEBA: SIN source_policy para evitar límite de 10 dominios
      // Parallel AI buscará en toda la web y nosotros filtraremos después
      console.log('🧪 [ParallelAI] MODO PRUEBA: Búsqueda sin restricción de dominios')

      // Ejecutar búsqueda con Parallel AI SIN source_policy
      const search = await this.client.beta.search({
        objective,
        search_queries: searchQueries.length > 0 ? searchQueries : undefined,
        processor,
        max_results: maxResults,
        max_chars_per_result: maxCharsPerResult
        // source_policy comentado temporalmente para testing
        // source_policy: {
        //   include_domains: includeList,
        //   exclude_domains: excludeList
        // }
      })

      console.log(`[ParallelAI] Encontrados ${search.results?.length || 0} resultados`)

      // Guardar en caché
      if (search.results && search.results.length > 0) {
        this.searchCache.set(cacheKey, search.results)
        
        // Limpiar caché antiguo
        setTimeout(() => {
          this.searchCache.delete(cacheKey)
        }, this.cacheTTL)
      }

      // Transformar a formato ValidatedAcademicSource
      return this.transformToAcademicSources(search.results || [])

    } catch (error) {
      console.error('[ParallelAI] Error en búsqueda:', error)
      if (error instanceof Error) {
        console.error('[ParallelAI] Error message:', error.message)
        console.error('[ParallelAI] Error stack:', error.stack)
      }
      // Log del objeto completo para debugging
      console.error('[ParallelAI] Error object:', JSON.stringify(error, null, 2))
      return []
    }
  }

  /**
   * Transforma resultados de Parallel AI al formato ValidatedAcademicSource
   */
  private transformToAcademicSources(results: any[]): ValidatedAcademicSource[] {
    return results.map(result => {
      const excerpts = Array.isArray(result.excerpts) ? result.excerpts : []
      const fullText = excerpts.join(' ')
      
      return {
        url: result.url || '',
        title: result.title || 'Sin título',
        doi: this.extractDOI(fullText),
        authors: this.extractAuthors(fullText),
        year: this.extractYear(fullText),
        journal: this.extractJournal(result.title, fullText),
        abstract: excerpts.length > 0 ? excerpts[0] : '',
        sourceType: 'parallel_ai' as const,
        trustScore: this.calculateTrustScore(result),
        isAccessible: true,
        validatedAt: new Date(), // Debe ser Date, no string
        excerpts // Mantener excerpts originales de Parallel AI
      }
    })
  }

  /**
   * Extrae DOI de texto usando regex
   */
  private extractDOI(text: string): string | undefined {
    const doiPatterns = [
      /\b(10\.\d{4,}\/[^\s]+)/gi,
      /doi:\s*(10\.\d{4,}\/[^\s]+)/gi,
      /https?:\/\/doi\.org\/(10\.\d{4,}\/[^\s]+)/gi
    ]

    for (const pattern of doiPatterns) {
      const match = text.match(pattern)
      if (match) {
        let doi = match[0]
        // Limpiar prefijos
        doi = doi.replace(/^doi:\s*/i, '')
        doi = doi.replace(/^https?:\/\/doi\.org\//i, '')
        // Limpiar sufijos comunes
        doi = doi.replace(/[.,;)\]]+$/, '')
        return doi
      }
    }

    return undefined
  }

  /**
   * Extrae autores de texto (heurística simple)
   */
  private extractAuthors(text: string): string[] {
    // Buscar patrones como "Author A, Author B, et al."
    const authorPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+et\s+al\.)?)/g
    const matches = text.match(authorPattern)
    
    if (matches && matches.length > 0) {
      // Tomar los primeros 3 autores únicos
      const uniqueAuthors = [...new Set(matches)].slice(0, 3)
      return uniqueAuthors
    }

    return []
  }

  /**
   * Extrae año de publicación
   */
  private extractYear(text: string): number | undefined {
    const yearPattern = /\b(19|20)\d{2}\b/g
    const matches = text.match(yearPattern)
    
    if (matches && matches.length > 0) {
      // Tomar el año más reciente encontrado
      const years = matches.map(y => parseInt(y))
      return Math.max(...years)
    }

    return undefined
  }

  /**
   * Extrae nombre de journal (heurística basada en título y texto)
   */
  private extractJournal(title: string, text: string): string | undefined {
    // Buscar patrones comunes de journals
    const journalPatterns = [
      /published in ([A-Z][^.,]+)/i,
      /journal of ([^.,]+)/i,
      /([A-Z][a-z]+ (?:Journal|Review|Medicine|Psychology|Psychiatry))/
    ]

    for (const pattern of journalPatterns) {
      const match = text.match(pattern)
      if (match) {
        return match[1] || match[0]
      }
    }

    return undefined
  }

  /**
   * Calcula trust score basado en dominio y presencia de DOI
   */
  private calculateTrustScore(result: any): number {
    let score = 50 // Base score

    try {
      const hostname = new URL(result.url).hostname.toLowerCase()
      
      // Factor 1: Dominio académico
      if (TRUSTED_ACADEMIC_DOMAINS.tier1.some(domain => hostname.includes(domain))) {
        score += 30
      } else if (TRUSTED_ACADEMIC_DOMAINS.tier2.some(domain => hostname.includes(domain))) {
        score += 20
      } else if (TRUSTED_ACADEMIC_DOMAINS.tier3.some(domain => hostname.includes(domain))) {
        score += 10
      }

      // Factor 2: Presencia de DOI en excerpts
      const fullText = Array.isArray(result.excerpts) ? result.excerpts.join(' ') : ''
      if (this.extractDOI(fullText)) {
        score += 15
      }

      // Factor 3: Longitud de excerpts (más contenido = más confiable)
      if (fullText.length > 1000) {
        score += 5
      }

    } catch (error) {
      // URL inválida
      score -= 20
    }

    return Math.min(100, Math.max(0, score))
  }
}

// ============================================================================
// INSTANCIA SINGLETON (SOLO SERVIDOR)
// ============================================================================

// Solo inicializar en el servidor para evitar problemas de CORS
const isServer = typeof window === 'undefined'

export const parallelAISearch = isServer
  ? new ParallelAISearch(process.env.PARALLEL_API_KEY) // Variable de servidor (sin NEXT_PUBLIC_)
  : new ParallelAISearch() // Cliente sin API key (deshabilitado)

