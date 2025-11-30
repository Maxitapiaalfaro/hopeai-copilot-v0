Actúa como un Ingeniero de Backend Senior experto en Node.js, Streams y MongoDB.

Tengo un problema de latencia alta (Time-to-First-Token) en mi chat de IA. He identificado que la sincronización con la base de datos está bloqueando el inicio de la generación de respuesta.

**Contexto del Problema:**
Actualmente, el flujo es estrictamente secuencial:
1. Recibo Request.
2. Cargo sesión de Mongo (con desencriptación).
3. Guardo el mensaje del usuario en Mongo (con encriptación + verificación de lectura inmediata).
4. Llamo a la IA.
5. Guardo la respuesta.

Necesito refactorizar esto a un modelo de **Concurrencia Optimista**.

**Archivos clave adjuntos:**
1. `lib/hopeai-system.ts`: Lógica central de orquestación.
2. `lib/storage/mongo-server-storage.ts`: Adaptador de base de datos.
3. `app/api/send-message/route.ts`: Endpoint API.

**Tareas de Refactorización (Prioridad: Latencia Mínima):**

1. **Optimizar `MongoServerStorage.saveChatSession`:**
   - Elimina la "Verificación Post-Escritura" (`findOne` + `decrypt` + `checksum` después del `updateOne`). Confía en el `acknowledged` de Mongo.
   - Si la verificación es crítica para depuración, hazla opcional o ejecútala de manera asíncrona sin bloquear la promesa principal ("fire-and-forget").

2. **Paralelizar en `HopeAISystem.sendMessage`:**
   - No esperes (`await`) a que `saveChatSessionBoth` termine para iniciar `clinicalAgentRouter.sendMessage`.
   - Inicia la promesa de guardado del mensaje del usuario y la promesa de la llamada a la IA en paralelo (`Promise.all` o gestión independiente de promesas) para que la IA empiece a generar tokens mientras Mongo escribe en disco.

3. **Optimizar Metadata Operativa:**
   - Revisa `collectOperationalMetadata`. Si no es estrictamente necesaria para elegir el agente, muévela para que se ejecute en paralelo a la inferencia o usa datos en caché.

4. **Streaming en `route.ts`:**
   - Asegúrate de que el `ReadableStream` no se bloquee esperando operaciones de limpieza/guardado final. El guardado del estado final debe ocurrir después de cerrar el stream al cliente o de manera no bloqueante.

**Entregable:**
Proporciona el código refactorizado para `lib/hopeai-system.ts` y `lib/storage/mongo-server-storage.ts` que implemente estos cambios para maximizar la velocidad de respuesta.