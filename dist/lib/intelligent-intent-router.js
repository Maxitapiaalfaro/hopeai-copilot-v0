"use strict";
/**
 * Intelligent Intent Router - Fase 2A Implementation
 *
 * Orquestador de Intenciones Inteligente que utiliza las capacidades nativas
 * del SDK de Google GenAI para clasificación automática de intenciones y
 * enrutamiento semántico entre agentes especializados.
 *
 * @author Arquitecto Principal de Sistemas de IA (A-PSI)
 * @version 2.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelligentIntentRouter = void 0;
exports.createIntelligentIntentRouter = createIntelligentIntentRouter;
const genai_1 = require("@google/genai");
const google_genai_config_1 = require("./google-genai-config");
const entity_extraction_engine_1 = require("./entity-extraction-engine");
const tool_registry_1 = require("./tool-registry");
/**
 * Orquestador de Intenciones Inteligente
 *
 * Utiliza Function Calling del SDK de Google GenAI para:
 * - Clasificación automática de intenciones del usuario
 * - Extracción de entidades semánticas relevantes
 * - Enrutamiento transparente entre agentes especializados
 * - Manejo inteligente de casos edge y ambigüedades
 */
class IntelligentIntentRouter {
    constructor(agentRouter, config = {}) {
        // Funciones de clasificación de intenciones optimizadas
        this.intentFunctions = [
            {
                name: 'activar_modo_socratico',
                description: 'Activar cuando el usuario busca exploración reflexiva, cuestionamiento socrático, desarrollo de insight terapéutico, análisis de casos complejos, o necesita guidance en el proceso terapéutico. Ejemplos: "¿Cómo puedo ayudar a mi paciente a reflexionar?", "Necesito explorar más profundamente este caso", "¿Qué preguntas debería hacer?"',
                parametersJsonSchema: {
                    type: 'object',
                    properties: {
                        tema_exploracion: {
                            type: 'string',
                            description: 'Tema principal a explorar con el usuario (ej: resistencia del paciente, transferencia, insight terapéutico)'
                        },
                        nivel_profundidad: {
                            type: 'string',
                            enum: ['superficial', 'moderado', 'profundo'],
                            description: 'Nivel de profundidad requerido para la exploración socrática'
                        },
                        contexto_clinico: {
                            type: 'string',
                            description: 'Contexto clínico específico que requiere exploración (opcional)'
                        }
                    },
                    required: ['tema_exploracion', 'nivel_profundidad']
                }
            },
            {
                name: 'activar_modo_clinico',
                description: 'Activar para resúmenes de sesión, documentación clínica, estructuración de información, planes de tratamiento, evaluaciones de progreso, o cualquier tarea de documentación profesional. Ejemplos: "Necesito un resumen de esta sesión", "Ayúdame a documentar el progreso", "Estructura esta información clínica"',
                parametersJsonSchema: {
                    type: 'object',
                    properties: {
                        tipo_resumen: {
                            type: 'string',
                            enum: ['sesion', 'progreso', 'evaluacion', 'plan_tratamiento', 'documentacion_general'],
                            description: 'Tipo específico de resumen o documentación requerida'
                        },
                        elementos_clave: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Elementos específicos a incluir en el resumen (ej: objetivos, intervenciones, observaciones)'
                        },
                        formato_requerido: {
                            type: 'string',
                            enum: ['narrativo', 'estructurado', 'bullet_points', 'profesional'],
                            description: 'Formato preferido para la documentación'
                        }
                    },
                    required: ['tipo_resumen']
                }
            },
            {
                name: 'activar_modo_academico',
                description: 'Activar para búsqueda de investigación científica, evidencia empírica, consultas académicas, revisión de literatura, o cuando se necesita información basada en evidencia. Ejemplos: "¿Qué dice la investigación sobre EMDR?", "Busca estudios sobre terapia con veteranos", "Necesito evidencia científica"',
                parametersJsonSchema: {
                    type: 'object',
                    properties: {
                        terminos_busqueda: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Términos clave para la búsqueda académica (ej: EMDR, PTSD, cognitive therapy)'
                        },
                        poblacion_objetivo: {
                            type: 'string',
                            description: 'Población específica de interés (ej: veteranos, adolescentes, adultos mayores, trauma survivors)'
                        },
                        tecnica_terapeutica: {
                            type: 'string',
                            description: 'Técnica o intervención terapéutica específica (ej: CBT, EMDR, DBT, mindfulness)'
                        },
                        tipo_evidencia: {
                            type: 'string',
                            enum: ['meta_analisis', 'rct', 'estudios_caso', 'revisiones_sistematicas', 'cualquier'],
                            description: 'Tipo de evidencia científica preferida'
                        }
                    },
                    required: ['terminos_busqueda']
                }
            }
        ];
        this.ai = google_genai_config_1.ai; // Usar la instancia configurada del SDK unificado
        this.agentRouter = agentRouter;
        this.entityExtractor = new entity_extraction_engine_1.EntityExtractionEngine();
        this.toolRegistry = tool_registry_1.ToolRegistry.getInstance();
        this.config = {
            confidenceThreshold: 0.8,
            fallbackAgent: 'socratico',
            enableLogging: true,
            maxRetries: 2,
            ...config
        };
    }
    /**
     * Método principal de orquestación inteligente con selección dinámica de herramientas
     */
    async orchestrateWithTools(userInput, sessionContext = [], previousAgent) {
        try {
            // 1. Clasificación de intención
            const intentResult = await this.classifyIntent(userInput, sessionContext);
            if (!intentResult) {
                return this.createFallbackOrchestration(userInput, sessionContext, 'Intent classification failed');
            }
            // 2. Extracción de entidades
            const entityResult = await this.entityExtractor.extractEntities(userInput, sessionContext);
            // 3. Selección contextual de herramientas
            const toolSelectionContext = {
                conversationHistory: sessionContext,
                currentIntent: intentResult.functionName,
                extractedEntities: entityResult.entities,
                sessionMetadata: {
                    previousAgent,
                    sessionLength: sessionContext.length,
                    recentTopics: this.extractRecentTopics(sessionContext)
                }
            };
            const selectedTools = await this.selectContextualTools(toolSelectionContext);
            const selectedAgent = this.mapFunctionToAgent(intentResult.functionName);
            return {
                selectedAgent,
                contextualTools: selectedTools.map(tool => tool.declaration),
                toolMetadata: selectedTools,
                confidence: this.calculateCombinedConfidence(intentResult.confidence, entityResult.confidence),
                reasoning: this.generateOrchestrationReasoning(intentResult, entityResult, selectedTools)
            };
        }
        catch (error) {
            console.error('[IntelligentIntentRouter] Error en orquestación:', error);
            return this.createFallbackOrchestration(userInput, sessionContext, `Orchestration error: ${error}`);
        }
    }
    /**
     * Clasifica automáticamente la intención del usuario y enruta al agente apropiado
     *
     * @param userInput - Input del usuario a clasificar
     * @param sessionContext - Contexto de la sesión actual
     * @param currentAgent - Agente actualmente activo (opcional)
     * @returns Resultado del enrutamiento con contexto enriquecido
     */
    async routeUserInput(userInput, sessionContext, currentAgent) {
        try {
            // Paso 1: Análisis de intención con Function Calling
            const classificationResult = await this.classifyIntent(userInput, sessionContext);
            if (!classificationResult) {
                return this.handleFallback(userInput, sessionContext, 'No se pudo clasificar la intención');
            }
            // Paso 2: Extracción semántica de entidades
            const entityExtractionResult = await this.entityExtractor.extractEntities(userInput, sessionContext);
            if (this.config.enableLogging) {
                console.log(`[IntentRouter] Entidades extraídas: ${entityExtractionResult.entities.length}`);
            }
            // Paso 3: Validación de confianza combinada
            const combinedConfidence = this.calculateCombinedConfidence(classificationResult.confidence, entityExtractionResult.confidence);
            if (combinedConfidence < this.config.confidenceThreshold) {
                if (this.config.enableLogging) {
                    console.log(`[IntentRouter] Confianza combinada baja (${combinedConfidence}), requiere clarificación`);
                }
                return {
                    success: false,
                    targetAgent: this.config.fallbackAgent,
                    enrichedContext: this.createEnrichedContext(userInput, 'clarification_needed', [], entityExtractionResult, sessionContext, currentAgent, 'Confianza insuficiente en clasificación o extracción', combinedConfidence),
                    requiresUserClarification: true
                };
            }
            // Paso 4: Mapeo de función a agente
            const targetAgent = this.mapFunctionToAgent(classificationResult.functionName);
            // Paso 5: Crear contexto enriquecido con entidades
            const enrichedContext = this.createEnrichedContext(userInput, classificationResult.functionName, entityExtractionResult.entities, entityExtractionResult, sessionContext, currentAgent, `Clasificación automática: ${classificationResult.functionName} con ${entityExtractionResult.entities.length} entidades`, combinedConfidence);
            // Paso 6: Logging para análisis
            if (this.config.enableLogging) {
                this.logRoutingDecision(enrichedContext);
            }
            return {
                success: true,
                targetAgent,
                enrichedContext,
                requiresUserClarification: false
            };
        }
        catch (error) {
            console.error('[IntentRouter] Error en enrutamiento:', error);
            return this.handleFallback(userInput, sessionContext, `Error: ${error}`);
        }
    }
    /**
     * Clasifica la intención usando Function Calling del SDK
     */
    async classifyIntent(userInput, sessionContext) {
        try {
            // Construir prompt con contexto
            const contextPrompt = this.buildContextualPrompt(userInput, sessionContext);
            const result = await this.ai.models.generateContent({
                model: 'gemini-2.5-flash-lite',
                contents: [{ role: 'user', parts: [{ text: contextPrompt }] }],
                config: {
                    tools: [{
                            functionDeclarations: this.intentFunctions
                        }],
                    toolConfig: {
                        functionCallingConfig: {
                            mode: genai_1.FunctionCallingConfigMode.AUTO
                        }
                    },
                    temperature: 0.1,
                    topP: 0.8,
                    topK: 40,
                    maxOutputTokens: 1000
                }
            });
            const functionCalls = result.functionCalls;
            if (!functionCalls || functionCalls.length === 0) {
                return null;
            }
            const functionCall = functionCalls[0];
            // Validar que el function call tiene un nombre válido
            if (!functionCall.name) {
                console.warn('[IntentRouter] Function call sin nombre válido');
                return null;
            }
            return {
                functionName: functionCall.name,
                parameters: functionCall.args || {},
                confidence: this.calculateConfidence(result),
                requiresClarification: false
            };
        }
        catch (error) {
            console.error('[IntentRouter] Error en clasificación:', error);
            return null;
        }
    }
    /**
     * Construye un prompt contextual para mejorar la clasificación
     */
    buildContextualPrompt(userInput, sessionContext) {
        const recentContext = sessionContext.slice(-3); // Últimos 3 intercambios
        const contextSummary = recentContext.length > 0
            ? `\n\nContexto reciente de la conversación:\n${recentContext.map(c => c.parts?.map(p => 'text' in p ? p.text : '').join(' ')).join('\n')}`
            : '';
        return `Como asistente de IA especializado en psicología clínica, analiza la siguiente consulta del usuario y determina cuál es la intención más apropiada.

Consulta del usuario: "${userInput}"${contextSummary}

Clasifica esta consulta en una de las siguientes categorías:
- Modo Socrático: Para exploración reflexiva, cuestionamiento y desarrollo de insights
- Modo Clínico: Para documentación, resúmenes y estructuración de información
- Modo Académico: Para búsqueda de investigación y evidencia científica

Selecciona la función apropiada con los parámetros más relevantes.`;
    }
    /**
     * Calcula un score de confianza basado en la respuesta del modelo
     */
    calculateConfidence(response) {
        // Implementación simplificada - en producción podría ser más sofisticada
        if (response.functionCalls && response.functionCalls.length > 0) {
            const functionCall = response.functionCalls[0];
            const hasRequiredParams = functionCall.args && Object.keys(functionCall.args).length > 0;
            return hasRequiredParams ? 0.9 : 0.7;
        }
        return 0.5;
    }
    /**
     * Mapea nombres de función a agentes
     */
    mapFunctionToAgent(functionName) {
        const mapping = {
            'activar_modo_socratico': 'socratico',
            'activar_modo_clinico': 'clinico',
            'activar_modo_academico': 'academico'
        };
        return mapping[functionName] || this.config.fallbackAgent;
    }
    /**
     * Crea contexto enriquecido para transferencia entre agentes
     */
    createEnrichedContext(originalQuery, detectedIntent, extractedEntities, entityExtractionResult, sessionHistory, previousAgent, transitionReason, confidence) {
        return {
            originalQuery,
            detectedIntent,
            extractedEntities,
            entityExtractionResult,
            sessionHistory,
            previousAgent,
            transitionReason,
            confidence
        };
    }
    /**
     * Calcula confianza combinada entre clasificación de intención y extracción de entidades
     */
    calculateCombinedConfidence(intentConfidence, entityConfidence) {
        // Promedio ponderado: 60% intención, 40% entidades
        return (intentConfidence * 0.6) + (entityConfidence * 0.4);
    }
    /**
     * Maneja casos de fallback cuando la clasificación falla
     */
    handleFallback(userInput, sessionContext, reason) {
        if (this.config.enableLogging) {
            console.log(`[IntentRouter] Fallback activado: ${reason}`);
        }
        // Crear resultado de extracción vacío para fallback
        const fallbackResult = {
            entityExtractionResult: { entities: [], primaryEntities: [], secondaryEntities: [], confidence: 0, processingTime: 0 }
        };
        const entityExtractionResult = fallbackResult.entityExtractionResult;
        return {
            success: true, // Fallback es exitoso
            targetAgent: this.config.fallbackAgent,
            enrichedContext: this.createEnrichedContext(userInput, 'fallback', [], entityExtractionResult, sessionContext, undefined, reason, 0.5),
            requiresUserClarification: false
        };
    }
    /**
     * Registra decisiones de enrutamiento para análisis
     */
    logRoutingDecision(context) {
        if (!this.config.enableLogging)
            return;
        const entitySummary = {
            total: context.extractedEntities.length,
            primary: context.entityExtractionResult.primaryEntities.length,
            secondary: context.entityExtractionResult.secondaryEntities.length,
            averageConfidence: context.entityExtractionResult.confidence
        };
        console.log('[IntentRouter] Decisión de enrutamiento:', {
            intent: context.detectedIntent,
            confidence: context.confidence,
            entitySummary,
            extractedEntities: context.extractedEntities.map(e => ({
                value: e.value,
                type: e.type,
                confidence: e.confidence
            })),
            transition: context.transitionReason,
            processingTime: context.entityExtractionResult.processingTime,
            timestamp: new Date().toISOString()
        });
    }
    /**
     * Selecciona herramientas contextuales basadas en la intención y entidades
     */
    async selectContextualTools(context) {
        const relevantDomains = this.mapIntentToDomains(context.currentIntent);
        const entityTypes = context.extractedEntities.map(e => e.type);
        return this.toolRegistry.getToolsForContext({
            domains: relevantDomains,
            entityTypes,
            sessionLength: context.sessionMetadata.sessionLength,
            previousAgent: context.sessionMetadata.previousAgent
        });
    }
    /**
     * Mapea intenciones a dominios clínicos
     */
    mapIntentToDomains(intent) {
        const mapping = {
            'activar_modo_socratico': [tool_registry_1.ClinicalDomain.THERAPY, tool_registry_1.ClinicalDomain.ASSESSMENT],
            'activar_modo_clinico': [tool_registry_1.ClinicalDomain.DOCUMENTATION, tool_registry_1.ClinicalDomain.ASSESSMENT],
            'activar_modo_academico': [tool_registry_1.ClinicalDomain.RESEARCH, tool_registry_1.ClinicalDomain.EVIDENCE_BASED]
        };
        return mapping[intent] || [tool_registry_1.ClinicalDomain.GENERAL];
    }
    /**
     * Extrae tópicos recientes de la conversación
     */
    extractRecentTopics(sessionContext) {
        // Implementación simplificada - en producción usaría NLP más sofisticado
        const recentMessages = sessionContext.slice(-5);
        const topics = [];
        recentMessages.forEach(content => {
            content.parts?.forEach(part => {
                if ('text' in part && part.text) {
                    // Extraer palabras clave simples
                    const keywords = part.text.toLowerCase()
                        .split(/\s+/)
                        .filter(word => word.length > 4)
                        .slice(0, 3);
                    topics.push(...keywords);
                }
            });
        });
        return [...new Set(topics)].slice(0, 10);
    }
    /**
     * Genera razonamiento para la decisión de orquestación
     */
    generateOrchestrationReasoning(intentResult, entityResult, selectedTools) {
        return `Intención detectada: ${intentResult.functionName} (confianza: ${intentResult.confidence.toFixed(2)}). ` +
            `Entidades extraídas: ${entityResult.entities.length} (confianza: ${entityResult.confidence.toFixed(2)}). ` +
            `Herramientas seleccionadas: ${selectedTools.length} herramientas especializadas.`;
    }
    /**
     * Crea resultado de orquestación de fallback
     */
    createFallbackOrchestration(userInput, sessionContext, reason) {
        const fallbackTools = this.toolRegistry.getBasicTools();
        return {
            selectedAgent: this.config.fallbackAgent,
            contextualTools: fallbackTools.map(tool => tool.declaration),
            toolMetadata: fallbackTools,
            confidence: 0.5,
            reasoning: `Fallback activado: ${reason}`
        };
    }
    /**
     * Actualiza la configuración del router
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    /**
     * Obtiene métricas de rendimiento del router
     */
    getPerformanceMetrics() {
        // Implementación básica - en producción se mantendría estado
        return {
            totalClassifications: 0,
            averageConfidence: 0,
            fallbackRate: 0,
            agentDistribution: {}
        };
    }
}
exports.IntelligentIntentRouter = IntelligentIntentRouter;
/**
 * Factory function para crear una instancia del router
 */
function createIntelligentIntentRouter(agentRouter, config) {
    return new IntelligentIntentRouter(agentRouter, config);
}
