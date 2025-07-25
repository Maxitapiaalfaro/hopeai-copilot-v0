/**
 * Orquestador Dinámico de HopeAI
 * 
 * Sistema central que coordina la selección inteligente de agentes y herramientas
 * basado en el contexto de la conversación y las necesidades del psicólogo.
 * 
 * Arquitectura:
 * - Análisis contextual de la consulta
 * - Selección dinámica de herramientas especializadas
 * - Enrutamiento inteligente a agentes especializados
 * - Gestión de contexto entre transiciones
 * 
 * @author HopeAI Development Team
 * @version 2.0.0
 */
 
import { GoogleGenAI, FunctionDeclaration } from '@google/genai';
import { IntelligentIntentRouter, OrchestrationResult } from './intelligent-intent-router';
import { ClinicalAgentRouter } from './clinical-agent-router';
import { ToolRegistry, ClinicalTool } from './tool-registry';
import { EntityExtractionEngine, ExtractedEntity } from './entity-extraction-engine';
import { ai } from './google-genai-config';

/**
 * Tipo para el contenido de conversación
 */
interface Content {
  role: string;
  parts: Array<{ text: string }>;
}

/**
 * Contexto de sesión para el orquestador
 */
interface SessionContext {
  sessionId: string;
  userId: string;
  conversationHistory: Content[];
  currentAgent?: string;
  activeTools: FunctionDeclaration[];
  sessionMetadata: {
    startTime: Date;
    totalInteractions: number;
    dominantTopics: string[];
    clinicalFocus?: string;
  };
}

/**
 * Resultado de la orquestación dinámica
 */
interface DynamicOrchestrationResult {
  success: boolean;
  selectedAgent: string;
  contextualTools: FunctionDeclaration[];
  toolMetadata: ClinicalTool[];
  sessionContext: SessionContext;
  confidence: number;
  reasoning: string;
  recommendations?: {
    suggestedFollowUp?: string;
    alternativeApproaches?: string[];
    clinicalConsiderations?: string[];
  };
}

/**
 * Configuración del orquestador dinámico
 */
interface DynamicOrchestratorConfig {
  enableAdaptiveLearning: boolean;
  maxToolsPerSession: number;
  confidenceThreshold: number;
  sessionTimeoutMinutes: number;
  enableRecommendations: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Orquestador Dinámico Principal
 * 
 * Coordina la selección inteligente de agentes y herramientas basada en:
 * - Análisis semántico de la consulta
 * - Contexto histórico de la sesión
 * - Patrones de uso del psicólogo
 * - Especialización clínica requerida
 */
export class DynamicOrchestrator {
  private ai: GoogleGenAI;
  private intentRouter: IntelligentIntentRouter;
  private agentRouter: ClinicalAgentRouter;
  private toolRegistry: ToolRegistry;
  private entityExtractor: EntityExtractionEngine;
  private activeSessions: Map<string, SessionContext>;
  private config: DynamicOrchestratorConfig;

  constructor(
    agentRouter: ClinicalAgentRouter,
    config?: Partial<DynamicOrchestratorConfig>
  ) {
    this.ai = ai;
    this.agentRouter = agentRouter;
    this.intentRouter = new IntelligentIntentRouter(agentRouter);
    this.toolRegistry = ToolRegistry.getInstance();
    this.entityExtractor = new EntityExtractionEngine();
    this.activeSessions = new Map();
    
    this.config = {
      enableAdaptiveLearning: true,
      maxToolsPerSession: 8,
      confidenceThreshold: 0.75,
      sessionTimeoutMinutes: 60,
      enableRecommendations: true,
      logLevel: 'info',
      ...config
    };
  }

  /**
   * Método principal de orquestación dinámica
   * 
   * Analiza la consulta del usuario y orquesta la respuesta óptima
   * seleccionando el agente y herramientas más apropiados.
   */
  async orchestrate(
    userInput: string,
    sessionId: string,
    userId: string
  ): Promise<DynamicOrchestrationResult> {
    try {
      this.log('info', `Iniciando orquestación para sesión ${sessionId}`);
      
      // 1. Obtener o crear contexto de sesión
      const sessionContext = await this.getOrCreateSession(sessionId, userId);
      
      // 2. Actualizar historial de conversación
      this.updateConversationHistory(sessionContext, userInput);
      
      // 3. Realizar orquestación inteligente
      const orchestrationResult = await this.intentRouter.orchestrateWithTools(
        userInput,
        sessionContext.conversationHistory,
        sessionContext.currentAgent
      );
      
      // 4. Optimizar selección de herramientas
      const optimizedTools = await this.optimizeToolSelection(
        orchestrationResult.contextualTools,
        sessionContext
      );
      
      // 5. Actualizar contexto de sesión
      await this.updateSessionContext(
        sessionContext,
        orchestrationResult.selectedAgent,
        optimizedTools
      );
      
      // 6. Generar recomendaciones si están habilitadas
      const recommendations = this.config.enableRecommendations
        ? await this.generateRecommendations(orchestrationResult, sessionContext)
        : undefined;
      
      const result: DynamicOrchestrationResult = {
        success: true,
        selectedAgent: orchestrationResult.selectedAgent,
        contextualTools: optimizedTools,
        toolMetadata: orchestrationResult.toolMetadata,
        sessionContext,
        confidence: orchestrationResult.confidence,
        reasoning: orchestrationResult.reasoning,
        recommendations
      };
      
      this.log('info', `Orquestación completada: ${orchestrationResult.selectedAgent} con ${optimizedTools.length} herramientas`);
      
      return result;
      
    } catch (error) {
      this.log('error', `Error en orquestación: ${error}`);
      return this.createErrorResult(sessionId, userId, error as Error);
    }
  }

  /**
   * Obtiene o crea una nueva sesión
   */
  private async getOrCreateSession(sessionId: string, userId: string): Promise<SessionContext> {
    let session = this.activeSessions.get(sessionId);
    
    if (!session) {
      session = {
        sessionId,
        userId,
        conversationHistory: [],
        activeTools: [],
        sessionMetadata: {
          startTime: new Date(),
          totalInteractions: 0,
          dominantTopics: []
        }
      };
      
      this.activeSessions.set(sessionId, session);
      this.log('debug', `Nueva sesión creada: ${sessionId}`);
    }
    
    return session;
  }

  /**
   * Actualiza el historial de conversación
   */
  private updateConversationHistory(session: SessionContext, userInput: string): void {
    session.conversationHistory.push({
      role: 'user',
      parts: [{ text: userInput }]
    });
    
    session.sessionMetadata.totalInteractions++;
    
    // Mantener solo los últimos 20 intercambios para eficiencia
    if (session.conversationHistory.length > 40) {
      session.conversationHistory = session.conversationHistory.slice(-40);
    }
  }

  /**
   * Optimiza la selección de herramientas basada en el contexto de sesión
   */
  private async optimizeToolSelection(
    tools: FunctionDeclaration[],
    session: SessionContext
  ): Promise<FunctionDeclaration[]> {
    // Limitar número de herramientas según configuración
    let optimizedTools = tools.slice(0, this.config.maxToolsPerSession);
    
    // Si hay herramientas activas, priorizar continuidad
    if (session.activeTools.length > 0) {
      const continuityTools = session.activeTools.filter(activeTool =>
        tools.some(newTool => newTool.name === activeTool.name)
      );
      
      // Combinar herramientas de continuidad con nuevas
      const newTools = tools.filter(tool =>
        !session.activeTools.some(activeTool => activeTool.name === tool.name)
      );
      
      optimizedTools = [...continuityTools, ...newTools].slice(0, this.config.maxToolsPerSession);
    }
    
    return optimizedTools;
  }

  /**
   * Actualiza el contexto de sesión después de la orquestación
   */
  private async updateSessionContext(
    session: SessionContext,
    selectedAgent: string,
    tools: FunctionDeclaration[]
  ): Promise<void> {
    session.currentAgent = selectedAgent;
    session.activeTools = tools;
    
    // Actualizar tópicos dominantes
    await this.updateDominantTopics(session);
  }

  /**
   * Actualiza los tópicos dominantes de la sesión
   */
  private async updateDominantTopics(session: SessionContext): Promise<void> {
    if (session.conversationHistory.length < 2) return;
    
    try {
      const recentMessages = session.conversationHistory.slice(-6);
      const conversationText = recentMessages
        .map(msg => msg.parts?.map(part => 'text' in part ? part.text : '').join(' '))
        .join(' ');
      
      // Extraer entidades para identificar tópicos
      const entityResult = await this.entityExtractor.extractEntities(conversationText);
      
      const topics = entityResult.entities
        .filter(entity => entity.confidence > 0.7)
        .map(entity => entity.value)
        .slice(0, 5);
      
      session.sessionMetadata.dominantTopics = Array.from(new Set([
        ...topics,
        ...session.sessionMetadata.dominantTopics
      ])).slice(0, 10);
      
    } catch (error) {
      this.log('warn', `Error actualizando tópicos dominantes: ${error}`);
    }
  }

  /**
   * Genera recomendaciones basadas en el contexto
   */
  private async generateRecommendations(
    orchestrationResult: OrchestrationResult,
    session: SessionContext
  ): Promise<DynamicOrchestrationResult['recommendations']> {
    try {
      const prompt = this.buildRecommendationPrompt(orchestrationResult, session);
      
      const result = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: prompt
      });
      
      const recommendations = this.parseRecommendations(result.text || '');
      
      return recommendations;
      
    } catch (error) {
      this.log('warn', `Error generando recomendaciones: ${error}`);
      return undefined;
    }
  }

  /**
   * Construye prompt para generar recomendaciones
   */
  private buildRecommendationPrompt(
    orchestrationResult: OrchestrationResult,
    session: SessionContext
  ): string {
    return `Como asistente especializado en psicología clínica, analiza el siguiente contexto y genera recomendaciones:

Agente seleccionado: ${orchestrationResult.selectedAgent}
Herramientas disponibles: ${orchestrationResult.contextualTools.map(t => t.name).join(', ')}
Tópicos dominantes: ${session.sessionMetadata.dominantTopics.join(', ')}
Interacciones en sesión: ${session.sessionMetadata.totalInteractions}

Genera recomendaciones en el siguiente formato JSON:
{
  "suggestedFollowUp": "Pregunta o acción sugerida para continuar",
  "alternativeApproaches": ["Enfoque alternativo 1", "Enfoque alternativo 2"],
  "clinicalConsiderations": ["Consideración clínica 1", "Consideración clínica 2"]
}`;
  }

  /**
   * Parsea las recomendaciones del modelo
   */
  private parseRecommendations(text: string): DynamicOrchestrationResult['recommendations'] {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      this.log('warn', `Error parseando recomendaciones: ${error}`);
    }
    
    return {
      suggestedFollowUp: "Continúa explorando el tema actual",
      alternativeApproaches: ["Considera un enfoque diferente"],
      clinicalConsiderations: ["Mantén el foco terapéutico"]
    };
  }

  /**
   * Crea resultado de error
   */
  private createErrorResult(
    sessionId: string,
    userId: string,
    error: Error
  ): DynamicOrchestrationResult {
    const fallbackSession: SessionContext = {
      sessionId,
      userId,
      conversationHistory: [],
      activeTools: [],
      sessionMetadata: {
        startTime: new Date(),
        totalInteractions: 0,
        dominantTopics: []
      }
    };
    
    const basicTools = this.toolRegistry.getBasicTools();
    
    return {
      success: false,
      selectedAgent: 'socratico',
      contextualTools: basicTools.map(tool => tool.declaration),
      toolMetadata: basicTools,
      sessionContext: fallbackSession,
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
   * Limpia sesiones expiradas
   */
  public cleanupExpiredSessions(): void {
    const now = new Date();
    const timeoutMs = this.config.sessionTimeoutMinutes * 60 * 1000;
    
    for (const [sessionId, session] of Array.from(this.activeSessions.entries())) {
      const sessionAge = now.getTime() - session.sessionMetadata.startTime.getTime();
      
      if (sessionAge > timeoutMs) {
        this.activeSessions.delete(sessionId);
        this.log('debug', `Sesión expirada eliminada: ${sessionId}`);
      }
    }
  }

  /**
   * Obtiene estadísticas del orquestador
   */
  public getStats(): {
    activeSessions: number;
    totalTools: number;
    averageSessionLength: number;
  } {
    const sessions = Array.from(this.activeSessions.values());
    const averageSessionLength = sessions.length > 0
      ? sessions.reduce((sum, session) => sum + session.sessionMetadata.totalInteractions, 0) / sessions.length
      : 0;
    
    return {
      activeSessions: this.activeSessions.size,
      totalTools: this.toolRegistry.getRegistryStats().totalTools,
      averageSessionLength
    };
  }

  /**
   * Actualiza la configuración del orquestador
   */
  public updateConfig(newConfig: Partial<DynamicOrchestratorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.log('info', 'Configuración del orquestador actualizada');
  }

  /**
   * Logging interno
   */
  private log(level: DynamicOrchestratorConfig['logLevel'], message: string): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = levels[this.config.logLevel];
    const messageLevel = levels[level];
    
    if (messageLevel >= configLevel) {
      console.log(`[DynamicOrchestrator:${level.toUpperCase()}] ${message}`);
    }
  }
}

/**
 * Factory function para crear el orquestador dinámico
 */
export function createDynamicOrchestrator(
  agentRouter: ClinicalAgentRouter,
  config?: Partial<DynamicOrchestratorConfig>
): DynamicOrchestrator {
  return new DynamicOrchestrator(agentRouter, config);
}

/**
 * Tipos exportados
 */
export type {
  SessionContext,
  DynamicOrchestrationResult,
  DynamicOrchestratorConfig
};