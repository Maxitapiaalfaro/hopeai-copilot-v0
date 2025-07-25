# **Arquitectura de Contexto y Persistencia para Chat Copilot de IA Clínica con Google Gen AI SDK**

## **Resumen Ejecutivo**

Este documento de diseño técnico presenta una **arquitectura nueva, simplificada y eficiente** para la gestión de contexto en un sistema de chat Copilot para supervisión en psicología clínica, basado en los **fundamentos del Google Gen AI SDK for TypeScript and JavaScript**[1](https://googleapis.github.io/js-genai/release_docs/index.html)[2](https://github.com/googleapis/js-genai). La arquitectura propuesta integra **conversaciones multi-turno**, **streaming en tiempo real**, **persistencia cliente con IndexedDB**, **capacidades de RAG clínico**, e **integración de herramientas de investigación** en un sistema unificado y escalable.

## **Fase 1: Fundamentos del SDK y Persistencia de Contexto**

## **1\. Fuente de Verdad: Google Gen AI SDK for TypeScript and JavaScript**

El **Google Gen AI SDK for TypeScript and JavaScript** es el SDK oficial desarrollado por Google DeepMind para aplicaciones potenciadas por Gemini 2.0, diseñado específicamente para **nuevas características de IA**[1](https://googleapis.github.io/js-genai/release_docs/index.html)[2](https://github.com/googleapis/js-genai). Este SDK **unifica** el acceso tanto a la **Gemini Developer API** como a **Vertex AI**, proporcionando una interfaz consistente para aplicaciones empresariales[1](https://googleapis.github.io/js-genai/release_docs/index.html).

## **Arquitectura Principal del SDK**

El SDK organiza sus funcionalidades en **cinco módulos principales**[1](https://googleapis.github.io/js-genai/release_docs/index.html)[2](https://github.com/googleapis/js-genai):

1. **`ai.models`**: Generación de contenido, imágenes, y examinación de metadatos

2. **`ai.caches`**: Gestión de caché para reducir costos con prefijos de prompt largos

3. **`ai.chats`**: Objetos de chat locales con estado para **interacciones multi-turno**

4. **`ai.files`**: Subida y referencia de archivos en prompts

5. **`ai.live`**: Sesiones en tiempo real con entrada de texto, audio y video

## **2\. Capacidades Fundamentales para Aplicaciones Clínicas**

## **a. Conversaciones Multi-turno y Streaming**

**Gestión de Chat Sessions**[3](https://www.prnewswire.com/news-releases/google-cloud-enhances-vertex-ai-search-for-healthcare-with-multimodal-ai-302388639.html)[4](https://googleapis.github.io/js-genai/release_docs/classes/chats.Chat.html):

typescript  
`const chat = ai.chats.create({`  
  `model: 'gemini-2.0-flash',`  
  `config: {`  
    `temperature: 0.7,`  
    `maxOutputTokens: 2048,`  
    `systemInstruction: 'Actúa como supervisor clínico especializado en psicología'`  
  `}`  
`});`

*`// Conversación multi-turno`*  
`const response = await chat.sendMessage({`  
  `message: 'Analiza esta sesión terapéutica...'`  
`});`

*`// Streaming en tiempo real`*  
`const streamResponse = await chat.sendMessageStream({`  
  `message: 'Proporciona estrategias de intervención...'`  
`});`

`for await (const chunk of streamResponse) {`  
  `// Procesamiento en tiempo real del streaming`  
  `console.log(chunk.text);`  
`}`

**Recuperación de Historial Completo**[3](https://www.prnewswire.com/news-releases/google-cloud-enhances-vertex-ai-search-for-healthcare-with-multimodal-ai-302388639.html)[4](https://googleapis.github.io/js-genai/release_docs/classes/chats.Chat.html):

typescript  
*`// Historial curado (válido para requests subsecuentes)`*  
`const curatedHistory = chat.getHistory(true);`

*`// Historial comprensivo (registro completo incluyendo respuestas vacías)`*  
`const fullHistory = chat.getHistory(false);`

El SDK **mantiene automáticamente** el estado conversacional, alternando entre roles `user` y `model`, y **actualiza el historial** después de recibir cada respuesta del modelo[3](https://www.prnewswire.com/news-releases/google-cloud-enhances-vertex-ai-search-for-healthcare-with-multimodal-ai-302388639.html)[4](https://googleapis.github.io/js-genai/release_docs/classes/chats.Chat.html).

## **b. Integración de Herramientas (Tool Use)**

**Patrón de Function Calling de 4 Pasos**[1](https://googleapis.github.io/js-genai/release_docs/index.html)[5](https://discuss.ai.google.dev/t/understanding-the-two-step-function-calling-mechanism-in-the-new-google-gen-ai-sdk/69926):

1. **Declaración de función** con esquema JSON

2. **Generación de contenido** con function calling habilitado

3. **Ejecución de la función** con parámetros retornados

4. **Envío del resultado** de vuelta al modelo

typescript  
`import {GoogleGenAI, FunctionCallingConfigMode} from '@google/genai';`

`const pubmedSearchDeclaration = {`  
  `name: 'searchPubMed',`  
  `parametersJsonSchema: {`  
    `type: 'object',`  
    `properties: {`  
      `query: {type: 'string'},`  
      `maxResults: {type: 'number'}`  
    `},`  
    `required: ['query']`  
  `}`  
`};`

`const response = await ai.models.generateContent({`  
  `model: 'gemini-2.0-flash',`  
  `contents: 'Busca investigación sobre terapia cognitivo-conductual para ansiedad',`  
  `config: {`  
    `toolConfig: {`  
      `functionCallingConfig: {`  
        `mode: FunctionCallingConfigMode.ANY,`  
        `allowedFunctionNames: ['searchPubMed']`  
      `}`  
    `},`  
    `tools: [{functionDeclarations: [pubmedSearchDeclaration]}]`  
  `}`  
`});`

## **c. Gestión de Archivos (Document Upload)**

**Capacidades Multimodales**[6](https://ai.google.dev/gemini-api/docs/files)[7](https://ai.google.dev/gemini-api/docs/document-processing?lang=python):

* **Soporte de archivos hasta 3,600 páginas**[7](https://ai.google.dev/gemini-api/docs/document-processing?lang=python)

* **Formatos soportados**: PDF, TXT, HTML, CSV, XML, RTF, JavaScript, Python

* **Procesamiento nativo con visión** para documentos con contenido visual[7](https://ai.google.dev/gemini-api/docs/document-processing?lang=python)

typescript  
*`// Subida de archivo clínico`*  
`const clinicalFile = await ai.files.upload({`  
  `file: 'caso_clinico.pdf',`  
  `config: {mimeType: 'application/pdf'}`  
`});`

*`// Uso en conversación`*  
`const analysis = await ai.models.generateContent({`  
  `model: 'gemini-2.5-flash',`  
  `contents: [clinicalFile, 'Analiza este caso clínico y sugiere intervenciones']`  
`});`

## **3\. Mecanismo de Persistencia de Contexto**

## **a. Serialización de Estado**

**Estructura del Context State**[3](https://www.prnewswire.com/news-releases/google-cloud-enhances-vertex-ai-search-for-healthcare-with-multimodal-ai-302388639.html)[4](https://googleapis.github.io/js-genai/release_docs/classes/chats.Chat.html):

typescript  
`interface ChatState {`  
  `sessionId: string;`  
  `userId: string;`  
  `mode: 'therapeutic_assistance' | 'clinical_supervision';`  
  `history: Content[];  // Historial conversacional completo`  
  `metadata: {`  
    `createdAt: Date;`  
    `lastUpdated: Date;`  
    `totalTokens: number;`  
    `fileReferences: string[];`  
  `};`  
  `clinicalContext: {`  
    `patientId?: string;`  
    `supervisorId?: string;`  
    `sessionType: string;`  
    `confidentialityLevel: 'high' | 'medium' | 'low';`  
  `};`  
`}`

**Serialización para Almacenamiento**[8](https://discuss.ai.google.dev/t/gemini-chat-history/5933)[9](https://discuss.ai.google.dev/t/what-is-the-best-way-to-persist-chat-history-into-file/3804):

typescript  
`function serializeChatState(chat: Chat): ChatState {`  
  `const history = chat.getHistory(false); // Historial comprensivo`  
    
  `return {`  
    `sessionId: generateSessionId(),`  
    `userId: getCurrentUserId(),`  
    `mode: getCurrentMode(),`  
    `history: history,`  
    `metadata: {`  
      `createdAt: new Date(),`  
      `lastUpdated: new Date(),`  
      `totalTokens: calculateTotalTokens(history),`  
      `fileReferences: extractFileReferences(history)`  
    `},`  
    `clinicalContext: getCurrentClinicalContext()`  
  `};`  
`}`

## **b. Rehidratación de Chat Sessions**

**Restauración de Contexto Completo**[10](https://discuss.ai.google.dev/t/how-can-i-start-a-new-chat-with-custom-chat-history-in-the-new-google-gen-ai-sdk-python/54812)[11](https://discuss.ai.google.dev/t/stateless-gemini-api-and-maintaining-continuous-conversations-for-multiple-users/41909/2):

typescript  
`function rehydrateChatSession(chatState: ChatState): Chat {`  
  `const chat = ai.chats.create({`  
    `model: 'gemini-2.0-flash',`  
    `config: getConfigForMode(chatState.mode),`  
    `history: chatState.history  // Restauración directa del historial`  
  `});`  
    
  `return chat;`  
`}`

El SDK **no mantiene estado server-side**[8](https://discuss.ai.google.dev/t/gemini-chat-history/5933)[11](https://discuss.ai.google.dev/t/stateless-gemini-api-and-maintaining-continuous-conversations-for-multiple-users/41909/2), por lo que la **persistencia es responsabilidad del cliente**, siguiendo un patrón similar al **protocolo HTTP stateless**[11](https://discuss.ai.google.dev/t/stateless-gemini-api-and-maintaining-continuous-conversations-for-multiple-users/41909/2).

## **Fase 2: Diseño de la Arquitectura de la Aplicación Clínica**

## **4\. Arquitectura de Agentes Adaptativos**

## **Agente Enrutador Dinámico**

typescript  
`interface ClinicalMode {`  
  `name: string;`  
  `systemInstruction: string;`  
  `tools: FunctionDeclaration[];`  
  `config: GenerateContentConfig;`  
`}`

`class ClinicalAgentRouter {`  
  `private modes: Map<string, ClinicalMode> = new Map();`  
    
  `constructor() {`  
    `this.initializeModes();`  
  `}`  
    
  `private initializeModes() {`  
    `// Modo: Asistencia Terapéutica`  
    `this.modes.set('therapeutic_assistance', {`  
      `name: 'Asistencia Terapéutica',`  
      ``systemInstruction: `Eres un asistente clínico especializado en psicología.``   
        `Tu rol es proporcionar apoyo informativo para sesiones terapéuticas,`   
        ``basado en evidencia científica y mejores prácticas clínicas.`,``  
      `tools: [`  
        `this.getPubMedSearchTool(),`  
        `this.getClinicalGuidelinesTool(),`  
        `this.getInterventionSuggestionTool()`  
      `],`  
      `config: {`  
        `temperature: 0.3,  // Más conservador para recomendaciones clínicas`  
        `maxOutputTokens: 1024,`  
        `safetySettings: this.getHighSafetySettings()`  
      `}`  
    `});`  
      
    `// Modo: Supervisión Clínica`  
    `this.modes.set('clinical_supervision', {`  
      `name: 'Supervisión Clínica',`  
      ``systemInstruction: `Eres un supervisor clínico senior especializado en``   
        `psicología. Proporciona orientación, análisis de casos y desarrollo`   
        ``profesional para terapeutas en formación y práctica.`,``  
      `tools: [`  
        `this.getCaseAnalysisTool(),`  
        `this.getEthicalGuidanceTool(),`  
        `this.getProfessionalDevelopmentTool()`  
      `],`  
      `config: {`  
        `temperature: 0.4,`  
        `maxOutputTokens: 2048,`  
        `safetySettings: this.getHighSafetySettings()`  
      `}`  
    `});`  
  `}`  
    
  `public createChatForMode(mode: string, history?: Content[]): Chat {`  
    `const clinicalMode = this.modes.get(mode);`  
    `if (!clinicalMode) {`  
      ``throw new Error(`Modo clínico no encontrado: ${mode}`);``  
    `}`  
      
    `return ai.chats.create({`  
      `model: 'gemini-2.0-flash',`  
      `config: {`  
        `...clinicalMode.config,`  
        `systemInstruction: clinicalMode.systemInstruction,`  
        `tools: [{functionDeclarations: clinicalMode.tools}]`  
      `},`  
      `history: history || []`  
    `});`  
  `}`  
`}`

## **5\. Pipeline de RAG Clínico**

## **Integración con Capacidades Nativas del SDK**

**Arquitectura de RAG con Files API**[6](https://ai.google.dev/gemini-api/docs/files)[12](https://ai.google.dev/edge/mediapipe/solutions/genai/rag):

typescript  
`class ClinicalRAGPipeline {`  
  `private vectorStore: ClinicalVectorStore;`  
  `private fileManager: FileManager;`  
    
  `constructor() {`  
    `this.vectorStore = new ClinicalVectorStore();`  
    `this.fileManager = new FileManager(ai.files);`  
  `}`  
    
  `async ingestClinicalDocument(file: File): Promise<string> {`  
    `// 1. Subir archivo usando Files API`  
    `const uploadedFile = await ai.files.upload({`  
      `file: file,`  
      `config: {`  
        `mimeType: file.type,`  
        `` displayName: `clinical_doc_${Date.now()}` ``  
      `}`  
    `});`  
      
    `// 2. Procesar y chunking del documento`  
    `const chunks = await this.chunkDocument(uploadedFile);`  
      
    `// 3. Generar embeddings y almacenar en vector store`  
    `await this.vectorStore.indexChunks(chunks);`  
      
    `return uploadedFile.name;`  
  `}`  
    
  `async retrieveRelevantContext(query: string, k: number = 5): Promise<string[]> {`  
    `// Recuperación semántica de chunks relevantes`  
    `const relevantChunks = await this.vectorStore.similaritySearch(query, k);`  
    `return relevantChunks.map(chunk => chunk.content);`  
  `}`  
    
  `async enhancePromptWithRAG(`  
    `query: string,`   
    `chat: Chat`  
  `): Promise<GenerateContentResponse> {`  
    `// 1. Recuperar contexto relevante`  
    `const contextChunks = await this.retrieveRelevantContext(query);`  
      
    `// 2. Construir prompt aumentado`  
    `` const enhancedPrompt = ` ``  
      `Contexto clínico relevante:`  
      `${contextChunks.join('\n\n')}`  
        
      `Pregunta del usuario: ${query}`  
        
      `Basándote en el contexto clínico proporcionado y tu conocimiento,`   
      `responde de manera precisa y fundamentada.`  
    `` `; ``  
      
    `// 3. Generar respuesta con contexto aumentado`  
    `return await chat.sendMessage({message: enhancedPrompt});`  
  `}`  
`}`

## **6\. Integración de Herramientas de Investigación**

## **PubMed Integration Tool**

typescript  
`class PubMedResearchTool {`  
  `private readonly pubmedApiKey: string;`  
    
  `constructor(apiKey: string) {`  
    `this.pubmedApiKey = apiKey;`  
  `}`  
    
  `getToolDeclaration(): FunctionDeclaration {`  
    `return {`  
      `name: 'searchPubMed',`  
      `parametersJsonSchema: {`  
        `type: 'object',`  
        `properties: {`  
          `query: {`  
            `type: 'string',`  
            `description: 'Consulta de búsqueda en terminología médica/psicológica'`  
          `},`  
          `maxResults: {`  
            `type: 'number',`  
            `description: 'Número máximo de resultados (por defecto: 10)'`  
          `},`  
          `dateRange: {`  
            `type: 'string',`  
            `description: 'Rango de fechas (ej: "last_5_years")'`  
          `}`  
        `},`  
        `required: ['query']`  
      `}`  
    `};`  
  `}`  
    
  `async executeTool(parameters: any): Promise<string> {`  
    `const {query, maxResults = 10, dateRange} = parameters;`  
      
    `try {`  
      `const searchResults = await this.searchPubMed(query, maxResults, dateRange);`  
      `return this.formatResults(searchResults);`  
    `} catch (error) {`  
      ``return `Error en búsqueda PubMed: ${error.message}`;``  
    `}`  
  `}`  
    
  `private async searchPubMed(`  
    `query: string,`   
    `maxResults: number,`   
    `dateRange?: string`  
  `): Promise<any[]> {`  
    `// Implementación de búsqueda en PubMed API`  
    `// Retorna artículos relevantes con metadatos`  
  `}`  
    
  `private formatResults(results: any[]): string {`  
    `` return results.map(article => ` ``  
      `Título: ${article.title}`  
      `Autores: ${article.authors.join(', ')}`  
      `Revista: ${article.journal}`  
      `Año: ${article.year}`  
      `PMID: ${article.pmid}`  
      `Resumen: ${article.abstract.substring(0, 300)}...`  
      `---`  
    `` `).join('\n'); ``  
  `}`  
`}`

## **Fase 3: Síntesis, Optimización y Documentación**

## **7\. Arquitectura de Persistencia Cliente**

## **IndexedDB Storage Manager**

typescript  
`class ClinicalContextStorage {`  
  `private dbName = 'clinical_copilot_db';`  
  `private version = 1;`  
  `private db: IDBDatabase | null = null;`  
    
  `async initialize(): Promise<void> {`  
    `return new Promise((resolve, reject) => {`  
      `const request = indexedDB.open(this.dbName, this.version);`  
        
      `request.onerror = () => reject(request.error);`  
      `request.onsuccess = () => {`  
        `this.db = request.result;`  
        `resolve();`  
      `};`  
        
      `request.onupgradeneeded = (event) => {`  
        `const db = (event.target as IDBOpenDBRequest).result;`  
          
        `// Store para sesiones de chat`  
        `const chatStore = db.createObjectStore('chat_sessions', {`  
          `keyPath: 'sessionId'`  
        `});`  
        `chatStore.createIndex('userId', 'userId', {unique: false});`  
        `chatStore.createIndex('lastUpdated', 'metadata.lastUpdated', {unique: false});`  
          
        `// Store para archivos clínicos`  
        `const filesStore = db.createObjectStore('clinical_files', {`  
          `keyPath: 'fileId'`  
        `});`  
        `filesStore.createIndex('sessionId', 'sessionId', {unique: false});`  
      `};`  
    `});`  
  `}`  
    
  `async saveChatSession(chatState: ChatState): Promise<void> {`  
    `const transaction = this.db!.transaction(['chat_sessions'], 'readwrite');`  
    `const store = transaction.objectStore('chat_sessions');`  
      
    `await new Promise<void>((resolve, reject) => {`  
      `const request = store.put(chatState);`  
      `request.onsuccess = () => resolve();`  
      `request.onerror = () => reject(request.error);`  
    `});`  
  `}`  
    
  `async loadChatSession(sessionId: string): Promise<ChatState | null> {`  
    `const transaction = this.db!.transaction(['chat_sessions'], 'readonly');`  
    `const store = transaction.objectStore('chat_sessions');`  
      
    `return new Promise((resolve, reject) => {`  
      `const request = store.get(sessionId);`  
      `request.onsuccess = () => resolve(request.result || null);`  
      `request.onerror = () => reject(request.error);`  
    `});`  
  `}`  
    
  `async getUserSessions(userId: string): Promise<ChatState[]> {`  
    `const transaction = this.db!.transaction(['chat_sessions'], 'readonly');`  
    `const store = transaction.objectStore('chat_sessions');`  
    `const index = store.index('userId');`  
      
    `return new Promise((resolve, reject) => {`  
      `const request = index.getAll(userId);`  
      `request.onsuccess = () => resolve(request.result);`  
      `request.onerror = () => reject(request.error);`  
    `});`  
  `}`  
`}`

## **Momento Óptimo para Persistencia con Streaming**

typescript  
`class StreamingPersistenceManager {`  
  `private storage: ClinicalContextStorage;`  
  `private saveTimeout: NodeJS.Timeout | null = null;`  
  `private readonly SAVE_DELAY = 2000; // 2 segundos después del último chunk`  
    
  `constructor(storage: ClinicalContextStorage) {`  
    `this.storage = storage;`  
  `}`  
    
  `async handleStreamingResponse(`  
    `chat: Chat,`  
    `sessionId: string,`  
    `streamResponse: AsyncIterable<GenerateContentResponse>`  
  `): Promise<void> {`  
    `let completeResponse = '';`  
      
    `for await (const chunk of streamResponse) {`  
      `completeResponse += chunk.text || '';`  
        
      `// UI update inmediato`  
      `this.updateUI(chunk.text);`  
        
      `// Programar guardado diferido`  
      `this.scheduleDelayedSave(chat, sessionId);`  
    `}`  
      
    `// Guardado inmediato al finalizar el stream`  
    `await this.saveImmediately(chat, sessionId);`  
  `}`  
    
  `private scheduleDelayedSave(chat: Chat, sessionId: string): void {`  
    `if (this.saveTimeout) {`  
      `clearTimeout(this.saveTimeout);`  
    `}`  
      
    `this.saveTimeout = setTimeout(() => {`  
      `this.saveImmediately(chat, sessionId);`  
    `}, this.SAVE_DELAY);`  
  `}`  
    
  `private async saveImmediately(chat: Chat, sessionId: string): Promise<void> {`  
    `if (this.saveTimeout) {`  
      `clearTimeout(this.saveTimeout);`  
      `this.saveTimeout = null;`  
    `}`  
      
    `const chatState = serializeChatState(chat);`  
    `chatState.sessionId = sessionId;`  
    `chatState.metadata.lastUpdated = new Date();`  
      
    `await this.storage.saveChatSession(chatState);`  
  `}`  
`}`

## **8\. Estrategia de Contexto Unificado**

## **Context Composition Manager**

typescript  
`class UnifiedContextManager {`  
  `private ragPipeline: ClinicalRAGPipeline;`  
  `private toolResults: Map<string, any> = new Map();`  
    
  `constructor(ragPipeline: ClinicalRAGPipeline) {`  
    `this.ragPipeline = ragPipeline;`  
  `}`  
    
  `async composeContextForTurn(`  
    `userMessage: string,`  
    `chatHistory: Content[],`  
    `sessionMetadata: any`  
  `): Promise<string> {`  
    `// 1. Recuperar contexto RAG relevante`  
    `const ragContext = await this.ragPipeline.retrieveRelevantContext(`  
      `userMessage,`   
      `5`  
    `);`  
      
    `// 2. Incluir resultados de herramientas recientes`  
    `const recentToolResults = this.getRecentToolResults();`  
      
    `// 3. Extraer contexto clínico de la sesión`  
    `const clinicalContext = this.extractClinicalContext(sessionMetadata);`  
      
    `// 4. Componer contexto unificado`  
    `` const unifiedContext = ` ``  
      `CONTEXTO CLÍNICO:`  
      `${clinicalContext}`  
        
      `INFORMACIÓN RELEVANTE DE BASE DE CONOCIMIENTO:`  
      `${ragContext.join('\n\n')}`  
        
      `RESULTADOS DE HERRAMIENTAS RECIENTES:`  
      `${recentToolResults}`  
        
      `MENSAJE DEL USUARIO:`  
      `${userMessage}`  
    `` `; ``  
      
    `return unifiedContext;`  
  `}`  
    
  `private getRecentToolResults(): string {`  
    `const recentResults = Array.from(this.toolResults.entries())`  
      `.slice(-3) // Últimos 3 resultados`  
      ``.map(([toolName, result]) => `${toolName}: ${JSON.stringify(result)}`)``  
      `.join('\n');`  
      
    `return recentResults;`  
  `}`  
    
  `private extractClinicalContext(metadata: any): string {`  
    `` return ` ``  
      `Tipo de sesión: ${metadata.clinicalContext.sessionType}`  
      `Nivel de confidencialidad: ${metadata.clinicalContext.confidentialityLevel}`  
      `Usuario ID: ${metadata.userId}`  
      `Modo actual: ${metadata.mode}`  
    `` `; ``  
  `}`  
`}`

## **9\. Estrategias de Optimización de Contexto**

## **Token Management y Long Context**

**Capacidades de Long Context de Gemini**[13](https://cloud.google.com/vertex-ai/generative-ai/docs/long-context)[14](https://ai.google.dev/gemini-api/docs/long-context):

* **Ventana de contexto de 1-2 millones de tokens**[13](https://cloud.google.com/vertex-ai/generative-ai/docs/long-context)

* **Recuperación casi perfecta (\>99%)**[13](https://cloud.google.com/vertex-ai/generative-ai/docs/long-context)

* **Capacidad para procesar \~50,000 líneas de código o 8 novelas promedio**[13](https://cloud.google.com/vertex-ai/generative-ai/docs/long-context)

typescript  
`class ContextOptimizationManager {`  
  `private readonly MAX_CONTEXT_TOKENS = 900000; // 90% del límite de 1M`  
  `private readonly SLIDING_WINDOW_SIZE = 50; // Turnos de conversación`  
    
  `async optimizeContextForLongConversation(`  
    `chatHistory: Content[],`  
    `currentQuery: string`  
  `): Promise<Content[]> {`  
    `// 1. Calcular tokens actuales`  
    `const totalTokens = await this.calculateTokens(chatHistory);`  
      
    `if (totalTokens <= this.MAX_CONTEXT_TOKENS) {`  
      `return chatHistory; // No optimization needed`  
    `}`  
      
    `// 2. Estrategia de ventana deslizante con preservación de contexto crítico`  
    `const optimizedHistory = await this.applySlidingWindowWithPreservation(`  
      `chatHistory,`  
      `currentQuery`  
    `);`  
      
    `return optimizedHistory;`  
  `}`  
    
  `private async applySlidingWindowWithPreservation(`  
    `history: Content[],`  
    `currentQuery: string`  
  `): Promise<Content[]> {`  
    `// 1. Preservar siempre los primeros mensajes (contexto de inicio)`  
    `const initialContext = history.slice(0, 4);`  
      
    `// 2. Preservar mensajes recientes`  
    `const recentContext = history.slice(-this.SLIDING_WINDOW_SIZE);`  
      
    `// 3. Identificar mensajes críticos en el medio`  
    `const criticalMessages = await this.identifyCriticalMessages(`  
      `history.slice(4, -this.SLIDING_WINDOW_SIZE),`  
      `currentQuery`  
    `);`  
      
    `// 4. Combinar contextos`  
    `const optimizedHistory = [`  
      `...initialContext,`  
      `...criticalMessages,`  
      `...recentContext`  
    `];`  
      
    `return optimizedHistory;`  
  `}`  
    
  `private async calculateTokens(history: Content[]): Promise<number> {`  
    `// Usar el método nativo del SDK para contar tokens`  
    `let totalTokens = 0;`  
      
    `for (const content of history) {`  
      `const tokenCount = await ai.models.countTokens({`  
        `model: 'gemini-2.0-flash',`  
        `contents: [content]`  
      `});`  
      `totalTokens += tokenCount.totalTokens;`  
    `}`  
      
    `return totalTokens;`  
  `}`  
    
  `private async identifyCriticalMessages(`  
    `middleHistory: Content[],`  
    `currentQuery: string`  
  `): Promise<Content[]> {`  
    `// Usar embeddings para identificar mensajes semánticamente relevantes`  
    `// a la consulta actual`  
    `const relevanceScores = await Promise.all(`  
      `middleHistory.map(async (content) => {`  
        `const score = await this.calculateRelevanceScore(content, currentQuery);`  
        `return {content, score};`  
      `})`  
    `);`  
      
    `// Retornar los 10 mensajes más relevantes`  
    `return relevanceScores`  
      `.sort((a, b) => b.score - a.score)`  
      `.slice(0, 10)`  
      `.map(item => item.content);`  
  `}`  
`}`

## **Caché y Reutilización de Contexto**

**Context Caching con Gemini API**[15](https://ai.google.dev/gemini-api/docs/caching):

typescript  
`class ContextCacheManager {`  
  `async createCacheForFrequentContext(`  
    `clinicalGuidelines: string,`  
    `ttlHours: number = 24`  
  `): Promise<string> {`  
    `const cache = await ai.caches.create({`  
      `model: 'gemini-2.0-flash',`  
      `contents: [`  
        `{`  
          `role: 'user',`  
          `parts: [{text: clinicalGuidelines}]`  
        `}`  
      `],`  
      ``ttl: `${ttlHours * 3600}s` // TTL en segundos``  
    `});`  
      
    `return cache.name;`  
  `}`  
    
  `async generateWithCachedContext(`  
    `cacheId: string,`  
    `userMessage: string`  
  `): Promise<GenerateContentResponse> {`  
    `return await ai.models.generateContent({`  
      `model: 'gemini-2.0-flash',`  
      `contents: userMessage,`  
      `config: {`  
        `cachedContent: cacheId`  
      `}`  
    `});`  
  `}`  
`}`

## **10\. Documento de Arquitectura de Referencia**

## **Arquitectura Unificada Completa**

typescript  
`class ClinicalCopilotSystem {`  
  `private agentRouter: ClinicalAgentRouter;`  
  `private ragPipeline: ClinicalRAGPipeline;`  
  `private storage: ClinicalContextStorage;`  
  `private contextManager: UnifiedContextManager;`  
  `private optimizationManager: ContextOptimizationManager;`  
  `private streamingManager: StreamingPersistenceManager;`  
  `private cacheManager: ContextCacheManager;`  
    
  `constructor() {`  
    `this.initializeSystem();`  
  `}`  
    
  `private async initializeSystem(): Promise<void> {`  
    `this.storage = new ClinicalContextStorage();`  
    `await this.storage.initialize();`  
      
    `this.ragPipeline = new ClinicalRAGPipeline();`  
    `this.agentRouter = new ClinicalAgentRouter();`  
    `this.contextManager = new UnifiedContextManager(this.ragPipeline);`  
    `this.optimizationManager = new ContextOptimizationManager();`  
    `this.streamingManager = new StreamingPersistenceManager(this.storage);`  
    `this.cacheManager = new ContextCacheManager();`  
  `}`  
    
  `async startClinicalSession(`  
    `userId: string,`  
    `mode: 'therapeutic_assistance' | 'clinical_supervision',`  
    `sessionId?: string`  
  `): Promise<{chat: Chat; sessionId: string}> {`  
    `let chatHistory: Content[] = [];`  
    `let finalSessionId = sessionId || generateUUID();`  
      
    `// Restaurar sesión existente si se proporciona sessionId`  
    `if (sessionId) {`  
      `const savedState = await this.storage.loadChatSession(sessionId);`  
      `if (savedState) {`  
        `chatHistory = savedState.history;`  
      `}`  
    `}`  
      
    `// Crear chat con historial restaurado`  
    `const chat = this.agentRouter.createChatForMode(mode, chatHistory);`  
      
    `return {chat, sessionId: finalSessionId};`  
  `}`  
    
  `async processUserMessage(`  
    `chat: Chat,`  
    `sessionId: string,`  
    `userMessage: string,`  
    `useStreaming: boolean = true`  
  `): Promise<GenerateContentResponse | AsyncIterable<GenerateContentResponse>> {`  
    `// 1. Componer contexto unificado`  
    `const chatHistory = chat.getHistory();`  
    `const sessionState = await this.storage.loadChatSession(sessionId);`  
      
    `const unifiedContext = await this.contextManager.composeContextForTurn(`  
      `userMessage,`  
      `chatHistory,`  
      `sessionState?.metadata || {}`  
    `);`  
      
    `// 2. Optimizar contexto para conversaciones largas`  
    `const optimizedHistory = await this.optimizationManager.optimizeContextForLongConversation(`  
      `chatHistory,`  
      `userMessage`  
    `);`  
      
    `// 3. Generar respuesta (streaming o no-streaming)`  
    `if (useStreaming) {`  
      `const streamResponse = await chat.sendMessageStream({`  
        `message: unifiedContext`  
      `});`  
        
      `// Manejar persistencia con streaming`  
      `this.streamingManager.handleStreamingResponse(`  
        `chat,`  
        `sessionId,`  
        `streamResponse`  
      `);`  
        
      `return streamResponse;`  
    `} else {`  
      `const response = await chat.sendMessage({`  
        `message: unifiedContext`  
      `});`  
        
      `// Persistir estado inmediatamente`  
      `await this.persistChatState(chat, sessionId);`  
        
      `return response;`  
    `}`  
  `}`  
    
  `async uploadClinicalDocument(`  
    `sessionId: string,`  
    `file: File`  
  `): Promise<string> {`  
    `// 1. Procesar documento con RAG pipeline`  
    `const fileId = await this.ragPipeline.ingestClinicalDocument(file);`  
      
    `// 2. Actualizar metadatos de la sesión`  
    `const sessionState = await this.storage.loadChatSession(sessionId);`  
    `if (sessionState) {`  
      `sessionState.metadata.fileReferences.push(fileId);`  
      `await this.storage.saveChatSession(sessionState);`  
    `}`  
      
    `return fileId;`  
  `}`  
    
  `private async persistChatState(chat: Chat, sessionId: string): Promise<void> {`  
    `const chatState = serializeChatState(chat);`  
    `chatState.sessionId = sessionId;`  
    `chatState.metadata.lastUpdated = new Date();`  
      
    `await this.storage.saveChatSession(chatState);`  
  `}`  
`}`

## **Conclusiones y Recomendaciones**

## **Beneficios de la Arquitectura Propuesta**

1. **Simplificación**: Uso nativo de las capacidades del Google Gen AI SDK sin abstracciones innecesarias

2. **Eficiencia**: Aprovechamiento del **long context window** (1-2M tokens) para reducir necesidad de optimización[13](https://cloud.google.com/vertex-ai/generative-ai/docs/long-context)

3. **Escalabilidad**: **Persistencia cliente con IndexedDB** para aplicaciones sin servidor

4. **Flexibilidad**: **Sistema de agentes adaptativos** para diferentes modos clínicos

5. **Robustez**: **Integración nativa de RAG** y herramientas de investigación

6. **Tiempo Real**: **Streaming integrado** con persistencia optimizada

## **Implementación Recomendada**

1. **Fase 1**: Implementar core del sistema (3-4 semanas)

   * Chat sessions con persistencia básica

   * Agente router con 2 modos clínicos

   * Integración básica de archivos

2. **Fase 2**: RAG y herramientas (4-6 semanas)

   * Pipeline de RAG clínico

   * Integración de PubMed

   * Optimización de contexto

3. **Fase 3**: Optimización y producción (2-3 semanas)

   * Context caching

   * Monitoreo de performance

   * Seguridad y compliance clínico

## **Consideraciones de Seguridad y Compliance**

* **Cifrado en tránsito y en reposo** para datos clínicos[16](https://chariotsolutions.com/blog/post/client-side-data-persistence-with-indexeddb/)

* **Control de acceso granular** por nivel de confidencialidad

* **Auditoría completa** de interacciones clínicas

* **Compliance con HIPAA/GDPR** según jurisdicción

Esta arquitectura proporciona una **base sólida, escalable y eficiente** para el desarrollo de un chat Copilot de IA para supervisión en psicología clínica, aprovechando al máximo las capacidades nativas del Google Gen AI SDK[1](https://googleapis.github.io/js-genai/release_docs/index.html)[2](https://github.com/googleapis/js-genai).

1. [https://googleapis.github.io/js-genai/release\_docs/index.html](https://googleapis.github.io/js-genai/release_docs/index.html)  
2. [https://github.com/googleapis/js-genai](https://github.com/googleapis/js-genai)  
3. [https://www.prnewswire.com/news-releases/google-cloud-enhances-vertex-ai-search-for-healthcare-with-multimodal-ai-302388639.html](https://www.prnewswire.com/news-releases/google-cloud-enhances-vertex-ai-search-for-healthcare-with-multimodal-ai-302388639.html)  
4. [https://googleapis.github.io/js-genai/release\_docs/classes/chats.Chat.html](https://googleapis.github.io/js-genai/release_docs/classes/chats.Chat.html)  
5. [https://discuss.ai.google.dev/t/understanding-the-two-step-function-calling-mechanism-in-the-new-google-gen-ai-sdk/69926](https://discuss.ai.google.dev/t/understanding-the-two-step-function-calling-mechanism-in-the-new-google-gen-ai-sdk/69926)  
6. [https://ai.google.dev/gemini-api/docs/files](https://ai.google.dev/gemini-api/docs/files)  
7. [https://ai.google.dev/gemini-api/docs/document-processing?lang=python](https://ai.google.dev/gemini-api/docs/document-processing?lang=python)  
8. [https://discuss.ai.google.dev/t/gemini-chat-history/5933](https://discuss.ai.google.dev/t/gemini-chat-history/5933)  
9. [https://discuss.ai.google.dev/t/what-is-the-best-way-to-persist-chat-history-into-file/3804](https://discuss.ai.google.dev/t/what-is-the-best-way-to-persist-chat-history-into-file/3804)  
10. [https://discuss.ai.google.dev/t/how-can-i-start-a-new-chat-with-custom-chat-history-in-the-new-google-gen-ai-sdk-python/54812](https://discuss.ai.google.dev/t/how-can-i-start-a-new-chat-with-custom-chat-history-in-the-new-google-gen-ai-sdk-python/54812)  
11. [https://discuss.ai.google.dev/t/stateless-gemini-api-and-maintaining-continuous-conversations-for-multiple-users/41909/2](https://discuss.ai.google.dev/t/stateless-gemini-api-and-maintaining-continuous-conversations-for-multiple-users/41909/2)  
12. [https://ai.google.dev/edge/mediapipe/solutions/genai/rag](https://ai.google.dev/edge/mediapipe/solutions/genai/rag)  
13. [https://cloud.google.com/vertex-ai/generative-ai/docs/long-context](https://cloud.google.com/vertex-ai/generative-ai/docs/long-context)  
14. [https://ai.google.dev/gemini-api/docs/long-context](https://ai.google.dev/gemini-api/docs/long-context)  
15. [https://ai.google.dev/gemini-api/docs/caching](https://ai.google.dev/gemini-api/docs/caching)  
16. [https://chariotsolutions.com/blog/post/client-side-data-persistence-with-indexeddb/](https://chariotsolutions.com/blog/post/client-side-data-persistence-with-indexeddb/)  
17. [https://cloud.google.com/vertex-ai/generative-ai/docs/chat/chat-prompts](https://cloud.google.com/vertex-ai/generative-ai/docs/chat/chat-prompts)  
18. [https://firebase.google.com/docs/ai-logic/chat](https://firebase.google.com/docs/ai-logic/chat)  
19. [https://github.com/vinodvpillai/persistent-ai-chatbot-with-postgresql](https://github.com/vinodvpillai/persistent-ai-chatbot-with-postgresql)  
20. [https://googleapis.github.io/python-genai/](https://googleapis.github.io/python-genai/)  
21. [https://workspaceupdates.googleblog.com/2025/05/pre-configure-the-gemini-app-conversation-history-admin-setting.html?m=1](https://workspaceupdates.googleblog.com/2025/05/pre-configure-the-gemini-app-conversation-history-admin-setting.html?m=1)  
22. [https://stackoverflow.com/questions/77758177/how-can-i-send-files-to-googles-gemini-models-via-api-call](https://stackoverflow.com/questions/77758177/how-can-i-send-files-to-googles-gemini-models-via-api-call)  
23. [https://ai.google.dev/gemini-api/docs/text-generation](https://ai.google.dev/gemini-api/docs/text-generation)  
24. [https://stackoverflow.com/questions/77307383/uploading-file-directly-to-google-cloud-document-ai](https://stackoverflow.com/questions/77307383/uploading-file-directly-to-google-cloud-document-ai)  
25. [https://workspaceupdates.googleblog.com/2025/05/pre-configure-the-gemini-app-conversation-history-admin-setting.html](https://workspaceupdates.googleblog.com/2025/05/pre-configure-the-gemini-app-conversation-history-admin-setting.html)  
26. [https://www.youtube.com/watch?v=Gvv9fMzfzwY](https://www.youtube.com/watch?v=Gvv9fMzfzwY)  
27. [https://techcrunch.com/2024/02/08/google-saves-your-conversations-with-gemini-for-years-by-default/](https://techcrunch.com/2024/02/08/google-saves-your-conversations-with-gemini-for-years-by-default/)  
28. [https://discuss.ai.google.dev/t/how-to-upload-files-with-media-upload-in-rest-api/6904](https://discuss.ai.google.dev/t/how-to-upload-files-with-media-upload-in-rest-api/6904)  
29. [https://wikidocs.net/229763](https://wikidocs.net/229763)  
30. [https://discuss.ai.google.dev/t/merging-search-history-into-conversations-in-google-gen-ai-sdk/65342](https://discuss.ai.google.dev/t/merging-search-history-into-conversations-in-google-gen-ai-sdk/65342)  
31. [https://ai.google.dev/api/files](https://ai.google.dev/api/files)  
32. [https://www.googlecloudcommunity.com/gc/AI-ML/Conversation-context-in-google-generativeai-chat/td-p/667188](https://www.googlecloudcommunity.com/gc/AI-ML/Conversation-context-in-google-generativeai-chat/td-p/667188)  
33. [https://ai-sdk.dev/docs/ai-sdk-rsc/generative-ui-state](https://ai-sdk.dev/docs/ai-sdk-rsc/generative-ui-state)  
34. [https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/multimodal-live](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/multimodal-live)  
35. [https://ai.google.dev/gemini-api/docs/function-calling?lang=android](https://ai.google.dev/gemini-api/docs/function-calling?lang=android)  
36. [https://google.github.io/adk-docs/sessions/state/](https://google.github.io/adk-docs/sessions/state/)  
37. [https://cloud.google.com/vertex-ai/generative-ai/docs/live-api/streamed-conversations](https://cloud.google.com/vertex-ai/generative-ai/docs/live-api/streamed-conversations)  
38. [https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling)  
39. [https://www.youtube.com/watch?v=z8Q3qLi9m78](https://www.youtube.com/watch?v=z8Q3qLi9m78)  
40. [https://ai.google.dev/gemini-api/docs/live](https://ai.google.dev/gemini-api/docs/live)  
41. [https://ai.google.dev/gemini-api/docs/function-calling](https://ai.google.dev/gemini-api/docs/function-calling)  
42. [https://developers.google.com/blockly/guides/configure/web/serialization](https://developers.google.com/blockly/guides/configure/web/serialization)  
43. [https://www.youtube.com/watch?v=yqiWlZtPY5M](https://www.youtube.com/watch?v=yqiWlZtPY5M)  
44. [https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)  
45. [https://cloud.google.com/vertex-ai/generative-ai/docs/sdks/overview](https://cloud.google.com/vertex-ai/generative-ai/docs/sdks/overview)  
46. [https://cloud.google.com/vertex-ai/generative-ai/docs/live-api?authuser=2](https://cloud.google.com/vertex-ai/generative-ai/docs/live-api?authuser=2)  
47. [https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/function-calling](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/function-calling)  
48. [https://cloud.google.com/vertex-ai/generative-ai/docs/deprecations/genai-vertexai-sdk](https://cloud.google.com/vertex-ai/generative-ai/docs/deprecations/genai-vertexai-sdk)  
49. [https://sdk.vercel.ai/docs/api-reference/google-generative-ai-stream](https://sdk.vercel.ai/docs/api-reference/google-generative-ai-stream)  
50. [https://ai.google.dev/edge/mediapipe/solutions/genai/function\_calling](https://ai.google.dev/edge/mediapipe/solutions/genai/function_calling)  
51. [https://stackoverflow.com/questions/75899239/data-saved-in-indexeddb-is-not-persisted](https://stackoverflow.com/questions/75899239/data-saved-in-indexeddb-is-not-persisted)  
52. [https://www.googlecloudcommunity.com/gc/Developer-Tools/Sachin-Duggal-API-Rate-Limits-and-Token-Usage-for-Deploying/m-p/850301](https://www.googlecloudcommunity.com/gc/Developer-Tools/Sachin-Duggal-API-Rate-Limits-and-Token-Usage-for-Deploying/m-p/850301)  
53. [https://cloud.google.com/use-cases/retrieval-augmented-generation](https://cloud.google.com/use-cases/retrieval-augmented-generation)  
54. [https://stackoverflow.com/questions/15816784/persistence-lifetime/73300812](https://stackoverflow.com/questions/15816784/persistence-lifetime/73300812)  
55. [https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/list-token](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/list-token)  
56. [https://cloud.google.com/vertex-ai/generative-ai/docs/rag-engine/rag-overview](https://cloud.google.com/vertex-ai/generative-ai/docs/rag-engine/rag-overview)  
57. [https://gist.github.com/Deeptanshu-sankhwar/0edc620709df7552c598365d36a30fec](https://gist.github.com/Deeptanshu-sankhwar/0edc620709df7552c598365d36a30fec)  
58. [https://ai.google.dev/api/tokens](https://ai.google.dev/api/tokens)  
59. [https://firebase.google.com/docs/genkit/rag](https://firebase.google.com/docs/genkit/rag)  
60. [https://web.dev/articles/indexeddb-best-practices-app-state](https://web.dev/articles/indexeddb-best-practices-app-state)  
61. [https://www.aubergine.co/insights/mastering-openai-chatgpt-api-expert-tips-for-streamlining-token-usage-in-contextual-conversations](https://www.aubergine.co/insights/mastering-openai-chatgpt-api-expert-tips-for-streamlining-token-usage-in-contextual-conversations)  
62. [https://ai.google.dev/edge/mediapipe/solutions/genai/rag/android](https://ai.google.dev/edge/mediapipe/solutions/genai/rag/android)  
63. [https://developer.chrome.com/docs/ai/cache-models](https://developer.chrome.com/docs/ai/cache-models)  
64. [https://developers.googleblog.com/en/vertex-ai-rag-engine-a-developers-tool/](https://developers.googleblog.com/en/vertex-ai-rag-engine-a-developers-tool/)  
65. [https://ai.google.dev/gemini-api/docs/tokens](https://ai.google.dev/gemini-api/docs/tokens)  
66. [https://ai.google.dev/edge/mediapipe/solutions/genai/rag?hl=it](https://ai.google.dev/edge/mediapipe/solutions/genai/rag?hl=it)  
67. [https://blog.google/technology/health/google-generative-ai-healthcare/](https://blog.google/technology/health/google-generative-ai-healthcare/)  
68. [https://googlecloudplatform.github.io/applied-ai-engineering-samples/genai-on-vertex-ai/gemini/prompting\_recipes/long\_context\_window/gemini\_long\_context\_text/](https://googlecloudplatform.github.io/applied-ai-engineering-samples/genai-on-vertex-ai/gemini/prompting_recipes/long_context_window/gemini_long_context_text/)  
69. [https://medcitynews.com/2023/12/google-generative-ai-healthcare/](https://medcitynews.com/2023/12/google-generative-ai-healthcare/)  
70. [https://www.youtube.com/watch?v=NHMJ9mqKeMQ](https://www.youtube.com/watch?v=NHMJ9mqKeMQ)  
71. [https://siliconangle.com/2024/03/12/google-cloud-rolls-new-generative-ai-tools-healthcare-life-sciences/](https://siliconangle.com/2024/03/12/google-cloud-rolls-new-generative-ai-tools-healthcare-life-sciences/)  
72. [https://github.com/googleapis/python-genai](https://github.com/googleapis/python-genai)  
73. [https://ai.google.dev/competition/projects/medical-ai-assistant](https://ai.google.dev/competition/projects/medical-ai-assistant)  
74. [https://community.openai.com/t/handling-long-conversations-with-context-management/614212](https://community.openai.com/t/handling-long-conversations-with-context-management/614212)  
75. [https://blog.google/products/google-cloud/himss-2025/](https://blog.google/products/google-cloud/himss-2025/)  
76. [https://www.googlecloudcommunity.com/gc/AI-ML/Conversation-context-in-google-generativeai-chat/m-p/667188](https://www.googlecloudcommunity.com/gc/AI-ML/Conversation-context-in-google-generativeai-chat/m-p/667188)  
77. [https://ai.google.dev/gemini-api/docs/migrate?hl=fr](https://ai.google.dev/gemini-api/docs/migrate?hl=fr)  
78. [https://www.fiercehealthcare.com/ai-and-machine-learning/himss24-google-cloud-builds-out-generative-ai-solutions-aid-healthcare](https://www.fiercehealthcare.com/ai-and-machine-learning/himss24-google-cloud-builds-out-generative-ai-solutions-aid-healthcare)  
79. [https://pub.dev/documentation/firebase\_vertexai/latest/firebase\_vertexai/ChatSession-class.html](https://pub.dev/documentation/firebase_vertexai/latest/firebase_vertexai/ChatSession-class.html)  
80. [https://googleapis.github.io/js-genai/release\_docs/classes/chats.Chats.html](https://googleapis.github.io/js-genai/release_docs/classes/chats.Chats.html)  
81. [https://github.com/googleapis/js-genai/blob/main/sdk-samples/chats.ts](https://github.com/googleapis/js-genai/blob/main/sdk-samples/chats.ts)  
82. [https://github.com/googleapis/js-genai/blob/main/sdk-samples/chat\_afc.ts](https://github.com/googleapis/js-genai/blob/main/sdk-samples/chat_afc.ts)  
83. [https://googleapis.github.io/js-genai/release\_docs/interfaces/types.Content.html](https://googleapis.github.io/js-genai/release_docs/interfaces/types.Content.html)  
84. [https://googleapis.github.io/js-genai/release\_docs/modules/types.html](https://googleapis.github.io/js-genai/release_docs/modules/types.html)  
85. [https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/get-token-count](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/get-token-count)

