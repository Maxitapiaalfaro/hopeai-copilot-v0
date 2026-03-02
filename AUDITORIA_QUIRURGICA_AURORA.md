# Reporte de Auditoría Quirúrgica: Proyecto Aurora

**Fecha:** 02 de Marzo de 2026  
**Objetivo:** Mapeo de puntos de inyección para Auth Wrapper externo y topología de IndexedDB para sincronización Sidecar.  
**Directiva:** Estricto cumplimiento de lanzamiento a corto plazo (sin refactorizaciones de deuda técnica).

---

## 1. Mapeo del "Demo User" y Fractura de Auth

El sistema actual presenta una fractura entre un intento de migración a Auth0 y el sistema original basado en credenciales/NextAuth. Sin embargo, el bloqueo de la interfaz y la inyección de identidad están altamente centralizados, lo que facilita la inserción de un Auth Wrapper externo.

### 1.1. Puntos de Entrada Residuales y Gate de UI

El bloqueo de la interfaz principal se gestiona en un único componente que actúa como "Gate" (puerta de enlace).

*   **Archivo:** `components/main-interface-optimized.tsx`
*   **Líneas:** `944-989`
*   **Función:** `MainInterfaceOptimizedWithAuth`
*   **Mecanismo:** Utiliza el hook `useAuth()` para verificar `isAuthenticated`. Si es falso, renderiza una pantalla de bloqueo con el botón "Iniciar Sesión" que abre el `AuthModal`.
*   **Punto de Inyección (Auth Wrapper):** Para puentear este sistema, se debe envolver `MainInterfaceOptimizedWithAuth` (o reemplazar su lógica interna) en `app/page.tsx` (Línea 9) con el nuevo proveedor de autenticación, forzando `isAuthenticated = true` una vez que el proveedor externo valide el token.

### 1.2. Origen de la Verdad de Identidad (UID)

La resolución de la identidad del usuario (incluyendo el fallback a `demo_user` o identificadores anónimos) está centralizada en un único archivo de utilidad que alimenta al resto del sistema.

*   **Archivo:** `lib/user-identity.ts`
*   **Líneas:** `95-100`
*   **Función:** `getEffectiveUserId(explicitUserId?: string)`
*   **Mecanismo:** Retorna el ID en este orden de prioridad: (1) ID explícito pasado por parámetro, (2) ID guardado en `localStorage` bajo la clave `aurora_user_id`, (3) ID anónimo generado por huella de dispositivo (`dev_...`).
*   **Punto de Inyección (UID Externo):** El Auth Wrapper externo debe llamar a `setCurrentUserId(uid_externo)` (definida en `lib/user-identity.ts`, línea 26) inmediatamente después del login exitoso. Esto escribirá el UID en `localStorage('aurora_user_id')`, y `getEffectiveUserId()` lo propagará automáticamente a todo el sistema.

### 1.3. Hardcoding de `demo_user` en el Orquestador

A pesar de la centralización en `user-identity.ts`, el orquestador principal tiene un hardcoding de seguridad que fuerza el estado a `demo_user` al resetearse o inicializarse sin contexto.

*   **Archivo:** `hooks/use-hopeai-system.ts`
*   **Líneas:** `393`, `628`
*   **Mecanismo:** En la función `resetSystem` y en la creación de contexto, se usa explícitamente `userId: systemState.userId || 'demo_user'`.
*   **Acción Requerida:** Asegurar que el Auth Wrapper inyecte el UID en el estado global antes de que `use-hopeai-system.ts` se inicialice, o reemplazar estas cadenas literales por llamadas a `getEffectiveUserId()`.

---

## 2. Topología de IndexedDB (La Fuente de la Verdad)

El almacenamiento local en IndexedDB **no está esparcido** en los enrutadores gigantes. Afortunadamente, la arquitectura implementa el patrón Adapter y centraliza las operaciones de base de datos en clases específicas, lo que hace viable la implementación de un Sidecar de sincronización.

Existen **dos bases de datos IndexedDB paralelas** operando en el cliente, lo cual es crítico para el Sidecar:

### 2.1. Base de Datos 1: `ClinicalContextStorage` (Fichas Clínicas)

Esta clase maneja el guardado de las Fichas Clínicas generadas y opera como un Singleton.

*   **Archivo:** `lib/clinical-context-storage.ts`
*   **Nombre DB:** `hopeai_clinical_db` (Store: `fichas_clinicas`)
*   **Función de Escritura Exacta:** `saveFichaClinica(ficha: FichaClinicaState)` (Líneas `267-281`).
*   **Mecanismo:** Utiliza transacciones estándar de IndexedDB (`put`).
*   **Punto de Inyección (Sidecar):** Interceptar o envolver la función `saveFichaClinica` en la instancia exportada `clinicalStorage` (Línea 354). Cada vez que se llame a esta función (ej. desde `hooks/use-patient-library.ts` línea 261), el Sidecar debe capturar el payload `ficha` y enviarlo a la nube.

### 2.2. Base de Datos 2: `EnhancedIndexedDBAdapter` (Historial de Chat y Sync)

Esta clase maneja el historial de chat y ya posee una infraestructura nativa para sincronización (`change_records`), lo que facilita enormemente el trabajo del Sidecar.

*   **Archivo:** `lib/storage/enhanced-indexeddb-adapter.ts`
*   **Nombre DB:** `hopeai_clinical_db` (Stores: `chat_sessions`, `change_records`)
*   **Función de Escritura Exacta:** `saveChatSession(session: ChatState)` (Líneas `213-237`).
*   **Mecanismo:** Realiza una transacción dual. Guarda la sesión en `chat_sessions` y **automáticamente registra el cambio** en el store `change_records` llamando a `this.recordChange('chat', session.sessionId, operation, session, changeStore)`.
*   **Punto de Inyección (Sidecar):** No es necesario interceptar las escrituras individuales. El Sidecar solo necesita instanciar `EnhancedIndexedDBAdapter` y llamar periódicamente a la función `getChangesSince(since: Date)` (Línea 564) o leer directamente el store `change_records`. Esto devolverá un array con todas las mutaciones (creaciones/actualizaciones) listas para ser enviadas a la nube. Una vez enviadas, se llama a `markChangesSynced(changeIds)` (Línea 584).

### 2.3. Resumen de Ejecución para el Sidecar

Para habilitar la sincronización a la nube sin tocar la lógica de orquestación de 3.000 líneas:

1.  **Para el Chat:** Consumir la cola de eventos ya existente en `lib/storage/enhanced-indexeddb-adapter.ts` mediante `getChangesSince()`.
2.  **Para las Fichas:** Envolver el método `saveFichaClinica` del singleton exportado en `lib/clinical-context-storage.ts` (Línea 354).
3.  **Para los Archivos:** Envolver el método `saveClinicalFile` en `lib/storage/enhanced-indexeddb-adapter.ts` (Línea 313).
