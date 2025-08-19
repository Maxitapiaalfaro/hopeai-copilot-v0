### Estructura y flujo principal
- Inicio y layout
  - La app enruta directamente a la interfaz clínica optimizada (pantalla completa, esquema claro, mobile-first).
```4:8:app/page.tsx
export default function HopeAIPage() {
  return (
    <div className="min-h-screen bg-white">
      <MainInterfaceOptimized />
    </div>
  )
}
```
- Contenedor de experiencia clínica
  - Orquesta Sidebar (historial/pacientes), Header (paciente activo), área central de chat, invitaciones, métricas de sesión, y panel de Ficha Clínica bajo demanda.
```660:715:components/main-interface-optimized.tsx
<Sidebar ... />
<Header onHistoryToggle={() => setMobileNavOpen(true)} sessionMeta={systemState.sessionMeta} />
...
<ChatInterface
  activeAgent={systemState.activeAgent}
  isProcessing={systemState.isLoading}
  isUploading={isUploading}
  currentSession={compatibleSession}
  sendMessage={handleSendMessage}
  uploadDocument={handleUploadDocument}
  addStreamingResponseToHistory={addStreamingResponseToHistory}
  pendingFiles={pendingFiles}
  onRemoveFile={handleRemoveFile}
  transitionState={systemState.transitionState}
  onGenerateFichaClinica={patient ? handleGenerateFichaFromChat : undefined}
  onOpenFichaClinica={patient ? handleOpenFichaFromChat : undefined}
  hasExistingFicha={(fichasClinicasLocal && fichasClinicasLocal.length > 0) || false}
  fichaLoading={isFichaLoading}
  generateLoading={isGenerateFichaLoading}
/>
```

### Chat: mensajes, streaming, grounding, botones, diseño
- Presentación de mensajes
  - Alineación por rol, badges/colores por agente, renderizado seguro de Markdown, adjuntos y referencias con grounding.
```445:507:components/chat-interface.tsx
{currentSession?.history?.slice(-visibleMessageCount).map((message) => {
  const messageAgentConfig = getAgentVisualConfigSafe(message.agent);
  ...
  <MarkdownRenderer content={message.content} className="text-sm" trusted={message.role === "model"} />
  {messageFiles[message.id] && ... <MessageFileAttachments files={messageFiles[message.id]} ... />}
  {message.groundingUrls && ... <a href={ref.url} ...>{ref.title}</a>}
})}
```
- Respuesta en streaming con referencias (RAG) en tiempo real
```521:555:components/chat-interface.tsx
{isStreaming && streamingResponse && (
  ...
  <StreamingMarkdownRenderer content={streamingResponse} className="text-sm" showTypingIndicator={true} />
  {streamingGroundingUrls && ... refs.map(... <a href={ref.url} ...>{ref.title}</a>)}
)}
```
- Indicadores de estado (pensando, enrutando, respondiendo) con transición de estados
```559:626:components/chat-interface.tsx
{(isProcessing || isStreaming) && !streamingResponse && (
  ...
  transitionState === 'thinking' | 'selecting_agent' | 'specialist_responding'
  ...
  {transitionState === 'thinking' && 'HopeAI analizando tu consulta...'}
)}
```
- Barra de entrada y acciones
  - Botones: Ficha Clínica (menu Ver/Generar), Adjuntar archivo, Voz, Expandir input, Enviar. Bloqueos por carga/streaming/archivos en procesamiento.
```680:771:components/chat-interface.tsx
<DropdownMenuTrigger ...><FileText /></DropdownMenuTrigger>
<FileUploadButton uploadDocument={uploadDocument} pendingFiles={pendingFiles} ... />
<VoiceInputButton onTranscriptUpdate={handleVoiceTranscript} ... />
<Button onClick={() => setIsInputExpanded(!isInputExpanded)} ... />
<Button onClick={handleSendMessage} disabled={!inputValue.trim() || isProcessing || isStreaming || isUploading || pendingFiles.some(...)}><Send/></Button>
```
- Seguridad y sanitización de contenido Markdown
```59:79:components/markdown-renderer.tsx
<div className=... dangerouslySetInnerHTML={{ __html: renderedContent }} />
```

### Adjuntos clínicos (archivos)
- UX de adjuntos por mensaje del usuario (compact/detallado)
```15:23:components/message-file-attachments.tsx
export function MessageFileAttachments({ files, variant = 'compact', isUserMessage = false }) {
  if (!files || files.length === 0 || !isUserMessage) return null
}
```
- Widget de subida con estado y conteo
```77:88:components/file-upload-button.tsx
<input type="file" multiple accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" ... />
```
- Subida, estado, y polling: bloquea envío mientras procesa; actualiza estado visual hasta ACTIVE
```396:433:components/main-interface-optimized.tsx
const uploadedFile = await HopeAISystemSingleton.uploadDocument(...)
setPendingFiles(prev => [...prev, { ...uploadedFile, processingStatus: ... }])
```
```436:502:components/main-interface-optimized.tsx
const response = await fetch('/api/check-file-status', { method: 'POST', ... })
setPendingFiles(prev => prev.map(file => file.id === fileId ? { ...file, processingStatus: state === 'ACTIVE' ? 'active' : 'processing' } : file))
```

### Voz (STT)
- Botón de voz con estados móviles/desktop e indicador flotante
```723:733:components/chat-interface.tsx
<VoiceInputButton onTranscriptUpdate={handleVoiceTranscript} ... language="es-ES" />
```
- Hook STT basado en react-speech-recognition con adaptación móvil
```3:6:hooks/use-speech-to-text.ts
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition'
```
```83:96:hooks/use-speech-to-text.ts
const { transcript, interimTranscript, finalTranscript, listening, ... } = useSpeechRecognition({ transcribing: true, clearTranscriptOnListen: false })
```

### Historial de conversaciones (UX)
- Lado izquierdo con tabs: Conversaciones vs Pacientes; paginación, selección, eliminación
```309:336:components/sidebar.tsx
<Button variant="ghost" ... onClick={() => handleConversationSelect(conversation.sessionId)}>
  ... título, fecha relativa, y badge del agente ...
</Button>
```
- Carga paginada y recuento total (fuente de verdad)
```103:117:hooks/use-conversation-history.ts
const result = await storage.getUserSessionsPaginated(userId, paginationOptions)
const summaries = result.items.map(createConversationSummary)
```
- Componente alternativo de lista completa (filtros/búsqueda)
```199:210:components/conversation-history-list.tsx
<CardTitle ...>Historial de Conversaciones <Badge>{filteredConversations.length}</Badge></CardTitle>
```

### Patient Library y Ficha Clínica
- Biblioteca de pacientes con CRUD, selección y disparo de conversación
```410:469:components/patient-library-section.tsx
filteredPatients.map((patient) => (
  <Button ... onClick={() => handlePatientClick(patient)}>...</Button>
))
```
- Generación/visualización de Ficha Clínica desde sidebar y desde chat (acciones coherentes)
```660:679:components/patient-library-section.tsx
await generateFichaClinica(selectedPatient.id, fichaId, { ...sessionState, patientForm, conversationSummary } as any)
```
```567:611:components/main-interface-optimized.tsx
const res = await fetch(`/api/patients/${encodeURIComponent(patient.id)}/ficha`, { method: 'POST', body: JSON.stringify({ fichaId, sessionId, sessionState, patientForm, conversationSummary }) })
```
- Panel de Ficha (sheet) con render seguro y acciones copiar/descargar
```94:101:components/patient-library/FichaClinicaPanel.tsx
{latest && latest.estado === 'completado' && (<MarkdownRenderer content={latest.contenido} />)}
```

### Gestión de sesión y contexto en frontend
- Estado unificado de sesión, historial, transición de estados, restauración automática
```55:66:hooks/use-hopeai-system.ts
const [systemState, setSystemState] = useState<...>({ sessionId: null, userId: 'demo_user', ... transitionState: 'idle' })
```
```148:201:hooks/use-hopeai-system.ts
hopeAISystem.current = await HopeAISystemSingleton.getInitializedInstance()
... intenta restaurar sesión reciente vía ClientContextPersistence ...
```
- Envío de mensaje: añade mensaje del usuario en UI, simula selección de agente, delega a sistema, sincroniza routing y agente activo
```274:345:hooks/use-hopeai-system.ts
const result = await hopeAISystem.current.sendMessage(sessionId, message, useStreaming, undefined, sessionMeta || systemState.sessionMeta)
setSystemState(prev => ({ ...prev, history: result.updatedState.history, activeAgent: result.updatedState.activeAgent, routingInfo: result.response.routingInfo, ... }))
```

### Integración con Google GenAI SDK (chats y RAG)
- Configuración del cliente y modelo clínico (Gemini 2.5 Flash), safety settings
```8:18:lib/google-genai-config.ts
function createGenAIClient(): GoogleGenAI { ... return new GoogleGenAI({ apiKey }); }
```
```53:61:lib/google-genai-config.ts
export const clinicalModelConfig = { model: "gemini-2.5-flash", temperature: 0.3, safetySettings: clinicalSafetySettings, ... }
```
- Sesiones de chat por agente con systemInstruction y tools; uso del SDK moderno
```590:603:lib/clinical-agent-router.ts
const chat = ai.chats.create({
  model: agentConfig.config.model || 'gemini-2.5-flash',
  config: { ... systemInstruction: agentConfig.systemInstruction, tools: agentConfig.tools || undefined },
  history: geminiHistory,
})
```
- Streaming y grounding: lectura de chunks, function calls para búsqueda académica nativa, extracción de groundingMetadata a URLs
```735:744:lib/clinical-agent-router.ts
const streamResult = await chat.sendMessageStream(messageParams)
result = this.createMetricsStreamingWrapper(streamResult, interactionId, enhancedMessage)
```
```1169:1203:lib/clinical-agent-router.ts
private extractUrlsFromGroundingMetadata(groundingMetadata: any) {
  if (groundingMetadata.groundingChunks) groundingChunks.forEach(chunk => { if (chunk.web?.uri) urls.push({ title: chunk.web.title, url: chunk.web.uri, domain: chunk.web.domain }) ... })
}
```
- Manejo de archivos para Gemini Files (createPartFromUri + verificación ACTIVE) y referencia por ID en historial para evitar contexto inflado
```621:673:lib/clinical-agent-router.ts
if (isLastMessage && msg.fileReferences?.length > 0) {
  const { getFilesByIds } = await import('./hopeai-system')
  const fileObjects = await getFilesByIds(msg.fileReferences)
  const filePart = createPartFromUri(fileUri, fileRef.type)
  parts.push(filePart)
}
```
- Visualización de referencias en el chat (frontend) ya integrada, alimentada por `groundingUrls` capturadas en streaming y añadidas a historial tras completar stream
```241:248:components/chat-interface.tsx
await addStreamingResponseToHistory(fullResponse, responseAgent, accumulatedGroundingUrls)
```

### Mapa de dependencias críticas (frontend)
- Envío de mensaje (UX → SDK)
  - `components/chat-interface.tsx` → `hooks/use-hopeai-system.ts` → `lib/hopeai-system.ts` → `lib/clinical-agent-router.ts` → `@google/genai` chats.sendMessage/Stream → vuelta de streaming → `hooks/use-hopeai-system.addStreamingResponseToHistory` → UI actualiza historial y muestra grounding.
- Adjuntos clínicos (UX → Gemini Files)
  - `components/file-upload-button.tsx` + `components/main-interface-optimized.tsx:handleUploadDocument` → `HopeAISystemSingleton.uploadDocument` → `clinical-file-manager` (valida/sube) → `Google AI Files` (estado ACTIVE) → `clinical-agent-router.createPartFromUri` en el último mensaje con `fileReferences` por ID.
- Ficha Clínica (UX → API interna)
  - Botones (chat y sidebar) → fetch POST/GET `/api/patients/[id]/ficha` → render en `FichaClinicaPanel`.

### Observaciones UX sólidas
- Diseño sobrio y elegante alineado a “instrumento silencioso”: fondos suaves, jerarquía clara, acciones discretas y seguras (deshabilitados contextuales), mobile-first en sidebar y micrófono.
  - Archivos: indicadores claros de “Procesando/Activo/Error” antes de permitir envío.
  - Transiciones de estado del agente: transparencia sin ruido (pensando/seleccionando/respondiendo).
  - Grounding: enlaces académicos visibles y no intrusivos.

### Riesgos y brechas UX/arquitectura (con enfoque SDK)
- Reconocimiento de voz: dependiente de `react-speech-recognition` con limitaciones de navegador; ya mitigado por warnings y fallback, pero requiere HTTPS y permisos explícitos en móviles; no impacta el flujo de GenAI.
- Estado de archivos: polling adicional a un endpoint para estado ACTIVE podría sincronizarse más directamente con la espera de `clinicalFileManager.waitForFileToBeActive(...)`, que ya se usa en el router para evitar adjuntar archivos no listos.
- Coherencia de “paciente activo”: el `Header` muestra paciente si `sessionMeta` está establecido; la UX depende de llamar `setSessionMeta` luego de iniciar conversación de paciente (ya implementado en `MainInterfaceOptimized`), lo cual es correcto.

### Recomendaciones estratégicas (basadas en Google GenAI SDK)
- Componente del SDK: Chats API moderna (`ai.chats.create`, `sendMessageStream`) y Files API (vía `createPartFromUri`) ya están correctamente adoptadas [[memory:6262758]].
- Justificación: El patrón “historial ligero + referencias por ID + adjunto del último mensaje” evita contextos inflados y errores RESOURCE_EXHAUSTED, y asegura que el LLM reciba los archivos como parts verificados en estado ACTIVE (consistencia con el SDK).
- Impacto esperado: menor latencia y mayor robustez en cargas largas; grounding consistente en el modo académico con URLs verificables.

- Componente del SDK: Herramientas de búsqueda nativa (GoogleSearch tool) en el agente académico con manejo de `groundingMetadata`.
- Justificación: Alinea estrictamente el flujo RAG (retrieve → augment → generate) y facilita citación verificable desde el frontend.
- Impacto esperado: minimiza alucinaciones; las referencias se muestran de forma limpia en el chat.

- Componente del SDK: Safety settings clínicos
- Justificación: Los `clinicalSafetySettings` configuran bloqueos de categorías de daño para entornos clínicos.
- Impacto esperado: coherencia de seguridad a nivel de modelo sin complejidad en el frontend.

— — —

- **Dependientes clave**: `components/chat-interface.tsx`, `hooks/use-hopeai-system.ts`, `lib/hopeai-system.ts`, `lib/clinical-agent-router.ts`, `lib/google-genai-config.ts`.
- **Independientes relevantes**: `components/markdown-renderer.tsx` (sanitización), `components/message-file-attachments.tsx` (UI adjuntos), `components/patient-library/FichaClinicaPanel.tsx` (visualización de ficha), `hooks/use-conversation-history.ts` (paginación), `hooks/use-speech-to-text.ts` (voz).

Breve resumen
- UX clínico cohesivo: chat central con estados de orquestación, historial y pacientes en sidebar, Ficha Clínica bajo demanda, adjuntos gestionados con estado y bloqueo de envío, voz integrada y grounding visible; todo sustentado por `@google/genai` chats/files y GoogleSearch para RAG.
- Flujo crítico (mensaje): ChatInterface → use-hopeai-system → hopeai-system → clinical-agent-router → SDK → stream + grounding → historial/UX actualizados.
- Diseño: sobrio, seguro, mobile-first, con controles claramente deshabilitados en operaciones sensibles (procesamiento/streaming/archivos).