### Análisis del Sistema HopeAI (enrutamiento, contexto, historial, biblioteca de pacientes, ficha clínica, y dependencia del SDK)

1) Observación general
- El proyecto ya implementa un orquestador moderno con enrutamiento por intención, extracción de entidades, y selección contextual de herramientas sobre el SDK de Google GenAI. La gestión de contexto cubre cliente (curated/comprehensive history con compresión) y servidor (adaptador con sesiones paginadas). Ficha clínica y Patient Library están integrados vía API y almacenamiento local. La dependencia del SDK de Google GenAI es transversal: configuración centralizada y uso consistente en agentes, extracción y tareas clínicas, alineado con tu preferencia de SDK [[memory:6262758]].

2) Puntos fuertes (con corroboración en archivos reales)

- Orquestación y enrutamiento de intenciones
  - Enrutador inteligente con pipeline: clasifica intención → extrae entidades con SDK → selecciona herramientas y agente objetivo.
```251:287:lib/intelligent-intent-router.ts
async orchestrateWithTools(
  userInput: string,
  sessionContext: Content[] = [],
  previousAgent?: string
): Promise<OrchestrationResult> {
  // 1. Clasificación de intención
  const intentResult = await this.classifyIntent(userInput, sessionContext);
  // 2. Extracción de entidades
  const entityResult = await this.entityExtractor.extractEntities(userInput, sessionContext);
  // 3. Selección contextual de herramientas
  const toolSelectionContext: ToolSelectionContext = {
    conversationHistory: sessionContext,
    currentIntent: intentResult.functionName,
    extractedEntities: entityResult.entities,
    sessionMetadata: { previousAgent, sessionLength: sessionContext.length, recentTopics: this.extractRecentTopics(sessionContext) }
  };
  const selectedTools = await this.selectContextualTools(toolSelectionContext);
  const selectedAgent = this.mapFunctionToAgent(intentResult.functionName);
  return { selectedAgent, contextualTools: selectedTools.map(t => t.declaration), ... }
}
```

  - Orquestador dinámico integra historia de sesión, enriquece input con adjuntos, llama al enrutador de intenciones, optimiza herramientas y actualiza contexto de sesión:
```153:171:lib/dynamic-orchestrator.ts
const sessionContext = await this.getOrCreateSession(sessionId, userId);
this.updateConversationHistory(sessionContext, userInput, sessionFiles);
const orchestrationResult = await this.intentRouter.orchestrateWithTools(
  userInput,
  sessionContext.conversationHistory,
  sessionContext.currentAgent
);
const optimizedTools = await this.optimizeToolSelection(orchestrationResult.contextualTools, sessionContext);
await this.updateSessionContext(sessionContext, orchestrationResult.selectedAgent, optimizedTools);
```

  - Bridge de orquestación decide dinámico vs legacy vs híbrido por configuración:
```150:158:lib/hopeai-orchestration-bridge.ts
switch (orchestrationType) {
  case 'dynamic':
    result = await this.handleDynamicOrchestration(userInput, sessionId, userId, context);
    break;
  case 'legacy':
    result = await this.handleLegacyOrchestration(userInput, sessionId, userId, context);
    break;
}
```

- Gestión de contexto (cliente + servidor) y chat history
  - Cliente: contexto optimizado con curated y comprehensive history y compresión selectiva; guarda métricas de uso:
```71:99:lib/client-context-persistence.ts
async saveOptimizedContext(sessionId, activeAgent, curatedHistory, metadata) {
  const existingContext = await this.loadOptimizedContext(sessionId)
  const comprehensiveHistory = existingContext?.comprehensiveHistory || curatedHistory
  const totalContent = comprehensiveHistory.reduce((acc, msg) => acc + msg.content.length, 0)
  const needsCompression = totalContent > COMPRESSION_THRESHOLD
  let finalCuratedHistory = curatedHistory
  if (needsCompression) {
    finalCuratedHistory = this.compressHistory(comprehensiveHistory)
  }
}
```
  - Hook de contexto optimizado mantiene curated y comprehensive y actualiza ratios:
```267:276:hooks/use-optimized-context.ts
const updatedCurated = [...prev.curatedHistory, userMessage, aiMessage].slice(-20)
const updatedComprehensive = [...prev.comprehensiveHistory, userMessage, aiMessage]
```
  - Servidor: adaptador en memoria con API unificada y selección automática server/client:
```195:213:lib/server-storage-adapter.ts
export async function getStorageAdapter() {
  if (isServerEnvironment()) { /* singleton global en memoria */ }
  else {
    const { clinicalStorage } = require('./clinical-context-storage')
    await clinicalStorage.initialize()
    return clinicalStorage
  }
}
```
  - Listado de conversaciones paginado desde UI:
```106:115:hooks/use-conversation-history.ts
const storage = await getStorageAdapter()
const result = await storage.getUserSessionsPaginated(userId, { pageSize: 20, sortBy: 'lastUpdated', sortOrder: 'desc' })
```

- Pipeline de mensaje y cambio de agente
  - Inserta mensaje del usuario, evalúa routing, cierra sesión del agente anterior y crea nueva sesión con historial convertido; guarda y envía:
```461:485:lib/hopeai-system.ts
currentState.history.push(userMessage)
if (routingResult.targetAgent !== currentState.activeAgent) {
  clinicalAgentRouter.closeChatSession(sessionId)
  return clinicalAgentRouter.createChatSession(sessionId, routingResult.targetAgent, currentState.history, true)
}
```
  - La creación de chat usa el SDK (ai.chats.create) con systemInstruction, tools y history específico del agente:
```591:603:lib/clinical-agent-router.ts
const chat = ai.chats.create({
  model: agentConfig.config.model || 'gemini-2.5-flash',
  config: { temperature: agentConfig.config.temperature, systemInstruction: agentConfig.systemInstruction, tools: agentConfig.tools?.length ? agentConfig.tools : undefined },
  history: geminiHistory,
})
```

- Patient Library (persistencia y UI)
  - IndexedDB para pacientes; CRUD y cache de resúmenes:
```71:99:lib/patient-persistence.ts
async savePatientRecord(patient) {
  const transaction = this.db!.transaction([this.storeName, this.indexName], "readwrite")
  const serializedPatient = { ...patient, createdAt: patient.createdAt.toISOString(), updatedAt: patient.updatedAt.toISOString() }
  const request = store.put(serializedPatient)
}
```
  - Hook de biblioteca de pacientes y generación de ficha vía API:
```206:214:hooks/use-patient-library.ts
const res = await fetch(`/api/patients/${encodeURIComponent(patientId)}/ficha`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fichaId, sessionState: sessionStateCore, patientForm, conversationSummary })
})
```
  - UI invoca generación desde panel:
```651:681:components/patient-library-section.tsx
<FichaClinicaPanel ... onGenerate={async () => {
  const sessionState = { ... }
  const conversationSummary = systemState.history.slice(-6).map(...).join('\n')
  const fichaId = `ficha_${selectedPatient.id}_${Date.now()}`
  await generateFichaClinica(selectedPatient.id, fichaId, { ...sessionState, patientForm, conversationSummary } as any)
}} />
```

- Ficha Clínica (Especialista en Documentación)
  - API endpoint delega al orquestador de tareas clínicas:
```25:33:app/api/patients/[id]/ficha/route.ts
await clinicalTaskOrchestrator.generateFichaClinica({ fichaId, pacienteId: id, sessionState: effectiveSessionState, patientForm, conversationSummary })
return NextResponse.json({ success: true })
```
  - Orquestación de ficha usa SDK en modo stateless con systemInstruction estricta:
```57:66:lib/clinical-task-orchestrator.ts
const content: Content = { role: 'user', parts: messageParts as unknown as any }
const result = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: [content as any],
  config: { temperature: 0.2, maxOutputTokens: 4096, systemInstruction: this.getArchivistaSystemInstruction() }
})
```

- Integración RAG (Investigador Académico)
  - Declaración de herramienta “searchAcademicWeb” (FunctionDeclaration) registrada para selección contextual:
```321:333:lib/tool-registry.ts
export class ToolRegistry {
  private tools: Map<string, ClinicalTool> = new Map();
  private constructor() { this.initializeTools(); }
}
```
```287:320:lib/tool-registry.ts
const searchAcademicWeb: ClinicalTool = {
  metadata: { id: 'search_academic_web', category: 'research', ... },
  declaration: { name: 'search_academic_web', parameters: { /* schema */ } }
};
```
  - Cliente PubMed con `executeTool()` y singleton:
```316:319:lib/pubmed-research-tool.ts
async executeTool(parameters: any): Promise<{ output?: string; error?: { code: number; message: string; details: string[] } }> { ... }
```
```392:393:lib/pubmed-research-tool.ts
// Singleton instance
export const pubmedTool = new PubMedResearchTool()
```
  - Reglas anti-alucinación y RAG estricto en identidad/rol del agente académico:
```431:441:lib/clinical-agent-router.ts
1. Búsqueda Obligatoria: NUNCA respondas ... sin realizar una búsqueda activa web con grounding automático.
... Protocolo RAG Estricto ...
1. Retrieve ... 2. Augment ... 3. Generate ...
```

- Configuración y uso unificado del SDK de Google GenAI
  - Cliente del SDK centralizado:
```8:18:lib/google-genai-config.ts
function createGenAIClient(): GoogleGenAI {
  if (typeof window !== 'undefined') { const apiKey = process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY; return new GoogleGenAI({ apiKey }); }
  else { const apiKey = process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY; return new GoogleGenAI({ apiKey }); }
}
```
  - Extracción de entidades usa `ai.models.generateContent` con tools y FunctionCallingConfigMode.AUTO:
```483:494:lib/entity-extraction-engine.ts
const extractionResult = await ai.models.generateContent({
  model: 'gemini-2.5-flash-lite',
  contents: contextualPrompt,
  config: { tools: [{ functionDeclarations: entityExtractionFunctions }], toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } } }
})
```
  - Agentes usan `ai.chats.create` con systemInstruction y tools (citado más arriba). Todo esto está alineado con tu directiva de usar el SDK de Google GenAI [[memory:6262758]] y basar la arquitectura en él [[memory:4693031]].

3) Brechas y riesgos arquitectónicos (concreto)

- Ejecución de herramientas RAG: no se evidencia un “Tool Execution Broker” que capture y ejecute functionCalls del chat y alimente respuestas de herramientas de vuelta al modelo (p. ej., PubMed). Se declaran FunctionDeclarations y existe `PubMedResearchTool.executeTool()`, pero falta el ciclo completo de ejecución/retorno al LLM en el camino de `ai.chats.create` o en `sendMessage`. Riesgo: el agente académico podría no realizar recuperación real, rompiendo el RAG estricto.
  - Evidencia de herramientas solo como declaraciones: ver `tool-registry.ts` y creación de chat con `tools` en `clinical-agent-router.ts` sin evidencia de manejo de `functionCalls` en runtime.

- Duplicidad/inconsistencia de singleton de orquestación
  - Coexisten dos rutas de singleton: `lib/orchestration-singleton.ts` y un `getGlobalOrchestrationSystem()` exportado desde `lib/hopeai-system.ts`. Los endpoints usan distintos imports:
```1:12:app/api/sessions/route.ts
import { getGlobalOrchestrationSystem } from '@/lib/orchestration-singleton'
```
```1:8:app/api/send-message/route.ts
import { getGlobalOrchestrationSystem } from '@/lib/hopeai-system'
```
  - Riesgo: divergencia de configuraciones/estadísticas y diagnósticos difíciles.

- Persistencia servidor in-memory
  - `ServerStorageAdapter` es en memoria por diseño de pruebas. Riesgo: pérdida de sesiones y fichas ante reinicio; en producción requerirá implementación durable (p. ej., Postgres/SQLite) compatible con `StorageAdapter`.

- Transferencia de contexto a herramientas
  - Aunque `IntelligentIntentRouter` construye `ToolSelectionContext`, no se observa inyección explícita de resultados de herramientas en prompts para el siguiente paso de generación (Augment). Riesgo: degradación del patrón RAG (Retrieve sin Augment explícito).

- Validación de grounding/citas
  - No se encuentra un mecanismo consistente para asociar `groundingUrls` a cada fragmento de texto generado por el modo académico; existen campos en `use-optimized-context` y `hopeai-system` para guardar `groundingUrls`, pero falta la conexión evidente desde la ejecución RAG a esas URLs durante el flujo de chat.

4) Recomendaciones estratégicas (basadas en SDK de Google GenAI)

- Componente del SDK: Google GenAI Function Calling (FunctionDeclaration + FunctionCallingConfigMode)
  - Acción: Implementar un “ToolExecutionBroker” en el pipeline de mensajes (idealmente en `ClinicalAgentRouter.sendMessage()` o en el bridge) que:
    - Intercepte `response.functionCalls` del SDK en respuestas del chat.
    - Mapee cada `functionCall` a la implementación concreta (p. ej., `pubmedTool.executeTool()`).
    - Reinyecte `functionResponses` al modelo con otra llamada `ai.chats.send(...)` o `ai.models.generateContent(...)` según patrón de function-calling del SDK, hasta converger.
  - Impacto esperado: Cumplimiento estricto RAG (Retrieve → Augment → Generate), reducción de alucinaciones y respuestas citadas con fuentes verificables.

- Consolidar el singleton de orquestación
  - Acción: Unificar a una sola fuente de verdad para `getGlobalOrchestrationSystem()` y actualizar todos los endpoints (`/api/send-message`, `/api/sessions`) para importarlo del mismo módulo.
  - Impacto: Métricas coherentes, menos deuda técnica y menor riesgo de estados divergentes.

- Persistencia durable del `StorageAdapter`
  - Acción: Implementar `StorageAdapter` respaldado por base de datos (p. ej., Prisma + SQLite/Postgres) respetando la interfaz en `types/clinical-types.ts`. Mantener `getUserSessionsPaginated` y operaciones de Ficha Clínica.
  - Impacto: Sesiones persistentes, historiales consultables, cumplimiento operativo.

- Grounding y citación verificable end-to-end
  - Acción: Estándar de “evidence payload” en la respuesta del agente académico que incluya metadatos (título, DOI/PMID, URL, calidad de evidencia), y populación consistente de `groundingUrls` en el `ChatMessage` guardado. Usar el broker de herramientas para propagar dichas fuentes.
  - Impacto: Trazabilidad de evidencia, auditoría clínica, reducción de riesgo reputacional por alucinaciones.

- Contexto entre agentes con SDK
  - Acción: Aprovechar `systemInstruction` y `history` específicos por agente (ya implementado) con una “Context Transfer Policy” común (p. ej., plantilla breve de resumen + últimos N mensajes curados + referencias de paciente relevantes), y asegurarse que `ContextWindowManager` gobierna los límites por agente. Vincular con `ClientContextPersistence` (curated) para minimizar tokens.
  - Impacto: Cambios de modo fluidos sin fuga de contexto, menor costo y latencia.

5) Consideraciones adicionales
- Seguridad y privacidad: la Patient Library y Ficha Clínica usan IndexedDB en cliente. Asegurar cifrado y niveles de confidencialidad en tránsito/descanso si se sincroniza a servidor.
- Telemetría y alertas: ya existe Sentry y métrica de agentes; extender con métricas de RAG (tasa de herramientas invocadas, tiempos de Retrieve/Augment/Generate y tasa de citas faltantes).
- Escalabilidad: si se adopta DB, incluir colas para tareas pesadas de RAG (p. ej., streaming de artículos extensos) y cache por PMID/consulta.

Archivos clave y dependencias (independientes/dependientes)
- Orquestación (depende de): `lib/intelligent-intent-router.ts`, `lib/dynamic-orchestrator.ts`, `lib/hopeai-orchestration-bridge.ts`, `lib/clinical-agent-router.ts`, `lib/tool-registry.ts`, `lib/entity-extraction-engine.ts`, `lib/google-genai-config.ts`.
- Chat/Contexto (depende de): `lib/client-context-persistence.ts` (cliente), `lib/server-storage-adapter.ts` (servidor), `hooks/use-optimized-context.ts`, `hooks/use-conversation-history.ts`, `lib/context-window-manager.ts`.
- Patient Library (depende de): `lib/patient-persistence.ts`, `hooks/use-patient-library.ts`, `components/patient-library-section.tsx`, `components/patient-library/FichaClinicaPanel.tsx`.
- Ficha Clínica (depende de): `app/api/patients/[id]/ficha/route.ts`, `lib/clinical-task-orchestrator.ts`, `lib/server-storage-adapter.ts`.
- RAG (depende de): `lib/tool-registry.ts` (declaración), `lib/pubmed-research-tool.ts` (ejecución), y falta broker de herramientas en el flujo de chat.

Resumen
- Orquestación por intención sólida y alineada con el SDK; contexto multi-capa y manejo de sesiones correcto; Patient Library y Ficha Clínica integradas.
- Riesgos: falta de ejecución de herramientas RAG en tiempo de chat, duplicidad de singletons y persistencia en memoria del servidor.
- Recomendaciones: implementar broker de herramientas con function-calling del SDK, unificar singleton, y adoptar almacenamiento durable; fortalecer grounding/citación end-to-end.