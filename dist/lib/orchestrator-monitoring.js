"use strict";
/**
 * Sistema de Monitoreo y Métricas del Orquestador Dinámico
 *
 * Proporciona capacidades avanzadas de monitoreo, logging y análisis
 * de rendimiento para el Orquestador Dinámico de HopeAI.
 *
 * Características:
 * - Métricas en tiempo real de rendimiento
 * - Análisis de patrones de uso
 * - Detección de anomalías
 * - Reportes de eficiencia de herramientas
 * - Dashboard de métricas clínicas
 *
 * @author HopeAI Development Team
 * @version 2.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestratorMonitoring = void 0;
exports.createOrchestratorMonitoring = createOrchestratorMonitoring;
/**
 * Sistema de Monitoreo del Orquestador
 *
 * Recopila, analiza y reporta métricas de rendimiento y uso
 * del sistema de orquestación dinámica.
 */
class OrchestratorMonitoring {
    constructor(config) {
        this.startTime = new Date();
        this.alertCounter = 0;
        this.config = {
            enableRealTimeMetrics: true,
            enableEventLogging: true,
            enableAnomalyDetection: true,
            enablePerformanceAlerts: true,
            maxEventsInMemory: 10000,
            metricsRetentionDays: 30,
            alertThresholds: {
                responseTimeMs: 5000,
                confidenceThreshold: 0.6,
                errorRateThreshold: 0.1,
                sessionFailureThreshold: 0.2
            },
            logLevel: 'info',
            ...config
        };
        this.initializeMetrics();
        this.events = [];
        this.alerts = [];
        this.log('info', 'Sistema de monitoreo del orquestador inicializado');
    }
    /**
     * Inicializa las métricas base
     */
    initializeMetrics() {
        this.metrics = {
            totalOrchestrations: 0,
            successfulOrchestrations: 0,
            failedOrchestrations: 0,
            averageResponseTime: 0,
            averageConfidence: 0,
            agentUsage: {},
            toolUsage: {},
            sessionMetrics: {
                averageSessionLength: 0,
                averageInteractionsPerSession: 0,
                mostCommonTopics: [],
                sessionSuccessRate: 0
            },
            hourlyDistribution: {},
            dailyTrends: {}
        };
    }
    /**
     * Registra un evento de orquestación
     */
    recordOrchestrationEvent(result, userInput, sessionId, userId, responseTime) {
        if (!this.config.enableEventLogging)
            return;
        const event = {
            id: this.generateEventId(),
            timestamp: new Date(),
            sessionId,
            userId,
            userInput,
            selectedAgent: result.selectedAgent,
            selectedTools: result.availableTools.map(tool => tool.name),
            confidence: result.confidence,
            responseTime,
            success: result.success,
            orchestrationType: result.orchestrationType,
            errorMessage: result.success ? undefined : result.reasoning,
            clinicalContext: result.sessionContext ? {
                dominantTopics: result.sessionContext.sessionMetadata.dominantTopics,
                sessionLength: result.sessionContext.sessionMetadata.totalInteractions,
                previousAgent: result.sessionContext.currentAgent
            } : undefined
        };
        this.events.push(event);
        // Mantener límite de eventos en memoria
        if (this.events.length > this.config.maxEventsInMemory) {
            this.events = this.events.slice(-this.config.maxEventsInMemory);
        }
        // Actualizar métricas en tiempo real
        if (this.config.enableRealTimeMetrics) {
            this.updateMetrics(event);
        }
        // Detectar anomalías
        if (this.config.enableAnomalyDetection) {
            this.detectAnomalies(event);
        }
        this.log('debug', `Evento registrado: ${event.id} - ${event.selectedAgent}`);
    }
    /**
     * Actualiza métricas en tiempo real
     */
    updateMetrics(event) {
        // Métricas generales
        this.metrics.totalOrchestrations++;
        if (event.success) {
            this.metrics.successfulOrchestrations++;
        }
        else {
            this.metrics.failedOrchestrations++;
        }
        // Actualizar tiempo promedio de respuesta
        this.metrics.averageResponseTime =
            (this.metrics.averageResponseTime * (this.metrics.totalOrchestrations - 1) + event.responseTime) /
                this.metrics.totalOrchestrations;
        // Actualizar confianza promedio
        this.metrics.averageConfidence =
            (this.metrics.averageConfidence * (this.metrics.totalOrchestrations - 1) + event.confidence) /
                this.metrics.totalOrchestrations;
        // Métricas de agentes
        if (!this.metrics.agentUsage[event.selectedAgent]) {
            this.metrics.agentUsage[event.selectedAgent] = {
                count: 0,
                averageConfidence: 0,
                averageResponseTime: 0,
                successRate: 0
            };
        }
        const agentMetrics = this.metrics.agentUsage[event.selectedAgent];
        agentMetrics.count++;
        agentMetrics.averageConfidence =
            (agentMetrics.averageConfidence * (agentMetrics.count - 1) + event.confidence) / agentMetrics.count;
        agentMetrics.averageResponseTime =
            (agentMetrics.averageResponseTime * (agentMetrics.count - 1) + event.responseTime) / agentMetrics.count;
        agentMetrics.successRate =
            (agentMetrics.successRate * (agentMetrics.count - 1) + (event.success ? 1 : 0)) / agentMetrics.count;
        // Métricas de herramientas
        event.selectedTools.forEach(toolName => {
            if (!this.metrics.toolUsage[toolName]) {
                this.metrics.toolUsage[toolName] = {
                    count: 0,
                    averageEffectiveness: 0,
                    clinicalDomains: [],
                    categories: []
                };
            }
            this.metrics.toolUsage[toolName].count++;
            // La efectividad se puede calcular basada en el éxito y confianza
            const effectiveness = event.success ? event.confidence : 0;
            this.metrics.toolUsage[toolName].averageEffectiveness =
                (this.metrics.toolUsage[toolName].averageEffectiveness * (this.metrics.toolUsage[toolName].count - 1) + effectiveness) /
                    this.metrics.toolUsage[toolName].count;
        });
        // Distribución horaria
        const hour = event.timestamp.getHours().toString();
        this.metrics.hourlyDistribution[hour] = (this.metrics.hourlyDistribution[hour] || 0) + 1;
        // Tendencias diarias
        const day = event.timestamp.toISOString().split('T')[0];
        this.metrics.dailyTrends[day] = (this.metrics.dailyTrends[day] || 0) + 1;
    }
    /**
     * Detecta anomalías en el rendimiento
     */
    detectAnomalies(event) {
        const alerts = [];
        // Tiempo de respuesta alto
        if (event.responseTime > this.config.alertThresholds.responseTimeMs) {
            alerts.push({
                id: this.generateAlertId(),
                timestamp: new Date(),
                level: 'warning',
                category: 'performance',
                message: `Tiempo de respuesta alto detectado: ${event.responseTime}ms`,
                details: {
                    eventId: event.id,
                    responseTime: event.responseTime,
                    threshold: this.config.alertThresholds.responseTimeMs,
                    agent: event.selectedAgent
                },
                resolved: false
            });
        }
        // Confianza baja
        if (event.confidence < this.config.alertThresholds.confidenceThreshold) {
            alerts.push({
                id: this.generateAlertId(),
                timestamp: new Date(),
                level: 'warning',
                category: 'accuracy',
                message: `Confianza baja detectada: ${event.confidence.toFixed(2)}`,
                details: {
                    eventId: event.id,
                    confidence: event.confidence,
                    threshold: this.config.alertThresholds.confidenceThreshold,
                    agent: event.selectedAgent
                },
                resolved: false
            });
        }
        // Fallo de orquestación
        if (!event.success) {
            alerts.push({
                id: this.generateAlertId(),
                timestamp: new Date(),
                level: 'error',
                category: 'system',
                message: `Fallo en orquestación: ${event.errorMessage}`,
                details: {
                    eventId: event.id,
                    errorMessage: event.errorMessage,
                    agent: event.selectedAgent,
                    userInput: event.userInput.substring(0, 100)
                },
                resolved: false
            });
        }
        // Agregar alertas
        this.alerts.push(...alerts);
        // Notificar alertas críticas
        alerts.forEach(alert => {
            if (alert.level === 'error' || alert.level === 'critical') {
                this.log('error', `ALERTA: ${alert.message}`);
            }
        });
    }
    /**
     * Genera reporte de análisis clínico
     */
    generateClinicalAnalysisReport(startDate, endDate) {
        const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 días atrás
        const end = endDate || new Date();
        const filteredEvents = this.events.filter(event => event.timestamp >= start && event.timestamp <= end);
        // Calcular métricas del reporte
        const uniqueUsers = new Set(filteredEvents.map(e => e.userId)).size;
        const uniqueSessions = new Set(filteredEvents.map(e => e.sessionId)).size;
        // Agente más usado
        const agentCounts = filteredEvents.reduce((acc, event) => {
            acc[event.selectedAgent] = (acc[event.selectedAgent] || 0) + 1;
            return acc;
        }, {});
        const mostUsedAgent = Object.entries(agentCounts)
            .sort(([, a], [, b]) => b - a)[0]?.[0] || 'ninguno';
        // Herramientas más efectivas
        const toolEffectiveness = this.calculateToolEffectiveness(filteredEvents);
        const mostEffectiveTools = toolEffectiveness
            .sort((a, b) => b.effectiveness - a.effectiveness)
            .slice(0, 5)
            .map(t => t.tool);
        // Tópicos clínicos principales
        const topicFrequency = this.extractTopicFrequency(filteredEvents);
        // Patrones de usuario
        const userPatterns = this.identifyUserPatterns(filteredEvents);
        const report = {
            reportId: this.generateReportId(),
            generatedAt: new Date(),
            timeRange: { start, end },
            summary: {
                totalSessions: uniqueSessions,
                uniqueUsers,
                mostUsedAgent,
                mostEffectiveTools,
                averageSessionSuccess: filteredEvents.filter(e => e.success).length / filteredEvents.length
            },
            insights: {
                topClinicalTopics: topicFrequency,
                agentEffectiveness: this.calculateAgentEffectiveness(filteredEvents),
                toolPerformance: toolEffectiveness,
                userPatterns
            },
            recommendations: this.generateRecommendations(filteredEvents)
        };
        this.log('info', `Reporte clínico generado: ${report.reportId}`);
        return report;
    }
    /**
     * Calcula efectividad de herramientas
     */
    calculateToolEffectiveness(events) {
        const toolStats = new Map();
        events.forEach(event => {
            event.selectedTools.forEach(tool => {
                if (!toolStats.has(tool)) {
                    toolStats.set(tool, { total: 0, successful: 0, totalConfidence: 0 });
                }
                const stats = toolStats.get(tool);
                stats.total++;
                if (event.success)
                    stats.successful++;
                stats.totalConfidence += event.confidence;
            });
        });
        return Array.from(toolStats.entries()).map(([tool, stats]) => ({
            tool,
            usage: stats.total,
            effectiveness: (stats.successful / stats.total) * (stats.totalConfidence / stats.total)
        }));
    }
    /**
     * Extrae frecuencia de tópicos
     */
    extractTopicFrequency(events) {
        const topicCounts = new Map();
        events.forEach(event => {
            if (event.clinicalContext?.dominantTopics) {
                event.clinicalContext.dominantTopics.forEach(topic => {
                    topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
                });
            }
        });
        return Array.from(topicCounts.entries())
            .map(([topic, frequency]) => ({ topic, frequency }))
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 10);
    }
    /**
     * Calcula efectividad de agentes
     */
    calculateAgentEffectiveness(events) {
        const agentStats = new Map();
        events.forEach(event => {
            if (!agentStats.has(event.selectedAgent)) {
                agentStats.set(event.selectedAgent, { total: 0, successful: 0, totalConfidence: 0 });
            }
            const stats = agentStats.get(event.selectedAgent);
            stats.total++;
            if (event.success)
                stats.successful++;
            stats.totalConfidence += event.confidence;
        });
        return Array.from(agentStats.entries()).map(([agent, stats]) => ({
            agent,
            successRate: stats.successful / stats.total,
            avgConfidence: stats.totalConfidence / stats.total
        }));
    }
    /**
     * Identifica patrones de usuario
     */
    identifyUserPatterns(events) {
        // Implementación simplificada - en producción sería más sofisticada
        const patterns = new Map();
        // Patrón de agentes más usados por usuario
        const userAgentPreferences = new Map();
        events.forEach(event => {
            if (!userAgentPreferences.has(event.userId)) {
                userAgentPreferences.set(event.userId, new Map());
            }
            const userPrefs = userAgentPreferences.get(event.userId);
            userPrefs.set(event.selectedAgent, (userPrefs.get(event.selectedAgent) || 0) + 1);
        });
        // Analizar preferencias
        userAgentPreferences.forEach((prefs, userId) => {
            const sortedPrefs = Array.from(prefs.entries()).sort(([, a], [, b]) => b - a);
            if (sortedPrefs.length > 0) {
                const preferredAgent = sortedPrefs[0][0];
                const pattern = `Preferencia por agente ${preferredAgent}`;
                patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
            }
        });
        return Array.from(patterns.entries())
            .map(([pattern, frequency]) => ({ pattern, frequency }))
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 5);
    }
    /**
     * Genera recomendaciones basadas en el análisis
     */
    generateRecommendations(events) {
        const recommendations = [];
        // Analizar tasa de éxito
        const successRate = events.filter(e => e.success).length / events.length;
        if (successRate < 0.8) {
            recommendations.push('Considerar ajustar umbrales de confianza para mejorar tasa de éxito');
        }
        // Analizar tiempo de respuesta
        const avgResponseTime = events.reduce((sum, e) => sum + e.responseTime, 0) / events.length;
        if (avgResponseTime > 3000) {
            recommendations.push('Optimizar rendimiento del sistema para reducir tiempo de respuesta');
        }
        // Analizar distribución de agentes
        const agentDistribution = events.reduce((acc, event) => {
            acc[event.selectedAgent] = (acc[event.selectedAgent] || 0) + 1;
            return acc;
        }, {});
        const agentEntries = Object.entries(agentDistribution);
        if (agentEntries.length > 0) {
            const mostUsed = agentEntries.sort(([, a], [, b]) => b - a)[0];
            const usagePercentage = mostUsed[1] / events.length;
            if (usagePercentage > 0.7) {
                recommendations.push(`El agente ${mostUsed[0]} está siendo usado en exceso (${(usagePercentage * 100).toFixed(1)}%). Considerar balancear la carga.`);
            }
        }
        return recommendations;
    }
    /**
     * Obtiene métricas actuales
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * Obtiene alertas activas
     */
    getActiveAlerts() {
        return this.alerts.filter(alert => !alert.resolved);
    }
    /**
     * Resuelve una alerta
     */
    resolveAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.resolved = true;
            this.log('info', `Alerta resuelta: ${alertId}`);
            return true;
        }
        return false;
    }
    /**
     * Limpia datos antiguos
     */
    cleanup() {
        const cutoffDate = new Date(Date.now() - this.config.metricsRetentionDays * 24 * 60 * 60 * 1000);
        // Limpiar eventos antiguos
        this.events = this.events.filter(event => event.timestamp > cutoffDate);
        // Limpiar alertas resueltas antiguas
        this.alerts = this.alerts.filter(alert => !alert.resolved || alert.timestamp > cutoffDate);
        this.log('info', 'Limpieza de datos completada');
    }
    /**
     * Reinicia métricas
     */
    resetMetrics() {
        this.initializeMetrics();
        this.events = [];
        this.alerts = [];
        this.log('info', 'Métricas reiniciadas');
    }
    /**
     * Genera ID único para eventos
     */
    generateEventId() {
        return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Genera ID único para alertas
     */
    generateAlertId() {
        return `alert_${Date.now()}_${++this.alertCounter}`;
    }
    /**
     * Genera ID único para reportes
     */
    generateReportId() {
        return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Logging interno
     */
    log(level, message) {
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        const configLevel = levels[this.config.logLevel];
        const messageLevel = levels[level];
        if (messageLevel >= configLevel) {
            console.log(`[OrchestratorMonitoring:${level.toUpperCase()}] ${message}`);
        }
    }
}
exports.OrchestratorMonitoring = OrchestratorMonitoring;
/**
 * Factory function para crear el sistema de monitoreo
 */
function createOrchestratorMonitoring(config) {
    return new OrchestratorMonitoring(config);
}
