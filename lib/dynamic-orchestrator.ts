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
import { SentryMetricsTracker } from './sentry-metrics-tracker';
import { UserPreferencesManager } from './user-preferences-manager';
import { ai } from './google-genai-config';
import type { ClinicalFile, ReasoningBullet, BulletGenerationContext } from '@/types/clinical-types';

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
  asyncRecommendations?: boolean;          // ⭐ Performance optimization
  toolContinuityThreshold?: number;        // ⭐ Smart tool persistence
  dominantTopicsUpdateInterval?: number;   // ⭐ Reduce update frequency
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
  private metricsTracker: SentryMetricsTracker;
  private userPreferencesManager: UserPreferencesManager;
  private activeSessions: Map<string, SessionContext> = new Map();
  private recommendationsCache: Map<string, DynamicOrchestrationResult['recommendations']> = new Map();
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
    this.metricsTracker = SentryMetricsTracker.getInstance();
    this.userPreferencesManager = UserPreferencesManager.getInstance();
    this.activeSessions = new Map();
    
    this.config = {
      enableAdaptiveLearning: true,
      maxToolsPerSession: 8,
      confidenceThreshold: 0.75,
      sessionTimeoutMinutes: 60,
      enableRecommendations: true,
      asyncRecommendations: false,           // Default to sync for backward compatibility
      toolContinuityThreshold: 3,           // Default threshold for tool persistence
      dominantTopicsUpdateInterval: 5,      // Update every 5 interactions
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
    userId: string,
    sessionFiles?: ClinicalFile[],
    onBulletUpdate?: (bullet: ReasoningBullet) => void
  ): Promise<DynamicOrchestrationResult> {
    const startTime = Date.now();
    
    try {
      this.log('info', `Iniciando orquestación para sesión ${sessionId}`);
      
      // El tracking de mensajes se maneja en el API layer para evitar duplicados
      // Solo registramos la actividad del orquestador internamente
      
      // 1. Obtener o crear contexto de sesión
      const sessionContext = await this.getOrCreateSession(sessionId, userId);
      
      // 2. Actualizar historial de conversación con archivos adjuntos
      this.updateConversationHistory(sessionContext, userInput, sessionFiles);
      
      // 3. Realizar orquestación inteligente PRIMERO para obtener el agente correcto
      const orchestrationResult = await this.intentRouter.orchestrateWithTools(
        userInput,
        sessionContext.conversationHistory,
        sessionContext.currentAgent
      );
      
      // 🎯 FUNCIONALIDAD MEJORADA: Generar bullets progresivos DESPUÉS de la orquestación
      // para usar el razonamiento real del agente seleccionado
      if (onBulletUpdate) {
        this.log('info', `Generando bullets progresivos coherentes para agente ${orchestrationResult.selectedAgent}`);
        
        // Crear contexto enriquecido para generación de bullets
        const bulletContext: BulletGenerationContext = {
          userInput,
          sessionContext: sessionContext.conversationHistory,
          selectedAgent: orchestrationResult.selectedAgent,
          extractedEntities: [], // Se extraerán en el proceso
          clinicalContext: {
            sessionType: 'general'
          },
          // NUEVO: Incluir el razonamiento real del orquestador
          orchestrationReasoning: orchestrationResult.reasoning,
          agentConfidence: orchestrationResult.confidence,
          contextualTools: orchestrationResult.contextualTools
        };
        
        // Generar bullets progresivos que reflejen el razonamiento real
        const bulletGenerator = this.generateReasoningBullets(bulletContext, onBulletUpdate);
        
        // Procesar bullets de forma asíncrona
        (async () => {
          try {
            for await (const bullet of bulletGenerator) {
              // Los bullets ahora reflejan el razonamiento real del agente
              this.log('debug', `Bullet coherente generado: ${bullet.content}`);
            }
          } catch (error) {
            this.log('warn', `Error generando bullets coherentes: ${error}`);
          }
        })();
        
        // Pausa reducida ya que la orquestación ya se completó
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
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
      
      // 6. Generar recomendaciones (optimizado para performance)
      let recommendations: DynamicOrchestrationResult['recommendations'] = undefined;
      
      if (this.config.enableRecommendations) {
        if (this.config.asyncRecommendations) {
          // 🚀 OPTIMIZACIÓN: Recomendaciones asíncronas (no bloquean respuesta)
          this.generateRecommendations(orchestrationResult, sessionContext)
            .then(rec => {
              if (rec) {
                this.cacheRecommendations(sessionId, rec);
                this.log('info', `📊 Async recommendations generated for session ${sessionId}`);
              }
            })
            .catch(error => this.log('warn', `Error generating async recommendations: ${error}`));
          
          // Usar recomendaciones cacheadas si existen
          recommendations = this.getCachedRecommendations(sessionId);
        } else {
          // Modo síncrono tradicional
          recommendations = await this.generateRecommendations(orchestrationResult, sessionContext);
        }
      }
      
      // Registrar cambio de agente si es diferente al anterior
      if (sessionContext.currentAgent && sessionContext.currentAgent !== orchestrationResult.selectedAgent) {
        this.metricsTracker.trackAgentSwitch({
          userId,
          sessionId,
          fromAgent: sessionContext.currentAgent as any,
          toAgent: orchestrationResult.selectedAgent as any,
          switchType: 'automatic',
          confidence: orchestrationResult.confidence
        });
      }
      
      // El tiempo de respuesta del orquestador se registra en el API layer
      // para mantener consistencia en las métricas
      
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
   * Genera bullets progresivos de razonamiento en tiempo real
   */
  async *generateReasoningBullets(
    context: BulletGenerationContext,
    onBulletUpdate?: (bullet: ReasoningBullet) => void
  ): AsyncGenerator<ReasoningBullet, void, unknown> {
    const startTime = Date.now();
    let bulletCounter = 0;
    
    try {
      this.log('info', `Generando bullets progresivos para sesión ${context.sessionContext.length > 0 ? 'con contexto' : 'nueva'}`);
      
      // Construir prompt contextual para generar bullets progresivos
      const bulletPrompt = this.buildBulletGenerationPrompt(context);
      
      // Crear chat para generar bullets progresivos coherentes con el agente
      const bulletChat = ai.chats.create({
        model: 'gemini-2.5-flash-lite',
        config: {
          systemInstruction: `Eres el sistema de razonamiento progresivo de HopeAI, especializado en generar bullets que reflejen AUTÉNTICAMENTE el proceso de pensamiento del agente seleccionado.

Tu tarea es crear bullets que muestren cómo el agente específico está procesando la consulta según su metodología particular:

🤔 **Supervisor Clínico (socratico)**: Enfoque en exploración reflexiva, identificación de patrones emocionales, formulación de preguntas socráticas y facilitación de insights.

📋 **Especialista en Documentación (clinico)**: Enfoque en análisis de información, estructuración profesional, identificación de elementos clínicamente relevantes y síntesis documental.

🔬 **Investigador Académico (academico)**: Enfoque en validación empírica, búsqueda de evidencia, evaluación metodológica y síntesis científica.

🎯 **Orquestador Dinámico (orquestador)**: Enfoque en análisis de intención, selección de especialista, optimización de herramientas y coordinación inteligente.

**PRINCIPIOS CRÍTICOS:**
1. Usa el razonamiento de selección proporcionado como base fundamental
2. Refleja la metodología específica del agente seleccionado
3. Incorpora las herramientas contextuales disponibles
4. Muestra progresión lógica hacia la respuesta del agente
5. Sé específico al caso, nunca genérico

**Formato:** Genera exactamente 4-6 bullets, uno por línea, comenzando con "• "

**Ejemplo Supervisor Clínico:**
• Identificando patrones emocionales subyacentes en la narrativa compartida
• Evaluando disposición para exploración reflexiva profunda
• Formulando preguntas que faciliten autoconocimiento sobre la situación
• Preparando terreno para insights sobre creencias limitantes`,
          temperature: 0.6,
          maxOutputTokens: 600,
          topP: 0.8
        }
      });
      
      // Generar bullets usando streaming
      const bulletStream = await bulletChat.sendMessageStream({ message: bulletPrompt });
      
      let accumulatedText = '';
      let currentBulletText = '';
      let isInBullet = false;
      
      for await (const chunk of bulletStream) {
        if (chunk.text) {
          accumulatedText += chunk.text;
          currentBulletText += chunk.text;
          
          // Detectar inicio de bullet
          if (chunk.text.includes('•') && !isInBullet) {
            isInBullet = true;
            currentBulletText = chunk.text.substring(chunk.text.indexOf('•'));
          }
          
          // Detectar final de bullet (nueva línea)
          if (isInBullet && chunk.text.includes('\n')) {
            const bulletContent = currentBulletText
              .replace('•', '')
              .trim()
              .split('\n')[0]
              .trim();
            
            if (bulletContent.length > 0) {
              bulletCounter++;
              const bullet: ReasoningBullet = {
                id: `bullet_${Date.now()}_${bulletCounter}`,
                content: bulletContent,
                status: 'completed',
                timestamp: new Date(),
                order: bulletCounter
              };
              
              // Callback para actualización en tiempo real
              if (onBulletUpdate) {
                onBulletUpdate(bullet);
              }
              
              yield bullet;
              
              // Pequeña pausa para efecto visual
              await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            currentBulletText = '';
            isInBullet = false;
          }
        }
      }
      
      // Procesar último bullet si no terminó con nueva línea
      if (isInBullet && currentBulletText.trim().length > 0) {
        const bulletContent = currentBulletText
          .replace('•', '')
          .trim();
        
        if (bulletContent.length > 0) {
          bulletCounter++;
          const bullet: ReasoningBullet = {
            id: `bullet_${Date.now()}_${bulletCounter}`,
            content: bulletContent,
            status: 'completed',
            timestamp: new Date(),
            order: bulletCounter
          };
          
          if (onBulletUpdate) {
            onBulletUpdate(bullet);
          }
          
          yield bullet;
        }
      }
      
      const processingTime = Date.now() - startTime;
      this.log('info', `Bullets progresivos generados: ${bulletCounter} bullets en ${processingTime}ms`);
      
    } catch (error) {
      this.log('error', `Error generando bullets progresivos: ${error}`);
      
      // Generar bullet de error
      const errorBullet: ReasoningBullet = {
        id: `bullet_error_${Date.now()}`,
        content: 'Procesando consulta...',
        status: 'error',
        timestamp: new Date(),
        order: 1
      };
      
      if (onBulletUpdate) {
        onBulletUpdate(errorBullet);
      }
      
      yield errorBullet;
    }
  }
  
  /**
   * Construye el prompt para generar bullets contextuales
   */
  private buildBulletGenerationPrompt(context: BulletGenerationContext): string {
    const { 
      userInput, 
      sessionContext, 
      selectedAgent, 
      extractedEntities, 
      clinicalContext,
      orchestrationReasoning,
      agentConfidence,
      contextualTools
    } = context;
    
    let prompt = `Consulta del usuario: "${userInput}"\n\n`;
    
    // Añadir contexto de sesión si existe
    if (sessionContext && sessionContext.length > 0) {
      const recentMessages = sessionContext.slice(-3);
      prompt += `Contexto de conversación reciente:\n`;
      recentMessages.forEach((msg: any, index) => {
        prompt += `${index + 1}. ${msg.role}: ${msg.parts?.[0]?.text || msg.content || 'Sin contenido'}\n`;
      });
      prompt += `\n`;
    }
    
    // MEJORA CRÍTICA: Incluir el razonamiento real del orquestador
    prompt += `Agente especializado seleccionado: ${selectedAgent}\n`;
    if (orchestrationReasoning) {
      prompt += `Razonamiento de selección: ${orchestrationReasoning}\n`;
    }
    if (agentConfidence) {
      prompt += `Confianza en la selección: ${(agentConfidence * 100).toFixed(1)}%\n`;
    }
    prompt += `\n`;
    
    // Añadir herramientas contextuales si existen
    if (contextualTools && contextualTools.length > 0) {
      prompt += `Herramientas clínicas disponibles: ${contextualTools.map((tool: any) => tool.name).join(', ')}\n\n`;
    }
    
    // Añadir entidades extraídas si existen
    if (extractedEntities && extractedEntities.length > 0) {
      prompt += `Entidades clínicas detectadas: ${extractedEntities.map((e: any) => e.text || e.name).join(', ')}\n\n`;
    }
    
    // Añadir contexto clínico si existe
    if (clinicalContext) {
      if (clinicalContext.patientId) {
        prompt += `Contexto del paciente: ID ${clinicalContext.patientId}\n`;
      }
      if (clinicalContext.sessionType) {
        prompt += `Tipo de sesión: ${clinicalContext.sessionType}\n`;
      }
      prompt += `\n`;
    }
    
    // MEJORA CRÍTICA: Prompts específicos por agente que reflejen su metodología
    prompt += this.getAgentSpecificBulletInstructions(selectedAgent);
    
    return prompt;
  }
  
  /**
   * Genera instrucciones específicas para bullets según el agente seleccionado
   */
  private getAgentSpecificBulletInstructions(selectedAgent: string): string {
    const agentInstructions = {
      'socratico': `Como Supervisor Clínico de HopeAI, genera bullets que reflejen tu proceso de razonamiento socrático:
• Muestra cómo identificas patrones en la información del usuario
• Refleja tu proceso de formulación de preguntas reflexivas
• Indica cómo evalúas la profundidad emocional requerida
• Demuestra tu análisis de la disposición del usuario para la exploración
• Muestra cómo preparas el terreno para insights terapéuticos

Ejemplo de bullets socráticos:
• Identificando patrones emocionales subyacentes en la narrativa del usuario
• Evaluando la disposición para exploración reflexiva profunda
• Formulando preguntas que faciliten el autoconocimiento
• Preparando terreno para insights sobre creencias limitantes`,
      
      'clinico': `Como Especialista en Documentación de HopeAI, genera bullets que reflejen tu proceso de síntesis documental:
• Muestra cómo analizas la información para estructurarla profesionalmente
• Refleja tu proceso de identificación de elementos clínicamente relevantes
• Indica cómo organizas la información según estándares profesionales
• Demuestra tu evaluación de completitud y coherencia documental
• Muestra cómo preparas la síntesis para uso clínico futuro

Ejemplo de bullets clínicos:
• Analizando elementos clave para documentación estructurada
• Identificando información clínicamente relevante para el expediente
• Organizando datos según formato SOAP/PIRP apropiado
• Evaluando completitud de la información para síntesis profesional`,
      
      'academico': `Como Investigador Académico de HopeAI, genera bullets que reflejen tu proceso de validación científica:
• Muestra cómo identificas conceptos que requieren validación empírica
• Refleja tu proceso de formulación de consultas de búsqueda específicas
• Indica cómo evalúas la relevancia de diferentes fuentes científicas
• Demuestra tu análisis de la calidad metodológica de la evidencia
• Muestra cómo preparas la síntesis de evidencia para aplicación clínica

Ejemplo de bullets académicos:
• Identificando conceptos clave que requieren validación científica
• Formulando estrategias de búsqueda en bases de datos especializadas
• Evaluando relevancia y calidad metodológica de estudios disponibles
• Sintetizando evidencia empírica para aplicación clínica práctica`,
      
      'orquestador': `Como Orquestador Dinámico de HopeAI, genera bullets que reflejen tu proceso de coordinación inteligente:
• Muestra cómo analizas la consulta para determinar el especialista óptimo
• Refleja tu evaluación de la complejidad y naturaleza de la solicitud
• Indica cómo consideras el contexto de sesión para la selección
• Demuestra tu proceso de optimización de herramientas contextuales
• Muestra cómo preparas la transición fluida al especialista seleccionado

Ejemplo de bullets de orquestación:
• Analizando naturaleza de la consulta para selección óptima de especialista
• Evaluando contexto de sesión y historial para continuidad terapéutica
• Optimizando herramientas clínicas según dominio detectado
• Preparando transición fluida al especialista más apropiado`
    };
    
    return agentInstructions[selectedAgent as keyof typeof agentInstructions] || agentInstructions['socratico'];
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
  private updateConversationHistory(session: SessionContext, userInput: string, sessionFiles?: ClinicalFile[]): void {
    // ARCHITECTURAL FIX: Enrich user input with file attachment context for orchestration
    let enrichedUserInput = userInput;
    
    if (sessionFiles && sessionFiles.length > 0) {
      const fileNames = sessionFiles.map(f => f.name).join(', ');
      enrichedUserInput = `${userInput}

**CONTEXTO PARA ORQUESTACIÓN:** El usuario ha adjuntado ${sessionFiles.length} archivo(s): ${fileNames}. Esta información debe considerarse al seleccionar el agente y herramientas apropiados.`;
      
      console.log(`[DynamicOrchestrator] Context enriched with ${sessionFiles.length} files:`, fileNames);
    }
    
    session.conversationHistory.push({
      role: 'user',
      parts: [{ text: enrichedUserInput }]
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
   * Actualiza los tópicos dominantes de la sesión (con optimización de frecuencia)
   */
  private async updateDominantTopics(session: SessionContext): Promise<void> {
    if (session.conversationHistory.length < 2) return;
    
    // 🚀 OPTIMIZACIÓN: Solo actualizar cada N interacciones
    const shouldUpdate = session.sessionMetadata.totalInteractions % (this.config.dominantTopicsUpdateInterval || 5) === 0;
    if (!shouldUpdate) {
      this.log('debug', `Skipping dominant topics update (interval: ${this.config.dominantTopicsUpdateInterval})`);
      return;
    }
    
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
      
      this.log('debug', `Updated dominant topics: ${topics.length} new topics identified`);
      
    } catch (error) {
      this.log('warn', `Error actualizando tópicos dominantes: ${error}`);
    }
  }

  /**
   * Cachea recomendaciones para uso futuro
   */
  private cacheRecommendations(sessionId: string, recommendations: DynamicOrchestrationResult['recommendations']): void {
    this.recommendationsCache.set(sessionId, recommendations);
    
         // Limpiar cache antiguo (máximo 50 sesiones)
     if (this.recommendationsCache.size > 50) {
       const oldestKey = this.recommendationsCache.keys().next().value;
       if (oldestKey) {
         this.recommendationsCache.delete(oldestKey);
       }
     }
  }

  /**
   * Obtiene recomendaciones cacheadas
   */
  private getCachedRecommendations(sessionId: string): DynamicOrchestrationResult['recommendations'] {
    return this.recommendationsCache.get(sessionId);
  }

  /**
   * Genera recomendaciones basadas en el contexto y preferencias del usuario
   */
  private async generateRecommendations(
    orchestrationResult: OrchestrationResult,
    session: SessionContext
  ): Promise<DynamicOrchestrationResult['recommendations']> {
    try {
      // 🧠 Obtener recomendaciones personalizadas basadas en historial del usuario
      const personalizedRecs = await this.userPreferencesManager.getPersonalizedRecommendations(
        session.userId,
        {
          currentAgent: orchestrationResult.selectedAgent,
          recentTopics: session.sessionMetadata.dominantTopics,
          sessionLength: session.sessionMetadata.totalInteractions
        }
      );
      
      // Combinar recomendaciones personalizadas con análisis contextual de AI
      const contextPrompt = this.buildRecommendationPrompt(orchestrationResult, session, personalizedRecs);
      
      const result = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: contextPrompt
      });
      
      const aiRecommendations = this.parseRecommendations(result.text || '');
      
      // Fusionar recomendaciones personalizadas con las de AI
      const enhancedRecommendations = {
        suggestedFollowUp: aiRecommendations?.suggestedFollowUp || personalizedRecs.rationale,
        alternativeApproaches: [
          ...(aiRecommendations?.alternativeApproaches || []),
          ...personalizedRecs.suggestedTools.map((tool: string) => `Use ${tool} based on your successful past usage`)
        ].slice(0, 3),
                 clinicalConsiderations: [
           ...(aiRecommendations?.clinicalConsiderations || []),
           ...(personalizedRecs.suggestedAgent ? [`Consider switching to ${personalizedRecs.suggestedAgent} agent based on your preferences`] : [])
         ]
      };
      
      // 📊 Aprender de la interacción actual
      await this.learnFromInteraction(session, orchestrationResult, personalizedRecs);
      
      return enhancedRecommendations;
      
    } catch (error) {
      this.log('warn', `Error generando recomendaciones: ${error}`);
      return undefined;
    }
  }

  /**
   * Construye prompt para generar recomendaciones con contexto personalizado
   */
  private buildRecommendationPrompt(
    orchestrationResult: OrchestrationResult,
    session: SessionContext,
    personalizedRecs?: any
  ): string {
    const personalizationContext = personalizedRecs ? `
    
CONTEXTO PERSONALIZADO DEL USUARIO:
- Agente preferido: ${personalizedRecs.suggestedAgent || 'Ninguna preferencia específica'}
- Herramientas exitosas: ${personalizedRecs.suggestedTools.join(', ')}
- Contexto de preferencias: ${personalizedRecs.rationale}
- Confianza en personalización: ${(personalizedRecs.confidence * 100).toFixed(1)}%` : '';

    return `Como asistente especializado en psicología clínica, analiza el siguiente contexto y genera recomendaciones personalizadas:

CONTEXTO ACTUAL:
Agente seleccionado: ${orchestrationResult.selectedAgent}
Herramientas disponibles: ${orchestrationResult.contextualTools.map(t => t.name).join(', ')}
Tópicos dominantes: ${session.sessionMetadata.dominantTopics.join(', ')}
Interacciones en sesión: ${session.sessionMetadata.totalInteractions}${personalizationContext}

Genera recomendaciones personalizadas en el siguiente formato JSON:
{
  "suggestedFollowUp": "Pregunta o acción sugerida basada en el historial y contexto actual",
  "alternativeApproaches": ["Enfoque alternativo 1", "Enfoque alternativo 2"],
  "clinicalConsiderations": ["Consideración clínica personalizada 1", "Consideración clínica personalizada 2"]
}`;
  }

  /**
   * Aprende de la interacción actual para mejorar futuras recomendaciones
   */
  private async learnFromInteraction(
    session: SessionContext,
    orchestrationResult: OrchestrationResult,
    personalizedRecs: any
  ): Promise<void> {
    try {
      // Registrar el uso de herramientas y agente como comportamiento positivo
      await this.userPreferencesManager.learnFromBehavior(
        session.userId,
        {
          action: `agent_selection_${orchestrationResult.selectedAgent}`,
          context: session.sessionMetadata.dominantTopics,
          outcome: 'positive', // Asumir positivo por ahora, en producción esto vendría del feedback del usuario
          agent: orchestrationResult.selectedAgent,
          tools: orchestrationResult.contextualTools.map(tool => tool.name || 'unknown_tool')
        }
      );
      
      // Incrementar métricas de sesión
      const userPrefs = await this.userPreferencesManager.getUserPreferences(session.userId);
      await this.userPreferencesManager.updatePreferences(session.userId, {
        sessionMetrics: {
          ...userPrefs.sessionMetrics,
          totalSessions: userPrefs.sessionMetrics.totalSessions + 1,
          averageSessionLength: Math.round(
            (userPrefs.sessionMetrics.averageSessionLength * userPrefs.sessionMetrics.totalSessions + 
             session.sessionMetadata.totalInteractions) / 
            (userPrefs.sessionMetrics.totalSessions + 1)
          )
        }
      });
      
      this.log('info', `🎯 [DynamicOrchestrator] Cross-session learning completed for user: ${session.userId}`);
      
    } catch (error) {
      this.log('warn', `Error learning from interaction: ${error}`);
    }
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
   * Get comprehensive user analytics and insights
   */
  public async getUserAnalytics(userId: string): Promise<{
    totalSessions: number;
    favoriteAgent: string;
    topTools: string[];
    learningTrends: string[];
    efficiency: number;
    sessionInsights: {
      averageLength: number;
      dominantTopics: string[];
      toolEffectiveness: { [key: string]: number };
    };
  }> {
    try {
      const userAnalytics = await this.userPreferencesManager.getUserAnalytics(userId);
      
      // Get additional insights from active session if exists
      const userSessions = Array.from(this.activeSessions.values())
        .filter(session => session.userId === userId);
      
      const currentSessionInsights = userSessions.length > 0 ? {
        currentTopics: userSessions[0].sessionMetadata.dominantTopics,
        currentAgent: userSessions[0].currentAgent,
        currentInteractions: userSessions[0].sessionMetadata.totalInteractions
      } : null;
      
      return {
        ...userAnalytics,
        sessionInsights: {
          averageLength: userAnalytics.totalSessions > 0 ? 
            userSessions.reduce((sum, s) => sum + s.sessionMetadata.totalInteractions, 0) / userSessions.length : 0,
          dominantTopics: userAnalytics.learningTrends,
          toolEffectiveness: userAnalytics.topTools.reduce((acc, tool, index) => {
            acc[tool] = Math.max(0.9 - (index * 0.1), 0.5); // Simulate effectiveness based on ranking
            return acc;
          }, {} as { [key: string]: number })
        }
      };
      
    } catch (error) {
      this.log('error', `Error getting user analytics for ${userId}: ${error}`);
      return {
        totalSessions: 0,
        favoriteAgent: 'socratico',
        topTools: [],
        learningTrends: [],
        efficiency: 0,
        sessionInsights: {
          averageLength: 0,
          dominantTopics: [],
          toolEffectiveness: {}
        }
      };
    }
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