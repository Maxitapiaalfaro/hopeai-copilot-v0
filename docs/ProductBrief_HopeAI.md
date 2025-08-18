### HopeAI: Executive Project Brief (para CMO) — Estado actual, end‑to‑end y verificado en código

#### Qué entrega hoy (producto tangible)
- Respuestas conversacionales clínicas con coordinación inteligente de especialistas (Socrático, Clínico, Académico), incluyendo enlaces de respaldo científico cuando aplica.
```25:35:app/api/send-message/route.ts
const orchestrationSystem = await getGlobalOrchestrationSystem()
const result = await orchestrationSystem.sendMessage(sessionId, message, useStreaming, suggestedAgent, sessionMeta)
```
```139:171:lib/dynamic-orchestrator.ts
const orchestrationResult = await this.intentRouter.orchestrateWithTools(userInput, sessionContext.conversationHistory, sessionContext.currentAgent)
```
```591:603:lib/clinical-agent-router.ts
const chat = ai.chats.create({ model: agentConfig.config.model, config: { systemInstruction: agentConfig.systemInstruction, tools: ... }, history: geminiHistory })
```

- Evidencia científica visible en la respuesta (grounding con URLs) cuando el modo Académico investiga con búsqueda nativa y el sistema expone las fuentes al usuario.
```951:963:lib/clinical-agent-router.ts
if (chunk.groundingMetadata) {
  const urls = self.extractUrlsFromGroundingMetadata(chunk.groundingMetadata)
  if (urls.length > 0) { yield { groundingUrls: urls, ... } }
}
```
```186:214:components/chat-interface.tsx
for await (const chunk of response) {
  if (chunk.groundingUrls && chunk.groundingUrls.length > 0) { setStreamingGroundingUrls(accumulatedGroundingUrls) }
}
```

- Carga de documentos clínicos por sesión, con validación/deduplicación y disponibilidad inmediata para el modelo.
```25:37:app/api/upload-document/route.ts
const uploadedFile = await HopeAISystemSingleton.uploadDocument(sessionId, file, userId)
```
```739:761:lib/hopeai-system.ts
if (!clinicalFileManager.isValidClinicalFile(file)) throw new Error(...)
const duplicateFile = existingFiles.find(existingFile => existingFile.name === file.name && existingFile.size === file.size)
```

- Observabilidad operativa lista (salud del sistema y métricas de orquestación).
```10:22:app/api/orchestration/health/route.ts
const healthStatus = orchestrationSystem.getHealthStatus()
```
```10:24:app/api/orchestration/metrics/route.ts
const metrics = orchestrationSystem.getSystemMetrics()
```

#### Cómo funciona (flujo de usuario, end‑to‑end)
- Conversación clínica con orquestación dinámica (elige y cambia especialista automáticamente según intención/entidades).
```505:517:lib/intelligent-intent-router.ts
models.generateContent({ ... tools: [{ functionDeclarations: this.intentFunctions }], toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } } })
```
```484:494:lib/entity-extraction-engine.ts
config: { tools: [{ functionDeclarations: entityExtractionFunctions }], toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } } }
```

- Experiencia de chat con streaming y preservación de contexto seguro (ventana deslizante y referencias clave).
```85:103:lib/context-window-manager.ts
this.detectContextualReferences(...); const sliding = this.applySlidingWindow(...); const preserved = this.preserveContextualReferences(sliding, sessionContext)
```
```516:551:components/chat-interface.tsx
{isStreaming && streamingResponse && ( ... <StreamingMarkdownRenderer content={streamingResponse} ... /> )}
```

- Historial de chat consistente y eficiente (referencia de archivos por ID; respuestas con grounding quedan en el historial).
```5:16:types/clinical-types.ts
fileReferences?: string[]  // IDs de archivos ... groundingUrls?: Array<{title: string, url: string, domain?: string}>
```
```678:709:lib/hopeai-system.ts
const aiMessage: ChatMessage = { content: responseContent, role: "model", agent, groundingUrls }
currentState.history.push(aiMessage)
```

- Biblioteca de pacientes (patient library) disponible en cliente; si existe un paciente asociado, su resumen cacheado se inyecta al contexto para respuestas más pertinentes.
```112:126:lib/patient-persistence.ts
async loadPatientRecord(patientId: string): Promise<PatientRecord | null> { ... }
```
```225:241:lib/hopeai-system.ts
const patientRecord = await patientPersistence.loadPatientRecord(patientReference)
patientSummary = patientRecord.summaryCache?.text || PatientSummaryBuilder.buildSummary(patientRecord)
```

#### Por qué importa comercialmente (beneficios probados en implementación)
- Diferenciación por especialización coordinada: el sistema decide el especialista correcto sin fricción para el psicólogo.
```279:287:lib/intelligent-intent-router.ts
return { selectedAgent, contextualTools: selectedTools.map(tool => tool.declaration), ... }
```

- Confianza de marca: evidencia científica citada dentro del flujo (URLs) reduce el riesgo percibido y eleva la credibilidad.
```951:963:lib/clinical-agent-router.ts
extractUrlsFromGroundingMetadata(...); yield { groundingUrls: urls, ... }
```

- Flujo estable en sesiones largas: optimización de contexto que evita “olvidos” y reduce latencia.
```68:76:lib/context-window-manager.ts
this.config = { maxExchanges: 4, triggerTokens: 2000, targetTokens: 1200, enableLogging: true, ... }
```

- Operación medible: la CMO puede confirmar salud y rendimiento sin ingeniería.
```10:22:app/api/orchestration/metrics/route.ts
return NextResponse.json({ success: true, metrics, timestamp: new Date().toISOString() })
```

#### Seguridad clínica y compliance (implementado)
- Salvaguardas de contenido sensibles activadas a nivel de modelo.
```54:61:lib/google-genai-config.ts
export const clinicalModelConfig = { model: "gemini-2.5-flash", temperature: 0.3, ... safetySettings: clinicalSafetySettings }
```
```34:51:lib/google-genai-config.ts
export const clinicalSafetySettings = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  ...
]
```

#### Dependencia estratégica (y fortaleza) del SDK de Google GenAI
- El SDK es el motor transversal: clasificación de intención, extracción de entidades, sesiones/streaming, grounding y gestión de contexto usan primitivas del SDK.
```505:517:lib/intelligent-intent-router.ts
FunctionCallingConfigMode.ANY ...
```
```484:494:lib/entity-extraction-engine.ts
FunctionCallingConfigMode.AUTO ...
```
```591:603:lib/clinical-agent-router.ts
ai.chats.create({ ... })
```
```12:18:lib/context-window-manager.ts
import { ContextWindowCompressionConfig, SlidingWindow } from '@google/genai'
```
```16:21:package.json
"@google/genai": "latest",
```

#### Límites conocidos (visibles en el código)
- Listado de sesiones por API (GET) aún devuelve vacío; no afecta la conversación ni la orquestación.
```61:70:app/api/sessions/route.ts
// Por ahora retornamos un array vacío ...
const sessions: any[] = []
```

#### Qué ve el usuario hoy (resumen)
- Conversa con HopeAI; el sistema elige el especialista adecuado, puede cambiar de especialista en caliente y, cuando corresponde, muestra enlaces a fuentes científicas. Puede subir documentos, que quedan disponibles en la sesión para enriquecer respuestas. El equipo de negocio puede consultar salud/métricas del sistema vía endpoints dedicados —todo esto ya implementado y operando según los archivos citados arriba.