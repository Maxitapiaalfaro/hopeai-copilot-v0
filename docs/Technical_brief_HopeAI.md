### Estado actual de HopeAI (corroborado con archivos y líneas)

- 1) Arquitectura de orquestación unificada
  - La API de mensajes usa un sistema singleton para enviar mensajes a la orquestación.
```25:35:app/api/send-message/route.ts
// Obtener el sistema de orquestación optimizado (singleton)
const orchestrationSystem = await getGlobalOrchestrationSystem()

// Usar el método sendMessage optimizado del sistema de orquestación
const result = await orchestrationSystem.sendMessage(
  sessionId,
  message,
  useStreaming,
  suggestedAgent,
  sessionMeta // Pass patient context metadata
)
```
  - El singleton de orquestación crea e inicializa una sola instancia con configuración de bridge, monitoring y system.
```70:86:lib/orchestration-singleton.ts
export async function getGlobalOrchestrationSystem(): Promise<HopeAIOrchestrationSystem> {
  if (!globalOrchestrationSystem) {
    // Crear router de agentes clínicos
    const agentRouter = new ClinicalAgentRouter()
    // Crear sistema de orquestación con configuración unificada
    globalOrchestrationSystem = createHopeAIOrchestrationSystem(
      hopeAI,
      agentRouter,
      ORCHESTRATION_CONFIG
    )
    // Inicializar el sistema completo
    await globalOrchestrationSystem.initialize()
  }
  return globalOrchestrationSystem
}
```
  - El sistema expone salud y métricas para endpoints operativos.
```289:306:lib/index.ts
public getHealthStatus(): SystemHealthStatus {
  const metrics = this.monitoring.getMetrics();
  const bridgeMetrics = this.orchestrationBridge.getPerformanceMetrics();
  // ...
  return {
    overall,
    components: {
      toolRegistry: toolRegistryHealth,
      orchestrationBridge: bridgeHealth,
      monitoring: monitoringHealth
    },
    // ...
  };
}
```

- 2) Orquestador dinámico con intención, entidades y herramientas
  - El orquestador dinámico coordina router de intención, extracción de entidades, herramientas y recomendaciones.
```139:171:lib/dynamic-orchestrator.ts
async orchestrate(
  userInput: string,
  sessionId: string,
  userId: string,
  sessionFiles?: ClinicalFile[]
): Promise<DynamicOrchestrationResult> {
  // 1. Obtener o crear contexto de sesión
  const sessionContext = await this.getOrCreateSession(sessionId, userId);
  // 2. Actualizar historial (incluye archivos adjuntos)
  this.updateConversationHistory(sessionContext, userInput, sessionFiles);
  // 3. Orquestación inteligente (intención + herramientas)
  const orchestrationResult = await this.intentRouter.orchestrateWithTools(
    userInput,
    sessionContext.conversationHistory,
    sessionContext.currentAgent
  );
  // 4. Optimizar herramientas y actualizar contexto
  // ...
}
```
  - La clasificación de intención usa Function Calling del SDK (`@google/genai`) con funciones “activar_modo_*”.
```505:517:lib/intelligent-intent-router.ts
const result = await this.ai.models.generateContent({
  model: 'gemini-2.5-flash-lite',
  contents: [{ role: 'user', parts: [{ text: contextPrompt }] }],
  config: {
    tools: [{ functionDeclarations: this.intentFunctions }],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.ANY,
        allowedFunctionNames: ['activar_modo_socratico','activar_modo_clinico','activar_modo_academico']
      }
    },
    temperature: 0.0
  }
});
```
  - La extracción de entidades también usa Function Calling con AUTO y catálogo propio de funciones.
```484:494:lib/entity-extraction-engine.ts
const extractionResult = await ai.models.generateContent({
  model: 'gemini-2.5-flash-lite',
  contents: contextualPrompt,
  config: {
    tools: [{ functionDeclarations: entityExtractionFunctions }],
    toolConfig: {
      functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO }
    }
  }
})
```
  - El registro de herramientas incluye una herramienta de búsqueda académica interoperable con el modelo.
```297:318:lib/tool-registry.ts
declaration: {
  name: 'google_search',
  description: 'Busca literatura académica relevante en la web...',
  parameters: {
    type: Type.OBJECT,
    properties: { query: { type: Type.STRING, description: 'Términos de búsqueda...' } },
    required: ['query']
  }
}
```

- 3) Agentes clínicos y sesión de chat con el SDK
  - El router clínico define tres agentes con instrucciones de sistema y crea sesiones con `ai.chats.create`.
```591:603:lib/clinical-agent-router.ts
const chat = ai.chats.create({
  model: agentConfig.config.model || 'gemini-2.5-flash',
  config: {
    temperature: agentConfig.config.temperature,
    // ...
    systemInstruction: agentConfig.systemInstruction,
    tools: agentConfig.tools && agentConfig.tools.length > 0 ? agentConfig.tools : undefined,
  },
  history: geminiHistory,
})
```
  - El agente académico declara herramientas nativas `googleSearch` con extracción de grounding posterior.
```560:571:lib/clinical-agent-router.ts
tools: [{
  googleSearch: {
    timeRangeFilter: { startTime: "2023-01-01T00:00:00Z", endTime: "2024-12-31T23:59:59Z" }
  }
}],
config: { ...clinicalModelConfig, temperature: 0.3 }
```
```951:963:lib/clinical-agent-router.ts
if (chunk.groundingMetadata) {
  const urls = self.extractUrlsFromGroundingMetadata(chunk.groundingMetadata)
  if (urls.length > 0) {
    yield { text: "", groundingUrls: urls, metadata: { type: "grounding_references", sources: urls } }
  }
}
```

- 4) Gestión de contexto optimizada (Sliding Window)
  - El `ContextWindowManager` aplica sliding window, preserva referencias y configura compresión.
```85:103:lib/context-window-manager.ts
processContext(
  sessionContext: Content[],
  currentInput: string
): ContextProcessingResult {
  // 1. Detectar referencias contextuales
  this.detectContextualReferences(sessionContext, currentInput);
  // 2. Sliding window
  const slidingWindowContext = this.applySlidingWindow(sessionContext);
  // 3. Preservar referencias críticas
  const contextWithPreservedReferences = this.preserveContextualReferences(
    slidingWindowContext, sessionContext
  );
  // 4. Estimar tokens y compresión
  // ...
}
```

- 5) Observabilidad operacional (health/metrics) y control
  - Endpoints activos para salud y métricas del orquestador.
```10:22:app/api/orchestration/health/route.ts
const orchestrationSystem = await getGlobalOrchestrationSystem()
const healthStatus = orchestrationSystem.getHealthStatus()
return NextResponse.json({ success: true, health: healthStatus, timestamp: new Date().toISOString() })
```
```10:24:app/api/orchestration/metrics/route.ts
const orchestrationSystem = await getGlobalOrchestrationSystem()
const metrics = orchestrationSystem.getSystemMetrics()
return NextResponse.json({ success: true, metrics, timestamp: new Date().toISOString() })
```
  - Reportes clínicos generados desde el sistema de orquestación.
```60:67:app/api/orchestration/reports/route.ts
const orchestrationSystem = await getGlobalOrchestrationSystem()
// Generar reporte clínico
const clinicalReport = orchestrationSystem.generateClinicalReport(startDate, endDate)
```

- 6) Interfaz de chat con streaming y grounding
  - La UI procesa streams, agrega grounding y persiste en historial tras completar.
```186:206:components/chat-interface.tsx
if (response && typeof response[Symbol.asyncIterator] === 'function') {
  for await (const chunk of response) {
    if (chunk.text) { fullResponse += chunk.text; setStreamingResponse(fullResponse) }
    if (chunk.groundingUrls && chunk.groundingUrls.length > 0) {
      accumulatedGroundingUrls = [...accumulatedGroundingUrls, ...chunk.groundingUrls]
      setStreamingGroundingUrls(accumulatedGroundingUrls)
    }
  }
}
```

- 7) Carga y manejo de documentos clínicos
  - Endpoint de carga delega a `HopeAISystemSingleton.uploadDocument(...)`.
```25:37:app/api/upload-document/route.ts
const uploadedFile = await HopeAISystemSingleton.uploadDocument(
  sessionId,
  file,
  userId
)
return NextResponse.json({ success: true, uploadedFile, message: `Documento "${file.name}" subido exitosamente` })
```
  - Lógica de validación, deduplicación y persistencia de archivos en el sistema.
```739:755:lib/hopeai-system.ts
if (!clinicalFileManager.isValidClinicalFile(file)) {
  throw new Error("Invalid file type or size...")
}
// Check duplicate files in the session
const existingFiles = await this.getPendingFilesForSession(sessionId)
const duplicateFile = existingFiles.find(existingFile =>
  existingFile.name === file.name && existingFile.size === file.size && existingFile.status !== 'error'
)
```

- 8) Modelos y seguridad clínica (SDK Google GenAI)
  - Configuración clínica del modelo y umbrales de seguridad activos.
```54:61:lib/google-genai-config.ts
export const clinicalModelConfig = {
  model: "gemini-2.5-flash",
  temperature: 0.3,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 4096,
  safetySettings: clinicalSafetySettings,
}
```
  - Dependencia actual en `@google/genai` en el proyecto.
```16:21:package.json
"dependencies": {
  "@google/genai": "latest",
  "@hookform/resolvers": "^3.9.1",
```

- 9) Capacidad de cambio de agente e inicialización de sesiones desde API
  - Cambio de agente por orquestación dinámica.
```12:21:app/api/switch-agent/route.ts
const orchestrationSystem = await getGlobalOrchestrationSystem()
const result = await orchestrationSystem.orchestrate(
  `Cambiar al agente: ${newAgent}`,
  sessionId,
  'default-user',
  { forceMode: 'dynamic', previousAgent: newAgent }
)
```
  - Creación de sesión via orquestador (nota: la lista de sesiones GET aún devuelve vacío).
```61:70:app/api/sessions/route.ts
// Por ahora retornamos un array vacío ya que la funcionalidad de getUserSessions
// necesita ser implementada en el nuevo sistema
const sessions: any[] = []

return NextResponse.json({ success: true, sessions })
```

- 10) UI de agentes y configuración visual (independiente del backend)
  - Mapeo visual de `socratico`, `clinico`, `academico`, `orquestador` para la interfaz.
```17:26:config/agent-visual-config.ts
export const AGENT_VISUAL_CONFIG: Record<AgentType, AgentVisualConfig> = {
  socratico: { name: "HopeAI Socrático", /* ... */ borderColor: "border-blue-200", /* ... */ },
  clinico:   { name: "HopeAI Clínico",    /* ... */ borderColor: "border-green-200", /* ... */ },
```

### Dependencias críticas (entendidas)
- Orquestador
  - Depende de: `lib/intelligent-intent-router.ts`, `lib/entity-extraction-engine.ts`, `lib/tool-registry.ts`, `lib/clinical-agent-router.ts`, `lib/google-genai-config.ts`.
  - Independiente de UI: no depende de `components/*` ni `config/agent-visual-config.ts`.

- Enrutamiento de intención
  - Depende de: `@google/genai` (Function Calling), `ContextWindowManager`, `ToolRegistry`, `EntityExtractionEngine`.
  - Independiente de: endpoints de Stripe/membresía.

- Gestión de contexto
  - Depende de: `@google/genai` (SlidingWindow types), se invoca desde `IntelligentIntentRouter`.
  - Independiente de: UI y endpoints de membresía.

- Agentes clínicos
  - Dependen de: `@google/genai` chats, instrucciones de sistema y herramientas; integran grounding para académico.
  - Independientes de: UI (solo exponen resultados/streams).

- Observabilidad
  - Endpoints `health/metrics/reports` dependen de `lib/index.ts` y del singleton de orquestación.
  - Independientes de UI.

### Limitaciones y estado “en progreso”
- Listado de sesiones (GET) aún no implementado en la nueva ruta (retorna vacío).
```61:67:app/api/sessions/route.ts
// Por ahora retornamos un array vacío ya que la funcionalidad de getUserSessions
// necesita ser implementada en el nuevo sistema
const sessions: any[] = []
```
- La documentación reconoce cobertura de tests críticos “en progreso”.
```138:146:docs/ARCHITECTURAL_MANIFESTO.md
| Cobertura de tests críticos | >90% | 🔄 En progreso |
| Disponibilidad del sistema  | >99.5% | ✅ Health checks |
```

## Conclusión breve
- HopeAI opera con un orquestador dinámico único, enrutamiento por intención con Function Calling, extracción de entidades, registro de herramientas y tres agentes clínicos; todo sobre `@google/genai`. La salud/métricas están expuestas por endpoints activos. La UI gestiona streaming y grounding. El flujo de documentos está implementado con validación y persistencia. Algunas capacidades (listar sesiones en la nueva ruta) están pendientes.



### Estado actual de HopeAI (de punta a punta, corroborado por archivos reales y extendido del análisis anterior)

1) Flujo solicitud→respuesta y orquestación única
- Se recibe el mensaje y se delega al sistema de orquestación singleton.
```25:35:app/api/send-message/route.ts
const orchestrationSystem = await getGlobalOrchestrationSystem()
const result = await orchestrationSystem.sendMessage(
  sessionId, message, useStreaming, suggestedAgent, sessionMeta
)
```
- El singleton crea una sola instancia e inicializa bridge, monitoring y system.
```70:86:lib/orchestration-singleton.ts
globalOrchestrationSystem = createHopeAIOrchestrationSystem(hopeAI, agentRouter, ORCHESTRATION_CONFIG)
await globalOrchestrationSystem.initialize()
```
- El sistema expone salud y métricas utilizadas por endpoints operativos.
```289:306:lib/index.ts
public getHealthStatus(): SystemHealthStatus { ... return { overall, components, metrics, alerts, ... } }
```
- Endpoints de salud/métricas consumen esas APIs.
```10:22:app/api/orchestration/health/route.ts
const orchestrationSystem = await getGlobalOrchestrationSystem()
const healthStatus = orchestrationSystem.getHealthStatus()
```
```10:24:app/api/orchestration/metrics/route.ts
const metrics = orchestrationSystem.getSystemMetrics()
```
- Dependencias:
  - Depende de: `lib/index.ts`, `lib/orchestration-singleton.ts`.
  - Independiente de: UI/estilos; Stripe/membresía.

2) Orquestador dinámico, intención, entidades y selección de herramientas
- El orquestador coordina intención, entidades, herramientas, contexto y recomendaciones.
```139:171:lib/dynamic-orchestrator.ts
const orchestrationResult = await this.intentRouter.orchestrateWithTools(userInput, sessionContext.conversationHistory, sessionContext.currentAgent)
```
- Clasificación de intención con Function Calling del SDK (funciones activar_modo_*).
```505:517:lib/intelligent-intent-router.ts
tools: [{ functionDeclarations: this.intentFunctions }],
toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: [...] } }
```
- Extracción de entidades con Function Calling AUTO y catálogo propio.
```484:494:lib/entity-extraction-engine.ts
config: { tools: [{ functionDeclarations: entityExtractionFunctions }], toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } } }
```
- Registro de herramientas incluye `google_search` para investigación académica.
```297:318:lib/tool-registry.ts
declaration: { name: 'google_search', ... required: ['query'] }
```
- Dependencias:
  - Depende de: `@google/genai` (FunctionDeclaration, FunctionCallingConfig), `lib/context-window-manager.ts`, `lib/tool-registry.ts`, `lib/entity-extraction-engine.ts`.
  - Independiente de: Patient library, UI visual.

3) Agentes clínicos y sesiones de chat (SDK de Google GenAI)
- Sesiones de chat con el SDK; uso de `ai.chats.create` y streaming.
```591:603:lib/clinical-agent-router.ts
const chat = ai.chats.create({ model: ..., config: { systemInstruction: ..., tools: ... }, history: geminiHistory })
```
- El agente académico usa `googleSearch` nativo y expone grounding como URLs.
```560:571:lib/clinical-agent-router.ts
tools: [{ googleSearch: { timeRangeFilter: { startTime: "...", endTime: "..." } } }]
```
```951:963:lib/clinical-agent-router.ts
if (chunk.groundingMetadata) { const urls = self.extractUrlsFromGroundingMetadata(...); yield { groundingUrls: urls, ... } }
```
- Dependencias:
  - Depende de: `@google/genai` (chats, streaming), instrucciones de sistema por agente.
  - Independiente de: endpoints de membresía/Stripe, estilos.

4) Gestión de contexto (Sliding Window) y preservación de referencias
- Ventana deslizante, preservación de referencias críticas y configuración de compresión.
```85:103:lib/context-window-manager.ts
this.detectContextualReferences(...); const sliding = this.applySlidingWindow(...); const preserved = this.preserveContextualReferences(sliding, sessionContext)
```
- Tipos del SDK para compresión/ventana.
```12:18:lib/context-window-manager.ts
import { ContextWindowCompressionConfig, SlidingWindow } from '@google/genai'
```
- Dependencias:
  - Depende de: `@google/genai` (tipos de ventana/compresión).
  - Independiente de: patient library y UI.

5) Historial de chat: modelo de datos y persistencia cliente/servidor
- Estructura del mensaje y del estado de chat; referencias a archivos por ID y grounding URLs.
```5:16:types/clinical-types.ts
export interface ChatMessage { id: string; content: string; role: "user"|"model"; agent?: AgentType; timestamp: Date; fileReferences?: string[]; groundingUrls?: ... }
```
```31:49:types/clinical-types.ts
export interface ChatState { sessionId; userId; ... history: ChatMessage[]; metadata: { ... fileReferences: string[] }; clinicalContext: { patientId? ... } }
```
- Persistencia en cliente con historial curado/comprehensivo y compresión.
```71:87:lib/client-context-persistence.ts
saveOptimizedContext(...){ const existingContext = await this.loadOptimizedContext(sessionId); const comprehensiveHistory = existingContext?.comprehensiveHistory || curatedHistory }
```
```317:334:lib/client-context-persistence.ts
// Compresión selectiva del historial (mantener primeros 2, últimos 10, muestreo intermedio)
```
- Persistencia servidor: guardado/carga de sesión (adaptador de storage) y escritura del historial al enviar.
```26:47:lib/hopeai-system.ts
private async saveChatSessionBoth(chatState: ChatState){ const existingSession = await this.storage.loadChatSession(chatState.sessionId); await this.storage.saveChatSession(chatState) }
```
```448:461:lib/hopeai-system.ts
const userMessage: ChatMessage = { id: ..., content: message, role: "user", ... fileReferences: sessionFiles?.map(f => f.id) || [] }
currentState.history.push(userMessage)
``]
- Agregar respuesta de streaming al historial con grounding.
```678:709:lib/hopeai-system.ts
async addStreamingResponseToHistory(...){ const aiMessage: ChatMessage = { content: responseContent, role: "model", agent, groundingUrls }; currentState.history.push(aiMessage) }
```
- Dependencias:
  - Depende de: adaptador de storage servidor (no mostrado aquí), `lib/hopeai-system.ts`; UI usa `ClientContextPersistence` para cache.
  - Independiente de: SDK directo (cliente), salvo cuando se forma contexto para el modelo.

6) Patient Library (biblioteca de pacientes) e inyección de contexto clínico
- Tipos de paciente y caché de resumen para uso del orquestador.
```119:130:types/clinical-types.ts
export interface PatientRecord { id; displayName; ... summaryCache?: PatientSummaryCache; ... }
```
- Persistencia en IndexedDB con interfaz tipo repositorio.
```9:16:lib/patient-persistence.ts
export class PatientPersistence implements PatientStorageAdapter { ... private readonly dbName = "HopeAI_PatientLibrary" ... }
```
- El sistema HopeAI inyecta resumen de paciente en el contexto si existe.
```225:241:lib/hopeai-system.ts
const patientPersistence = getPatientPersistence(); const patientRecord = await patientPersistence.loadPatientRecord(patientReference);
patientSummary = patientRecord.summaryCache?.text || PatientSummaryBuilder.buildSummary(patientRecord)
```
- Dependencias:
  - Depende de: `lib/patient-persistence.ts` y `PatientSummaryBuilder`.
  - Independiente de: `@google/genai` (la biblioteca es cliente IndexedDB).

7) UI de chat con streaming y grounding
- La UI procesa streaming chunk-a-chunk y muestra grounding en vivo; registra en historial al concluir.
```186:214:components/chat-interface.tsx
for await (const chunk of response) { if (chunk.text){...} if (chunk.groundingUrls){ ... setStreamingGroundingUrls(...) } }
```
```235:243:components/chat-interface.tsx
await addStreamingResponseToHistory(fullResponse, responseAgent, accumulatedGroundingUrls)
```
- Carga de archivos por IDs para mensajes del historial.
```63:71:components/chat-interface.tsx
if (message.fileReferences?.length > 0) { const files = await getFilesByIds(message.fileReferences) ... }
```
- Dependencias:
  - Depende de: `lib/hopeai-system` (getFilesByIds), `lib/sentry-metrics-tracker` para tracking UI.
  - Independiente de: orquestación interna (consume su output).

8) Documentos clínicos: carga, deduplicación y referencia por ID
- Endpoint de carga usa el singleton para subir y registrar archivo.
```25:37:app/api/upload-document/route.ts
const uploadedFile = await HopeAISystemSingleton.uploadDocument(sessionId, file, userId)
```
- Validación, deduplicación y actualización de metadatos de sesión.
```739:761:lib/hopeai-system.ts
if (!clinicalFileManager.isValidClinicalFile(file)) throw new Error(...)
const duplicateFile = existingFiles.find(... name === file.name && size === file.size && status !== 'error')
```
- Dependencias:
  - Depende de: `clinical-file-manager`, storage, `HopeAISystem`.
  - Independiente de: clasificación de intención.

9) Observabilidad y métricas Sentry (uso y sesiones)
- Registro de mensajes, tiempos, streaming, grounding, function calls y cambios de agente.
```81:100:lib/sentry-metrics-tracker.ts
public trackMessageSent(metrics: MessageMetrics){ Sentry.addBreadcrumb({ message: 'Message sent', category: 'metrics', data: {...} }) }
```
```431:450:lib/sentry-metrics-tracker.ts
public trackAgentSwitch(...){ Sentry.addBreadcrumb({ message: 'Agent switch recorded', ... }) }
```
- Dependencias:
  - Depende de: `@sentry/nextjs`.
  - Independiente de: `@google/genai`.

10) Importancia y dependencia transversal del SDK de Google GenAI
- Cliente/Config del SDK (clave y modelo clínico base)
```8:25:lib/google-genai-config.ts
function createGenAIClient(): GoogleGenAI { /* lee NEXT_PUBLIC_GOOGLE_AI_API_KEY/GOOGLE_AI_API_KEY */ }
export const clinicalModelConfig = { model: "gemini-2.5-flash", ... safetySettings: clinicalSafetySettings }
```
- Uso en orquestación de intención (Function Calling), extracción de entidades, sesiones de chat, streaming, grounding, y tipos de contexto:
  - Intención: `models.generateContent(...)` con `FunctionCallingConfigMode.ANY`.  [lib/intelligent-intent-router.ts 505:517]
  - Entidades: `models.generateContent(...)` con funciones de extracción.  [lib/entity-extraction-engine.ts 484:494]
  - Sesiones: `ai.chats.create(...)` y `sendMessageStream(...)`.  [lib/clinical-agent-router.ts 591:603, 735:744]
  - Grounding académico: extracción de URLs desde `groundingMetadata`.  [lib/clinical-agent-router.ts 951:963]
  - Gestión de ventana: tipos `SlidingWindow` y `ContextWindowCompressionConfig`.  [lib/context-window-manager.ts 12:18]
- Declarado como dependencia del proyecto.
```16:21:package.json
"@google/genai": "latest",
```
- Conclusión (SDK): es pilar operativo. Sin el SDK, no funcionan la clasificación de intenciones, la extracción de entidades, la creación/streaming de chats, ni el grounding; además, varios tipos (ventana/compresión, FunctionDeclaration) estructuran el diseño.

11) Capacidades complementarias y estado pendiente
- Cambio de agente por orquestación dinámica expuesto por API.
```12:21:app/api/switch-agent/route.ts
const result = await orchestrationSystem.orchestrate(`Cambiar al agente: ${newAgent}`, sessionId, 'default-user', { forceMode: 'dynamic', ... })
```
- Endpoint de sesiones (GET) aún devuelve lista vacía (pendiente de implementación en el nuevo sistema).
```61:70:app/api/sessions/route.ts
// ... por ahora retornamos un array vacío ...
const sessions: any[] = []
return NextResponse.json({ success: true, sessions })
```

### Resumen
- Orquestación centralizada con health/metrics activos; intención, entidades y herramientas operan sobre `@google/genai`.
- Agentes especializados usan sesiones del SDK (streaming + grounding); contexto optimizado por Sliding Window.
- Historial de chat referenciado por ID de archivos y enriquecido con grounding; persistencia en cliente (IndexedDB) y servidor (storage).
- Patient library basada en IndexedDB se inyecta al orquestador como contexto clínico.
- El SDK de Google GenAI es dependencia crítica en todo el pipeline: configuración, función de enrutamiento, extracción, chat/streaming y tipos de contexto; UI y métricas son independientes.