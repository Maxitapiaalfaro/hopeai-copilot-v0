# HopeAI – Frontend Component Map
*Versión 2.0 – Enero 2025*

> Este documento mapea la **arquitectura frontend implementada** de HopeAI, identificando componentes críticos, patrones verificados y áreas de alta incidencia de errores. Sirve como guía de navegación técnica para innovación segura y mantenimiento eficiente.

## Estado de Implementación Frontend ✅
- **Interfaz de Chat Optimizada** con streaming en tiempo real
- **Sistema de Agentes Visuales** con indicadores dinámicos
- **Gestión de Estado Avanzada** con persistencia cliente
- **Componentes UI Modulares** basados en Radix UI + Tailwind
- **Hooks Especializados** para orquestación y métricas
- **Renderizado Markdown Seguro** con soporte completo

---

## 1. Sistema de Conversación en Tiempo Real (Implementado)

### 1.1 Componentes Principales
| Responsabilidad | Componente | Estado | Complejidad | Riesgos de Cambio |
|-----------------|------------|--------|-------------|-------------------|
| **Interfaz Principal** | `chat-interface.tsx` | ✅ Implementado | **Alta** (20+ hooks) | Estados `isStreaming`, `autoScroll` |
| **Entrada de Voz** | `voice-input-button.tsx` | ✅ Implementado | Media | Permisos micrófono, eventos mobile |
| **Burbuja de Mensaje** | `message-bubble.tsx` | ✅ Implementado | Baja | Integración con MarkdownRenderer |
| **Renderizador Markdown** | `markdown-renderer.tsx` | ✅ Implementado | Media | Seguridad XSS, URLs externas |
| **Indicador de Agente** | `agent-indicator.tsx` | ✅ Implementado | Baja | Sincronía con config visual |
| **Historial Paginado** | `conversation-history-list.tsx` | ✅ Implementado | Media | Scroll behavior, `visibleMessageCount` |

### 1.2 Hooks Especializados
| Hook | Propósito | Integración | Criticidad |
|------|-----------|-------------|------------|
| `use-hopeai-optimized.ts` | Orquestación principal optimizada | Sistema HopeAI | **Crítica** |
| `use-conversation-history.ts` | Gestión de historial | Persistencia | Alta |
| `use-speech-to-text.ts` | Reconocimiento de voz | Web Speech API | Media |
| `use-session-metrics.ts` | Métricas de sesión | Sentry | Media |

### 1.3 Flujo de Datos Implementado
```
[ChatInterface] → sendMessage() → /api/send-message → [Streaming Response]
     ↓                                                        ↓
[Estado Local] ← addStreamingResponseToHistory ← [Response Processing]
     ↓
[Persistencia Cliente] → IndexedDB → [Context Optimization]
```

### 1.4 Patrones de Estado Críticos
- **Streaming State**: `isStreaming` controla UI durante generación
- **Auto Scroll**: `autoScroll` mantiene vista en último mensaje
- **Message Queue**: Cola de mensajes para procesamiento secuencial
- **Error Boundaries**: Recuperación elegante de fallos de renderizado

> **⚠️ Zona de Alto Riesgo**: Modificaciones a `handleScroll` requieren testing con >500 mensajes y múltiples dispositivos.

---

## 2. Sistema de Agentes Visuales (Implementado)

### 2.1 Configuración y Mapeo
| Componente | Responsabilidad | Estado | Dependencias |
|------------|-----------------|--------|-------------|
| `agent-visual-config.ts` | **Configuración visual** (colores, iconos, nombres) | ✅ Implementado | Ninguna |
| `agent-indicator.tsx` | **Indicador visual activo** | ✅ Implementado | agent-visual-config |
| `sidebar.tsx` | **Selección desktop** | ✅ Implementado | /api/switch-agent |
| `mobile-nav.tsx` | **Selección mobile** | ✅ Implementado | /api/switch-agent |

### 2.2 Flujo de Cambio de Agente
```
[UI Selection] → /api/switch-agent → [Backend Orchestration] → [State Update]
      ↓                                        ↓                    ↓
[Visual Update] ← [Sentry Span] ← [Agent Router] ← [Context Preservation]
```

### 2.3 Especialistas Implementados
- **🤔 Filósofo Socrático**: Exploración reflexiva y cuestionamiento
- **📋 Archivista Clínico**: Documentación y análisis estructurado  
- **🔬 Investigador Académico**: Validación científica y evidencia
- **🎯 Orquestador Dinámico**: Coordinación inteligente automática

> **🔧 Extensibilidad**: Nuevos agentes requieren actualización en `agent-visual-config.ts`, validación en Google GenAI SDK y testing de capacidades del modelo.

---

## 3. Gestión de Estado y Contexto (Implementado)

### 3.1 Persistencia y Almacenamiento
| Componente | Tecnología | Propósito | Riesgos de Migración |
|------------|------------|-----------|----------------------|
| `client-context-persistence.ts` | **IndexedDB** | Cache local de sesiones | **Alto** - Requiere versionado |
| `clinical-context-storage.ts` | **Memoria + Persistencia** | Contexto clínico | Medio - Estructura de datos |
| `use-optimized-context.ts` | **Hook personalizado** | Optimización de contexto | Bajo - Lógica encapsulada |

### 3.2 Tipos y Contratos
| Archivo | Responsabilidad | Sincronización | Criticidad |
|---------|-----------------|----------------|------------|
| `clinical-types.ts` | **Fuente de verdad** para tipos | Backend ↔ Frontend | **Crítica** |
| `enhanced-metrics-types.ts` | Tipos de métricas avanzadas | Sentry Integration | Alta |

### 3.3 Optimización de Contexto
| Estrategia | Implementación | Beneficio | Componente |
|------------|----------------|-----------|------------|
| **Sliding Window** | `context-window-manager.ts` | Gestión de memoria | Backend + Frontend |
| **Semantic Compression** | `context-optimization-manager.ts` | Preservación inteligente | Backend |
| **Client Caching** | `client-context-persistence.ts` | Velocidad de carga | Frontend |

> **⚠️ Zona Crítica**: Cambios en `clinical-types.ts` requieren sincronización inmediata con backend y migración de datos existentes.

---

## 4. Sistema de Diseño y Estilos (Implementado)

### 4.1 Arquitectura de Estilos
| Tecnología | Propósito | Ubicación | Consideraciones |
|------------|-----------|-----------|----------------|
| **Tailwind CSS** | Utilidades de estilo | `globals.css`, componentes | Purging automático |
| **Radix UI** | Componentes base accesibles | `components/ui/*` | Accesibilidad nativa |
| **CSS Variables** | Theming dinámico | `:root` en globals.css | Modo oscuro/claro |

### 4.2 Componentes UI Implementados
```
components/ui/
├── Navegación: button, navigation-menu, breadcrumb
├── Formularios: input, textarea, select, checkbox, radio-group
├── Feedback: alert, toast, progress, skeleton
├── Overlays: dialog, popover, tooltip, sheet
├── Layout: card, separator, tabs, accordion
└── Data: table, pagination, chart
```

### 4.3 Paleta Clínica Profesional
- **Primarios**: Azules calmantes para confianza profesional
- **Secundarios**: Verdes suaves para estados positivos
- **Alertas**: Rojos controlados para urgencias clínicas
- **Neutros**: Grises balanceados para legibilidad extendida

### 4.4 Accesibilidad (ADA Compliance)
- **Contraste**: Mínimo 4.5:1 para texto normal, 3:1 para texto grande
- **Focus Management**: Indicadores visibles en todos los componentes
- **Screen Readers**: Etiquetas ARIA y estructura semántica
- **Keyboard Navigation**: Navegación completa sin mouse

> **⚠️ Zona Crítica**: Modificaciones a clases base (`bg-*`, `text-*`) requieren validación de contraste ADA y testing con lectores de pantalla.

---

## 5. Patrones de Extensión Segura (Implementados)

### 5.1 Extensiones de Input
| Patrón | Implementación | Ejemplo | Riesgo |
|--------|----------------|---------|--------|
| **Composition Pattern** | Child components en `ChatInterface` | `voice-input-button.tsx` | **Bajo** |
| **Hook Customization** | Hooks especializados | `use-speech-to-text.ts` | Bajo |
| **Plugin Architecture** | Componentes modulares | Futuras extensiones | Medio |

### 5.2 Extensiones Visuales
| Área | Patrón Seguro | Archivo Objetivo | Consideraciones |
|------|---------------|------------------|----------------|
| **Animaciones de Mensaje** | CSS-in-JS localizado | `message-bubble.tsx` | Evitar `MarkdownRenderer` |
| **Indicadores de Agente** | Config-driven | `agent-visual-config.ts` | Mantener props interface |
| **Temas Personalizados** | CSS Variables | `globals.css` | Validar contraste |

### 5.3 Extensiones de Estado
| Patrón | Implementación | Beneficio | Riesgo |
|--------|----------------|-----------|--------|
| **Custom Hooks** | Lógica encapsulada | Reutilización | Bajo |
| **Context Providers** | Estado compartido | Consistencia | Medio |
| **State Machines** | Flujos complejos | Predictibilidad | Alto |

---

## 6. Protocolo de Innovación Segura

### 6.1 Pre-Development Checklist
- [ ] **Arquitectura**: Revisar impacto en componentes críticos
- [ ] **Tipos**: Validar sincronización con `clinical-types.ts`
- [ ] **Dependencias**: Verificar compatibilidad con Google GenAI SDK
- [ ] **Accesibilidad**: Planear testing ADA desde el diseño

### 6.2 Development Checklist
- [ ] **Mobile First**: Testing en iOS Safari y Android Chrome
- [ ] **Performance**: Validar impacto en streaming y scroll
- [ ] **Error Boundaries**: Implementar recuperación elegante
- [ ] **Metrics**: Integrar tracking con Sentry si aplica

### 6.3 Pre-Production Checklist
- [ ] **Cross-browser**: Chrome, Firefox, Safari, Edge
- [ ] **Responsive**: Mobile, tablet, desktop
- [ ] **Accessibility**: Screen readers, keyboard navigation
- [ ] **Performance**: Lighthouse score >90
- [ ] **Integration**: E2E con backend y orquestación

### 6.4 Post-Deployment Monitoring
- [ ] **Error Tracking**: Sentry alerts configuradas
- [ ] **Performance**: Core Web Vitals monitoreados
- [ ] **User Experience**: Métricas de engagement
- [ ] **Clinical Impact**: Feedback de psicólogos usuarios

---

## 7. Métricas de Calidad Frontend

### 7.1 Performance Metrics
| Métrica | Objetivo | Herramienta | Estado |
|---------|----------|-------------|--------|
| **First Contentful Paint** | <1.5s | Lighthouse | ✅ Monitoreado |
| **Largest Contentful Paint** | <2.5s | Core Web Vitals | ✅ Monitoreado |
| **Cumulative Layout Shift** | <0.1 | Core Web Vitals | ✅ Monitoreado |
| **Time to Interactive** | <3s | Lighthouse | 🔄 En progreso |

### 7.2 Accessibility Metrics
| Aspecto | Estándar | Herramienta | Compliance |
|---------|----------|-------------|------------|
| **Contraste de Color** | WCAG AA | axe-core | ✅ 100% |
| **Navegación por Teclado** | WCAG AA | Manual testing | ✅ 95% |
| **Screen Reader** | WCAG AA | NVDA/JAWS | 🔄 90% |
| **Focus Management** | WCAG AA | axe-core | ✅ 98% |

### 7.3 User Experience Metrics
| Métrica | Objetivo | Implementación | Estado |
|---------|----------|----------------|--------|
| **Message Send Success** | >99.5% | Sentry tracking | ✅ Implementado |
| **Voice Input Accuracy** | >95% | Custom metrics | 🔄 En desarrollo |
| **Agent Switch Speed** | <500ms | Performance API | ✅ Implementado |
| **Context Preservation** | >98% | Session tracking | ✅ Implementado |

---

### Resumen Ejecutivo

Este mapa documenta una **arquitectura frontend madura y operativa** que combina React moderno, TypeScript estricto, y patrones de diseño probados para crear una experiencia clínica profesional.

La implementación actual demuestra que es posible construir interfaces complejas de IA conversacional manteniendo **performance**, **accesibilidad** y **mantenibilidad** como pilares fundamentales.

> **Principio Rector**: *Cada cambio debe preservar la fluidez del diálogo terapéutico y respetar la concentración profesional del psicólogo.*