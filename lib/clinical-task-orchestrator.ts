import { ai } from "./google-genai-config"
import { createContextWindowManager } from "./context-window-manager"
import type { FichaClinicaState, ChatState } from "@/types/clinical-types"
import { createPartFromUri } from "@google/genai"
import type { Content, Part } from "@google/genai"

/**
 * ClinicalTaskOrchestrator
 * Gestiona tareas asíncronas de larga duración, como la generación/actualización
 * de la Ficha Clínica, sin bloquear el flujo conversacional.
 */
export class ClinicalTaskOrchestrator {
  private static instance: ClinicalTaskOrchestrator | null = null
  private constructor() {}

  static getInstance(): ClinicalTaskOrchestrator {
    if (!ClinicalTaskOrchestrator.instance) {
      ClinicalTaskOrchestrator.instance = new ClinicalTaskOrchestrator()
    }
    return ClinicalTaskOrchestrator.instance
  }

  /**
   * Dispara generación inicial de Ficha Clínica
   */
  async generateFichaClinica(params: {
    fichaId: string
    pacienteId: string
    sessionState: ChatState
    patientForm?: any
    conversationSummary?: string
    sessionId?: string
    previousFichaContent?: string
  }): Promise<FichaClinicaState> {
    // Stateless server generation: DO NOT persist on server.
    // Client will handle persistence in IndexedDB.
    const initialState: FichaClinicaState = {
      fichaId: params.fichaId,
      pacienteId: params.pacienteId,
      estado: 'generando',
      contenido: '',
      version: 1,
      ultimaActualizacion: new Date(),
      historialVersiones: [{ version: 1, fecha: new Date() }]
    }

    try {
      // 1) Construcción de contexto: historial + formulario inicial + resumen conversación + ficha anterior
      const messageParts: Part[] = await this.composePartsForModel(
        params.sessionState,
        params.patientForm,
        params.conversationSummary,
        params.sessionId,
        params.previousFichaContent
      )

      // 2) Llamada stateless al modelo con systemInstruction estricta
      const content: Content = { role: 'user', parts: messageParts as unknown as any }
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [content as any],
        config: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          systemInstruction: this.getArchivistaSystemInstruction()
        }
      })

      const text = result.text || ''
      const completed: FichaClinicaState = {
        ...initialState,
        estado: 'completado',
        contenido: text,
        ultimaActualizacion: new Date()
      }
      return completed
    } catch (error) {
      const failed: FichaClinicaState = {
        fichaId: params.fichaId,
        pacienteId: params.pacienteId,
        estado: 'error',
        contenido: '',
        version: 1,
        ultimaActualizacion: new Date(),
        historialVersiones: [{ version: 1, fecha: new Date() }]
      }
      return failed
    }
  }

  /**
   * Construye prompt consolidado con límite de contexto usando el ContextWindowManager
   */
  private async composeFichaPromptParts(
    sessionState: ChatState,
    patientForm?: any,
    conversationSummary?: string,
    previousFichaContent?: string
  ): Promise<string> {
    const manager = createContextWindowManager({ enableLogging: false })
    const historyAsContent = sessionState.history.map(msg => ({ role: msg.role, parts: [{ text: msg.content }] }))
    const processed = manager.processContext(historyAsContent, 'Generar Ficha Clínica')

    const patientFormBlock = patientForm ? this.formatPatientForm(patientForm) : ''

    let conversation = processed.processedContext
      .map(c => c.parts?.map(p => ('text' in p ? p.text : '')).join('\n') || '')
      .filter(Boolean)
      .join('\n\n')

    // Fallback: si el gestor de contexto produce vacío, construir a partir del historial crudo
    if (!conversation || conversation.trim().length === 0) {
      const lastMessages = (sessionState.history || []).slice(-12)
      conversation = lastMessages
        .map(m => `${m.role === 'user' ? 'Paciente' : 'Modelo'}: ${m.content}`)
        .join('\n')
    }

    const header = previousFichaContent 
      ? 'Actualiza la Ficha Clínica integrando nueva información de la sesión actual.'
      : 'Genera una Ficha Clínica formal basada exclusivamente en el material provisto.'
    
    const source = 'Fuentes internas: historial de conversación y formulario/registro del paciente disponibles.'
    
    const previousFichaBlock = previousFichaContent 
      ? `\n\nFICHA CLÍNICA EXISTENTE (mantén información relevante y actualiza con nuevos datos):\n${previousFichaContent}\n`
      : ''
    
    const formBlock = patientFormBlock ? `\n\nFormulario/Registro del Paciente:\n${patientFormBlock}` : ''
    
    const autoSummary = !conversationSummary || conversationSummary.trim().length === 0
      ? conversation.split('\n').slice(-6).join('\n')
      : conversationSummary
    const convoSummaryBlock = autoSummary ? `\n\nResumen de Conversación Actual:\n${autoSummary}` : ''
    
    return `${header}\n${source}${previousFichaBlock}${formBlock}${convoSummaryBlock}\n\nHistorial:\n${conversation}`
  }

  private async composePartsForModel(
    sessionState: ChatState,
    patientForm?: any,
    conversationSummary?: string,
    sessionId?: string,
    previousFichaContent?: string
  ): Promise<Part[]> {
    const textPrompt = await this.composeFichaPromptParts(sessionState, patientForm, conversationSummary, previousFichaContent)
    const parts: Part[] = [{ text: textPrompt } as Part]

    // Adjuntar archivos del último mensaje del usuario si existen
    try {
      const history = sessionState.history || []
      const lastUserMsg = [...history].reverse().find(m => m.role === 'user' && m.fileReferences && m.fileReferences.length > 0)
      if (lastUserMsg && lastUserMsg.fileReferences) {
        const { getFilesByIds } = await import('./hopeai-system')
        const files = await getFilesByIds(lastUserMsg.fileReferences)
        for (const file of files) {
          const fileUri = file.geminiFileUri || (file.geminiFileId ? (file.geminiFileId.startsWith('files/') ? file.geminiFileId : `files/${file.geminiFileId}`) : undefined)
          if (!fileUri) continue
          try {
            const filePart = createPartFromUri(fileUri, file.type)
            parts.push(filePart as unknown as Part)
          } catch {
            // omit invalid file
          }
        }
      }
    } catch {
      // Omite adjuntos si falla la recolección
    }

    return parts
  }

  private getArchivistaSystemInstruction(): string {
    return (
      'Actúas como Especialista en Documentación Clínica. Tu tarea es crear o actualizar fichas clínicas profesionales.\n\n' +
      'CUANDO HAY FICHA EXISTENTE:\n' +
      '- Mantén toda la información relevante de la ficha anterior\n' +
      '- Integra los nuevos hallazgos de la sesión actual\n' +
      '- Actualiza diagnósticos o información que haya cambiado\n' +
      '- Mantén la coherencia temporal y clínica del caso\n' +
      '- Preserva el contexto histórico del paciente\n\n' +
      'CUANDO ES FICHA NUEVA:\n' +
      '- Genera una ficha clínica formal basada en la información proporcionada\n\n' +
      'REGLAS GENERALES:\n' +
      '- No infieras ni añadas datos externos\n' +
      '- No incluyas marcadores de sistema o etiquetas entre corchetes\n' +
      '- Escribe únicamente contenido clínico final, claro y profesional\n' +
      '- Cita únicamente hechos presentes en el material provisto\n' +
      '- Mantén un registro cronológico coherente del caso'
    )
  }

  private formatPatientForm(form: any): string {
    try {
      const lines: string[] = []
      if (form.displayName) lines.push(`Nombre: ${form.displayName}`)
      if (form.demographics) {
        const d = form.demographics
        const demo: string[] = []
        if (d.ageRange) demo.push(`Edad: ${d.ageRange}`)
        if (d.gender) demo.push(`Género: ${d.gender}`)
        if (d.occupation) demo.push(`Ocupación: ${d.occupation}`)
        if (demo.length) lines.push(`Demografía: ${demo.join(', ')}`)
      }
      if (Array.isArray(form.tags) && form.tags.length) lines.push(`Áreas de enfoque: ${form.tags.join(', ')}`)
      if (form.notes) lines.push(`Notas clínicas: ${form.notes}`)
      if (form.confidentiality?.accessLevel) lines.push(`Confidencialidad: ${form.confidentiality.accessLevel}`)
      if (Array.isArray(form.attachments) && form.attachments.length) lines.push(`Adjuntos: ${form.attachments.map((a:any)=>a.name||a.id).slice(0,10).join(', ')}`)
      return lines.join('\n')
    } catch {
      return typeof form === 'string' ? form : JSON.stringify(form)
    }
  }
}

export const clinicalTaskOrchestrator = ClinicalTaskOrchestrator.getInstance()


