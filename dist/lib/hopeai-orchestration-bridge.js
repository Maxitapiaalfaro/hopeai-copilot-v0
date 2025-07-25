"use strict";
/**
 * Puente de Integración del Orquestador Dinámico con HopeAI
 *
 * Sistema que integra el nuevo Orquestador Dinámico con la arquitectura
 * existente de HopeAI, manteniendo compatibilidad hacia atrás mientras
 * introduce las nuevas capacidades de selección dinámica de herramientas.
 *
 * Responsabilidades:
 * - Adaptación de interfaces entre sistemas legacy y nuevos
 * - Gestión de transiciones graduales
 * - Mantenimiento de compatibilidad con agentes existentes
 * - Logging y monitoreo de la integración
 *
 * @author HopeAI Development Team
 * @version 2.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HopeAIOrchestrationBridge = void 0;
exports.createOrchestrationBridge = createOrchestrationBridge;
const dynamic_orchestrator_1 = require("./dynamic-orchestrator");
const tool_registry_1 = require("./tool-registry");
/**
 * Puente de Integración del Orquestador Dinámico
 *
 * Actúa como capa de abstracción entre el sistema HopeAI existente
 * y el nuevo Orquestador Dinámico, permitiendo una migración gradual
 * y manteniendo compatibilidad con componentes legacy.
 */
class HopeAIOrchestrationBridge {
    constructor(hopeAISystem, agentRouter, config) {
        this.hopeAISystem = hopeAISystem;
        this.agentRouter = agentRouter;
        this.dynamicOrchestrator = new dynamic_orchestrator_1.DynamicOrchestrator(agentRouter);
        this.toolRegistry = tool_registry_1.ToolRegistry.getInstance();
        this.requestCounter = 0;
        this.config = {
            enableDynamicOrchestration: true,
            fallbackToLegacy: true,
            enablePerformanceMonitoring: true,
            enableGradualMigration: true,
            migrationPercentage: 80, // 80% de requests usan orquestación dinámica
            logLevel: 'info',
            ...config
        };
        this.performanceMetrics = {
            totalRequests: 0,
            dynamicOrchestrationRequests: 0,
            legacyRequests: 0,
            averageResponseTime: 0,
            successRate: 0,
            errorRate: 0,
            toolSelectionAccuracy: 0
        };
        this.log('info', 'HopeAI Orchestration Bridge inicializado');
    }
    /**
     * Método principal de orquestación integrada
     *
     * Decide si usar orquestación dinámica o legacy basado en la configuración
     * y el contexto de la solicitud.
     */
    async orchestrate(userInput, sessionId, userId, context) {
        const startTime = Date.now();
        this.requestCounter++;
        this.performanceMetrics.totalRequests++;
        try {
            this.log('debug', `Procesando solicitud ${this.requestCounter} para sesión ${sessionId}`);
            // Determinar tipo de orquestación a usar
            const orchestrationType = this.determineOrchestrationType(context?.forceMode);
            let result;
            switch (orchestrationType) {
                case 'dynamic':
                    result = await this.handleDynamicOrchestration(userInput, sessionId, userId, context);
                    this.performanceMetrics.dynamicOrchestrationRequests++;
                    break;
                case 'legacy':
                    result = await this.handleLegacyOrchestration(userInput, sessionId, userId, context);
                    this.performanceMetrics.legacyRequests++;
                    break;
                case 'hybrid':
                    result = await this.handleHybridOrchestration(userInput, sessionId, userId, context);
                    break;
                default:
                    throw new Error(`Tipo de orquestación no soportado: ${orchestrationType}`);
            }
            // Calcular métricas de rendimiento
            if (this.config.enablePerformanceMonitoring) {
                const processingTime = Date.now() - startTime;
                result.performanceMetrics = {
                    orchestrationTime: processingTime * 0.7, // Estimación
                    toolSelectionTime: processingTime * 0.2,
                    totalProcessingTime: processingTime
                };
                this.updatePerformanceMetrics(result, processingTime);
            }
            this.log('info', `Orquestación completada: ${result.orchestrationType} - ${result.selectedAgent}`);
            return result;
        }
        catch (error) {
            this.log('error', `Error en orquestación: ${error}`);
            this.performanceMetrics.errorRate++;
            return this.createErrorResult(userInput, sessionId, userId, error);
        }
    }
    /**
     * Maneja orquestación dinámica usando el nuevo sistema
     */
    async handleDynamicOrchestration(userInput, sessionId, userId, context) {
        try {
            const dynamicResult = await this.dynamicOrchestrator.orchestrate(userInput, sessionId, userId);
            return {
                success: dynamicResult.success,
                orchestrationType: 'dynamic',
                selectedAgent: dynamicResult.selectedAgent,
                availableTools: dynamicResult.contextualTools,
                sessionContext: dynamicResult.sessionContext,
                confidence: dynamicResult.confidence,
                reasoning: dynamicResult.reasoning,
                recommendations: dynamicResult.recommendations
            };
        }
        catch (error) {
            this.log('warn', `Error en orquestación dinámica, fallback a legacy: ${error}`);
            if (this.config.fallbackToLegacy) {
                return this.handleLegacyOrchestration(userInput, sessionId, userId, context);
            }
            throw error;
        }
    }
    /**
     * Maneja orquestación legacy usando el sistema existente
     */
    async handleLegacyOrchestration(userInput, sessionId, userId, context) {
        try {
            // Usar el sistema HopeAI existente
            const sessionHistory = context?.sessionHistory || [];
            const previousAgent = context?.previousAgent;
            // Simular el comportamiento legacy con herramientas básicas
            const basicTools = this.toolRegistry.getBasicTools();
            const selectedAgent = this.determineAgentLegacy(userInput);
            return {
                success: true,
                orchestrationType: 'legacy',
                selectedAgent,
                availableTools: basicTools.map(tool => tool.declaration),
                confidence: 0.8,
                reasoning: 'Orquestación legacy basada en patrones predefinidos'
            };
        }
        catch (error) {
            this.log('error', `Error en orquestación legacy: ${error}`);
            throw error;
        }
    }
    /**
     * Maneja orquestación híbrida combinando ambos sistemas
     */
    async handleHybridOrchestration(userInput, sessionId, userId, context) {
        try {
            // Intentar orquestación dinámica primero
            const dynamicResult = await this.handleDynamicOrchestration(userInput, sessionId, userId, context);
            // Si la confianza es baja, complementar con legacy
            if (dynamicResult.confidence < 0.7) {
                const legacyResult = await this.handleLegacyOrchestration(userInput, sessionId, userId, context);
                // Combinar resultados
                return {
                    ...dynamicResult,
                    orchestrationType: 'hybrid',
                    availableTools: [
                        ...dynamicResult.availableTools,
                        ...legacyResult.availableTools.filter(tool => !dynamicResult.availableTools.some(dt => dt.name === tool.name))
                    ].slice(0, 8), // Limitar herramientas
                    confidence: Math.max(dynamicResult.confidence, legacyResult.confidence),
                    reasoning: `Híbrido: ${dynamicResult.reasoning} + Legacy backup`
                };
            }
            return {
                ...dynamicResult,
                orchestrationType: 'hybrid'
            };
        }
        catch (error) {
            this.log('error', `Error en orquestación híbrida: ${error}`);
            throw error;
        }
    }
    /**
     * Determina el tipo de orquestación a usar
     */
    determineOrchestrationType(forceMode) {
        if (forceMode) {
            return forceMode;
        }
        if (!this.config.enableDynamicOrchestration) {
            return 'legacy';
        }
        if (this.config.enableGradualMigration) {
            const random = Math.random() * 100;
            if (random < this.config.migrationPercentage) {
                return 'dynamic';
            }
            else {
                return 'legacy';
            }
        }
        return 'dynamic';
    }
    /**
     * Determina agente usando lógica legacy
     */
    determineAgentLegacy(userInput) {
        const input = userInput.toLowerCase();
        if (input.includes('resumen') || input.includes('documentar') || input.includes('nota')) {
            return 'clinico';
        }
        if (input.includes('investigar') || input.includes('estudio') || input.includes('evidencia')) {
            return 'academico';
        }
        return 'socratico'; // Default
    }
    /**
     * Actualiza métricas de rendimiento
     */
    updatePerformanceMetrics(result, processingTime) {
        // Actualizar tiempo promedio de respuesta
        this.performanceMetrics.averageResponseTime =
            (this.performanceMetrics.averageResponseTime * (this.performanceMetrics.totalRequests - 1) + processingTime) /
                this.performanceMetrics.totalRequests;
        // Actualizar tasa de éxito
        if (result.success) {
            this.performanceMetrics.successRate =
                (this.performanceMetrics.successRate * (this.performanceMetrics.totalRequests - 1) + 1) /
                    this.performanceMetrics.totalRequests;
        }
        // Actualizar precisión de selección de herramientas (simplificado)
        if (result.confidence > 0.8) {
            this.performanceMetrics.toolSelectionAccuracy =
                (this.performanceMetrics.toolSelectionAccuracy * (this.performanceMetrics.totalRequests - 1) + 1) /
                    this.performanceMetrics.totalRequests;
        }
    }
    /**
     * Crea resultado de error
     */
    createErrorResult(userInput, sessionId, userId, error) {
        const basicTools = this.toolRegistry.getBasicTools();
        return {
            success: false,
            orchestrationType: 'legacy',
            selectedAgent: 'socratico',
            availableTools: basicTools.map(tool => tool.declaration),
            confidence: 0.3,
            reasoning: `Error en orquestación: ${error.message}`,
            recommendations: {
                suggestedFollowUp: "Intenta reformular tu consulta",
                alternativeApproaches: ["Usa términos más específicos"],
                clinicalConsiderations: ["Verifica la conectividad del sistema"]
            }
        };
    }
    /**
     * Obtiene métricas de rendimiento del puente
     */
    getPerformanceMetrics() {
        return { ...this.performanceMetrics };
    }
    /**
     * Obtiene estadísticas del sistema
     */
    getSystemStats() {
        return {
            bridgeMetrics: this.getPerformanceMetrics(),
            orchestratorStats: this.dynamicOrchestrator.getStats(),
            toolRegistryStats: this.toolRegistry.getStats()
        };
    }
    /**
     * Actualiza configuración del puente
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.log('info', 'Configuración del puente actualizada');
    }
    /**
     * Limpia recursos y sesiones expiradas
     */
    cleanup() {
        this.dynamicOrchestrator.cleanupExpiredSessions();
        this.log('debug', 'Limpieza de recursos completada');
    }
    /**
     * Reinicia métricas de rendimiento
     */
    resetMetrics() {
        this.performanceMetrics = {
            totalRequests: 0,
            dynamicOrchestrationRequests: 0,
            legacyRequests: 0,
            averageResponseTime: 0,
            successRate: 0,
            errorRate: 0,
            toolSelectionAccuracy: 0
        };
        this.requestCounter = 0;
        this.log('info', 'Métricas de rendimiento reiniciadas');
    }
    /**
     * Logging interno
     */
    log(level, message) {
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        const configLevel = levels[this.config.logLevel];
        const messageLevel = levels[level];
        if (messageLevel >= configLevel) {
            console.log(`[OrchestrationBridge:${level.toUpperCase()}] ${message}`);
        }
    }
}
exports.HopeAIOrchestrationBridge = HopeAIOrchestrationBridge;
/**
 * Factory function para crear el puente de orquestación
 */
function createOrchestrationBridge(hopeAISystem, agentRouter, config) {
    return new HopeAIOrchestrationBridge(hopeAISystem, agentRouter, config);
}
