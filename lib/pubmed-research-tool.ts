interface PubMedArticle {
  pmid: string
  title: string
  authors: string[]
  journal: string
  year: number
  abstract: string
  doi?: string
  url: string
}

interface PubMedSearchParams {
  query: string
  maxResults?: number
  dateRange?: string
  sortBy?: "relevance" | "date" | "citations"
}

export class PubMedResearchTool {
  private readonly baseUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
  private readonly apiKey?: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey
  }

  async searchPubMed(params: PubMedSearchParams): Promise<PubMedArticle[]> {
    const { query, maxResults = 10, dateRange, sortBy = "relevance" } = params

    try {
      // Step 1: Search for PMIDs with retry logic
      const searchUrl = this.buildSearchUrl(query, maxResults, dateRange, sortBy)
      const searchResponse = await this.fetchWithRetry(searchUrl, 'búsqueda de PMIDs')
      const searchData = await searchResponse.text()

      const pmids = this.extractPMIDs(searchData)

      if (pmids.length === 0) {
        return []
      }

      // Step 2: Fetch article details with retry logic
      const detailsUrl = this.buildDetailsUrl(pmids)
      const detailsResponse = await this.fetchWithRetry(detailsUrl, 'detalles de artículos')
      const detailsData = await detailsResponse.text()

      return this.parseArticleDetails(detailsData)
    } catch (error) {
      console.error("Error searching PubMed:", error)
      throw new Error("Failed to search PubMed database")
    }
  }

  private async fetchWithRetry(
    url: string, 
    operation: string, 
    maxRetries: number = 3, 
    timeoutMs: number = 10000
  ): Promise<Response> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[PubMedTool] Intento ${attempt}/${maxRetries} para ${operation}`)
        
        // Crear AbortController para timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
        
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'HopeAI-Research-Tool/1.0 (contact@hopeai.com)'
          }
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        // Rate limiting: esperar entre requests
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
        
        return response
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.warn(`[PubMedTool] Error en intento ${attempt} para ${operation}:`, lastError.message)
        
        // Si es el último intento, lanzar el error
        if (attempt === maxRetries) {
          break
        }
        
        // Backoff exponencial: esperar más tiempo entre reintentos
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        console.log(`[PubMedTool] Esperando ${backoffMs}ms antes del siguiente intento...`)
        await new Promise(resolve => setTimeout(resolve, backoffMs))
      }
    }
    
    throw new Error(`Falló ${operation} después de ${maxRetries} intentos. Último error: ${lastError?.message}`)
  }

  private buildSearchUrl(query: string, maxResults: number, dateRange?: string, sortBy?: string): string {
    const params = new URLSearchParams({
      db: "pubmed",
      term: this.enhanceQuery(query),
      retmax: maxResults.toString(),
      retmode: "xml",
      sort: sortBy === "date" ? "pub_date" : "relevance",
    })

    if (dateRange) {
      params.append("datetype", "pdat")
      params.append("reldate", this.convertDateRange(dateRange))
    }

    if (this.apiKey) {
      params.append("api_key", this.apiKey)
    }

    return `${this.baseUrl}/esearch.fcgi?${params.toString()}`
  }

  private buildDetailsUrl(pmids: string[]): string {
    const params = new URLSearchParams({
      db: "pubmed",
      id: pmids.join(","),
      retmode: "xml",
      rettype: "abstract",
    })

    if (this.apiKey) {
      params.append("api_key", this.apiKey)
    }

    return `${this.baseUrl}/efetch.fcgi?${params.toString()}`
  }

  private enhanceQuery(query: string): string {
    // Add psychology and clinical terms to improve relevance
    const clinicalTerms = [
      "psychology[MeSH]",
      "psychotherapy[MeSH]",
      "mental health[MeSH]",
      "clinical psychology[MeSH]",
    ]

    // Check if query already contains field tags
    if (query.includes("[") && query.includes("]")) {
      return query
    }

    // Add clinical context to general queries
    return `(${query}) AND (${clinicalTerms.join(" OR ")})`
  }

  private convertDateRange(dateRange: string): string {
    switch (dateRange) {
      case "last_year":
        return "365"
      case "last_5_years":
        return "1825"
      case "last_10_years":
        return "3650"
      default:
        return "1825" // Default to 5 years
    }
  }

  private extractPMIDs(xmlData: string): string[] {
    const pmids: string[] = []
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlData, "text/xml")

    const idElements = doc.querySelectorAll("Id")
    idElements.forEach((element) => {
      const pmid = element.textContent?.trim()
      if (pmid) {
        pmids.push(pmid)
      }
    })

    return pmids
  }

  private parseArticleDetails(xmlData: string): PubMedArticle[] {
    const articles: PubMedArticle[] = []
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlData, "text/xml")

    const articleElements = doc.querySelectorAll("PubmedArticle")

    articleElements.forEach((articleElement) => {
      try {
        const pmid = articleElement.querySelector("PMID")?.textContent?.trim() || ""
        const title = articleElement.querySelector("ArticleTitle")?.textContent?.trim() || ""

        // Extract authors
        const authorElements = articleElement.querySelectorAll("Author")
        const authors: string[] = []
        authorElements.forEach((authorElement) => {
          const lastName = authorElement.querySelector("LastName")?.textContent?.trim()
          const foreName = authorElement.querySelector("ForeName")?.textContent?.trim()
          if (lastName) {
            authors.push(foreName ? `${lastName}, ${foreName}` : lastName)
          }
        })

        // Extract journal info
        const journal = articleElement.querySelector("Title")?.textContent?.trim() || ""
        const yearElement = articleElement.querySelector("PubDate Year")
        const year = yearElement ? Number.parseInt(yearElement.textContent?.trim() || "0") : 0

        // Extract abstract
        const abstractElements = articleElement.querySelectorAll("AbstractText")
        let abstract = ""
        abstractElements.forEach((element) => {
          const label = element.getAttribute("Label")
          const text = element.textContent?.trim() || ""
          if (label) {
            abstract += `${label}: ${text}\n`
          } else {
            abstract += `${text}\n`
          }
        })

        // Extract DOI
        const doiElement = articleElement.querySelector("ELocationID[EIdType='doi']")
        const doi = doiElement?.textContent?.trim()

        if (pmid && title) {
          articles.push({
            pmid,
            title,
            authors,
            journal,
            year,
            abstract: abstract.trim(),
            doi,
            url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          })
        }
      } catch (error) {
        console.error("Error parsing article:", error)
      }
    })

    return articles
  }

  formatSearchResults(articles: PubMedArticle[]): string {
    if (articles.length === 0) {
      return "No se encontraron artículos relevantes en PubMed."
    }

    return articles
      .map((article, index) => {
        const authorsText =
          article.authors.length > 3 ? `${article.authors.slice(0, 3).join(", ")} et al.` : article.authors.join(", ")

        return `
**${index + 1}. ${article.title}**
*Autores:* ${authorsText}
*Revista:* ${article.journal} (${article.year})
*PMID:* ${article.pmid}
*URL:* ${article.url}

*Resumen:*
${article.abstract.substring(0, 300)}${article.abstract.length > 300 ? "..." : ""}

---`
      })
      .join("\n\n")
  }

  // Function declaration for Google Gen AI SDK
  getToolDeclaration() {
    return {
      name: "searchPubMed",
      description: "Search PubMed database for scientific articles related to psychology and clinical practice",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query using medical/psychological terminology",
          },
          maxResults: {
            type: "number",
            description: "Maximum number of results to return (default: 10, max: 20)",
            minimum: 1,
            maximum: 20,
          },
          dateRange: {
            type: "string",
            description: "Date range for articles",
            enum: ["last_year", "last_5_years", "last_10_years"],
          },
          sortBy: {
            type: "string",
            description: "Sort results by relevance or date",
            enum: ["relevance", "date"],
          },
        },
        required: ["query"],
      },
    }
  }

  async executeTool(parameters: any): Promise<{ output?: string; error?: { code: number; message: string; details: string[] } }> {
    try {
      // Validación robusta de parámetros
      if (!parameters || typeof parameters !== 'object') {
        return {
          error: {
            code: 400,
            message: "Parámetros inválidos",
            details: ["Los parámetros deben ser un objeto válido"]
          }
        }
      }

      const { query, maxResults = 10, dateRange, sortBy = "relevance" } = parameters

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return {
          error: {
            code: 400,
            message: "Query de búsqueda requerido",
            details: ["Debe proporcionar un término de búsqueda válido"]
          }
        }
      }

      if (maxResults && (typeof maxResults !== 'number' || maxResults < 1 || maxResults > 20)) {
        return {
          error: {
            code: 400,
            message: "Número de resultados inválido",
            details: ["maxResults debe ser un número entre 1 y 20"]
          }
        }
      }

      const articles = await this.searchPubMed(parameters)
      const formattedResults = this.formatSearchResults(articles)
      
      return {
        output: formattedResults
      }
    } catch (error) {
      console.error('[PubMedTool] Error en executeTool:', error)
      
      // Manejo estructurado de diferentes tipos de errores
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return {
          error: {
            code: 503,
            message: "Error de conectividad con PubMed",
            details: ["No se pudo conectar con la base de datos de PubMed. Verifique su conexión a internet."]
          }
        }
      }
      
      if (error instanceof Error && error.message.includes('timeout')) {
        return {
          error: {
            code: 408,
            message: "Timeout en la búsqueda",
            details: ["La búsqueda en PubMed tardó demasiado tiempo. Intente con términos más específicos."]
          }
        }
      }
      
      return {
        error: {
          code: 500,
          message: "Error interno en la búsqueda",
          details: [error instanceof Error ? error.message : "Error desconocido en PubMed"]
        }
      }
    }
  }
}

// Singleton instance
export const pubmedTool = new PubMedResearchTool()
