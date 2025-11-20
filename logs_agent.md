🖥️ [getStorageAdapter] Running on SERVER - storage mode: mongodb
♻️ [getStorageAdapter] Reusing existing ServerStorageAdapter instance (Singleton Global)   
🔧 [HopeAISystem] Creating intent router...
✅ [HopeAISystem] Intent router created
🔧 [HopeAISystem] Creating dynamic orchestrator...
✅ [HopeAISystem] Dynamic orchestrator created
✅ [HopeAISystem] Storage adapter obtained: ServerStorageAdapter
🔧 [HopeAISystem] Calling storage.initialize()...
🔧 [ServerStorageAdapter] initialize() called
✅ [ServerStorageAdapter] Already initialized, skipping
✅ [HopeAISystem] Storage initialized successfully
✅ [HopeAISystem] PARALLEL initialization completed in 11ms
✅ [Prewarm] HopeAI system pre-warmed successfully in 12ms
🖥️ [API /send-message] POST request received on SERVER
🖥️ [API /send-message] Environment: { hasWindow: false, nodeEnv: 'development' }
🔄 [API /send-message] Enviando mensaje con sistema optimizado... {
  sessionId: 'sess_1763215270198_h7r2z3',
  message: 'Quiero documentar un caso, ayudame a encontrar dif...',
  useStreaming: true,
  userId: '3b608903-40fb-43c2-acee-4b9ae2ca5f93',
  suggestedAgent: undefined,
  patientReference: 'None'
}
🔧 [API /send-message] Getting global orchestration system...
✅ [API /send-message] Orchestration system obtained in 1ms
💾 🔍 [STORAGE] loadChatSession called | Context: {"sessionId":"sess_1763215270198_h7r2z3"}
 GET / 200 in 7618ms
[HopeAI] Creating new session: sess_1763215270198_h7r2z3
💾 🔍 [STORAGE] loadChatSession called | Context: {"sessionId":"sess_1763215270198_h7r2z3"}
 ✓ Compiled in 1ms (11641 modules)
📝 Creando nueva sesión: sess_1763215270198_h7r2z3
💾 🔍 [STORAGE] saveChatSession called | Context: {"sessionId":"sess_1763215270198_h7r2z3","userId":"3b608903-40fb-43c2-acee-4b9ae2ca5f93"}
 ✓ Compiled in 0ms (11641 modules)
💾 🔍 [STORAGE] Upsert result | Context: {"matchedCount":0,"modifiedCount":0,"upsertedId":"691887b1c42003c814497fc5"}
 ✓ Compiled in 0ms (11641 modules)
[dotenv@17.2.3] injecting env (0) from .env -- tip: 🗂️ backup and recover secrets: https:///dotenvx.com/ops
[GenAI Config] Usando credenciales desde GOOGLE_SERVICE_ACCOUNT_*
The user provided Google Cloud credentials will take precedence over the API key from the environment variable.
[ParallelAI] Cliente inicializado correctamente
⏰ [ClinicalAgentRouter] Automatic cleanup started (interval: 5 minutes)
🔍 API: Retrieving documents for session: sess_1763215270198_h7r2z3
🚀 [HopeAISystem] initialize() called { isServer: true }
🔧 [HopeAISystem] Starting PARALLEL initialization...
🔧 [HopeAISystem] Getting storage adapter...
🔍 [getStorageAdapter] Environment check: {
  isServer: true,
  hasWindow: false,
  nodeEnv: 'development',
  storageMode: 'mongodb'
}
🖥️ [getStorageAdapter] Running on SERVER - storage mode: mongodb
♻️ [getStorageAdapter] Reusing existing ServerStorageAdapter instance (Singleton Global)   
🔧 [HopeAISystem] Creating intent router...
✅ [HopeAISystem] Intent router created
🔧 [HopeAISystem] Creating dynamic orchestrator...
✅ [HopeAISystem] Dynamic orchestrator created
✅ [HopeAISystem] Storage adapter obtained: ServerStorageAdapter
🔧 [HopeAISystem] Calling storage.initialize()...
🔧 [ServerStorageAdapter] initialize() called
✅ [ServerStorageAdapter] Already initialized, skipping
✅ [HopeAISystem] Storage initialized successfully
✅ [HopeAISystem] PARALLEL initialization completed in 4ms
📋 [OPTIMIZED] Getting pending files for session: sess_1763215270198_h7r2z3
💾 ℹ️ [STORAGE] Chat session saved and verified | Context: {"sessionId":"sess_17632152701988_h7r2z3","userId":"3b608903-40fb-43c2-acee-4b9ae2ca5f93"}
💾 Chat session saved: sess_1763215270198_h7r2z3
[HopeAI] Agent router session opened for sess_1763215270198_h7r2z3 with agent socratico    
📋 [OPTIMIZED] Getting pending files for session: sess_1763215270198_h7r2z3
 GET / 200 in 6520ms
📋 [OPTIMIZED] Found 0 truly pending files for session sess_1763215270198_h7r2z3 (0 total, 0 already sent)
✅ API: Retrieved documents: 0
 GET /api/documents?sessionId=sess_1763215270198_h7r2z3 200 in 9326ms
📋 [OPTIMIZED] Found 0 truly pending files for session sess_1763215270198_h7r2z3 (0 total, 0 already sent)
🔄 Context Window Processing:
   - Original messages: 0
   - Processed messages: 0
   - Estimated tokens: 0
   - Contextual references: 0
   - Processing time: 0ms
🔄 [HopeAI] Context Window Applied: {
  originalMessages: 0,
  optimizedMessages: 0,
  estimatedTokens: 0,
  compressionApplied: false,
  hasFiles: false
}
🏥 [HopeAI] SessionMeta received: {
  hasSessionMeta: true,
  patientReference: 'None',
  sessionId: 'sess_1763215270198_h7r2z3'
}
[HopeAI] Collecting operational metadata
📊 [HopeAI] Operational metadata collected: {
  session_duration_minutes: 0,
  time_of_day: 'morning',
  region: 'LATAM',
  risk_level: 'low',
  risk_flags_count: 0,
  consecutive_switches: 0,
  therapeutic_phase: null,
  session_count: 0
}
[HopeAI] 🧠 Using Advanced Orchestration with cross-session learning
[DynamicOrchestrator:INFO] Iniciando orquestación para sesión sess_1763215270198_h7r2z3    
🔄 Context Window Processing:
   - Original messages: 1
   - Processed messages: 1
   - Estimated tokens: 20
   - Contextual references: 0
   - Processing time: 1ms
⚠️ No se recibieron function calls en la respuesta combinada
[DynamicOrchestrator:INFO] Generando bullets progresivos para sesión con contexto
[DynamicOrchestrator:INFO] 🧷 Generación de bullets lanzada en paralelo (no bloquea streaming)
[DynamicOrchestrator:INFO] Orquestación completada: socratico con 2 herramientas
[HopeAI] 🎯 Advanced orchestration result: {
  selectedAgent: 'socratico',
  confidence: 0.5,
  toolsSelected: 2,
  hasRecommendations: false
}
🎯 [API /send-message] Agente seleccionado: socratico
📝 [HopeAI] Mensaje del usuario agregado al historial: {
  historyLength: 1,
  userMessageId: 'msg_1763215323406_ctq46bo2o',
  userMessageContent: 'Quiero documentar un caso, ayudame a encontrar dif'
}
[HopeAI] SessionMeta patient reference: None
📊 [ClinicalRouter] Operational metadata included in message
🟢 [ClinicalRouter] Subsequent turn detected: Using LIGHTWEIGHT file references (saves ~60k tokens)
[ClinicalRouter] ✅ Added lightweight file context (~0 chars vs ~60k tokens)
[dotenv@17.2.3] injecting env (0) from .env -- tip: 🔐 prevent committing .env to code: https://dotenvx.com/precommit
[GenAI Config] Usando credenciales desde GOOGLE_SERVICE_ACCOUNT_*
The user provided Google Cloud credentials will take precedence over the API key from the environment variable.
[ParallelAI] Cliente inicializado correctamente
⏰ [ClinicalAgentRouter] Automatic cleanup started (interval: 5 minutes)
🔍 API: Retrieving documents for session: sess_1763215270198_h7r2z3
🚀 [HopeAISystem] initialize() called { isServer: true }
🔧 [HopeAISystem] Starting PARALLEL initialization...
🔧 [HopeAISystem] Getting storage adapter...
🔍 [getStorageAdapter] Environment check: {
  isServer: true,
  hasWindow: false,
  nodeEnv: 'development',
  storageMode: 'mongodb'
}
🖥️ [getStorageAdapter] Running on SERVER - storage mode: mongodb
♻️ [getStorageAdapter] Reusing existing ServerStorageAdapter instance (Singleton Global)   
🔧 [HopeAISystem] Creating intent router...
✅ [HopeAISystem] Intent router created
🔧 [HopeAISystem] Creating dynamic orchestrator...
✅ [HopeAISystem] Dynamic orchestrator created
✅ [HopeAISystem] Storage adapter obtained: ServerStorageAdapter
🔧 [HopeAISystem] Calling storage.initialize()...
🔧 [ServerStorageAdapter] initialize() called
✅ [ServerStorageAdapter] Already initialized, skipping
✅ [HopeAISystem] Storage initialized successfully
✅ [HopeAISystem] PARALLEL initialization completed in 3ms
📋 [OPTIMIZED] Getting pending files for session: sess_1763215270198_h7r2z3
📋 [OPTIMIZED] Found 0 truly pending files for session sess_1763215270198_h7r2z3 (0 total, 0 already sent)
✅ API: Retrieved documents: 0
 GET /api/documents?sessionId=sess_1763215270198_h7r2z3 200 in 454ms
🎯 [API /send-message] Bullet emitido: Me pregunto qué tipo de estructuración busca el ps...
🎯 [API /send-message] Bullet emitido: Podría ser útil explorar qué elementos específicos...
🎯 [API /send-message] Bullet emitido: Quizás el psicólogo está buscando un marco teórico...
🎯 [API /send-message] Bullet emitido: Considero si la herramienta `formulate_clarifying_...
🎯 [API /send-message] Bullet emitido: Parece que el objetivo es encontrar un método de d...
[DynamicOrchestrator:INFO] Bullets progresivos generados: 5 bullets en 2388ms
💾 🔍 [STORAGE] loadChatSession called | Context: {"sessionId":"sess_1763215270198_h7r2z3"}
💾 ℹ️ [STORAGE] Chat session loaded | Context: {"sessionId":"sess_1763215270198_h7r2z3"}
⚠️ Sesión ya existe, actualizando: sess_1763215270198_h7r2z3
💾 🔍 [STORAGE] saveChatSession called | Context: {"sessionId":"sess_1763215270198_h7r2z3","userId":"3b608903-40fb-43c2-acee-4b9ae2ca5f93"}
💾 🔍 [STORAGE] Upsert result | Context: {"matchedCount":1,"modifiedCount":1,"upsertedId":null}
💾 ℹ️ [STORAGE] Chat session saved and verified | Context: {"sessionId":"sess_17632152701988_h7r2z3","userId":"3b608903-40fb-43c2-acee-4b9ae2ca5f93"}
💾 Chat session saved: sess_1763215270198_h7r2z3
💾 [HopeAI] Estado guardado en DB con mensaje del usuario: { sessionId: 'sess_1763215270198_h7r2z3', historyLength: 1 }
🎉 [SessionMetrics] Streaming interaction setup completed: sess_1763215270198_h7r2z3 | Metrics will be captured on stream completion
🎯 [API /send-message] Orquestación completada: {
  sessionId: 'sess_1763215270198_h7r2z3',
  agentType: 'socratico',
  responseLength: 0,
  responseKeys: [ 'routingInfo' ],
  hasText: false,
  hasRoutingInfo: true,
  isAsyncIterator: true
}
🌊 [API /send-message] Procesando respuesta streaming...
📝 [API /send-message] Chunk #1 recibido (236 chars): "Claro. Una buena estructura es la base de una docu..."
✅ [API /send-message] Chunk #1 enviado vía SSE
📝 [API /send-message] Chunk #2 recibido (232 chars): " la complejidad del caso.

Aquí tienes una compara..."
✅ [API /send-message] Chunk #2 enviado vía SSE
📝 [API /send-message] Chunk #3 recibido (205 chars): " | **S**ubjetivo, **O**bjetivo, **A**nálisis, **P*..."
✅ [API /send-message] Chunk #3 enviado vía SSE
📝 [API /send-message] Chunk #4 recibido (221 chars): "ponentes, **P**recipitantes, **P**erpetuadores, **..."
✅ [API /send-message] Chunk #4 enviado vía SSE
📝 [API /send-message] Chunk #5 recibido (208 chars): " del paciente, plan. |

Para empezar, ¿qué tipo de..."
✅ [API /send-message] Chunk #5 enviado vía SSE
📊 [ClinicalRouter] Stream with tools complete - interactionId: sess_1763215270198_h7r2z3_1763215280297_8imdvkies, finalResponse exists: true, accumulated text length: 1102
📊 [SessionMetrics] recordModelCallComplete - ID: sess_1763215270198_h7r2z3_1763215280297_8imdvkies
📊 [SessionMetrics] Input: 5086, Output: 282, Total: 5368
📊 [SessionMetrics] Model: gemini-2.5-pro, Cost: $0.002231
📊 [ClinicalRouter] Streaming with tools - Token usage - Input: 5086, Output: 282, Total: 5495
📊 [SessionMetrics] completeInteraction - ID: sess_1763215270198_h7r2z3_1763215280297_8imdvkies, Session: sess_1763215270198_h7r2z3
📊 [SessionMetrics] Tokens: 5368, Cost: $0.002231
📊 [SessionMetrics] Time: 54105ms, Agent: socratico
📊 [SessionMetrics] Created new interaction array for session sess_1763215270198_h7r2z3    
📊 [SessionMetrics] Added interaction to session. Total interactions now: 1
📊 [SessionMetrics] Updating snapshot for session sess_1763215270198_h7r2z3
📊 [SessionMetrics] Total interactions in session: 1
📊 [SessionMetrics] Last interaction tokens: 5368, cost: $0.0022308
📊 [SessionMetrics] Calculated totals - Tokens: 5368, Cost: $0.0022308, Time: 54105ms      
✅ [ClinicalRouter] Streaming with tools interaction completed - Cost: $0.002231, Tokens: 5368, Time: 54105ms
✅ [API /send-message] Streaming completado: 5 chunks, 1102 caracteres
✅ [API /send-message] Stream completado exitosamente
 POST /api/send-message 200 in 64061ms