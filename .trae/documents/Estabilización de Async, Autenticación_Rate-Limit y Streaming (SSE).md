## Objetivo
Resolver los errores consecutivos del sistema: listeners asíncronos, 401/429 y saturación SSE, y fallos de streaming, con logging y pruebas de carga.

## Hallazgos
- No existen listeners tipo `chrome.runtime.onMessage` ni `return true` en el repo; el error "message channel closed" apunta a entorno del navegador/extensión. Aun así, mejoraremos nuestros canales asíncronos (SSE y fetch) con timeouts y cierre correcto.
- `/api/migration/status` se consulta desde `useMigrationProgress` sin autenticación explícita; puede producir 401 según contexto de sesión.
- Reintentos y control de tasa no existen en el cliente (`APIClientAdapter.makeRequest`), lo que favorece 429 y saturación en SSE y otros endpoints.
- SSE implementado vía `ReadableStream` (`lib/sse-client.ts` y `app/api/send-message/route.ts`), sin reconexión automática ni bufferización ante picos.

## Cambios Propuestos

### 1) Comunicación Asíncrona
- `lib/sse-client.ts`:
  - Añadir auto-reconexión incremental con `AbortController` (reintentos con jitter y tope).
  - Añadir `timeout` de inactividad y cierre ordenado del stream al completar.
  - Buffer de salida con límite (p.ej., 1–2 MB) y entrega en lotes cuando se detecte pico.
- `app/api/send-message/route.ts`:
  - Agregar heartbeat `: ping\n\n` cada 15s para mantener el canal abierto y detectar desconexión.
  - Asegurar `controller.close()` y captura de excepciones en `cancel()`.

### 2) Autenticación y Rate Limiting
- `components/migration/migration-hooks.ts` (`useMigrationProgress`):
  - Incluir `Authorization: Bearer <access>` y `credentials: 'include'` para `/api/migration/status`.
  - Implementar backoff exponencial en el polling y pausar ante 401/429.
- `lib/storage/api-client-adapter.ts`:
  - Añadir reintentos con backoff y jitter (p.ej., 100ms→1.6s, máx. 5 intentos) en `makeRequest`.
  - Implementar cola de peticiones con límite de concurrencia (p.ej., 4) y token bucket (p.ej., 20 req/min), compartida por instancia.
  - Detectar 429 y ampliar backoff; registrar métricas de rechazo.
- Opcional (servidor): evaluar y ajustar límites de rate limiting si existe middleware (no detectado en repo). Mantener límites conservadores y retornar `Retry-After`.

### 3) Streaming (SSE)
- `lib/sse-client.ts`:
  - Manejo de reconexión automática si `onError` o cierre inesperado; re-suscribir callbacks;
  - Buffer de chunks y entrega con backpressure; proteger decodificación y parseo.
- `hooks/use-hopeai-system.ts`:
  - Añadir manejo de reconexión del generador cuando el cliente notifique `onError`.
  - Cancelación explícita al cambiar de sesión o al desmontar.

### 4) Logging y Métricas
- `lib/logger` y puntos de llamada:
  - En `APIClientAdapter.makeRequest`: log estructurado con `status`, `retryAttempt`, `durationMs`.
  - En `lib/sse-client.ts`: log de eventos `start/chunk/error/complete` con conteos y tiempos.
- Métricas:
  - Contadores de 401/429, latencias p50/p90/p99 por endpoint, tasa de reconexión SSE.

### 5) Pruebas
- Vitest:
  - Tests de backoff: simular 429/5xx y verificar reintentos.
  - Tests de autenticación: mock de token y 401→recovery.
  - Tests de SSE reconexión: simular cierre en mitad del stream y validar re-suscripción y entrega completa.
- Carga:
  - Extender `scripts/load-test-chat-storage.ts` para incluir endpoints de pacientes/fichas/analyses y medir p50/p90/p99.

## Archivos a Modificar
- `lib/sse-client.ts` (reconexión, timeout, buffer)
- `app/api/send-message/route.ts` (heartbeat y cierre)
- `components/migration/migration-hooks.ts` (auth y backoff en `/api/migration/status`)
- `lib/storage/api-client-adapter.ts` (rate limiter y backoff)
- `hooks/use-hopeai-system.ts` (reconexión del generador)
- Tests y scripts de carga.

## Verificación
- Reproducir 401/429 y comprobar que el cliente reduce la presión y recupera con tokens válidos.
- Simular desconexión SSE y validar reconexión automática y entrega completa.
- Confirmar ausencia de errores de canal asíncrono y estabilidad con heartbeats.

¿Confirmas proceder con estos cambios y la suite de pruebas asociadas?