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
      <div className={cn('text-sm leading-relaxed whitespace-pre-wrap', className)}>
        {content}
      </div>
    )
  }
  
  return (
    <div 
      className={cn(
        'markdown-content text-sm leading-relaxed',
        // Estilos base optimizados
        'prose prose-sm max-w-none',
        // Personalización de colores para el tema clínico
        'prose-headings:text-gray-900 prose-p:text-gray-700',
        'prose-strong:text-gray-900 prose-em:text-gray-600',
        'prose-code:text-gray-800 prose-code:bg-gray-100',
        'prose-pre:bg-gray-50 prose-pre:border prose-pre:border-gray-200',
        'prose-blockquote:border-blue-200 prose-blockquote:bg-blue-50',
        'prose-a:text-blue-600 hover:prose-a:text-blue-800',
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
            'markdown-content text-sm leading-relaxed prose prose-sm max-w-none',
            // Estilos optimizados para streaming
            'prose-headings:text-gray-900 prose-p:text-gray-700',
            'prose-strong:text-gray-900 prose-em:text-gray-600',
            'prose-code:text-gray-800 prose-code:bg-gray-100',
            'prose-pre:bg-gray-50 prose-pre:border prose-pre:border-gray-200',
            'prose-blockquote:border-blue-200 prose-blockquote:bg-blue-50',
            'prose-a:text-blue-600 hover:prose-a:text-blue-800',
            'prose-p:mb-3 prose-headings:mb-2 prose-headings:mt-3',
            'prose-ul:my-2 prose-ol:my-2 prose-li:my-1'
          )}
          dangerouslySetInnerHTML={{ __html: renderedContent }}
        />
      ) : (
        <div className="text-sm text-gray-500 italic">
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