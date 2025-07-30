# HopeAI – Architectural Manifesto  
*Versión 2.0 – Enero 2025*

> "La arquitectura existe para habilitar resultados clínicos seguros y una evolución veloz del producto, no para dictar implementaciones rígidas." – Arquitecto Principal de Sistemas de IA

---

## 1. Propósito y Realidad Arquitectónica

HopeAI es una **plataforma de IA clínica implementada** que asiste a psicólogos mediante **tres especialistas coordinados dinámicamente**: el Filósofo Socrático, el Archivista Clínico y el Investigador Académico. 

Este documento establece **los principios que gobiernan nuestra arquitectura verificada** y **cómo evolucionamos de forma sostenible** sobre una base sólida de componentes implementados.

### Arquitectura Implementada (Estado Actual)
- ✅ **Sistema de Orquestación Dinámica** con selección inteligente de agentes
- ✅ **Métricas Integrales** con Sentry para análisis de uso y rendimiento  
- ✅ **Gestión Avanzada de Contexto** con optimización y ventana deslizante
- ✅ **Enrutamiento Inteligente** basado en intenciones y entidades semánticas
- ✅ **Registro de Herramientas Clínicas** con primitivas conductuales categorizadas

*Los detalles de implementación viven en el Technical Playbook y las ADR.*

---

## 2. Principios Fundamentales (Implementados)

### 2.1 Principios de Sistema
1. **Identidad Unificada** – El usuario interactúa con *HopeAI* como un sistema coherente, respaldado por el patrón singleton que garantiza consistencia de estado.
2. **Orquestación Inteligente** – La coordinación dinámica de especialistas utiliza Google GenAI Function Calling para selección contextual transparente.
3. **Resiliencia Clínica** – Implementamos degradación elegante con fallback al especialista principal y manejo robusto de errores.
4. **Observabilidad Integral** – Sistema completo de métricas con Sentry: mensajes por agente, tiempo de actividad, cambios de contexto y análisis de rendimiento.
5. **Evolución Continua** – Arquitectura modular con registro de herramientas extensible y configuración dinámica sin interrupciones.
6. **Privacidad y Ética** – Protección de datos clínicos con niveles de confidencialidad, validación de contexto y cumplimiento regulatorio.

### 2.2 Principios de Experiencia Clínica

La arquitectura implementada respalda una experiencia donde *la inteligencia clínica es transparente*:

1. **Flujo Conversacional Continuo** – El sistema de streaming y gestión de contexto optimizada mantiene la fluidez del diálogo terapéutico sin interrupciones técnicas.
2. **Precisión Contextual** – El motor de extracción de entidades y el enrutamiento inteligente aseguran respuestas relevantes y consistentes con el dominio clínico.
3. **Santuario Digital Profesional** – La interfaz minimalista y las métricas no intrusivas respetan el espacio terapéutico y la concentración profesional.

### 2.3 Principios de Inteligencia Distribuida

4. **Especialización Coordinada** – Cada agente (Socrático, Clínico, Académico) mantiene su expertise mientras el orquestador dinámico selecciona el más apropiado.
5. **Aprendizaje Contextual** – El sistema preserva y optimiza el contexto conversacional para mantener coherencia terapéutica a largo plazo.
6. **Adaptabilidad Inteligente** – Las herramientas clínicas se seleccionan dinámicamente según el dominio detectado (ansiedad, trauma, relaciones, etc.).

> Guardrails implementados: *La tecnología sirve a la clínica* y *La IA amplifica, no reemplaza, el criterio profesional*.

---

## 3. Modelo de Cambios
| Zona | Naturaleza del Cambio | Requisitos |
|------|-----------------------|------------|
| 🟢 Verde | Configuraciones, métricas, documentación, nuevas herramientas aisladas | Tests unitarios & PR review |
| 🟡 Amarilla | Cambios en algoritmos de routing, contexto o coordinación | Feature flag, tests de integración, rollout ≤25 % |
| 🔴 Roja | Cambios en interfaces core, protocolos externos, estructura de contexto clínico | ADR, revisión arquitectónica, plan de rollback aprobado |

> *La zona se decide en el PR usando `docs/development/safe-modification-guide.md`.*

---

## 4. Patrones Arquitectónicos (Implementados)

### 4.1 Patrones de Sistema
| Problema | Patrón Implementado | Componente | Beneficio Verificado |
|----------|---------------------|------------|----------------------|
| Estado global de orquestación | Singleton | `orchestration-singleton.ts` | Métricas unificadas, cero fragmentación |
| Selección dinámica de agentes | Strategy + Factory | `dynamic-orchestrator.ts` | Extensibilidad sin modificar clientes |
| Gestión de contexto | Sliding Window | `context-window-manager.ts` | Optimización automática de memoria |
| Almacenamiento flexible | Adapter | `server-storage-adapter.ts` | Intercambio de backends sin impacto |
| Herramientas clínicas | Registry + Metadata | `tool-registry.ts` | Selección inteligente y categorización |

### 4.2 Patrones de Inteligencia
| Capacidad | Implementación | Componente | Resultado Clínico |
|-----------|----------------|------------|-------------------|
| Clasificación de intenciones | Function Calling | `intelligent-intent-router.ts` | Enrutamiento preciso a especialistas |
| Extracción semántica | Entity Recognition | `entity-extraction-engine.ts` | Comprensión contextual profunda |
| Optimización de contexto | Multi-Strategy | `context-optimization-manager.ts` | Conversaciones largas sin pérdida |
| Monitoreo inteligente | Real-time Metrics | `sentry-metrics-tracker.ts` | Insights de uso y mejora continua |

---

## 5. Observabilidad y Métricas Implementadas

### 5.1 Métricas de Sistema (Sentry Integration)
- **Mensajes por Agente**: Tracking granular de uso por especialista
- **Tiempo de Respuesta**: Latencia de orquestación y generación
- **Cambios de Contexto**: Frecuencia y efectividad de switches de agente
- **Actividad de Sesión**: Duración, engagement y patrones de uso
- **Herramientas Clínicas**: Selección y efectividad de primitivas conductuales

### 5.2 Métricas de Calidad Clínica
- **Relevancia Contextual**: Precisión del enrutamiento inteligente
- **Retención de Contexto**: Efectividad de la gestión de memoria conversacional
- **Coherencia Terapéutica**: Consistencia entre especialistas
- **Satisfacción Implícita**: Análisis de patrones de interacción

### 5.3 Alertas y Monitoreo Automático
- **Umbrales Configurables**: Tiempo de respuesta, tasa de error, confianza de clasificación
- **Detección de Anomalías**: Patrones inusuales en el comportamiento del sistema
- **Salud del Sistema**: Monitoreo continuo de componentes críticos
- **Rollback Automático**: Degradación elegante ante fallos detectados

### 5.4 Revisión y Evolución
- **Análisis Quincenal**: Revisión de métricas y ajuste de umbrales
- **Feedback Loop**: Las métricas informan mejoras arquitectónicas
- **Validación Continua**: Verificación de que la arquitectura sirve a los objetivos clínicos

---

## 6. Seguridad Clínica
- Validación de contexto antes de procesar consultas.
- Modo de degradación al especialista principal si ocurre fallo.
- Auditorías periódicas de privacidad y confidencialidad.

---

## 7. Gobierno del Documento
1. **Propietario**: Arquitecto Principal de Sistemas de IA.
2. **Actualización**: PR etiquetado `architecture` + aprobación de tech-lead.
3. **Relación con Otros Artefactos**:
   - **ADRs** capturan el *por qué* de decisiones específicas.
   - **Technical Playbook** muestra el *cómo* implementarlas.
   - Diagramas C4 viven en `docs/architecture/` y se actualizan cuando un cambio rojo o amarillo altera la estructura.

---

## 8. Métricas de Éxito Arquitectónico (Implementadas)

### 8.1 Métricas de Desarrollo
| Indicador | Objetivo | Estado Actual |
|-----------|----------|---------------|
| Velocidad de cambio en Zona Verde | ≤2 días | ✅ Implementado |
| Tasa de rollback | <1% | 🔄 Monitoreando |
| MTTR fallos clínicos | <2 min | ✅ Degradación automática |
| Cobertura de tests críticos | >90% | 🔄 En progreso |

### 8.2 Métricas de Sistema
| Indicador | Objetivo | Implementación |
|-----------|----------|----------------|
| Tiempo de respuesta promedio | <3s | ✅ Sentry tracking |
| Precisión de enrutamiento | >95% | ✅ Function calling metrics |
| Retención de contexto | >98% | ✅ Context optimization |
| Disponibilidad del sistema | >99.5% | ✅ Health checks |

### 8.3 Métricas de Experiencia Clínica
| Indicador | Objetivo | Medición |
|-----------|----------|----------|
| Relevancia clínica de respuestas | >95% | ✅ Entity extraction confidence |
| Coherencia entre especialistas | >90% | ✅ Session context tracking |
| Satisfacción de flujo conversacional | >9/10 | 🔄 Análisis de patrones |
| Reducción de carga cognitiva | Medible | ✅ Métricas de interacción |

---

---

## 9. Estado de Implementación y Próximos Pasos

### 9.1 Componentes Verificados ✅
- Sistema de orquestación dinámica con singleton pattern
- Métricas integrales con Sentry para análisis de uso
- Gestión avanzada de contexto con optimización automática
- Enrutamiento inteligente basado en Function Calling
- Registro extensible de herramientas clínicas
- Tres especialistas implementados con protocolos específicos

### 9.2 Áreas de Evolución Continua 🔄
- Refinamiento de algoritmos de selección de herramientas
- Expansión del catálogo de primitivas conductuales
- Optimización de métricas de satisfacción clínica
- Integración de feedback loops automáticos

### 9.3 Principios de Evolución
- **Evidencia sobre Intuición**: Toda mejora debe estar respaldada por métricas
- **Incrementalidad Segura**: Cambios pequeños, frecuentes y reversibles
- **Validación Clínica**: Los psicólogos validan que la tecnología sirve a la práctica
- **Sostenibilidad Técnica**: La arquitectura debe facilitar, no obstaculizar, la evolución

---

### Resumen Ejecutivo

Este *Manifesto* documenta una **arquitectura implementada y verificada** que guía el desarrollo sostenible de HopeAI. Los principios aquí establecidos se basan en componentes reales, métricas operativas y patrones probados.

La arquitectura actual demuestra que es posible combinar **inteligencia artificial avanzada** con **rigor clínico** y **excelencia técnica** para crear una herramienta que verdaderamente amplifica las capacidades de los psicólogos profesionales.

*Los detalles de implementación evolucionan en el Technical Playbook; estos principios arquitectónicos permanecen estables como fundamento del sistema.*