import MarkdownIt from 'markdown-it'
import { getAgentVisualConfig } from '@/config/agent-visual-config'
import type { AgentType } from '@/types/clinical-types'

// Instancia singleton optimizada de markdown-it para mensajes clínicos
let mdInstance: MarkdownIt | null = null

// Función para obtener la instancia configurada (lazy loading)
function getMarkdownInstance(): MarkdownIt {
  if (!mdInstance) {
    mdInstance = new MarkdownIt({
      html: true, // Permitir HTML para resaltado de menciones de agentes
      xhtmlOut: false,
      breaks: true, // Convertir saltos de línea en <br>
      linkify: true, // Autodetectar enlaces
      typographer: true, // Habilitar tipografía inteligente
    })
    
    // Configurar reglas de renderizado personalizadas
    configureCustomRules(mdInstance)
  }
  return mdInstance
}

// Configuración de reglas personalizadas separada para mejor mantenimiento
function configureCustomRules(md: MarkdownIt) {

  // Configurar reglas de renderizado personalizadas para el contexto clínico
  md.renderer.rules.heading_open = (tokens, idx) => {
    const token = tokens[idx]
    const level = token.tag.slice(1) // h1 -> 1, h2 -> 2, etc.
    const classes = {
      '1': 'text-xl font-serif font-semibold text-foreground mt-6 mb-3 border-b border-border pb-2 first:mt-0',
      '2': 'text-lg font-serif font-semibold text-foreground mt-5 mb-2 first:mt-0',
      '3': 'text-base font-serif font-semibold text-foreground mt-4 mb-1 first:mt-0',
      '4': 'font-semibold text-foreground mt-3 mb-1 first:mt-0',
      '5': 'font-medium text-muted-foreground mt-2 mb-1 first:mt-0',
      '6': 'font-normal text-muted-foreground mt-1 mb-1 first:mt-0'
    }
    return `<${token.tag} class="${classes[level as keyof typeof classes] || classes['3']}">`
  }

  // Personalizar listas para mejor legibilidad clínica
  md.renderer.rules.bullet_list_open = () => {
    return '<ul class="list-disc list-outside space-y-2 my-4 ml-6 pl-2">'
  }

  md.renderer.rules.ordered_list_open = () => {
    return '<ol class="list-decimal list-outside space-y-2 my-4 ml-6 pl-2">'
  }

  md.renderer.rules.list_item_open = () => {
    return '<li class="leading-relaxed pl-1">'
  }

  // Personalizar párrafos
  md.renderer.rules.paragraph_open = () => {
    return '<p class="leading-relaxed mb-4 last:mb-0">'
  }

  // Personalizar código inline y bloques
  md.renderer.rules.code_inline = (tokens, idx) => {
    const token = tokens[idx]
    return `<code class="bg-secondary text-foreground/80 px-1 py-0.5 rounded font-mono text-[0.9em]">${md.utils.escapeHtml(token.content)}</code>`
  }

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx]
    const langClass = token.info ? ` language-${md.utils.escapeHtml(token.info)}` : ''
    return `<pre class="bg-secondary/50 border border-border/80 rounded-lg p-4 my-4 overflow-x-auto"><code class="font-mono text-[0.9em]${langClass}">${md.utils.escapeHtml(token.content)}</code></pre>`
  }

  // Personalizar blockquotes para citas clínicas
  md.renderer.rules.blockquote_open = () => {
    return '<blockquote class="border-l-4 border-primary/50 bg-secondary/80 pl-4 py-2 my-4 italic">'
  }

  // Personalizar enlaces
  md.renderer.rules.link_open = (tokens, idx) => {
    const token = tokens[idx]
    const href = token.attrGet('href') || '#'
    return `<a href="${href}" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">`
  }

  // Personalizar tablas para datos clínicos
  md.renderer.rules.table_open = () => {
    return '<div class="overflow-x-auto my-4"><table class="min-w-full border border-border/80 rounded-lg">'
  }

  md.renderer.rules.table_close = () => {
    return '</table></div>'
  }

  md.renderer.rules.thead_open = () => {
    return '<thead class="bg-secondary/50">'
  }

  md.renderer.rules.th_open = () => {
    return '<th class="px-4 py-2 text-left font-sans font-semibold text-foreground border-b border-border/80">'
  }

  md.renderer.rules.td_open = () => {
    return '<td class="px-4 py-3 border-b border-border/50">'
  }
}

// Cache para resultados de parsing (mejora rendimiento en re-renders)
const parseCache = new Map<string, string>()
const MAX_CACHE_SIZE = 100

/**
 * Parsea texto markdown a HTML con estilos optimizados para contenido clínico
 * @param content - Contenido markdown a parsear
 * @returns HTML parseado y estilizado
 */
export function parseMarkdown(content: string): string {
  if (!content || typeof content !== 'string') {
    return ''
  }
  
  // Verificar cache primero
  const cacheKey = `static:${content}`
  if (parseCache.has(cacheKey)) {
    return parseCache.get(cacheKey)!
  }
  
  try {
    // Aplicar resaltado de menciones de agentes antes del parsing
    const contentWithHighlights = highlightAgentMentions(content)
    
    const md = getMarkdownInstance()
    const result = md.render(contentWithHighlights)
    
    // Agregar al cache (con límite de tamaño)
    if (parseCache.size >= MAX_CACHE_SIZE) {
      const firstKey = parseCache.keys().next().value
      if (firstKey) {
        parseCache.delete(firstKey)
      }
    }
    parseCache.set(cacheKey, result)
    
    return result
  } catch (error) {
    console.error('Error parsing markdown:', error)
    // Fallback: retornar el contenido original con saltos de línea convertidos
    return content.replace(/\n/g, '<br>')
  }
}

/**
 * Parsea texto markdown de forma incremental para streaming
 * Útil para mostrar contenido mientras se está recibiendo
 * @param content - Contenido markdown parcial
 * @returns HTML parseado que maneja contenido incompleto
 */
export function parseMarkdownStreaming(content: string): string {
  if (!content || typeof content !== 'string') {
    return ''
  }
  
  try {
    const md = getMarkdownInstance()
    
    // Para streaming, manejamos contenido incompleto de forma más inteligente
    let safeContent = content
    
    // Si termina con markdown incompleto, agregamos espacio para parsing seguro
    if (content.endsWith('*') || content.endsWith('_') || content.endsWith('`') || 
        content.endsWith('#') || content.endsWith('-') || content.endsWith('>')) {
      safeContent = content + ' '
    }
    
    // Aplicar resaltado de menciones de agentes antes del parsing
    const contentWithHighlights = highlightAgentMentions(safeContent)
    
    return md.render(contentWithHighlights)
  } catch (error) {
    console.error('Error parsing streaming markdown:', error)
    // Fallback más robusto para streaming
    return content.replace(/\n/g, '<br>')
  }
}

/**
 * Detecta y resalta menciones de agentes en el contenido
 * @param content - Contenido a procesar
 * @returns Contenido con menciones de agentes resaltadas
 */
export function highlightAgentMentions(content: string): string {
  if (!content || typeof content !== 'string') {
    return ''
  }

  let processedContent = content

  // Patrones para detectar menciones exactas de agentes
  const agentPatterns = [
    { pattern: /\bSupervisor Clínico\b/g, type: 'socratico' as AgentType },
    { pattern: /\bEspecialista en Documentación\b/g, type: 'clinico' as AgentType },
    { pattern: /\bInvestigador Académico\b/g, type: 'academico' as AgentType }
  ]

  // Procesar cada tipo de agente (solo color de texto, sin fondo destacado)
  agentPatterns.forEach(({ pattern, type }) => {
    const config = getAgentVisualConfig(type)
    if (!config) return

    processedContent = processedContent.replace(pattern, (match) => {
      // Keep agent color and bold; inherit parent font size for consistency
      return `<span class="font-semibold ${config.textColor}">${match}</span>`
    })
  })

  return processedContent
}

/**
 * Limpia y sanitiza el contenido markdown antes del parsing
 * @param content - Contenido a limpiar
 * @returns Contenido limpio y seguro
 */
export function sanitizeMarkdownContent(content: string): string {
  if (!content || typeof content !== 'string') {
    return ''
  }
  
  // Remover caracteres de control peligrosos pero mantener saltos de línea
  return content
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
}

// Exportar la instancia para casos especiales si es necesario
export { getMarkdownInstance }