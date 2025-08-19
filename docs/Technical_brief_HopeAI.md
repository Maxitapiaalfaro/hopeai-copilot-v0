### Núcleo de Orquestación y Enrutamiento (máxima criticidad)
- Google GenAI SDK (raíz de dependencia)
  - Rol: Provee `ai` para todo el proyecto (única fuente del cliente del SDK).
  - Usado por: extracción de entidades, agentes, tareas clínicas, orquestación.
```8:18:lib/google-genai-config.ts
function createGenAIClient(): GoogleGenAI {
  if (typeof window !== 'undefined') {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY;
    return new GoogleGenAI({ apiKey });
  } else {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    return new GoogleGenAI({ apiKey });
  }
}
```
  - Impacto: Si cambia, afecta a `lib/entity-extraction-engine.ts`, `lib/clinical-agent-router.ts`, `lib/clinical-task-orchestrator.ts`, `lib/dynamic-orchestrator.ts`, `lib/intelligent-intent-router.ts`.

- Sistema central HopeAI
  - Rol: Inicializa storage, enrutadores y (opcional) orquestación avanzada; implementa `sendMessage` con routing y cambio de agente; expone singleton.
```74:88:lib/hopeai-system.ts
if (this.useAdvancedOrchestration) {
  this.dynamicOrchestrator = new DynamicOrchestrator(clinicalAgentRouter, {
    enableAdaptiveLearning: true,
    enableRecommendations: true,
    asyncRecommendations: true,
    ...
  })
}
```
```461:485:lib/hopeai-system.ts
currentState.history.push(userMessage)
if (routingResult.targetAgent !== currentState.activeAgent) {
  clinicalAgentRouter.closeChatSession(sessionId)
  return clinicalAgentRouter.createChatSession(sessionId, routingResult.targetAgent, currentState.history, true)
}
```
```1115:1117:lib/hopeai-system.ts
export async function getGlobalOrchestrationSystem(): Promise<HopeAISystem> {
  return await HopeAISystemSingleton.getInitializedInstance()
}
```
  - Dependencias: `getStorageAdapter()`, `ClinicalAgentRouter`, `DynamicOrchestrator`, `IntelligentIntentRouter`.
  - Dependientes: `/api/send-message`.

- Singleton de orquestación (nota de duplicidad)
  - Rol: Proveer una instancia única del sistema de orquestación (config bridge/monitoring).
```70:86:lib/orchestration-singleton.ts
if (!globalOrchestrationSystem) {
  await hopeAI.initialize()
  const agentRouter = new ClinicalAgentRouter()
  globalOrchestrationSystem = createHopeAIOrchestrationSystem(hopeAI, agentRouter, ORCHESTRATION_CONFIG)
  await globalOrchestrationSystem.initialize()
}
```
  - Dependientes: `/api/sessions`.
  - Riesgo: coexisten dos “singletons” (este y el de `lib/hopeai-system.ts`), lo que crea dependencia cruzada no deseada.

- Bridge de orquestación
  - Rol: Decide dinámico/legacy/híbrido y mide performance.
```150:158:lib/hopeai-orchestration-bridge.ts
switch (orchestrationType) {
  case 'dynamic':
    result = await this.handleDynamicOrchestration(...); break;
  case 'legacy':
    result = await this.handleLegacyOrchestration(...); break;
}
```
  - Dependencias: `DynamicOrchestrator`, `ClinicalAgentRouter`.

- Orquestador Dinámico (estado de sesión de orquestación)
  - Rol: Mantiene contexto de sesión para orquestación; invoca Intent Router; optimiza herramientas.
```106:116:lib/dynamic-orchestrator.ts
this.ai = ai;
this.agentRouter = agentRouter;
this.intentRouter = new IntelligentIntentRouter(agentRouter);
this.toolRegistry = ToolRegistry.getInstance();
this.entityExtractor = new EntityExtractionEngine();
```
```153:171:lib/dynamic-orchestrator.ts
const sessionContext = await this.getOrCreateSession(sessionId, userId);
this.updateConversationHistory(sessionContext, userInput, sessionFiles);
const orchestrationResult = await this.intentRouter.orchestrateWithTools(
  userInput, sessionContext.conversationHistory, sessionContext.currentAgent
);
const optimizedTools = await this.optimizeToolSelection(orchestrationResult.contextualTools, sessionContext);
```
  - Dependencias: `ai`, `IntelligentIntentRouter`, `ToolRegistry`, `EntityExtractionEngine`.

- Enrutador de Intención Inteligente
  - Rol: Clasifica intención con el SDK, extrae entidades, selecciona herramientas y agente destino.
```12:19:lib/intelligent-intent-router.ts
import { ... FunctionCallingConfigMode ... } from '@google/genai';
import { ai } from './google-genai-config';
import { ClinicalAgentRouter } from './clinical-agent-router';
import { EntityExtractionEngine ... } from './entity-extraction-engine';
import { ToolRegistry ... } from './tool-registry';
```
```251:287:lib/intelligent-intent-router.ts
const intentResult = await this.classifyIntent(userInput, sessionContext);
const entityResult = await this.entityExtractor.extractEntities(userInput, sessionContext);
const selectedTools = await this.selectContextualTools(toolSelectionContext);
const selectedAgent = this.mapFunctionToAgent(intentResult.functionName);
```
  - Dependencias: SDK vía `ai`, `EntityExtractionEngine`, `ToolRegistry`, `ClinicalAgentRouter`.

- Router de Agentes Clínicos (uso del SDK en chat)
  - Rol: Configura agentes (Socrático/Archivista/Académico), crea sesiones de chat con `ai.chats.create`, convierte historial, maneja transición de agentes; contiene reglas RAG del agente académico.
```591:603:lib/clinical-agent-router.ts
const chat = ai.chats.create({
  model: agentConfig.config.model || 'gemini-2.5-flash',
  config: { ... systemInstruction: agentConfig.systemInstruction, tools: agentConfig.tools?.length ? agentConfig.tools : undefined },
  history: geminiHistory,
})
```
```431:441:lib/clinical-agent-router.ts
1. Búsqueda Obligatoria ... con grounding automático.
... Protocolo RAG Estricto ...
1. Retrieve ... 2. Augment ... 3. Generate ...
```
  - Dependencias: SDK, definiciones de herramientas del `ToolRegistry`.

- Registro de Herramientas (RAG y más)
  - Rol: Catálogo central de `FunctionDeclaration` compatibles con SDK, incl. “searchAcademicWeb”.
```321:333:lib/tool-registry.ts
export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, ClinicalTool> = new Map();
  private constructor() { this.initializeTools(); }
}
```
  - Dependientes: `IntelligentIntentRouter`, `DynamicOrchestrator`, `ClinicalAgentRouter`.

- Extracción de Entidades con SDK
  - Rol: Usa `ai.models.generateContent` con `FunctionCallingConfigMode.AUTO`.
```483:494:lib/entity-extraction-engine.ts
const extractionResult = await ai.models.generateContent({
  model: 'gemini-2.5-flash-lite',
  contents: contextualPrompt,
  config: { tools: [{ functionDeclarations: entityExtractionFunctions }],
           toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } } }
})
```

### Capa API (puntos de entrada críticos)
- Enviar mensaje (entrada principal del chat)
  - Rol: Obtiene sistema global, delega `sendMessage`, registra métricas, devuelve estado actualizado.
```25:35:app/api/send-message/route.ts
const orchestrationSystem = await getGlobalOrchestrationSystem()
const result = await orchestrationSystem.sendMessage(
  sessionId, message, useStreaming, suggestedAgent, sessionMeta
)
```
  - Dependencias: `getGlobalOrchestrationSystem` de `lib/hopeai-system.ts`.

- Crear sesión
  - Rol: Usa el singleton alternativo para orquestar creación de sesión (modo dinámico).
```11:23:app/api/sessions/route.ts
const orchestrationSystem = await getGlobalOrchestrationSystem()
const result = await orchestrationSystem.orchestrate(
  `Crear nueva sesión clínica`, sessionId, userId, { forceMode: 'dynamic', previousAgent: agent }
)
```
  - Dependencias: `lib/orchestration-singleton.ts` (duplicidad respecto al anterior).

- Ficha clínica (API del Archivista)
  - Rol: Valida inputs, carga estado de sesión si hace falta, delega al orquestador clínico.
```25:33:app/api/patients/[id]/ficha/route.ts
await clinicalTaskOrchestrator.generateFichaClinica({
  fichaId, pacienteId: id, sessionState: effectiveSessionState, patientForm, conversationSummary
})
```

### Persistencia y Gestión de Contexto/Historial (cliente/servidor)
- Adaptador de Storage (servidor y cliente)
  - Rol: Implementa almacenamiento en memoria en servidor y redirige al IndexedDB en cliente.
```195:213:lib/server-storage-adapter.ts
export async function getStorageAdapter() {
  if (isServerEnvironment()) { /* singleton global in-memory */ return globalThis.__hopeai_storage_adapter__ }
  else { const { clinicalStorage } = require('./clinical-context-storage'); await clinicalStorage.initialize(); return clinicalStorage }
}
```
  - Dependientes: `hopeai-system`, `ficha` API, hooks de historia.

- Contexto optimizado (cliente)
  - Rol: Curated vs comprehensive history y compresión inteligente.
```71:99:lib/client-context-persistence.ts
const existingContext = await this.loadOptimizedContext(sessionId)
const comprehensiveHistory = existingContext?.comprehensiveHistory || curatedHistory
const needsCompression = totalContent > COMPRESSION_THRESHOLD
if (needsCompression) { finalCuratedHistory = this.compressHistory(comprehensiveHistory) }
```

- Actualización de historia en orquestación
  - Rol: Integra adjuntos y mantiene ventana de últimas interacciones para eficiencia.
```267:290:lib/dynamic-orchestrator.ts
if (sessionFiles?.length > 0) { enrichedUserInput = `${userInput}\n\n**CONTEXTO...**` }
session.conversationHistory.push({ role: 'user', parts: [{ text: enrichedUserInput }] })
if (session.conversationHistory.length > 40) { session.conversationHistory = session.conversationHistory.slice(-40) }
```

- Listado de conversaciones (UI)
  - Rol: Paginación y caché por usuario desde el storage unificado.
```106:117:hooks/use-conversation-history.ts
const storage = await getStorageAdapter()
const result = await storage.getUserSessionsPaginated(userId, paginationOptions)
const summaries = result.items.map(createConversationSummary)
```

### Patient Library (persistencia y UI)
- Persistencia de pacientes (IndexedDB)
  - Rol: CRUD y cache de resúmenes; patrón singleton cliente.
```71:100:lib/patient-persistence.ts
const transaction = this.db!.transaction([this.storeName, this.indexName], "readwrite")
const serializedPatient = { ...patient, createdAt: patient.createdAt.toISOString(), updatedAt: patient.updatedAt.toISOString() }
const request = store.put(serializedPatient)
```

- Hook de biblioteca y Ficha Clínica
  - Rol: Orquesta CRUD, búsqueda, y generación/lectura de fichas vía API.
```206:214:hooks/use-patient-library.ts
await fetch(`/api/patients/${encodeURIComponent(patientId)}/ficha`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fichaId, sessionState: sessionStateCore, patientForm, conversationSummary })
})
```

- UI de Patient Library y panel de Ficha
  - Rol: Dispara generación de ficha desde contexto de chat actual.
```651:681:components/patient-library-section.tsx
onGenerate={async () => {
  const sessionState = { ...history, clinicalContext: { patientId: selectedPatient.id, ... } }
  const conversationSummary = systemState.history.slice(-6).map(...).join('\n')
  const fichaId = `ficha_${selectedPatient.id}_${Date.now()}`
  await generateFichaClinica(selectedPatient.id, fichaId, { ...sessionState, patientForm, conversationSummary } as any)
}}
```

### Ficha Clínica (Archivista, generación con SDK)
- Orquestador de tareas clínicas
  - Rol: Persiste estado “generando → completado/fallido”, compone partes, llama al SDK con `systemInstruction` del Archivista.
```57:68:lib/clinical-task-orchestrator.ts
const content: Content = { role: 'user', parts: messageParts as unknown as any }
const result = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: [content as any],
  config: { temperature: 0.2, maxOutputTokens: 4096, systemInstruction: this.getArchivistaSystemInstruction() }
})
```

### RAG e Integración Académica
- Declaración de herramienta y ejecución PubMed
  - Rol: Declarar FunctionDeclaration (SDK) y proveer ejecución real (HTTP con reintentos).
```316:319:lib/pubmed-research-tool.ts
async executeTool(parameters: any): Promise<{ output?: string; error?: { code: number; message: string; details: string[] } }> { ... }
```
  - Nota: Falta un “tool execution broker” que conecte los functionCalls de `ai.chats` con `executeTool()` y reinyecte resultados al modelo (Augment).

### Tipos y contratos (base de dependencias)
```85:100:types/clinical-types.ts
export interface StorageAdapter {
  initialize(): Promise<void>
  saveChatSession(chatState: ChatState): Promise<void>
  loadChatSession(sessionId: string): Promise<ChatState | null>
  getUserSessions(userId: string): Promise<ChatState[]>
  getUserSessionsPaginated(userId: string, options?: PaginationOptions): Promise<PaginatedResponse<ChatState>>
  deleteChatSession(sessionId: string): Promise<void>
  saveClinicalFile(file: ClinicalFile): Promise<void>
  getClinicalFiles(sessionId: string): Promise<ClinicalFile[]>
  saveFichaClinica(ficha: FichaClinicaState): Promise<void>
  getFichaClinicaById(fichaId: string): Promise<FichaClinicaState | null>
}
```

### Archivos más críticos por centralidad (alto impacto si cambian)
- Muy alto: `lib/google-genai-config.ts`, `lib/hopeai-system.ts`, `lib/clinical-agent-router.ts`, `lib/intelligent-intent-router.ts`, `lib/dynamic-orchestrator.ts`, `lib/tool-registry.ts`, `lib/server-storage-adapter.ts`, `types/clinical-types.ts`, `app/api/send-message/route.ts`.
- Alto (soporte clave): `lib/hopeai-orchestration-bridge.ts`, `lib/entity-extraction-engine.ts`, `lib/clinical-task-orchestrator.ts`, `lib/patient-persistence.ts`, `hooks/use-conversation-history.ts`, `hooks/use-optimized-context.ts`, `components/patient-library-section.tsx`.

Resumen
- Orquestación y routing descansan en `hopeai-system` + `dynamic-orchestrator` + `intelligent-intent-router` y el SDK (`google-genai-config`). `clinical-agent-router` es el punto de contacto de chat con el SDK y las herramientas declaradas en `tool-registry`. Contexto/Historial: cliente (`client-context-persistence`, `use-optimized-context`) y servidor (`server-storage-adapter`). Patient Library y Ficha Clínica están conectadas vía `hooks/use-patient-library` → API → `clinical-task-orchestrator`. La dependencia del SDK de Google GenAI es transversal y crítica en extracción de entidades, chat de agentes y generación de ficha.