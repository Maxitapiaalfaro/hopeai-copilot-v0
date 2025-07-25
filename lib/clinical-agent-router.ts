import { ai, clinicalModelConfig } from "./google-genai-config"
import { pubmedTool } from "./pubmed-research-tool"
import type { AgentType, AgentConfig, ChatMessage } from "@/types/clinical-types"

export class ClinicalAgentRouter {
  private agents: Map<AgentType, AgentConfig> = new Map()
  private activeChatSessions: Map<string, any> = new Map()

  constructor() {
    this.initializeAgents()
  }

  // Prompt Information Block
  // Version: 2.0
  // Author: System-Critique Analyst
  // Changelog: Complete restructure with PTCF framework, security hardening, and structured output
  
  private initializeAgents() {
    // HopeAI Socrático - Therapeutic Dialogue Agent
    this.agents.set("socratico", {
      name: "HopeAI Socrático",
      description: "Especialista en diálogo terapéutico y reflexión profunda",
      color: "blue",
      systemInstruction: `## Rol y Objetivo
Eres HopeAI Socrático, un supervisor clínico senior especializado en facilitar insight terapéutico mediante el método socrático estructurado.

## Proceso Interno de Pensamiento Obligatorio 
1. Analiza el contexto proporcionado (entidades, resumen de sesión, prioridades)
2. Identifica patrones cognitivos y dinámicas terapéuticas clave
3. Formula una pregunta socrática específica que facilite la reflexión
4. Proporciona justificación clínica y seguimiento sugerido

## Técnicas Socráticas de Uso Interno
- Preguntas de clarificación: "¿Qué evidencia tienes de que...?"
- Exploración de supuestos: "¿Qué asumes cuando dices...?"
- Examen de evidencia: "¿Cómo llegaste a esa conclusión?"
- Perspectivas alternativas: "¿Qué otras explicaciones podrían existir?"
- Implicaciones: "Si esto fuera cierto, ¿qué significaría?"

## Reglas
- Mantén confidencialidad absoluta
- NO proporciones diagnósticos directos, solo hipótesis y/o análisis crítico clínico
- Deriva inmediatamente si detectas riesgo de crisis
- Tus respuestas siempre las provees en un orden logico en formato Markdown
- Enfócate en el desarrollo profesional del terapeuta
- Tono profesional pero cálido, como supervisión clínica real`,
      tools: [],
      config: {
        ...clinicalModelConfig,
        temperature: 0.4,
      },
    })

    // HopeAI Clínico - Clinical Documentation Agent
    this.agents.set("clinico", {
      name: "HopeAI Clínico",
      description: "Especialista en síntesis y documentación clínica",
      color: "green",
      systemInstruction: `## Rol y Objetivo
Eres HopeAI Clínico, un documentalista clínico senior especializado en generar documentación que cumple estándares DSM-5-TR y protocolos de confidencialidad. Tus respuestas siempre las provees en un orden logico en formato Markdown

## Proceso Interno de Pensamiento Obligatorio 
1. Analiza el contexto extraído (tarea, paciente, formato requerido)
2. Extrae datos objetivos y observaciones conductuales
3. Identifica indicadores clínicos y patrones comportamentales
4. Estructura la documentación según el formato solicitado
5. Valida cumplimiento de confidencialidad y precisión terminológica

## Formatos de Documentación
- **Resúmenes de sesión**: Estructura SOAP (Subjetivo, Objetivo, Análisis, Plan)
- **Planes de tratamiento**: Formato SMART (Específico, Medible, Alcanzable, Relevante, Temporal)
- **Notas de progreso**: Cronológicas con métricas cuantificables

## Reglas de Confidencialidad
- Utiliza únicamente iniciales o códigos de referencia para identificar a los pacientes
- Marca documentación clínica como "CONFIDENCIAL - USO CLÍNICO"
- Incluye disclaimer de confidencialidad en documentación clínica
- Terminología clínica profesional en español`,
      tools: [],
      config: {
        ...clinicalModelConfig,
        temperature: 0.2,
      },
    })

    // HopeAI Académico - Research and Evidence Agent
    this.agents.set("academico", {
      name: "HopeAI Académico",
      description: "Especialista en investigación y evidencia científica",
      color: "purple",
      systemInstruction: `## Rol y Objetivo
Eres HopeAI Académico, un investigador clínico senior especializado en síntesis de evidencia científica mediante búsquedas en PubMed y análisis crítico de literatura.

## Proceso Interno de Pensamiento Obligatorio 
1. Analiza el contexto extraído (términos de búsqueda, población objetivo)
2. Ejecuta búsqueda en PubMed con términos específicos y operadores booleanos
3. Evalúa calidad metodológica y nivel de evidencia de cada estudio
4. Sintetiza hallazgos considerando heterogeneidad y aplicabilidad clínica
5. Formula recomendaciones basadas en evidencia con niveles de certeza

## Criterios de Evaluación Internos Obligatorios
- **Nivel de evidencia**: I-V según Oxford Centre for Evidence-Based Medicine
- **Calidad metodológica**: RCT > estudios observacionales > casos clínicos
- **Relevancia clínica**: vs. significancia estadística
- **Aplicabilidad**: a población objetivo específica

## Estructura de Respuesta
**EVIDENCIA CIENTÍFICA**: Estudios relevantes con nivel de evidencia (I-V), tamaño muestral, y limitaciones metodológicas específicas
**APLICACIÓN CLÍNICA**: Implicaciones directas para la práctica terapéutica, consideraciones diagnósticas, y adaptaciones según población
**RECOMENDACIONES BASADAS EN EVIDENCIA**: Intervenciones específicas con grado de recomendación (A-D), contraindicaciones, y consideraciones éticas
**BRECHAS EN EL CONOCIMIENTO**: Áreas que requieren más investigación, limitaciones actuales, y precauciones clínicas necesarias

## Reglas
- Usa herramienta PubMed para búsquedas específicas
- Formato APA 7ª edición, incluye DOI/PMID
- Si evidencia limitada: "La evidencia actual es insuficiente"
- Tus respuestas siempre las provees en un orden logico en formato Markdown
- Rigor académico con lenguaje especializado para psicólogos clínicos`,
      tools: [pubmedTool.getToolDeclaration()],
      config: {
        ...clinicalModelConfig,
        temperature: 0.3,
      },
    })
  }

  async createChatSession(sessionId: string, agent: AgentType, history?: ChatMessage[]): Promise<any> {
    const agentConfig = this.agents.get(agent)
    if (!agentConfig) {
      throw new Error(`Agent not found: ${agent}`)
    }

    try {
      // Convert history to Gemini format if provided
      const geminiHistory = history ? this.convertHistoryToGeminiFormat(history) : []

      // Create chat session using the correct SDK API
      const chat = ai.chats.create({
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
      })

      this.activeChatSessions.set(sessionId, { chat, agent })
      return chat
    } catch (error) {
      console.error("Error creating chat session:", error)
      throw error
    }
  }

  private convertHistoryToGeminiFormat(history: ChatMessage[]) {
    return history.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }))
  }

  async sendMessage(sessionId: string, message: string, useStreaming = true, enrichedContext?: any): Promise<any> {
    const sessionData = this.activeChatSessions.get(sessionId)
    if (!sessionData) {
      throw new Error(`Chat session not found: ${sessionId}`)
    }

    const { chat, agent } = sessionData

    try {
      // Enriquecer el mensaje con contexto si está disponible
      let enhancedMessage = message
      if (enrichedContext) {
        enhancedMessage = this.buildEnhancedMessage(message, enrichedContext)
      }

      // Convert message to correct SDK format
      const messageParams = {
        message: enhancedMessage
      }

      if (useStreaming) {
        const result = await chat.sendMessageStream(messageParams)

        // Handle function calls for academic agent
        if (agent === "academico") {
          return this.handleStreamingWithTools(result, sessionId)
        }

        return result
      } else {
        const result = await chat.sendMessage(messageParams)

        // Handle function calls for academic agent
        if (agent === "academico") {
          return this.handleNonStreamingWithTools(result, sessionId)
        }

        return result
      }
    } catch (error) {
      console.error("Error sending message:", error)
      throw error
    }
  }

  private async handleStreamingWithTools(result: any, sessionId: string): Promise<any> {
    const sessionData = this.activeChatSessions.get(sessionId)
    if (!sessionData) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    // Create a new async generator that properly handles function calls during streaming
    return (async function* () {
      let accumulatedText = ""
      let functionCalls: any[] = []
      let hasYieldedContent = false
      
      try {
        // Process the streaming result chunk by chunk
        for await (const chunk of result) {
          // Always yield text chunks immediately for responsive UI
          if (chunk.text) {
            accumulatedText += chunk.text
            hasYieldedContent = true
            yield chunk
          }
          
          // Collect function calls as they arrive
          if (chunk.functionCalls) {
            functionCalls.push(...chunk.functionCalls)
          }
        }
        
        // After the initial stream is complete, handle function calls if any
        if (functionCalls.length > 0) {
          console.log(`[ClinicalRouter] Processing ${functionCalls.length} function calls`)
          
          // Execute all function calls in parallel
          const functionResponses = await Promise.all(
            functionCalls.map(async (call: any) => {
              if (call.name === "searchPubMed") {
                console.log(`[ClinicalRouter] Executing PubMed search:`, call.args)
                const toolResult = await pubmedTool.executeTool(call.args)
                return {
                  name: call.name,
                  response: toolResult,
                }
              }
              return null
            })
          )
          
          // Filter out null responses
          const validResponses = functionResponses.filter(response => response !== null)
          
          if (validResponses.length > 0) {
            console.log(`[ClinicalRouter] Sending ${validResponses.length} function responses back to model`)
            
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
            })
            
            // Yield the follow-up response chunks
            for await (const chunk of followUpResult) {
              if (chunk.text) {
                hasYieldedContent = true
                yield chunk
              }
            }
          }
        }
        
        // If no content was yielded at all, yield an empty chunk to prevent UI hanging
        if (!hasYieldedContent) {
          console.warn('[ClinicalRouter] No content yielded, providing fallback')
          yield { text: "" }
        }
        
      } catch (error) {
        console.error("[ClinicalRouter] Error in streaming with tools:", error)
        // Yield error information as a chunk
        yield { 
          text: "Lo siento, hubo un error procesando tu solicitud. Por favor, inténtalo de nuevo.",
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      }
    })()
  }

  private buildEnhancedMessage(originalMessage: string, enrichedContext: any): string {
    // Si es una solicitud de confirmación, devolver el mensaje tal como está
    // (ya viene formateado como prompt de confirmación desde HopeAI System)
    if (enrichedContext.isConfirmationRequest) {
      return originalMessage
    }
    
    let enhancedMessage = originalMessage
    
    // Agregar entidades extraídas si están disponibles
    if (enrichedContext.extractedEntities && enrichedContext.extractedEntities.length > 0) {
      const entitiesText = enrichedContext.extractedEntities.join(", ")
      enhancedMessage += `\n\n[Contexto detectado: ${entitiesText}]`
    }
    
    // Agregar información de sesión relevante
    if (enrichedContext.sessionSummary) {
      enhancedMessage += `\n\n[Resumen de sesión: ${enrichedContext.sessionSummary}]`
    }
    
    // Agregar prioridades específicas del agente
    if (enrichedContext.agentPriorities && enrichedContext.agentPriorities.length > 0) {
      const prioritiesText = enrichedContext.agentPriorities.join(", ")
      enhancedMessage += `\n\n[Enfoques prioritarios: ${prioritiesText}]`
    }
    
    return enhancedMessage
  }



  private async handleNonStreamingWithTools(result: any, sessionId: string): Promise<any> {
    const functionCalls = result.functionCalls

    if (functionCalls && functionCalls.length > 0) {
      // Execute function calls
      const functionResponses = await Promise.all(
        functionCalls.map(async (call: any) => {
          if (call.name === "searchPubMed") {
            const toolResult = await pubmedTool.executeTool(call.args)
            return {
              name: call.name,
              response: toolResult,
            }
          }
          return null
        }),
      )

      // Send function results back to the model
      const sessionData = this.activeChatSessions.get(sessionId)
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
        })
        return followUpResult
      }
    }

    return result
  }

  getAgentConfig(agent: AgentType): AgentConfig | undefined {
    return this.agents.get(agent)
  }

  getAllAgents(): Map<AgentType, AgentConfig> {
    return this.agents
  }

  closeChatSession(sessionId: string): void {
    this.activeChatSessions.delete(sessionId)
  }
}

// Singleton instance
export const clinicalAgentRouter = new ClinicalAgentRouter()
