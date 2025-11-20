## Diagnóstico actual
- 429 proviene del middleware global de seguridad, no de los handlers:
  - Rate limit aplicado antes de los handlers en `middleware.ts:270–280` (c:\Users\david\hopeai-copilot-v0\middleware.ts:270–280).
  - Tipos por ruta: `getRateLimitType` mapea `'/api/send-message'` a `messaging` (10/min), `'/api/documents'` a `public` (20/min) (c:\Users\david\hopeai-copilot-v0\lib\security\admin-auth.ts:208–214).
  - Configuración por tipo: `RATE_LIMIT_CONFIGS` (c:\Users\david\hopeai-copilot-v0\lib\security\rate-limiter.ts:22–57).
- `/api/send-message` funciona con SSE y no crea múltiples requests por chunk; los 429 se disparan por frecuencia total de llamadas (mensajes + otras peticiones sincronas cerca) (c:\Users\david\hopeai-copilot-v0\app\api\send-message\route.ts:145–175).
- `/api/documents?sessionId=...` se consulta al cambiar `sessionId` y cada vez que cambia el historial; dos llamadas muy cercanas son comunes (c:\Users\david\hopeai-copilot-v0\components\main-interface-optimized.tsx:149, c:\Users\david\hopeai-copilot-v0\components\chat-interface.tsx:441; handler en c:\Users\david\hopeai-copilot-v0\app\api\documents\route.ts:4–39).
- `/api/storage/conflicts/resolve` no existe; el flujo real está en `POST /api/sync/conflicts` (c:\Users\david\hopeai-copilot-v0\app\api\sync\conflicts\route.ts). El cliente llama un endpoint inexistente (c:\Users\david\hopeai-copilot-v0\lib\storage\api-client-adapter.ts:421–431).
- MongoDB está correctamente configurado y usado como fuente de verdad cuando `HOPEAI_STORAGE_MODE='mongodb'`:
  - Conexión y pool: `maxPoolSize: 10`, `socketTimeoutMS: 45000` (c:\Users\david\hopeai-copilot-v0\lib\database\mongodb.ts:15–25).
  - Persistencia cifrada y verificación con checksum en `MongoServerStorage` (c:\Users\david\hopeai-copilot-v0\lib\storage\mongo-server-storage.ts:144–231).
  - Endpoint de guardado `POST /api/storage/chat-sessions` usa el adaptador y Mongo cuando corresponde (c:\Users\david\hopeai-copilot-v0\app\api\storage\chat-sessions\route.ts:32–80, 106–121).

## Cambios de limitación de tasa
- Elevar y afinar límites para flujo normal:
  - Aumentar `messaging` a `maxRequests: 30` y `blockDurationMs: 30s` (c:\Users\david\hopeai-copilot-v0\lib\security\rate-limiter.ts:30–35).
  - Crear tipo `documents` con `maxRequests: 60`/min y mapear `'/api/documents'` a `documents` (añadir en `RATE_LIMIT_CONFIGS` y en `getRateLimitType`) (c:\Users\david\hopeai-copilot-v0\lib\security\rate-limiter.ts y c:\Users\david\hopeai-copilot-v0\lib\security\admin-auth.ts:208–214).
- Trato especial para SSE:
  - Detectar solicitudes SSE de `POST /api/send-message` mediante un header `X-SSE-Stream: 1` desde el cliente (c:\Users\david\hopeai-copilot-v0\lib\sse-client.ts:66–80) y aplicar un límite más permisivo o bypass controlado en `middleware.ts` solo para ese caso.
- Añadir cabeceras `Retry-After` coherentes y `X-RateLimit-*` ya existen (c:\Users\david\hopeai-copilot-v0\middleware.ts:137–143).

## Manejo de 429 y reintentos (cliente)
- SSE client:
  - En `sendMessage`/`sendMessageStream`, si `response.status === 429`, leer `Retry-After` y reintentar con backoff exponencial (`base=500ms`, `jitter`, `maxRetries=3`) (c:\Users\david\hopeai-copilot-v0\lib\sse-client.ts:82–90, 150–158).
  - Superficie de error clara: mostrar tiempo restante si disponible.
- API client genérico:
  - En `makeRequest`, distinguir 429 y aplicar backoff similar (c:\Users\david\hopeai-copilot-v0\lib\storage\api-client-adapter.ts:62–107).

## Sincronización entre agentes y secuenciación
- Cola de mensajes por sesión en cliente para garantizar secuencia:
  - En `hooks/use-hopeai-system.ts:304–584`, añadir un guard o una cola simple (con `Promise` chain) que impida enviar un nuevo mensaje si el anterior sigue streaming.
  - Marcar `transitionState`/`isStreaming` y bloquear UI para evitar concurrencia; esto ya se aproxima en `chat-interface.tsx`, reforzar la verificación antes de llamar `sendMessage`.
- Unificar endpoint de resolución de conflictos:
  - Cambiar el cliente a `POST /api/sync/conflicts` y soportar estrategias actuales (c:\Users\david\hopeai-copilot-v0\lib\storage\api-client-adapter.ts:421–431 → actualizar ruta).
  - Opcional: crear `app/api/storage/conflicts/resolve/route.ts` que reenvíe a `sync/conflicts` para mantener compatibilidad.

## Optimización de MongoDB
- Conexión:
  - Ajustar `maxPoolSize` a `50` y `minPoolSize` a `5` bajo carga moderada; mantener `socketTimeoutMS: 45000` y `serverSelectionTimeoutMS: 5000` (c:\Users\david\hopeai-copilot-v0\lib\database\mongodb.ts:15–25).
- Escrituras:
  - Mantener `writeConcern: { w: 'majority' }` para chatSessions; si la latencia es alta, permitir `w:1` en entornos no críticos.
- Índices ya se aseguran; verificar que se crean al iniciar (c:\Users\david\hopeai-copilot-v0\lib\database\mongodb.ts:114–167).
- Concurrencia:
  - Añadir control optimista con `lastUpdated` en resoluciones de conflictos para evitar sobrescrituras sin verificación (c:\Users\david\hopeai-copilot-v0\app\api\sync\conflicts\route.ts).

## Debounce de `/api/documents`
- Reducir llamadas duplicadas:
  - Añadir debounce de 500–1000ms en `chat-interface.tsx` cuando cambie `history`.
  - Consolidar la carga de documentos a una sola fuente para evitar disparos simultáneos desde dos componentes.

## Pruebas y verificación
- Pruebas de carga de mensajes consecutivos:
  - Script Node que envíe 50 mensajes secuenciales a `POST /api/send-message` y verifique ausencia de 429; medir latencia promedio y desviación.
- Pruebas de concurrencia multiagente:
  - Simular dos mensajes en rápida sucesión con agentes distintos; confirmar que la cola secuencia las peticiones.
- Consistencia MongoDB:
  - Tras 100 mensajes, leer `chatSessions` y verificar checksum y `messageCount` (c:\Users\david\hopeai-copilot-v0\lib\storage\mongo-server-storage.ts:204–220).
- Monitoreo de recursos:
  - Log de `process.memoryUsage()` y latencia por request en `/api/send-message`; métrica con `sentryMetricsTracker` ya se actualiza (c:\Users\david\hopeai-copilot-v0\app\api\send-message\route.ts:128–143).

## Criterios de éxito
- Mensajes procesados en secuencia sin pérdida ni solapamientos.
- No aparecen 429 durante el uso normal (mensajes y documentos debounced).
- Persistencia consistente en MongoDB (checksums válidos, conteos correctos).
- Streaming estable sin interrupciones y con reintentos controlados cuando terceros o el propio middleware indiquen esperar.

## Entregables
- Ajustes en rate limiting y mapeo por ruta.
- Manejo de reintentos 429 en `sse-client` y `api-client-adapter`.
- Cola de mensajes por sesión y bloqueo de UI durante streaming.
- Corrección de endpoint de conflictos y (opcional) proxy de compatibilidad.
- Debounce en carga de documentos.
- Scripts de prueba de carga y verificación de consistencia.