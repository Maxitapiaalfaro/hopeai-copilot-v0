## Plan Ejecutivo — Streaming del Modelo End-to-End en HopeAI

### 1) Contexto y problema a resolver
- **Situación actual**: El backend ya produce streaming (AsyncGenerator) con `ai.chats.create().sendMessageStream(...)` y metadatos (grounding, routing). El endpoint `app/api/send-message/route.ts` empaqueta un único JSON y no re-expone los chunks.
- **Impacto**: La ruta HTTP no permite UX en vivo (tiempo a primer token, cancelación, grounding incremental) para consumidores “ligeros” que usan `hooks/use-hopeai.ts`.
- **Riesgo**: Percepción de latencia alta y menor confianza (sin referencias progresivas) en flujos críticos para psicólogos clínicos.

### 2) Objetivo
- **Habilitar streaming end-to-end vía red** (SSE o NDJSON) en `POST /api/send-message`, preservando grounding/citations y métricas, con cancelación y compatibilidad hacia atrás.

### 3) Alcance
- **Incluye**: API `send-message` (SSE/NDJSON), cliente “ligero” (`hooks/use-hopeai.ts`) con `sendMessageStream`, UI (`components/chat-interface.tsx`) soporte lectura por red, telemetría por chunk, endurecimiento de SDK/configuración.
- **No incluye**: Cambios funcionales en orquestación/selección de agente; solo “passthrough” de stream y mejoras de seguridad/config.

### 4) Diseño de solución (alto nivel)
- **Servidor** (`app/api/send-message/route.ts`):
  - Cambiar a respuesta streaming (preferencia: SSE) re-emitiendo el `AsyncGenerator` del sistema.
  - Eventos propuestos: `route` (routingInfo), `token` (texto parcial), `meta` (groundingUrls), `done` (summary/usage), `error`.
- **Cliente** (`hooks/use-hopeai.ts`):
  - Nuevo `sendMessageStream(message, sessionMeta?)` que usa Fetch + `ReadableStream` para parsear SSE/NDJSON y expone un async iterable de eventos.
  - Mantener `sendMessage(...)` actual como modo no streaming.
- **UI** (`components/chat-interface.tsx`):
  - Añadir camino alterno para consumir el stream de red (idéntico a iterador local actual) y unificar el render de chunks/grounding.
- **Orquestación** (sin cambios funcionales):
  - Continuar produciendo `AsyncGenerator` con `routingInfo` y chunks; el endpoint solo “puentea”.
- **Cumplimiento SDK (@google/genai)**:
  - Server-only keys, `apiVersion: 'v1'`, centralizar en `lib/google-genai-config.ts`.
  - Mantener `generateContentStream`/`sendMessageStream` según docs y propagar `GroundingMetadata` por chunk.

### 5) Contrato de eventos (SSE)
- Content-Type: `text/event-stream; charset=utf-8`
- Ejemplo de emisión (servidor):
```
event: route
data: {"targetAgent":"clinico","confidence":0.86}


event: token
data: {"text":"Parte 1..."}


event: meta
data: {"groundingUrls":[{"title":"RCT 2023","url":"https://example.org"}]}


event: token
data: {"text":"Parte 2..."}


event: done
data: {"sessionId":"session_123","usage":{"ttfbMs":320,"chunks":42}}

```
- Semántica:
  - **route**: se emite 0–1 vez al inicio si hay `routingInfo`.
  - **token**: uno por bloque textual incremental.
  - **meta**: referencias/grounding incremental; el cliente acumula.
  - **done**: marca fin del stream; puede incluir métricas de uso/tiempo.

### 6) Seguridad y configuración (obligatorio)
- **Claves**: no exponer `NEXT_PUBLIC_*`. Usar `GOOGLE_API_KEY` o Vertex (`GOOGLE_GENAI_USE_VERTEXAI`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`).
- **Centralización**: `lib/google-genai-config.ts` debe:
  - Inicializar cliente solo en servidor; rechazar entorno `window`.
  - Fijar `apiVersion: 'v1'` (superficie estable) salvo justificación de preview.
  - Documentar en README/PR referencia a la doc oficial del SDK (`https://googleapis.github.io/js-genai/release_docs/index.html`).

### 7) Observabilidad y métricas
- **Por chunk**: capturar `chunkCount`, `ttfb`, `duration`, tokens estimados si `usageMetadata` del SDK está disponible en el último candidato.
- **Eventos**: registrar `route`, conteo de `meta` (URLs), errores parciales, cancelaciones (AbortController).
- **Integración**: mantener trackers existentes (`session-metrics-comprehensive-tracker`, Sentry spans) y sumar campos de streaming.

### 8) Plan de despliegue (fases)
- **Fase 0 — Diseño y contratos (0.5 sem)**
  - Congelar protocolo (SSE vs NDJSON); elegir SSE. Especificar esquema de eventos y errores.
  - Alinear cambios de SDK/config y checklist de seguridad.
- **Fase 1 — Backend SSE (1 sem)**
  - Implementar SSE en `app/api/send-message/route.ts`, iterar `AsyncGenerator` y emitir `route|token|meta|done|error`.
  - Tests de carga y timeouts (serverless) + buffering headers (`X-Accel-Buffering: no`).
- **Fase 2 — Cliente streaming (1 sem)**
  - `hooks/use-hopeai.ts`: `sendMessageStream` (Fetch + ReadableStream + parser SSE).
  - `components/chat-interface.tsx`: camino de render con stream de red (tokens/grounding). Cancelación.
- **Fase 3 — Endurecimiento y rollout (0.5–1 sem)**
  - SDK compliance (server-only keys, `apiVersion`), documentación, feature flag/kill switch.
  - Telemetría por chunk + dashboards y alertas (SLOs de TTFB/errores).

### 9) KPIs de éxito (definición y metas)
- **TTFB** (p95): < 600 ms (desde click a primer `token`).
- **Tiempo de respuesta total** (p95): -15% vs baseline no streaming.
- **Stall rate** (streams interrumpidos): < 2% en p7 días.
- **Citations coverage** (sesiones académicas con ≥1 `meta`): > 85%.
- **Errores 5xx** (por stream): < 1%.

### 10) Riesgos y mitigaciones
- **Serverless buffering/timeouts**: usar headers anti-buffering, heartbeats periódicos, límites de duración por stream.
- **Parsers en cliente**: fallback a NDJSON si proxies rompen SSE.
- **Credenciales**: verificación CI para evitar `NEXT_PUBLIC_*` en config del SDK.
- **Backpressure**: aplicar `reader.read()` por demanda; limitar tamaño de buffer.
- **Compatibilidad**: mantener `sendMessage` no streaming como fallback.

### 11) Estimación de esfuerzo y responsables
- **Backend**: 3–5 días (SSE + tests + métricas). Responsable: Orquestación/API.
- **Frontend**: 3–5 días (hook streaming + UI + cancelación). Responsable: FE Core.
- **Seguridad/SDK**: 1–2 días (config + revisión). Responsable: Plataforma.
- **Observabilidad**: 1–2 días (dashboards/alertas). Responsable: Data/Infra.

### 12) Cambios específicos por archivo (resumen técnico)
- `app/api/send-message/route.ts`: implementar SSE; iterar generador; emitir eventos; headers no-cache/keep-alive.
- `hooks/use-hopeai.ts`: agregar `sendMessageStream` con Fetch + parser SSE; exponer async iterable; soportar AbortController.
- `components/chat-interface.tsx`: aceptar stream de red; consolidar manejo de `groundingUrls` incremental.
- `lib/google-genai-config.ts`: server-only, `apiVersion: 'v1'`, sin `NEXT_PUBLIC_*` para claves.

### 13) Checklist de PR (cumplimiento SDK y calidad)
- **SDK**: `@google/genai` estable, `apiVersion: 'v1'`, server-only keys, contratos `files`/`grounding` por chunk.
- **Docs**: actualizar `docs/AI_Workflow_Architecture.md` (nuevo flujo SSE) y este plan con estado final.
- **UX**: TTFB medido; cancelación funcional; grounding incremental visible.
- **QA**: fallbacks (no streaming) y reconexiones; pruebas en redes lentas.

### 14) Go/No-Go
- **Go** cuando: KPIs p95 dentro de meta en staging, auditoría de seguridad SDK OK, regresiones 0 en flujos críticos.
- **Rollback**: flag para volver a JSON final inmediato (modo actual) sin redeploy.
