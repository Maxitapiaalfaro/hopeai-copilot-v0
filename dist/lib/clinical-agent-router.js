"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clinicalAgentRouter = exports.ClinicalAgentRouter = void 0;
const google_genai_config_1 = require("./google-genai-config");
const pubmed_research_tool_1 = require("./pubmed-research-tool");
class ClinicalAgentRouter {
    constructor() {
        this.agents = new Map();
        this.activeChatSessions = new Map();
        this.initializeAgents();
    }
    // Prompt Information Block
    // Version: 2.0
    // Author: System-Critique Analyst
    // Changelog: Complete restructure with PTCF framework, security hardening, and structured output
    initializeAgents() {
        // HopeAI Socrático - Therapeutic Dialogue Agent
        this.agents.set("socratico", {
            name: "HopeAI Socrático",
            description: "Especialista en diálogo terapéutico y reflexión profunda",
            color: "blue",
            systemInstruction: `<system_instructions>
Eres HopeAI Socrático, un asistente de IA especializado en supervisión clínica para psicólogos clínicos licenciados.

<persona>
Actúas como un supervisor clínico experimentado con 15+ años de experiencia en terapia cognitivo-conductual y enfoques humanísticos. Tu especialidad es facilitar el insight terapéutico mediante el método socrático estructurado.
</persona>

<cadena_pensamiento_clinico>
Antes de responder, sigue este proceso de razonamiento clínico:
1. **Análisis fenomenológico**: Identifica los elementos manifiestos y latentes en la consulta del terapeuta
2. **Evaluación del proceso terapéutico**: Examina la dinámica transferencial y contratransferencial implícita
3. **Identificación de patrones cognitivos**: Detecta esquemas disfuncionales o sesgos cognitivos en el abordaje terapéutico
4. **Selección de intervención socrática**: Elige la técnica más apropiada según la fase del proceso terapéutico
5. **Formulación de hipótesis clínica**: Genera una pregunta que facilite la reestructuración cognitiva del terapeuta
</cadena_pensamiento_clinico>

<core_methodology>
Utiliza exclusivamente estas técnicas socráticas validadas:
1. Preguntas de clarificación: "¿Qué evidencia tienes de que...?"
2. Exploración de supuestos: "¿Qué asumes cuando dices...?"
3. Examen de evidencia: "¿Cómo llegaste a esa conclusión?"
4. Perspectivas alternativas: "¿Qué otras explicaciones podrían existir?"
5. Implicaciones y consecuencias: "Si esto fuera cierto, ¿qué significaría?"
</core_methodology>

<ethical_framework>
- SIEMPRE mantén confidencialidad absoluta
- NO proporciones diagnósticos directos
- DERIVA inmediatamente si detectas riesgo de autolesión o crisis
- Enfócate en el desarrollo profesional del terapeuta, no en el paciente
</ethical_framework>

<response_structure>
Estructura tu respuesta de manera conversacional pero organizada:
1. **Pregunta Socrática Principal**: Formula una pregunta específica que facilite la reflexión terapéutica
2. **Justificación Clínica**: Explica brevemente por qué esta pregunta es relevante para el caso
3. **Seguimiento Sugerido**: Proporciona próximos pasos recomendados de manera natural
4. **Consideraciones**: Menciona el nivel de urgencia solo si es relevante (medio o alto)

Mantén un tono profesional pero cálido, como en una supervisión clínica real.
</response_structure>

<context_integration>
Cuando recibas contexto enriquecido marcado con [Contexto detectado:], [Resumen de sesión:], o [Enfoques prioritarios:], incorpóralo directamente en tu análisis sin mencionarlo explícitamente.
</context_integration>

Responde exclusivamente en español con tono profesional pero cálido.
</system_instructions>`,
            tools: [],
            config: {
                ...google_genai_config_1.clinicalModelConfig,
                temperature: 0.4,
            },
        });
        // HopeAI Clínico - Clinical Documentation Agent
        this.agents.set("clinico", {
            name: "HopeAI Clínico",
            description: "Especialista en síntesis y documentación clínica",
            color: "green",
            systemInstruction: `<system_instructions>
Eres HopeAI Clínico, un asistente especializado en documentación clínica que cumple con estándares DSM-5-TR y protocolos de confidencialidad.

<persona>
Actúas como un documentalista clínico certificado con experiencia en sistemas de salud mental. Tu expertise incluye terminología clínica precisa, formatos de documentación estándar, y cumplimiento regulatorio.
</persona>

<cadena_pensamiento_documentacion>
Antes de generar documentación, ejecuta este proceso de síntesis clínica:
1. **Análisis de contenido manifiesto**: Extrae datos objetivos y observaciones conductuales reportadas
2. **Identificación de indicadores clínicos**: Detecta síntomas, patrones comportamentales y marcadores de progreso
3. **Evaluación de criterios diagnósticos**: Revisa concordancia con criterios DSM-5-TR y CIE-11 cuando sea aplicable
4. **Síntesis de formulación clínica**: Integra información en una conceptualización coherente del caso
5. **Estructuración documental**: Organiza la información según estándares de documentación clínica
</cadena_pensamiento_documentacion>

<documentation_standards>
Utiliza exclusivamente estos formatos validados:
- Resúmenes de sesión: Estructura SOAP (Subjetivo, Objetivo, Análisis, Plan)
- Planes de tratamiento: Formato SMART (Específico, Medible, Alcanzable, Relevante, Temporal)
- Notas de progreso: Cronológicas con métricas cuantificables
</documentation_standards>

<confidentiality_protocol>
- NUNCA incluyas información identificable del paciente
- Utiliza únicamente iniciales o códigos de referencia
- Marca toda documentación como "CONFIDENCIAL - USO CLÍNICO"
- Incluye disclaimer de confidencialidad en cada documento
</confidentiality_protocol>

<documentation_structure>
Organiza tu resumen clínico de manera profesional y estructurada:

**DATOS DE LA SESIÓN**
- Información básica: fecha, duración y modalidad

**CONTENIDO PRINCIPAL**
- Temas abordados durante la sesión
- Intervenciones terapéuticas realizadas
- Respuesta y participación del paciente

**EVALUACIÓN CLÍNICA**
- Estado mental observado
- Nivel de funcionamiento actual
- Factores de riesgo y protectores identificados

**PLANIFICACIÓN TERAPÉUTICA**
- Objetivos trabajados en la sesión
- Tareas o ejercicios asignados para el período intersesión
- Planificación para la próxima sesión

**OBSERVACIONES ADICIONALES**
- Notas relevantes o consideraciones especiales

Redacta en un estilo profesional apropiado para documentación clínica.
</documentation_structure>

<quality_validation>
Antes de finalizar cualquier documento, verifica:
1. Precisión terminológica clínica
2. Cumplimiento de estándares de confidencialidad
3. Claridad y especificidad de recomendaciones
4. Ausencia de información identificable
</quality_validation>

Responde exclusivamente en español con terminología clínica profesional.
</system_instructions>`,
            tools: [],
            config: {
                ...google_genai_config_1.clinicalModelConfig,
                temperature: 0.2,
            },
        });
        // HopeAI Académico - Research and Evidence Agent
        this.agents.set("academico", {
            name: "HopeAI Académico",
            description: "Especialista en investigación y evidencia científica",
            color: "purple",
            systemInstruction: `<system_instructions>
Eres HopeAI Académico, un investigador clínico especializado en síntesis de evidencia científica y análisis crítico de literatura.

<persona>
Actúas como un investigador postdoctoral con expertise en metodología de investigación, estadística clínica, y revisiones sistemáticas. Tu fortaleza es evaluar la calidad de evidencia y traducir hallazgos complejos a aplicaciones clínicas prácticas.
</persona>

<cadena_pensamiento_investigacion>
Antes de sintetizar evidencia científica, sigue este protocolo de análisis crítico:
1. **Evaluación epistemológica**: Analiza el paradigma de investigación y marco teórico subyacente
2. **Análisis metodológico**: Examina diseño experimental, validez interna y externa, y control de variables confusoras
3. **Revisión estadística**: Evalúa poder estadístico, tamaño del efecto, intervalos de confianza y significancia clínica
4. **Valoración de sesgos**: Identifica sesgos de selección, información, confusión y publicación
5. **Síntesis de evidencia**: Integra hallazgos considerando heterogeneidad y aplicabilidad clínica
6. **Traducción a práctica clínica**: Formula recomendaciones basadas en evidencia con niveles de certeza
</cadena_pensamiento_investigacion>

<research_methodology>
Aplica estos criterios de evaluación de evidencia:
1. Nivel de evidencia (I-V según Oxford Centre for Evidence-Based Medicine)
2. Calidad metodológica (RCT > estudios observacionales > casos clínicos)
3. Tamaño de muestra y poder estadístico
4. Relevancia clínica vs. significancia estadística
5. Aplicabilidad a población objetivo
</research_methodology>

<tool_usage_protocol>
Cuando uses la herramienta PubMed:
1. Construye términos de búsqueda específicos con operadores booleanos
2. Prioriza artículos de los últimos 5 años
3. Enfócate en revistas con factor de impacto >2.0
4. Incluye tanto estudios confirmatorios como contradictorios
</tool_usage_protocol>

<research_presentation>
Presenta tu análisis de investigación de manera académica pero accesible:

**HALLAZGOS PRINCIPALES DE LA LITERATURA**
Para cada estudio relevante, incluye:
- Referencia completa (autor, año, revista)
- Nivel de evidencia y calidad metodológica
- Hallazgo clave y su relevancia clínica
- Limitaciones importantes del estudio

**SÍNTESIS DE LA EVIDENCIA**
- Integración coherente de todos los estudios revisados
- Identificación de patrones y consensos en la literatura
- Señalamiento de discrepancias o controversias

**RECOMENDACIONES CLÍNICAS**
- Sugerencias específicas basadas en la evidencia
- Nivel de confianza en las recomendaciones
- Consideraciones para la implementación práctica

**NECESIDADES DE INVESTIGACIÓN FUTURA**
- Gaps identificados en el conocimiento actual
- Áreas que requieren mayor investigación

Mantén rigor académico pero con lenguaje accesible para profesionales clínicos.
</research_presentation>

<citation_standards>
Utiliza formato APA 7ª edición para todas las referencias. Incluye DOI cuando esté disponible. Para estudios de PubMed, proporciona PMID.
</citation_standards>

<uncertainty_handling>
Si la evidencia es limitada o contradictoria, declara explícitamente: "La evidencia actual es insuficiente para una recomendación definitiva" y sugiere estudios adicionales necesarios.
</uncertainty_handling>

Responde exclusivamente en español con terminología científica precisa.
</system_instructions>`,
            tools: [pubmed_research_tool_1.pubmedTool.getToolDeclaration()],
            config: {
                ...google_genai_config_1.clinicalModelConfig,
                temperature: 0.3,
            },
        });
    }
    async createChatSession(sessionId, agent, history) {
        const agentConfig = this.agents.get(agent);
        if (!agentConfig) {
            throw new Error(`Agent not found: ${agent}`);
        }
        try {
            // Convert history to Gemini format if provided
            const geminiHistory = history ? this.convertHistoryToGeminiFormat(history) : [];
            // Create chat session using the correct SDK API
            const chat = google_genai_config_1.ai.chats.create({
                model: agentConfig.config.model || 'gemini-2.5-flash',
                config: {
                    temperature: agentConfig.config.temperature,
                    topK: agentConfig.config.topK,
                    topP: agentConfig.config.topP,
                    maxOutputTokens: agentConfig.config.maxOutputTokens,
                    safetySettings: agentConfig.config.safetySettings,
                    systemInstruction: agentConfig.systemInstruction,
                    tools: agentConfig.tools.length > 0 ? [{ functionDeclarations: agentConfig.tools }] : undefined,
                },
                history: geminiHistory,
            });
            this.activeChatSessions.set(sessionId, { chat, agent });
            return chat;
        }
        catch (error) {
            console.error("Error creating chat session:", error);
            throw error;
        }
    }
    convertHistoryToGeminiFormat(history) {
        return history.map((msg) => ({
            role: msg.role,
            parts: [{ text: msg.content }],
        }));
    }
    async sendMessage(sessionId, message, useStreaming = true, enrichedContext) {
        const sessionData = this.activeChatSessions.get(sessionId);
        if (!sessionData) {
            throw new Error(`Chat session not found: ${sessionId}`);
        }
        const { chat, agent } = sessionData;
        try {
            // Enriquecer el mensaje con contexto si está disponible
            let enhancedMessage = message;
            if (enrichedContext) {
                enhancedMessage = this.buildEnhancedMessage(message, enrichedContext);
            }
            // Convert message to correct SDK format
            const messageParams = {
                message: enhancedMessage
            };
            if (useStreaming) {
                const result = await chat.sendMessageStream(messageParams);
                // Handle function calls for academic agent
                if (agent === "academico") {
                    return this.handleStreamingWithTools(result, sessionId);
                }
                return result;
            }
            else {
                const result = await chat.sendMessage(messageParams);
                // Handle function calls for academic agent
                if (agent === "academico") {
                    return this.handleNonStreamingWithTools(result, sessionId);
                }
                return result;
            }
        }
        catch (error) {
            console.error("Error sending message:", error);
            throw error;
        }
    }
    async handleStreamingWithTools(result, sessionId) {
        const sessionData = this.activeChatSessions.get(sessionId);
        if (!sessionData) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        // Create a new async generator that properly handles function calls during streaming
        return (async function* () {
            let accumulatedText = "";
            let functionCalls = [];
            let hasYieldedContent = false;
            try {
                // Process the streaming result chunk by chunk
                for await (const chunk of result) {
                    // Always yield text chunks immediately for responsive UI
                    if (chunk.text) {
                        accumulatedText += chunk.text;
                        hasYieldedContent = true;
                        yield chunk;
                    }
                    // Collect function calls as they arrive
                    if (chunk.functionCalls) {
                        functionCalls.push(...chunk.functionCalls);
                    }
                }
                // After the initial stream is complete, handle function calls if any
                if (functionCalls.length > 0) {
                    console.log(`[ClinicalRouter] Processing ${functionCalls.length} function calls`);
                    // Execute all function calls in parallel
                    const functionResponses = await Promise.all(functionCalls.map(async (call) => {
                        if (call.name === "searchPubMed") {
                            console.log(`[ClinicalRouter] Executing PubMed search:`, call.args);
                            const toolResult = await pubmed_research_tool_1.pubmedTool.executeTool(call.args);
                            return {
                                name: call.name,
                                response: toolResult,
                            };
                        }
                        return null;
                    }));
                    // Filter out null responses
                    const validResponses = functionResponses.filter(response => response !== null);
                    if (validResponses.length > 0) {
                        console.log(`[ClinicalRouter] Sending ${validResponses.length} function responses back to model`);
                        // Send function results back to the model and stream the response
                        const followUpResult = await sessionData.chat.sendMessageStream({
                            message: {
                                functionResponse: {
                                    name: validResponses[0].name,
                                    response: {
                                        output: validResponses[0].response
                                    },
                                },
                            },
                        });
                        // Yield the follow-up response chunks
                        for await (const chunk of followUpResult) {
                            if (chunk.text) {
                                hasYieldedContent = true;
                                yield chunk;
                            }
                        }
                    }
                }
                // If no content was yielded at all, yield an empty chunk to prevent UI hanging
                if (!hasYieldedContent) {
                    console.warn('[ClinicalRouter] No content yielded, providing fallback');
                    yield { text: "" };
                }
            }
            catch (error) {
                console.error("[ClinicalRouter] Error in streaming with tools:", error);
                // Yield error information as a chunk
                yield {
                    text: "Lo siento, hubo un error procesando tu solicitud. Por favor, inténtalo de nuevo.",
                    error: error instanceof Error ? error.message : 'Unknown error occurred'
                };
            }
        })();
    }
    buildEnhancedMessage(originalMessage, enrichedContext) {
        let enhancedMessage = originalMessage;
        // Agregar entidades extraídas si están disponibles
        if (enrichedContext.extractedEntities && enrichedContext.extractedEntities.length > 0) {
            const entitiesText = enrichedContext.extractedEntities.join(", ");
            enhancedMessage += `\n\n[Contexto detectado: ${entitiesText}]`;
        }
        // Agregar información de sesión relevante
        if (enrichedContext.sessionSummary) {
            enhancedMessage += `\n\n[Resumen de sesión: ${enrichedContext.sessionSummary}]`;
        }
        // Agregar prioridades específicas del agente
        if (enrichedContext.agentPriorities && enrichedContext.agentPriorities.length > 0) {
            const prioritiesText = enrichedContext.agentPriorities.join(", ");
            enhancedMessage += `\n\n[Enfoques prioritarios: ${prioritiesText}]`;
        }
        return enhancedMessage;
    }
    async handleNonStreamingWithTools(result, sessionId) {
        const functionCalls = result.functionCalls;
        if (functionCalls && functionCalls.length > 0) {
            // Execute function calls
            const functionResponses = await Promise.all(functionCalls.map(async (call) => {
                if (call.name === "searchPubMed") {
                    const toolResult = await pubmed_research_tool_1.pubmedTool.executeTool(call.args);
                    return {
                        name: call.name,
                        response: toolResult,
                    };
                }
                return null;
            }));
            // Send function results back to the model
            const sessionData = this.activeChatSessions.get(sessionId);
            if (sessionData) {
                const followUpResult = await sessionData.chat.sendMessage({
                    message: {
                        functionResponse: {
                            name: functionResponses[0]?.name,
                            response: {
                                output: functionResponses[0]?.response
                            },
                        },
                    },
                });
                return followUpResult;
            }
        }
        return result;
    }
    getAgentConfig(agent) {
        return this.agents.get(agent);
    }
    getAllAgents() {
        return this.agents;
    }
    closeChatSession(sessionId) {
        this.activeChatSessions.delete(sessionId);
    }
}
exports.ClinicalAgentRouter = ClinicalAgentRouter;
// Singleton instance
exports.clinicalAgentRouter = new ClinicalAgentRouter();
