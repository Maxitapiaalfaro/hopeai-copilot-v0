import MarkdownIt from 'markdown-it'

// Instancia singleton optimizada de markdown-it para mensajes clínicos
let mdInstance: MarkdownIt | null = null

// Función para obtener la instancia configurada (lazy loading)
function getMarkdownInstance(): MarkdownIt {
  if (!mdInstance) {
    mdInstance = new MarkdownIt({
      html: false, // Desactivar HTML por seguridad
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
      '1': 'text-lg font-bold text-gray-900 mt-4 mb-2 border-b border-gray-200 pb-1 first:mt-0',
      '2': 'text-base font-semibold text-gray-800 mt-3 mb-2 first:mt-0',
      '3': 'text-sm font-medium text-gray-700 mt-3 mb-1 first:mt-0',
      '4': 'text-sm font-medium text-gray-600 mt-2 mb-1 first:mt-0',
      '5': 'text-xs font-medium text-gray-600 mt-2 mb-1 first:mt-0',
      '6': 'text-xs font-normal text-gray-500 mt-1 mb-1 first:mt-0'
    }
    return `<${token.tag} class="${classes[level as keyof typeof classes] || classes['3']}">`
  }

  // Personalizar listas para mejor legibilidad clínica
  md.renderer.rules.bullet_list_open = () => {
    return '<ul class="list-disc list-outside space-y-1 my-2 ml-6 pl-2">'
  }

  md.renderer.rules.ordered_list_open = () => {
    return '<ol class="list-decimal list-outside space-y-1 my-2 ml-6 pl-2">'
  }

  md.renderer.rules.list_item_open = () => {
    return '<li class="text-sm leading-relaxed pl-1">'
  }

  // Personalizar párrafos
  md.renderer.rules.paragraph_open = () => {
    return '<p class="text-sm leading-relaxed mb-3 last:mb-0">'
  }

  // Personalizar código inline y bloques
  md.renderer.rules.code_inline = (tokens, idx) => {
    const token = tokens[idx]
    return `<code class="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-xs font-mono">${md.utils.escapeHtml(token.content)}</code>`
  }

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx]
    const langClass = token.info ? ` language-${md.utils.escapeHtml(token.info)}` : ''
    return `<pre class="bg-gray-50 border border-gray-200 rounded-lg p-3 my-3 overflow-x-auto"><code class="text-xs font-mono${langClass}">${md.utils.escapeHtml(token.content)}</code></pre>`
  }

  // Personalizar blockquotes para citas clínicas
  md.renderer.rules.blockquote_open = () => {
    return '<blockquote class="border-l-4 border-blue-200 bg-blue-50 pl-4 py-2 my-3 italic text-sm">'
  }

  // Personalizar enlaces
  md.renderer.rules.link_open = (tokens, idx) => {
    const token = tokens[idx]
    const href = token.attrGet('href') || '#'
    return `<a href="${href}" class="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">`
  }

  // Personalizar tablas para datos clínicos
  md.renderer.rules.table_open = () => {
    return '<div class="overflow-x-auto my-3"><table class="min-w-full border border-gray-200 rounded-lg">'
  }

  md.renderer.rules.table_close = () => {
    return '</table></div>'
  }

  md.renderer.rules.thead_open = () => {
    return '<thead class="bg-gray-50">'
  }

  md.renderer.rules.th_open = () => {
    return '<th class="px-3 py-2 text-left text-xs font-medium text-gray-700 border-b border-gray-200">'
  }

  md.renderer.rules.td_open = () => {
    return '<td class="px-3 py-2 text-sm text-gray-900 border-b border-gray-100">'
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
    const md = getMarkdownInstance()
    const result = md.render(content)
    
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
    
    return md.render(safeContent)
  } catch (error) {
    console.error('Error parsing streaming markdown:', error)
    // Fallback más robusto para streaming
    return content.replace(/\n/g, '<br>')
  }
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