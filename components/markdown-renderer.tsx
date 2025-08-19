"use client"

import React, { useMemo, memo } from 'react'
import { parseMarkdown, parseMarkdownStreaming, sanitizeMarkdownContent } from '@/lib/markdown-parser'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
  content: string
  isStreaming?: boolean
  className?: string
  /**
   * Si es true, el contenido se considera seguro y se renderiza como HTML
   * Si es false, se escapa el HTML por seguridad
   */
  trusted?: boolean
}

/**
 * Componente para renderizar contenido Markdown de forma segura y elegante
 * Optimizado para mensajes clínicos con soporte para streaming
 */
const MarkdownRendererComponent = ({ 
  content, 
  isStreaming = false, 
  className = '', 
  trusted = true 
}: MarkdownRendererProps) => {
  
  const renderedContent = useMemo(() => {
    if (!content) return ''
    
    // Sanitizar el contenido primero
    const sanitizedContent = sanitizeMarkdownContent(content)
    
    if (!sanitizedContent) return ''
    
    // Usar el parser apropiado según si es streaming o no
    if (isStreaming) {
      return parseMarkdownStreaming(sanitizedContent)
    } else {
      return parseMarkdown(sanitizedContent)
    }
  }, [content, isStreaming])
  
  // Si no hay contenido, no renderizar nada
  if (!renderedContent) {
    return null
  }
  
  // Si no es contenido confiable, mostrar como texto plano
  if (!trusted) {
    return (
      <div className={cn('text-base leading-relaxed whitespace-pre-wrap', className)}>
        {content}
      </div>
    )
  }
  
  return (
    <div 
      className={cn(
        'markdown-content text-base leading-relaxed',
        // Estilos base optimizados
        'prose max-w-none paper-noise',
        // Personalización de colores para el tema clínico
        'dark:prose-invert',
        'prose-headings:text-foreground prose-p:text-foreground/90',
        'prose-strong:text-foreground prose-em:text-muted-foreground',
        'prose-code:text-foreground prose-code:bg-muted',
        'prose-pre:bg-muted prose-pre:border prose-pre:border-border',
        'prose-blockquote:border-blue-200 dark:prose-blockquote:border-blue-900/40 prose-blockquote:bg-blue-50 dark:prose-blockquote:bg-blue-950/30',
        'prose-a:text-primary hover:prose-a:underline',
        // Prevent cutting/overflow on mobile (long links, words)
        'break-words prose-a:break-words prose-li:break-words',
        // Espaciado optimizado
        'prose-p:mb-3 prose-headings:mb-2 prose-headings:mt-3',
        'prose-ul:my-2 prose-ol:my-2 prose-li:my-1',
        className
      )}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  )
}

// Memoizar el componente para evitar re-renders innecesarios
export const MarkdownRenderer = memo(MarkdownRendererComponent)

/**
 * Hook para usar el renderizador de markdown con estado
 */
export function useMarkdownRenderer(content: string, isStreaming = false) {
  const renderedContent = useMemo(() => {
    if (!content) return ''
    
    const sanitizedContent = sanitizeMarkdownContent(content)
    if (!sanitizedContent) return ''
    
    return isStreaming 
      ? parseMarkdownStreaming(sanitizedContent)
      : parseMarkdown(sanitizedContent)
  }, [content, isStreaming])
  
  return renderedContent
}

/**
 * Componente especializado para mensajes de streaming
 * Incluye indicador de escritura y manejo optimizado de contenido parcial
 */
interface StreamingMarkdownRendererProps {
  content: string
  className?: string
  showTypingIndicator?: boolean
}

const StreamingMarkdownRendererComponent = ({ 
  content, 
  className = '',
  showTypingIndicator = true 
}: StreamingMarkdownRendererProps) => {
  const renderedContent = useMarkdownRenderer(content, true)
  
  if (!content && !showTypingIndicator) {
    return null
  }
  
  return (
    <div className={cn('relative', className)}>
      {renderedContent ? (
        <div 
          className={cn(
            'markdown-content text-base leading-relaxed prose max-w-none dark:prose-invert',
            // Estilos optimizados para streaming
            'prose-headings:text-foreground prose-p:text-foreground/90',
            'prose-strong:text-foreground prose-em:text-muted-foreground',
            'prose-code:text-foreground prose-code:bg-muted',
            'prose-pre:bg-muted prose-pre:border prose-pre:border-border',
            'prose-blockquote:border-blue-200 dark:prose-blockquote:border-blue-900/40 prose-blockquote:bg-blue-50 dark:prose-blockquote:bg-blue-950/30',
            'prose-a:text-primary hover:prose-a:underline break-words',
            'prose-p:mb-3 prose-headings:mb-2 prose-headings:mt-3',
            'prose-ul:my-2 prose-ol:my-2 prose-li:my-1'
          )}
          dangerouslySetInnerHTML={{ __html: renderedContent }}
        />
      ) : (
        <div className="text-base text-gray-500 italic">
          Escribiendo...
        </div>
      )}
      
      {showTypingIndicator && content && (
        <span className="inline-block w-0.5 h-4 bg-blue-500 animate-pulse ml-1 align-text-bottom" />
      )}
    </div>
  )
}

export const StreamingMarkdownRenderer = memo(StreamingMarkdownRendererComponent)

export default MarkdownRenderer