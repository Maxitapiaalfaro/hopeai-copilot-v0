"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pubmedTool = exports.PubMedResearchTool = void 0;
class PubMedResearchTool {
    constructor(apiKey) {
        this.baseUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
        this.apiKey = apiKey;
    }
    async searchPubMed(params) {
        const { query, maxResults = 10, dateRange, sortBy = "relevance" } = params;
        try {
            // Step 1: Search for PMIDs
            const searchUrl = this.buildSearchUrl(query, maxResults, dateRange, sortBy);
            const searchResponse = await fetch(searchUrl);
            const searchData = await searchResponse.text();
            const pmids = this.extractPMIDs(searchData);
            if (pmids.length === 0) {
                return [];
            }
            // Step 2: Fetch article details
            const detailsUrl = this.buildDetailsUrl(pmids);
            const detailsResponse = await fetch(detailsUrl);
            const detailsData = await detailsResponse.text();
            return this.parseArticleDetails(detailsData);
        }
        catch (error) {
            console.error("Error searching PubMed:", error);
            throw new Error("Failed to search PubMed database");
        }
    }
    buildSearchUrl(query, maxResults, dateRange, sortBy) {
        const params = new URLSearchParams({
            db: "pubmed",
            term: this.enhanceQuery(query),
            retmax: maxResults.toString(),
            retmode: "xml",
            sort: sortBy === "date" ? "pub_date" : "relevance",
        });
        if (dateRange) {
            params.append("datetype", "pdat");
            params.append("reldate", this.convertDateRange(dateRange));
        }
        if (this.apiKey) {
            params.append("api_key", this.apiKey);
        }
        return `${this.baseUrl}/esearch.fcgi?${params.toString()}`;
    }
    buildDetailsUrl(pmids) {
        const params = new URLSearchParams({
            db: "pubmed",
            id: pmids.join(","),
            retmode: "xml",
            rettype: "abstract",
        });
        if (this.apiKey) {
            params.append("api_key", this.apiKey);
        }
        return `${this.baseUrl}/efetch.fcgi?${params.toString()}`;
    }
    enhanceQuery(query) {
        // Add psychology and clinical terms to improve relevance
        const clinicalTerms = [
            "psychology[MeSH]",
            "psychotherapy[MeSH]",
            "mental health[MeSH]",
            "clinical psychology[MeSH]",
        ];
        // Check if query already contains field tags
        if (query.includes("[") && query.includes("]")) {
            return query;
        }
        // Add clinical context to general queries
        return `(${query}) AND (${clinicalTerms.join(" OR ")})`;
    }
    convertDateRange(dateRange) {
        switch (dateRange) {
            case "last_year":
                return "365";
            case "last_5_years":
                return "1825";
            case "last_10_years":
                return "3650";
            default:
                return "1825"; // Default to 5 years
        }
    }
    extractPMIDs(xmlData) {
        const pmids = [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlData, "text/xml");
        const idElements = doc.querySelectorAll("Id");
        idElements.forEach((element) => {
            const pmid = element.textContent?.trim();
            if (pmid) {
                pmids.push(pmid);
            }
        });
        return pmids;
    }
    parseArticleDetails(xmlData) {
        const articles = [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlData, "text/xml");
        const articleElements = doc.querySelectorAll("PubmedArticle");
        articleElements.forEach((articleElement) => {
            try {
                const pmid = articleElement.querySelector("PMID")?.textContent?.trim() || "";
                const title = articleElement.querySelector("ArticleTitle")?.textContent?.trim() || "";
                // Extract authors
                const authorElements = articleElement.querySelectorAll("Author");
                const authors = [];
                authorElements.forEach((authorElement) => {
                    const lastName = authorElement.querySelector("LastName")?.textContent?.trim();
                    const foreName = authorElement.querySelector("ForeName")?.textContent?.trim();
                    if (lastName) {
                        authors.push(foreName ? `${lastName}, ${foreName}` : lastName);
                    }
                });
                // Extract journal info
                const journal = articleElement.querySelector("Title")?.textContent?.trim() || "";
                const yearElement = articleElement.querySelector("PubDate Year");
                const year = yearElement ? Number.parseInt(yearElement.textContent?.trim() || "0") : 0;
                // Extract abstract
                const abstractElements = articleElement.querySelectorAll("AbstractText");
                let abstract = "";
                abstractElements.forEach((element) => {
                    const label = element.getAttribute("Label");
                    const text = element.textContent?.trim() || "";
                    if (label) {
                        abstract += `${label}: ${text}\n`;
                    }
                    else {
                        abstract += `${text}\n`;
                    }
                });
                // Extract DOI
                const doiElement = articleElement.querySelector("ELocationID[EIdType='doi']");
                const doi = doiElement?.textContent?.trim();
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
                    });
                }
            }
            catch (error) {
                console.error("Error parsing article:", error);
            }
        });
        return articles;
    }
    formatSearchResults(articles) {
        if (articles.length === 0) {
            return "No se encontraron artículos relevantes en PubMed.";
        }
        return articles
            .map((article, index) => {
            const authorsText = article.authors.length > 3 ? `${article.authors.slice(0, 3).join(", ")} et al.` : article.authors.join(", ");
            return `
**${index + 1}. ${article.title}**
*Autores:* ${authorsText}
*Revista:* ${article.journal} (${article.year})
*PMID:* ${article.pmid}
*URL:* ${article.url}

*Resumen:*
${article.abstract.substring(0, 300)}${article.abstract.length > 300 ? "..." : ""}

---`;
        })
            .join("\n\n");
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
        };
    }
    async executeTool(parameters) {
        try {
            const articles = await this.searchPubMed(parameters);
            return this.formatSearchResults(articles);
        }
        catch (error) {
            return `Error al buscar en PubMed: ${error instanceof Error ? error.message : "Error desconocido"}`;
        }
    }
}
exports.PubMedResearchTool = PubMedResearchTool;
// Singleton instance
exports.pubmedTool = new PubMedResearchTool();
