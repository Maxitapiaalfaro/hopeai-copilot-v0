## Objetivo
Eliminar la saturación y 429 originados por la migración IndexedDB→MongoDB, aislándola completamente del flujo de chat y de la sincronización con MongoDB, y luego optimizar el chat sin romper la lógica multiagente.

## Cambios en Migración (Aislamiento y Throttling)
- Feature flag “alpha-only”:
  - Activar variable (p.ej. `NEXT_PUBLIC_MIGRATION_ENABLED`) y verificación de usuario/rol; ocultar UI de migración a no-alpha y devolver 404/403 en endpoints.
- Pausar/limitar polling:
  - `useMigrationProgress`: pausar polling cuando el chat esté en streaming o la app esté en actividad de envío; activar solo si `isProcessing`.
  - Adoptar backoff exponencial y abortar ante 401/429; respeto de `Retry-After` si existe.
- Token-bucket dedicado (servidor y cliente):
  - Cuota pequeña por usuario/sesión para rutas de migración; nunca compite con la cuota de chat.
  - Encolar trabajos de baja prioridad; suspender ejecución si se detecta streaming de chat.
- Progressive Rollout y Orquestación:
  - Limitar `maxConcurrentMigrations` y aplicar ventanas de ejecución (off-peak); suspender si el monitor de carga (métricas) detecta picos.
- Eliminación de redundancias:
  - Consolidar lotes y evitar relecturas/reescrituras repetitivas; no reintentar 4xx no recuperables.

## Rate Limiting Inteligente (Global)
- Per-user/per-session:
  - Chat: 1 stream activo por sesión; nuevas solicitudes cancelan la anterior o se encolan con prioridad “crítica”.
  - Migración: cuotas pequeñas y prioridad baja; nunca se ejecuta si hay streaming.
- Cliente HTTP:
  - Backoff exponencial con jitter (100→1600 ms, máx. 4 intentos) y límite de concurrencia (p.ej. 4).
  - Per-route quotas: menor para migración; mayor para chat/almacenamiento crítico.

## Chat (después de estabilizar migración)
- SSE servidor `/api/send-message`:
  - Gate por sesión/usuario con token-bucket + cola; incluir `Retry-After` en 429.
  - Heartbeat y cierre ordenado (mantener); mensajes de error con `code`, `retryAfter`, `traceId`.
- SSE cliente:
  - Autenticación completa (cookies + `Authorization`); cancelación del stream previo antes de enviar otro.
  - Reconexión automática con backoff ante cortes y buffers con backpressure.
- Hooks/UI:
  - Bloquear enviar durante streaming; coalescing si hay doble envío en <300 ms.
  - Persistencia al completar o cada N chunks; evitar escrituras redundantes.

## Logging y Métricas
- Trazabilidad con `traceId` por sesión/solicitud.
- Métricas: p50/p90/p99 por endpoint; contadores de 401/429; ratio de reconexión SSE; uso de colas; throughput.

## Pruebas de Carga y Estabilidad
- Escenarios: bursts de chat, múltiples usuarios, reconexiones SSE.
- Validar: sin 429 en uso normal; en picos, colas y mensajes claros; p99 del primer evento SSE < 2s.

## Entregables
- Aislamiento total de la migración (alpha-only, pausas y throttling).
- Rate limiting y backoff integrados en cliente/servidor.
- Optimizaciones del chat manteniendo eventos multiagente.
- Métricas y pruebas de carga para validar SLAs.

Confirma para comenzar con la implementación de aislamiento/throttling de migración y luego aplicar los gates por sesión/usuario en el chat.