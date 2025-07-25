"use strict";
/**
 * Punto de Entrada Principal del Orquestador Dinámico de HopeAI
 *
 * Este archivo actúa como el punto de integración central para todos los
 * componentes del sistema de orquestación dinámica, proporcionando una
 * interfaz unificada y simplificada para el uso del sistema.
 *
 * Arquitectura Integrada:
 * - Tool Registry: Gestión centralizada de herramientas clínicas
 * - Intelligent Intent Router: Enrutamiento semántico avanzado
 * - Dynamic Orchestrator: Orquestación inteligente de agentes y herramientas
 * - Orchestration Bridge: Integración con sistema legacy
 * - Monitoring System: Métricas y análisis en tiempo real
 *
 * @author HopeAI Development Team
 * @version 2.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HopeAIOrchestrationSystem = exports.OrchestratorMonitoring = exports.HopeAIOrchestrationBridge = exports.DynamicOrchestrator = exports.IntelligentIntentRouter = exports.ToolRegistry = void 0;
exports.createHopeAIOrchestrationSystem = createHopeAIOrchestrationSystem;
exports.createDefaultOrchestrationSystem = createDefaultOrchestrationSystem;
// Exportaciones principales del sistema
var tool_registry_1 = require("./tool-registry");
Object.defineProperty(exports, "ToolRegistry", { enumerable: true, get: function () { return tool_registry_1.ToolRegistry; } });
var intelligent_intent_router_1 = require("./intelligent-intent-router");
Object.defineProperty(exports, "IntelligentIntentRouter", { enumerable: true, get: function () { return intelligent_intent_router_1.IntelligentIntentRouter; } });
var dynamic_orchestrator_1 = require("./dynamic-orchestrator");
Object.defineProperty(exports, "DynamicOrchestrator", { enumerable: true, get: function () { return dynamic_orchestrator_1.DynamicOrchestrator; } });
var hopeai_orchestration_bridge_1 = require("./hopeai-orchestration-bridge");
Object.defineProperty(exports, "HopeAIOrchestrationBridge", { enumerable: true, get: function () { return hopeai_orchestration_bridge_1.HopeAIOrchestrationBridge; } });
var orchestrator_monitoring_1 = require("./orchestrator-monitoring");
Object.defineProperty(exports, "OrchestratorMonitoring", { enumerable: true, get: function () { return orchestrator_monitoring_1.OrchestratorMonitoring; } });
const hopeai_orchestration_bridge_2 = require("./hopeai-orchestration-bridge");
const orchestrator_monitoring_2 = require("./orchestrator-monitoring");
const tool_registry_2 = require("./tool-registry");
/**
 * Sistema Principal de Orquestación de HopeAI
 *
 * Clase principal que integra todos los componentes del sistema de
 * orquestación dinámica, proporcionando una interfaz unificada y
 * gestión centralizada de recursos.
 */
class HopeAIOrchestrationSystem {
    constructor(hopeAISystem, agentRouter, config) {
        this.hopeAISystem = hopeAISystem;
        this.agentRouter = agentRouter;
        this.startTime = new Date();
        this.isInitialized = false;
        this.config = {
            bridge: {
                enableDynamicOrchestration: true,
                fallbackToLegacy: true,
                enablePerformanceMonitoring: true,
                migrationPercentage: 80,
                logLevel: 'info'
            },
            monitoring: {
                enableRealTimeMetrics: true,
                enableEventLogging: true,
                enableAnomalyDetection: true,
                enablePerformanceAlerts: true,
                logLevel: 'info'
            },
            system: {
                enableAutoCleanup: true,
                cleanupIntervalMinutes: 60,
                enableHealthChecks: true,
                healthCheckIntervalMinutes: 15
            },
            ...config
        };
        this.initializeComponents();
    }
    /**
     * Inicializa todos los componentes del sistema
     */
    initializeComponents() {
        try {
            // Inicializar Tool Registry
            this.toolRegistry = tool_registry_2.ToolRegistry.getInstance();
            // Inicializar sistema de monitoreo
            this.monitoring = new orchestrator_monitoring_2.OrchestratorMonitoring(this.config.monitoring);
            // Inicializar puente de orquestación
            this.orchestrationBridge = new hopeai_orchestration_bridge_2.HopeAIOrchestrationBridge(this.hopeAISystem, this.agentRouter, this.config.bridge);
            // Configurar intervalos de mantenimiento
            this.setupMaintenanceIntervals();
            this.isInitialized = true;
            this.log('info', 'Sistema de orquestación HopeAI inicializado correctamente');
        }
        catch (error) {
            this.log('error', `Error inicializando sistema: ${error}`);
            throw error;
        }
    }
    /**
     * Configura intervalos de mantenimiento automático
     */
    setupMaintenanceIntervals() {
        if (this.config.system?.enableAutoCleanup) {
            const cleanupInterval = (this.config.system.cleanupIntervalMinutes || 60) * 60 * 1000;
            this.cleanupInterval = setInterval(() => {
                this.performCleanup();
            }, cleanupInterval);
        }
        if (this.config.system?.enableHealthChecks) {
            const healthCheckInterval = (this.config.system.healthCheckIntervalMinutes || 15) * 60 * 1000;
            this.healthCheckInterval = setInterval(() => {
                this.performHealthCheck();
            }, healthCheckInterval);
        }
    }
    /**
     * Método principal de orquestación
     *
     * Punto de entrada unificado para todas las solicitudes de orquestación.
     */
    async orchestrate(userInput, sessionId, userId, options) {
        if (!this.isInitialized) {
            throw new Error('Sistema no inicializado. Llama a initialize() primero.');
        }
        const startTime = Date.now();
        try {
            this.log('debug', `Procesando orquestación para sesión ${sessionId}`);
            // Realizar orquestación a través del puente
            const result = await this.orchestrationBridge.orchestrate(userInput, sessionId, userId, {
                forceMode: options?.forceMode,
                sessionHistory: options?.sessionHistory,
                previousAgent: options?.previousAgent
            });
            // Registrar evento en el sistema de monitoreo
            if (options?.enableMonitoring !== false) {
                const responseTime = Date.now() - startTime;
                this.monitoring.recordOrchestrationEvent(result, userInput, sessionId, userId, responseTime);
            }
            this.log('info', `Orquestación completada: ${result.selectedAgent} (${result.orchestrationType})`);
            return result;
        }
        catch (error) {
            this.log('error', `Error en orquestación: ${error}`);
            throw error;
        }
    }
    /**
     * Obtiene el estado de salud del sistema
     */
    getHealthStatus() {
        const metrics = this.monitoring.getMetrics();
        const bridgeMetrics = this.orchestrationBridge.getPerformanceMetrics();
        const activeAlerts = this.monitoring.getActiveAlerts();
        // Evaluar salud de componentes
        const toolRegistryHealth = this.evaluateToolRegistryHealth();
        const bridgeHealth = this.evaluateBridgeHealth(bridgeMetrics);
        const monitoringHealth = this.evaluateMonitoringHealth(metrics);
        // Determinar salud general
        const componentHealths = [toolRegistryHealth, bridgeHealth, monitoringHealth];
        const overall = componentHealths.includes('unhealthy') ? 'unhealthy' :
            componentHealths.includes('degraded') ? 'degraded' : 'healthy';
        return {
            overall,
            components: {
                toolRegistry: toolRegistryHealth,
                orchestrationBridge: bridgeHealth,
                monitoring: monitoringHealth
            },
            metrics: {
                uptime: Date.now() - this.startTime.getTime(),
                totalOrchestrations: metrics.totalOrchestrations,
                currentSessions: bridgeMetrics.totalRequests, // Aproximación
                averageResponseTime: metrics.averageResponseTime,
                errorRate: metrics.failedOrchestrations / Math.max(metrics.totalOrchestrations, 1)
            },
            alerts: {
                critical: activeAlerts.filter(a => a.level === 'critical').length,
                warnings: activeAlerts.filter(a => a.level === 'warning').length
            },
            lastHealthCheck: new Date()
        };
    }
    /**
     * Evalúa la salud del Tool Registry
     */
    evaluateToolRegistryHealth() {
        try {
            const stats = this.toolRegistry.getStats();
            if (stats.totalTools === 0) {
                return 'unhealthy';
            }
            if (stats.totalTools < 5) {
                return 'degraded';
            }
            return 'healthy';
        }
        catch (error) {
            return 'unhealthy';
        }
    }
    /**
     * Evalúa la salud del puente de orquestación
     */
    evaluateBridgeHealth(metrics) {
        if (metrics.errorRate > 0.2) {
            return 'unhealthy';
        }
        if (metrics.errorRate > 0.1 || metrics.averageResponseTime > 5000) {
            return 'degraded';
        }
        return 'healthy';
    }
    /**
     * Evalúa la salud del sistema de monitoreo
     */
    evaluateMonitoringHealth(metrics) {
        const activeAlerts = this.monitoring.getActiveAlerts();
        const criticalAlerts = activeAlerts.filter(a => a.level === 'critical').length;
        if (criticalAlerts > 0) {
            return 'unhealthy';
        }
        if (activeAlerts.length > 10) {
            return 'degraded';
        }
        return 'healthy';
    }
    /**
     * Genera reporte de análisis clínico
     */
    generateClinicalReport(startDate, endDate) {
        return this.monitoring.generateClinicalAnalysisReport(startDate, endDate);
    }
    /**
     * Obtiene métricas completas del sistema
     */
    getSystemMetrics() {
        return {
            orchestrator: this.monitoring.getMetrics(),
            bridge: this.orchestrationBridge.getPerformanceMetrics(),
            toolRegistry: this.toolRegistry.getStats(),
            system: {
                uptime: Date.now() - this.startTime.getTime(),
                initialized: this.isInitialized,
                startTime: this.startTime
            }
        };
    }
    /**
     * Obtiene alertas activas
     */
    getActiveAlerts() {
        return this.monitoring.getActiveAlerts();
    }
    /**
     * Resuelve una alerta específica
     */
    resolveAlert(alertId) {
        return this.monitoring.resolveAlert(alertId);
    }
    /**
     * Actualiza configuración del sistema
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        // Actualizar configuraciones de componentes
        if (newConfig.bridge) {
            this.orchestrationBridge.updateConfig(newConfig.bridge);
        }
        this.log('info', 'Configuración del sistema actualizada');
    }
    /**
     * Realiza limpieza automática del sistema
     */
    performCleanup() {
        try {
            this.monitoring.cleanup();
            this.orchestrationBridge.cleanup();
            this.log('debug', 'Limpieza automática completada');
        }
        catch (error) {
            this.log('error', `Error en limpieza automática: ${error}`);
        }
    }
    /**
     * Realiza verificación de salud automática
     */
    performHealthCheck() {
        try {
            const health = this.getHealthStatus();
            if (health.overall === 'unhealthy') {
                this.log('error', 'Sistema en estado no saludable');
            }
            else if (health.overall === 'degraded') {
                this.log('warn', 'Sistema en estado degradado');
            }
            this.log('debug', `Verificación de salud: ${health.overall}`);
        }
        catch (error) {
            this.log('error', `Error en verificación de salud: ${error}`);
        }
    }
    /**
     * Reinicia métricas del sistema
     */
    resetMetrics() {
        this.monitoring.resetMetrics();
        this.orchestrationBridge.resetMetrics();
        this.log('info', 'Métricas del sistema reiniciadas');
    }
    /**
     * Cierra el sistema y libera recursos
     */
    shutdown() {
        try {
            // Limpiar intervalos
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
            }
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
            }
            // Realizar limpieza final
            this.performCleanup();
            this.isInitialized = false;
            this.log('info', 'Sistema de orquestación cerrado correctamente');
        }
        catch (error) {
            this.log('error', `Error cerrando sistema: ${error}`);
        }
    }
    /**
     * Logging interno
     */
    log(level, message) {
        const logLevel = this.config.bridge?.logLevel || 'info';
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        if (levels[level] >= levels[logLevel]) {
            console.log(`[HopeAIOrchestrationSystem:${level.toUpperCase()}] ${message}`);
        }
    }
}
exports.HopeAIOrchestrationSystem = HopeAIOrchestrationSystem;
/**
 * Factory function para crear el sistema completo de orquestación
 */
function createHopeAIOrchestrationSystem(hopeAISystem, agentRouter, config) {
    return new HopeAIOrchestrationSystem(hopeAISystem, agentRouter, config);
}
/**
 * Función de utilidad para inicialización rápida con configuración por defecto
 */
function createDefaultOrchestrationSystem(hopeAISystem, agentRouter) {
    return new HopeAIOrchestrationSystem(hopeAISystem, agentRouter, {
        bridge: {
            enableDynamicOrchestration: true,
            migrationPercentage: 100, // 100% orquestación dinámica
            enablePerformanceMonitoring: true
        },
        monitoring: {
            enableRealTimeMetrics: true,
            enableAnomalyDetection: true,
            enablePerformanceAlerts: true
        },
        system: {
            enableAutoCleanup: true,
            enableHealthChecks: true
        }
    });
}
