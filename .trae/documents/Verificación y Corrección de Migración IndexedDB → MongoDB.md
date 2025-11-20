## Hallazgos Clave
- La migración actual solo considera stores genéricos `sessions/patients/files/preferences` y no coincide con los stores reales: `chat_sessions`, `patient_records`, `clinical_files`, `user_preferences`, `fichas_clinicas`, `pattern_analyses` (lib/storage/enhanced-indexeddb-adapter.ts:66–86, 164–207).
- `LocalDataMigrator.getEntitiesToMigrate()` usa nombres de stores incorrectos (lib/migration/local-data-migrator.ts:214–219), y `prepareEntityForMigration()` fija `_entityType` a valores no soportados por el cliente remoto (lib/migration/local-data-migrator.ts:318–327) → el `APIClientAdapter.create()` solo soporta `chat-session`, `clinical-file`, `patient`, `pattern-analysis` (lib/storage/api-client-adapter.ts:365–377).
- No existen rutas server-side para `/storage/patients` ni `/storage/pattern-analyses` (búsqueda confirmada). Sí existen para `chat-sessions` y `clinical-files` (app/api/storage/chat-sessions/route.ts, clinical-files/*).
- El backend Mongo cifra y verifica integridad de `chatSessions` (lib/storage/mongo-server-storage.ts:144–231). `fichasClinicas` se almacenan sin cifrado (lib/storage/mongo-server-storage.ts:394–424).
- El sync se inicia inmediatamente tras login (contexts/auth-context.tsx:66–67, 96–97, 152–153) y hay orquestador de sync/conflictos (`lib/sync/sync-orchestrator.ts`).

## Objetivos de Verificación
- Migración inicial completa y fiel del 100% de datos clínicos del usuario (chat, pacientes, archivos, fichas, análisis).
- Flujo de usuario consistente: acceso inmediato post-login, offline disponible, consistencia multi-dispositivo.
- Sincronización bidireccional robusta con manejo de conflictos y seguridad en tránsito/descanso.
- Pruebas de carga, intermitencia, consistencia y rendimiento que cumplan criterios de éxito.

## Correcciones Técnicas Propuestas
1. Alinear stores y tipos de entidad en `LocalDataMigrator`:
- `createBackup()` y `getEntitiesToMigrate()` deben usar stores reales: `chat_sessions`, `patient_records`, `clinical_files`, `user_preferences`, `fichas_clinicas`, `pattern_analyses` (lib/migration/local-data-migrator.ts:165–175, 214–241).
- Mapear a tipos remotos soportados: `chat_sessions → chat-session`, `patient_records → patient`, `clinical_files → clinical-file`, `pattern_analyses → pattern-analysis`, `fichas_clinicas → ficha-clinica`, `user_preferences → user-preferences`.
- Ajustar `markEntityAsMigrated()` para respetar keyPath por store (`sessionId`, `id`, `analysisId`, `fichaId`) (lib/migration/local-data-migrator.ts:389–399).

2. Completar rutas API en el servidor:
- Implementar `app/api/storage/patients/route.ts` (GET/POST/DELETE y /batch) respaldado por colección `patients` con índices ya previstos (lib/database/mongodb.ts:createIndexes()).
- Implementar `app/api/storage/pattern-analyses/route.ts` (POST y GET por `patientId`) respaldado por colección `patternAnalyses`.
- Evaluar si `fichasClinicas` usan una ruta `app/api/storage/fichas-clinicas/route.ts`; hoy existen métodos en `MongoServerStorage` pero no endpoints.

3. Seguridad y cifrado:
- Cifrar `fichasClinicas` en Mongo (similar a `chatSessions`) o limitar campos sensibles según política.
- Verificar HTTPS y cabeceras auth (`Authorization`, `X-User-Id`, `X-Device-Id`) en el cliente remoto (lib/storage/api-client-adapter.ts:48–59).

4. Feedback de UI sobre migración:
- Integrar `useMigrationProgress` en `components/header.tsx` para mostrar progreso en tiempo real (barra/Badge).
- Activar toasts con `useMigrationNotifications` para etapas clave (inicio, lote procesado, finalización, rollback).

## Plan de Verificación End-to-End
- Preparación de entorno:
- Inicializar IndexedDB con datos sintéticos en todos los stores (EnhancedIndexedDBAdapter.save* y ClinicalContextStorage.save*).
- Forzar migración con `ProgressiveRollout` y `LocalDataMigrator.migrateUserData()`.

- Casos de prueba funcionales:
- Migración inicial 100%: comparar conteos locales vs Mongo tras migración usando `getStorageStats` vs endpoints de listado (chat-sessions, patients, clinical-files, fichas, pattern-analyses).
- Integridad y esquema: validar checksums y fechas normalizadas en sesiones (lib/storage/mongo-server-storage.ts:162–181) y consistencia de índices.
- Acceso post-login: verificar que los datos locales están disponibles inmediatamente, antes de completar sync (contexts/auth-context.tsx:66–67).
- Offline: crear cambios locales con red simulada caída; verificar encolado `pending_operations` y recuperación con reintentos.
- Multi-dispositivo: simular dos `deviceId`; asegurar que el pull excluye cambios del mismo dispositivo y reconcilia las del otro (`app/api/storage/changes/route.ts`).

- Conflictos y resolución:
- Generar conflictos intencionales (ediciones simultáneas) y verificar endpoints `/api/sync/conflicts` y resoluciones `use_local|use_server|merge|manual`.

## Pruebas de Carga y Conectividad
- Carga masiva:
- Extender `scripts/load-test-chat-storage.ts` para incluir pacientes y archivos; medir latencias p50/p90/p99 y throughput.
- Intermitencia:
- Inyectar fallos `NETWORK_ERROR` y `HTTP 5xx` en `APIClientAdapter.makeRequest()`; validar reintentos y backoff.

## Pruebas de Consistencia Multi-Dispositivo
- Orquestar sesiones A/B con distintos `deviceId` aplicando cambios en paralelo; validar `changeLogs` y estado final coherente con pull/push.

## Pruebas de Rendimiento
- Medir tiempos post-login (arranque de sync) y disponibilidad de datos locales; objetivos: render < 200ms, sync inicial no bloqueante, migración en background con UI responsiva.

## Criterios de Éxito (Validación)
- 100% de datos clínicos migrados sin pérdida: comparación exacta de conteos y muestreo aleatorio de registros descifrados.
- Tiempos de carga aceptables: UI fluida, sync en background, p99 insert < 500ms bajo carga definida.
- Consistencia total: sin divergencias entre dispositivos tras reconciliación.
- Navegadores soportados: validar en Chrome/Firefox/Edge; usar `fake-indexeddb` para CI.

## Entregables
- Correcciones en `LocalDataMigrator` y nuevos endpoints de pacientes/pattern-analyses.
- Pruebas Vitest: migración completa, offline/online, conflictos y rendimiento básico.
- Scripts de carga extendidos y reporte de métricas.
- Mejora UI con progreso y notificaciones de migración.

¿Confirmas que procedamos con estas correcciones y el plan de verificación?