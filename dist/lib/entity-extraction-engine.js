"use strict";
/**
 * Entity Extraction Engine - Fase 2B
 *
 * Motor avanzado de extracción de entidades semánticas para HopeAI
 * Implementa extracción automática de:
 * - Técnicas terapéuticas
 * - Poblaciones objetivo
 * - Trastornos y condiciones
 * - Validación semántica
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultEntityExtractor = exports.EntityExtractionEngine = void 0;
exports.createEntityExtractionEngine = createEntityExtractionEngine;
const google_genai_config_1 = require("./google-genai-config");
const genai_1 = require("@google/genai");
// Function Declarations para extracción de entidades
const entityExtractionFunctions = [
    {
        name: 'extract_therapeutic_techniques',
        description: 'Extraer técnicas terapéuticas mencionadas en el texto',
        parameters: {
            type: genai_1.Type.OBJECT,
            properties: {
                techniques: {
                    type: genai_1.Type.ARRAY,
                    items: {
                        type: genai_1.Type.OBJECT,
                        properties: {
                            name: { type: genai_1.Type.STRING, description: 'Nombre de la técnica terapéutica' },
                            category: {
                                type: genai_1.Type.STRING,
                                enum: ['cognitivo-conductual', 'psicodinámico', 'humanístico', 'sistémico', 'integrativo'],
                                description: 'Categoría de la técnica'
                            },
                            confidence: { type: genai_1.Type.NUMBER, description: 'Nivel de confianza (0-1)' },
                            context: { type: genai_1.Type.STRING, description: 'Contexto en el que se menciona' }
                        },
                        required: ['name', 'category', 'confidence']
                    }
                }
            },
            required: ['techniques']
        }
    },
    {
        name: 'extract_target_populations',
        description: 'Extraer poblaciones objetivo mencionadas en el texto',
        parameters: {
            type: genai_1.Type.OBJECT,
            properties: {
                populations: {
                    type: genai_1.Type.ARRAY,
                    items: {
                        type: genai_1.Type.OBJECT,
                        properties: {
                            group: { type: genai_1.Type.STRING, description: 'Grupo poblacional' },
                            age_range: { type: genai_1.Type.STRING, description: 'Rango de edad si aplica' },
                            characteristics: {
                                type: genai_1.Type.ARRAY,
                                items: { type: genai_1.Type.STRING },
                                description: 'Características específicas'
                            },
                            confidence: { type: genai_1.Type.NUMBER, description: 'Nivel de confianza (0-1)' }
                        },
                        required: ['group', 'confidence']
                    }
                }
            },
            required: ['populations']
        }
    },
    {
        name: 'extract_disorders_conditions',
        description: 'Extraer trastornos y condiciones clínicas mencionadas',
        parameters: {
            type: genai_1.Type.OBJECT,
            properties: {
                conditions: {
                    type: genai_1.Type.ARRAY,
                    items: {
                        type: genai_1.Type.OBJECT,
                        properties: {
                            name: { type: genai_1.Type.STRING, description: 'Nombre del trastorno o condición' },
                            category: {
                                type: genai_1.Type.STRING,
                                enum: ['ansiedad', 'depresión', 'trauma', 'personalidad', 'neurocognitivo', 'otro'],
                                description: 'Categoría diagnóstica'
                            },
                            severity: {
                                type: genai_1.Type.STRING,
                                enum: ['leve', 'moderado', 'severo', 'no_especificado'],
                                description: 'Nivel de severidad si se menciona'
                            },
                            confidence: { type: genai_1.Type.NUMBER, description: 'Nivel de confianza (0-1)' }
                        },
                        required: ['name', 'category', 'confidence']
                    }
                }
            },
            required: ['conditions']
        }
    },
    {
        name: 'extract_clinical_concepts',
        description: 'Extraer conceptos clínicos generales y herramientas de evaluación',
        parameters: {
            type: genai_1.Type.OBJECT,
            properties: {
                concepts: {
                    type: genai_1.Type.ARRAY,
                    items: {
                        type: genai_1.Type.OBJECT,
                        properties: {
                            concept: { type: genai_1.Type.STRING, description: 'Concepto clínico' },
                            type: {
                                type: genai_1.Type.STRING,
                                enum: ['assessment_tool', 'intervention', 'theoretical_framework', 'clinical_process'],
                                description: 'Tipo de concepto'
                            },
                            relevance: {
                                type: genai_1.Type.STRING,
                                enum: ['alta', 'media', 'baja'],
                                description: 'Relevancia para el contexto'
                            },
                            confidence: { type: genai_1.Type.NUMBER, description: 'Nivel de confianza (0-1)' }
                        },
                        required: ['concept', 'type', 'confidence']
                    }
                }
            },
            required: ['concepts']
        }
    }
];
class EntityExtractionEngine {
    constructor(config = {}) {
        this.knownEntities = new Map();
        this.synonymMaps = new Map();
        this.config = {
            enableValidation: true,
            confidenceThreshold: 0.7,
            maxEntitiesPerType: 10,
            enableSynonymExpansion: true,
            enableContextualAnalysis: true,
            ...config
        };
        this.initializeKnownEntities();
        this.initializeSynonymMaps();
    }
    initializeKnownEntities() {
        // Técnicas terapéuticas conocidas
        this.knownEntities.set('therapeutic_technique', new Set([
            'EMDR', 'TCC', 'Terapia Cognitivo-Conductual', 'DBT', 'ACT',
            'Mindfulness', 'Exposición', 'Reestructuración Cognitiva',
            'Terapia Gestalt', 'Psicoanálisis', 'Terapia Sistémica',
            'Terapia Narrativa', 'Hipnoterapia', 'Biofeedback'
        ]));
        // Poblaciones objetivo conocidas
        this.knownEntities.set('target_population', new Set([
            'veteranos', 'adolescentes', 'niños', 'adultos mayores',
            'mujeres víctimas de violencia', 'personas con discapacidad',
            'refugiados', 'personal de salud', 'estudiantes universitarios'
        ]));
        // Trastornos y condiciones conocidas
        this.knownEntities.set('disorder_condition', new Set([
            'TEPT', 'Depresión Mayor', 'Trastorno de Ansiedad Generalizada',
            'Trastorno Bipolar', 'Esquizofrenia', 'Trastorno Límite de Personalidad',
            'Trastorno Obsesivo-Compulsivo', 'Fobia Social', 'Agorafobia'
        ]));
    }
    initializeSynonymMaps() {
        this.synonymMaps.set('EMDR', ['Desensibilización y Reprocesamiento por Movimientos Oculares']);
        this.synonymMaps.set('TCC', ['Terapia Cognitivo-Conductual', 'CBT']);
        this.synonymMaps.set('DBT', ['Terapia Dialéctica Conductual']);
        this.synonymMaps.set('ACT', ['Terapia de Aceptación y Compromiso']);
        this.synonymMaps.set('TEPT', ['Trastorno de Estrés Postraumático', 'PTSD']);
    }
    async extractEntities(text, sessionContext) {
        const startTime = Date.now();
        try {
            // Construir prompt contextual
            const contextualPrompt = this.buildContextualPrompt(text, sessionContext);
            // Ejecutar extracción usando Google GenAI
            const extractionResult = await google_genai_config_1.ai.models.generateContent({
                model: 'gemini-2.5-flash-lite',
                contents: contextualPrompt,
                config: {
                    tools: [{ functionDeclarations: entityExtractionFunctions }],
                    toolConfig: {
                        functionCallingConfig: {
                            mode: genai_1.FunctionCallingConfigMode.AUTO
                        }
                    }
                }
            });
            // Procesar resultados de function calls
            const entities = await this.processFunctionCalls(extractionResult.functionCalls || []);
            // Clasificar entidades por importancia
            const { primaryEntities, secondaryEntities } = this.classifyEntitiesByImportance(entities);
            // Calcular confianza general
            const overallConfidence = this.calculateOverallConfidence(entities);
            const processingTime = Date.now() - startTime;
            return {
                entities,
                primaryEntities,
                secondaryEntities,
                confidence: overallConfidence,
                processingTime
            };
        }
        catch (error) {
            console.error('[EntityExtractionEngine] Error extracting entities:', error);
            return {
                entities: [],
                primaryEntities: [],
                secondaryEntities: [],
                confidence: 0,
                processingTime: Date.now() - startTime
            };
        }
    }
    buildContextualPrompt(text, sessionContext) {
        let prompt = `Analiza el siguiente texto y extrae todas las entidades clínicas relevantes:\n\n"${text}"\n\n`;
        if (sessionContext && this.config.enableContextualAnalysis) {
            prompt += `Contexto de la sesión:\n`;
            if (sessionContext.currentAgent) {
                prompt += `- Agente actual: ${sessionContext.currentAgent}\n`;
            }
            if (sessionContext.previousEntities) {
                prompt += `- Entidades previas: ${sessionContext.previousEntities.join(', ')}\n`;
            }
            prompt += `\n`;
        }
        prompt += `Extrae y clasifica todas las entidades relevantes con alta precisión. Prioriza entidades específicas y técnicas sobre conceptos generales.`;
        return prompt;
    }
    async processFunctionCalls(functionCalls) {
        const allEntities = [];
        for (const call of functionCalls) {
            switch (call.name) {
                case 'extract_therapeutic_techniques':
                    const techniques = call.args.techniques || [];
                    for (const tech of techniques) {
                        if (tech.confidence >= this.config.confidenceThreshold) {
                            allEntities.push({
                                type: 'therapeutic_technique',
                                value: tech.name,
                                confidence: tech.confidence,
                                context: tech.context,
                                synonyms: this.synonymMaps.get(tech.name)
                            });
                        }
                    }
                    break;
                case 'extract_target_populations':
                    const populations = call.args.populations || [];
                    for (const pop of populations) {
                        if (pop.confidence >= this.config.confidenceThreshold) {
                            allEntities.push({
                                type: 'target_population',
                                value: pop.group,
                                confidence: pop.confidence,
                                context: pop.age_range || pop.characteristics?.join(', ')
                            });
                        }
                    }
                    break;
                case 'extract_disorders_conditions':
                    const conditions = call.args.conditions || [];
                    for (const condition of conditions) {
                        if (condition.confidence >= this.config.confidenceThreshold) {
                            allEntities.push({
                                type: 'disorder_condition',
                                value: condition.name,
                                confidence: condition.confidence,
                                context: `${condition.category} - ${condition.severity}`
                            });
                        }
                    }
                    break;
                case 'extract_clinical_concepts':
                    const concepts = call.args.concepts || [];
                    for (const concept of concepts) {
                        if (concept.confidence >= this.config.confidenceThreshold) {
                            allEntities.push({
                                type: 'clinical_concept',
                                value: concept.concept,
                                confidence: concept.confidence,
                                context: `${concept.type} - ${concept.relevance}`
                            });
                        }
                    }
                    break;
            }
        }
        return this.deduplicateEntities(allEntities);
    }
    deduplicateEntities(entities) {
        const seen = new Set();
        const deduplicated = [];
        for (const entity of entities) {
            const key = `${entity.type}:${entity.value.toLowerCase()}`;
            if (!seen.has(key)) {
                seen.add(key);
                deduplicated.push(entity);
            }
        }
        return deduplicated;
    }
    classifyEntitiesByImportance(entities) {
        const primaryThreshold = 0.8;
        const primaryEntities = entities.filter(entity => entity.confidence >= primaryThreshold ||
            entity.type === 'therapeutic_technique' ||
            entity.type === 'disorder_condition');
        const secondaryEntities = entities.filter(entity => !primaryEntities.includes(entity));
        return { primaryEntities, secondaryEntities };
    }
    calculateOverallConfidence(entities) {
        if (entities.length === 0)
            return 0;
        const totalConfidence = entities.reduce((sum, entity) => sum + entity.confidence, 0);
        return totalConfidence / entities.length;
    }
    async validateEntities(entities) {
        if (!this.config.enableValidation) {
            return {
                isValid: true,
                validatedEntities: entities,
                invalidEntities: [],
                suggestions: []
            };
        }
        const validatedEntities = [];
        const invalidEntities = [];
        const suggestions = [];
        for (const entity of entities) {
            const knownSet = this.knownEntities.get(entity.type);
            if (knownSet && this.isEntityKnown(entity.value, knownSet)) {
                validatedEntities.push(entity);
            }
            else if (entity.confidence >= 0.9) {
                // Alta confianza, probablemente válida aunque no esté en la base conocida
                validatedEntities.push(entity);
            }
            else {
                invalidEntities.push(entity);
                suggestions.push(`Verificar: ${entity.value} (${entity.type})`);
            }
        }
        return {
            isValid: invalidEntities.length === 0,
            validatedEntities,
            invalidEntities,
            suggestions
        };
    }
    isEntityKnown(value, knownSet) {
        // Búsqueda exacta
        if (knownSet.has(value))
            return true;
        // Búsqueda case-insensitive
        const lowerValue = value.toLowerCase();
        for (const known of knownSet) {
            if (known.toLowerCase() === lowerValue)
                return true;
        }
        // Búsqueda por sinónimos
        if (this.config.enableSynonymExpansion) {
            for (const [key, synonyms] of this.synonymMaps) {
                if (synonyms.some(syn => syn.toLowerCase() === lowerValue)) {
                    return true;
                }
            }
        }
        return false;
    }
    // Método para actualizar la base de entidades conocidas
    addKnownEntity(type, value, synonyms) {
        const knownSet = this.knownEntities.get(type) || new Set();
        knownSet.add(value);
        this.knownEntities.set(type, knownSet);
        if (synonyms) {
            this.synonymMaps.set(value, synonyms);
        }
    }
    // Método para obtener estadísticas del motor
    getEngineStats() {
        const stats = {
            totalKnownEntities: 0,
            entitiesByType: {},
            totalSynonyms: this.synonymMaps.size,
            config: this.config
        };
        for (const [type, entities] of this.knownEntities) {
            stats.entitiesByType[type] = entities.size;
            stats.totalKnownEntities += entities.size;
        }
        return stats;
    }
}
exports.EntityExtractionEngine = EntityExtractionEngine;
// Factory function
function createEntityExtractionEngine(config) {
    return new EntityExtractionEngine(config);
}
// Instancia por defecto
exports.defaultEntityExtractor = createEntityExtractionEngine();
