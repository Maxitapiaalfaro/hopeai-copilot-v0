## Alineación con el requerimiento

* La clasificación de intención debe usar `gemini-2.5-flash-lite`. Se mantiene este modelo como fuente de verdad para intención.

## Causas raíz (confirmadas en código y logs)

* El camino de orquestación avanzada falla cuando no hay Function Calling y cae en `fallbackAgent = 'socratico'` (lib/intelligent-intent-router.ts:279–286, 1558–1571).

* Tras mover a servidor (Vertex), `flash-lite` a veces no devuelve function calls; el log "No se recibieron function calls en la respuesta combinada" coincide con lib/intelligent-intent-router.ts:777.

## Solución técnica manteniendo Flash Lite

1. Cliente dedicado para intención con API Key (AI Studio):

   * Crear cliente `aiIntent` (API key) para llamadas de intención con `flash-lite` (sin Vertex), aprovechando que AI Studio soporta Function Calling de forma estable.

   * Mantener `ai` (Vertex) para generación y agentes.

   * Exportar desde `google-genai-config.ts` un nuevo cliente, por ejemplo `aiIntent = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY || NEXT_PUBLIC_GOOGLE_AI_API_KEY })`.

   * Usar `aiIntent` en `IntelligentIntentRouter` para `classifyIntentAndExtractEntities()` y `classifyIntent()`; el modelo sigue siendo `'gemini-2.5-flash-lite'`.

2. Fallback heurístico en orquestación avanzada:

   * En `orchestrateWithTools()`, cuando `intentResult === null`, aplicar `heuristicClassifyIntent(userInput)` para decidir el agente (`clinico` si “documentar/nota/SOAP”, `academico` si “evidencia/investigación/papers”, `socratico` general) y devolver herramientas básicas.

   * Alternativamente, hacer que `createFallbackOrchestration(...)` use heurísticos para `selectedAgent` en lugar de `config.fallbackAgent`.

3. Afinar llamada de Function Calling (manteniendo flash-lite):

   * Añadir `allowedFunctionNames` también en la llamada combinada (igual que en `classifyIntent`) para reforzar ejecución de FC.

   * Verificar `FunctionCallingConfigMode.ANY` y, si el SDK exige, probar `AUTO` (sin cambiar el modelo).

4. Observabilidad

   * Loggear explícitamente el cliente usado (AI Studio vs Vertex) y el motivo de fallback (conteo de function calls) para trazabilidad.

## Verificación

* Unit tests de router:

  * "Quiero documentar un caso" con simulación de fallo de FC → `clinico`.

  * "Busca evidencia sobre TCC" con fallo de FC → `academico`.

  * Entrada genérica sin keywords → `socratico`.

* Integración:

  * Confirmar que con `aiIntent + flash-lite` se reciben function calls; si no, el heurístico evita el sesgo a `socratico`.

* Edge cases: se conservan overrides a `clinico` por riesgo/archivos (lib/intelligent-intent-router.ts:418–480 y 610–633).

## Alcance

* Cambios localizados en `lib/google-genai-config.ts` y `lib/intelligent-intent-router.ts`. No se tocan secretos ni Mongo.

## Próximo paso

* Implementar los cambios anteriores, ejecutar pruebas y validar en el entorno actual con MongoDB + Vertex, manteniendo `flash-lite` para intención.

