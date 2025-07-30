# HopeAI – Backend Component Map
*Última actualización: 2025-01-XX*

> Este mapa complementa el diagrama `c4-level3-components-orchestrator.md` y señala las piezas del backend donde históricamente aparecen más incidencias al innovar.  Su meta es **conservar el poder actual de los especialistas** mientras facilita mejoras exponenciales basadas en el Google GenAI SDK.

---

## 1. Flujo de Petición a Respuesta (Timeline Simplificado)
| Paso | Archivo / Módulo | Función Clave |
|------|------------------|---------------|
| 1. **API Gateway** recibe POST `/api/send-message` | `app/api/send-message/route.ts` | Deserializa payload, obtiene sesión, pasa control al orquestador. |
| 2. **Singleton** | `lib/orchestration-singleton.ts` | Garantiza una única instancia de orquestación (importante para métricas y caché). |
| 3. **Dynamic Orchestrator** | `lib/dynamic-orchestrator.ts` | Punto de coordinación: enlaza intent router, agentes, herramientas y monitoring. |
| 4. **Intent Detection** | `lib/intelligent-intent-router.ts` + `lib/entity-extraction-engine.ts` | Clasifica intención, extrae entidades; decisión crítica para calidad. |
| 5. **Agent Routing** | `lib/clinical-agent-router.ts` | Devuelve instancia y config del especialista (Socrático / Archivista / Investigador). |
| 6. **Context Management** | `lib/context-optimization-manager.ts` + `lib/context-window-manager.ts` | Recorta historial, preserva contexto relevante. |
| 7. **Especialista** | Sección correspondiente del router | Llama GenAI con prompt y herramientas MCP. |
| 8. **Tool Registry** | `lib/tool-registry.ts` | Ejecuta herramientas externas en paralelo si las define el especialista. |
| 9. **Monitoring & Metrics** | `lib/orchestrator-monitoring.ts` | Registra latencia, éxito, retención de contexto y errores. |
| 10. **Respuesta** | `dynamic-orchestrator.ts` → API | Devuelve stream al frontend.

⚠️ Si modifica cualquiera de estos pasos, verifique la compatibilidad en **GenAI SDK** (parámetros de modelo, timeouts, métricas) y enlácelo en el PR.

---

## 2. Componentes con Alta Tasa de Incidencias
| Área Crítica | Archivos Principales | Razón de Falla Común | Pistas para Innovar |
|--------------|---------------------|----------------------|--------------------|
| **Detección de Intención** | `intelligent-intent-router.ts`, `entity-extraction-engine.ts` | Bajas tasas de confianza → routing incorrecto. | 1) Ajustar umbrales de confianza con experimentos A/B.<br>2) Probar embeddings más recientes del SDK (`model: "text-embedding-gecko"`). |
| **Investigador Académico** | `clinical-agent-router.ts` (web academic search via Grounding) | Latencia elevada y resultados vacíos. | 1) Habilitar cache Redis para resultados de búsqueda.<br>2) Usar `withCircuitBreaker()` (SDK) alrededor de `chat.completions.retrieve()`.<br>3) Validar prompt y chunk size según guía RAG del SDK. |
| **Gestión de Contexto** | `