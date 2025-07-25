"use strict";
/**
 * Tool Registry - Registro Central de Herramientas Clínicas
 *
 * Este módulo implementa el catálogo maestro de primitivas conductuales
 * que pueden ser utilizadas dinámicamente por el Orquestador Inteligente.
 *
 * Arquitectura:
 * - Cada herramienta es una FunctionDeclaration compatible con Google GenAI SDK
 * - Metadatos contextuales para selección inteligente
 * - Sistema de categorización y priorización
 * - Versionado y evolución de herramientas
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchPubMed = exports.proposeBehavioralExperiment = exports.reframePerspective = exports.detectPattern = exports.generateValidatingStatement = exports.identifyCoreEmotion = exports.formulateClarifyingQuestion = exports.toolRegistry = exports.ToolRegistry = exports.ClinicalDomain = exports.ToolCategory = void 0;
const genai_1 = require("@google/genai");
var ToolCategory;
(function (ToolCategory) {
    ToolCategory["EMOTIONAL_EXPLORATION"] = "emotional_exploration";
    ToolCategory["COGNITIVE_ANALYSIS"] = "cognitive_analysis";
    ToolCategory["BEHAVIORAL_INTERVENTION"] = "behavioral_intervention";
    ToolCategory["RESEARCH_ACADEMIC"] = "research_academic";
    ToolCategory["VALIDATION_SUPPORT"] = "validation_support";
    ToolCategory["PATTERN_DETECTION"] = "pattern_detection";
})(ToolCategory || (exports.ToolCategory = ToolCategory = {}));
var ClinicalDomain;
(function (ClinicalDomain) {
    ClinicalDomain["ANXIETY"] = "anxiety";
    ClinicalDomain["DEPRESSION"] = "depression";
    ClinicalDomain["TRAUMA"] = "trauma";
    ClinicalDomain["RELATIONSHIPS"] = "relationships";
    ClinicalDomain["ADDICTION"] = "addiction";
    ClinicalDomain["PERSONALITY"] = "personality";
    ClinicalDomain["GENERAL"] = "general";
})(ClinicalDomain || (exports.ClinicalDomain = ClinicalDomain = {}));
// ============================================================================
// PRIMITIVAS CONDUCTUALES - EXPLORACIÓN EMOCIONAL
// ============================================================================
const formulateClarifyingQuestion = {
    metadata: {
        id: 'formulate_clarifying_question',
        category: ToolCategory.EMOTIONAL_EXPLORATION,
        priority: 9,
        contextKeywords: ['confuso', 'no entiendo', 'unclear', 'ambiguo', 'explicar'],
        clinicalDomain: [ClinicalDomain.GENERAL],
        version: '1.0.0',
        lastUpdated: new Date('2024-01-15')
    },
    declaration: {
        name: 'formulate_clarifying_question',
        description: 'Genera una pregunta clarificadora específica y empática para profundizar en la comprensión de la experiencia del cliente, evitando preguntas genéricas o superficiales.',
        parameters: {
            type: genai_1.Type.OBJECT,
            properties: {
                clientStatement: {
                    type: genai_1.Type.STRING,
                    description: 'La declaración o comentario del cliente que requiere clarificación'
                },
                emotionalContext: {
                    type: genai_1.Type.STRING,
                    description: 'El contexto emocional detectado en la conversación'
                },
                focusArea: {
                    type: genai_1.Type.STRING,
                    enum: ['emotions', 'thoughts', 'behaviors', 'relationships', 'triggers'],
                    description: 'El área específica en la que enfocar la clarificación'
                }
            },
            required: ['clientStatement', 'emotionalContext', 'focusArea']
        }
    }
};
exports.formulateClarifyingQuestion = formulateClarifyingQuestion;
const identifyCoreEmotion = {
    metadata: {
        id: 'identify_core_emotion',
        category: ToolCategory.EMOTIONAL_EXPLORATION,
        priority: 8,
        contextKeywords: ['siento', 'emoción', 'feeling', 'emotional', 'mood'],
        clinicalDomain: [ClinicalDomain.GENERAL, ClinicalDomain.ANXIETY, ClinicalDomain.DEPRESSION],
        version: '1.0.0',
        lastUpdated: new Date('2024-01-15')
    },
    declaration: {
        name: 'identify_core_emotion',
        description: 'Identifica y nombra la emoción central subyacente en la experiencia del cliente, distinguiendo entre emociones primarias y secundarias.',
        parameters: {
            type: genai_1.Type.OBJECT,
            properties: {
                clientNarrative: {
                    type: genai_1.Type.STRING,
                    description: 'La narrativa o descripción del cliente sobre su experiencia'
                },
                behavioralIndicators: {
                    type: genai_1.Type.ARRAY,
                    items: { type: genai_1.Type.STRING },
                    description: 'Indicadores conductuales observados o reportados'
                },
                contextualFactors: {
                    type: genai_1.Type.STRING,
                    description: 'Factores contextuales relevantes (situación, relaciones, eventos)'
                }
            },
            required: ['clientNarrative']
        }
    }
};
exports.identifyCoreEmotion = identifyCoreEmotion;
const generateValidatingStatement = {
    metadata: {
        id: 'generate_validating_statement',
        category: ToolCategory.VALIDATION_SUPPORT,
        priority: 7,
        contextKeywords: ['dolor', 'difícil', 'struggle', 'hard', 'overwhelming'],
        clinicalDomain: [ClinicalDomain.GENERAL, ClinicalDomain.TRAUMA],
        version: '1.0.0',
        lastUpdated: new Date('2024-01-15')
    },
    declaration: {
        name: 'generate_validating_statement',
        description: 'Crea una declaración de validación empática y específica que reconozca la experiencia del cliente sin minimizar o sobreactuar.',
        parameters: {
            type: genai_1.Type.OBJECT,
            properties: {
                clientExperience: {
                    type: genai_1.Type.STRING,
                    description: 'La experiencia específica que el cliente ha compartido'
                },
                emotionalIntensity: {
                    type: genai_1.Type.STRING,
                    enum: ['low', 'moderate', 'high', 'severe'],
                    description: 'La intensidad emocional percibida en la experiencia'
                },
                validationType: {
                    type: genai_1.Type.STRING,
                    enum: ['emotional', 'experiential', 'perspective', 'effort'],
                    description: 'El tipo de validación más apropiado para la situación'
                }
            },
            required: ['clientExperience', 'emotionalIntensity', 'validationType']
        }
    }
};
exports.generateValidatingStatement = generateValidatingStatement;
// ============================================================================
// PRIMITIVAS CONDUCTUALES - ANÁLISIS COGNITIVO
// ============================================================================
const detectPattern = {
    metadata: {
        id: 'detect_pattern',
        category: ToolCategory.PATTERN_DETECTION,
        priority: 8,
        contextKeywords: ['siempre', 'nunca', 'always', 'never', 'pattern', 'repetir'],
        clinicalDomain: [ClinicalDomain.GENERAL, ClinicalDomain.ANXIETY, ClinicalDomain.DEPRESSION],
        version: '1.0.0',
        lastUpdated: new Date('2024-01-15')
    },
    declaration: {
        name: 'detect_pattern',
        description: 'Identifica patrones recurrentes en pensamientos, emociones o comportamientos del cliente, destacando conexiones significativas.',
        parameters: {
            type: genai_1.Type.OBJECT,
            properties: {
                conversationHistory: {
                    type: genai_1.Type.STRING,
                    description: 'Historial relevante de la conversación para análisis de patrones'
                },
                patternType: {
                    type: genai_1.Type.STRING,
                    enum: ['cognitive', 'emotional', 'behavioral', 'relational', 'situational'],
                    description: 'El tipo de patrón a detectar'
                },
                timeframe: {
                    type: genai_1.Type.STRING,
                    description: 'Marco temporal en el que se observa el patrón'
                }
            },
            required: ['conversationHistory', 'patternType']
        }
    }
};
exports.detectPattern = detectPattern;
const reframePerspective = {
    metadata: {
        id: 'reframe_perspective',
        category: ToolCategory.COGNITIVE_ANALYSIS,
        priority: 7,
        contextKeywords: ['terrible', 'awful', 'disaster', 'catastrophe', 'hopeless'],
        clinicalDomain: [ClinicalDomain.ANXIETY, ClinicalDomain.DEPRESSION],
        version: '1.0.0',
        lastUpdated: new Date('2024-01-15')
    },
    declaration: {
        name: 'reframe_perspective',
        description: 'Ofrece una perspectiva alternativa equilibrada y realista sobre la situación del cliente, sin invalidar su experiencia.',
        parameters: {
            type: genai_1.Type.OBJECT,
            properties: {
                originalPerspective: {
                    type: genai_1.Type.STRING,
                    description: 'La perspectiva original o pensamiento del cliente'
                },
                situationalContext: {
                    type: genai_1.Type.STRING,
                    description: 'El contexto situacional completo'
                },
                reframeType: {
                    type: genai_1.Type.STRING,
                    enum: ['balanced', 'strength_based', 'growth_oriented', 'evidence_based'],
                    description: 'El tipo de reencuadre más apropiado'
                }
            },
            required: ['originalPerspective', 'situationalContext', 'reframeType']
        }
    }
};
exports.reframePerspective = reframePerspective;
// ============================================================================
// PRIMITIVAS CONDUCTUALES - INTERVENCIÓN CONDUCTUAL
// ============================================================================
const proposeBehavioralExperiment = {
    metadata: {
        id: 'propose_behavioral_experiment',
        category: ToolCategory.BEHAVIORAL_INTERVENTION,
        priority: 6,
        contextKeywords: ['try', 'experiment', 'practice', 'action', 'behavior'],
        clinicalDomain: [ClinicalDomain.ANXIETY, ClinicalDomain.DEPRESSION],
        version: '1.0.0',
        lastUpdated: new Date('2024-01-15')
    },
    declaration: {
        name: 'propose_behavioral_experiment',
        description: 'Diseña un experimento conductual específico, medible y apropiado para probar creencias o desarrollar nuevas habilidades.',
        parameters: {
            type: genai_1.Type.OBJECT,
            properties: {
                targetBelief: {
                    type: genai_1.Type.STRING,
                    description: 'La creencia o patrón específico que se quiere examinar'
                },
                clientCapabilities: {
                    type: genai_1.Type.STRING,
                    description: 'Las capacidades y limitaciones actuales del cliente'
                },
                experimentType: {
                    type: genai_1.Type.STRING,
                    enum: ['exposure', 'behavioral_activation', 'skill_practice', 'reality_testing'],
                    description: 'El tipo de experimento conductual'
                },
                timeframe: {
                    type: genai_1.Type.STRING,
                    description: 'Marco temporal propuesto para el experimento'
                }
            },
            required: ['targetBelief', 'clientCapabilities', 'experimentType']
        }
    }
};
exports.proposeBehavioralExperiment = proposeBehavioralExperiment;
// ============================================================================
// HERRAMIENTA ESPECIALIZADA - INVESTIGACIÓN ACADÉMICA
// ============================================================================
const searchPubMed = {
    metadata: {
        id: 'search_pubmed',
        category: ToolCategory.RESEARCH_ACADEMIC,
        priority: 5,
        contextKeywords: ['research', 'study', 'evidence', 'investigación', 'estudios'],
        clinicalDomain: [ClinicalDomain.GENERAL],
        version: '1.0.0',
        lastUpdated: new Date('2024-01-15')
    },
    declaration: {
        name: 'search_pubmed',
        description: 'Busca literatura académica relevante en PubMed para proporcionar evidencia científica sobre técnicas o condiciones clínicas.',
        parameters: {
            type: genai_1.Type.OBJECT,
            properties: {
                searchQuery: {
                    type: genai_1.Type.STRING,
                    description: 'Términos de búsqueda específicos para PubMed'
                },
                clinicalCondition: {
                    type: genai_1.Type.STRING,
                    description: 'Condición clínica específica de interés'
                },
                interventionType: {
                    type: genai_1.Type.STRING,
                    description: 'Tipo de intervención o técnica terapéutica'
                },
                maxResults: {
                    type: genai_1.Type.NUMBER,
                    description: 'Número máximo de resultados a retornar',
                    default: 5
                }
            },
            required: ['searchQuery']
        }
    }
};
exports.searchPubMed = searchPubMed;
// ============================================================================
// REGISTRO CENTRAL DE HERRAMIENTAS
// ============================================================================
class ToolRegistry {
    constructor() {
        this.tools = new Map();
        this.initializeTools();
    }
    static getInstance() {
        if (!ToolRegistry.instance) {
            ToolRegistry.instance = new ToolRegistry();
        }
        return ToolRegistry.instance;
    }
    initializeTools() {
        const coreTools = [
            formulateClarifyingQuestion,
            identifyCoreEmotion,
            generateValidatingStatement,
            detectPattern,
            reframePerspective,
            proposeBehavioralExperiment,
            searchPubMed
        ];
        coreTools.forEach(tool => {
            this.tools.set(tool.metadata.id, tool);
        });
    }
    /**
     * Obtiene todas las herramientas disponibles
     */
    getAllTools() {
        return Array.from(this.tools.values());
    }
    /**
     * Obtiene herramientas por categoría
     */
    getToolsByCategory(category) {
        return this.getAllTools().filter(tool => tool.metadata.category === category);
    }
    /**
     * Obtiene herramientas por dominio clínico
     */
    getToolsByDomain(domain) {
        return this.getAllTools().filter(tool => tool.metadata.clinicalDomain.includes(domain));
    }
    /**
     * Busca herramientas por palabras clave contextuales
     */
    searchToolsByKeywords(keywords) {
        const normalizedKeywords = keywords.map(k => k.toLowerCase());
        return this.getAllTools().filter(tool => {
            return tool.metadata.contextKeywords.some(keyword => normalizedKeywords.some(nk => keyword.toLowerCase().includes(nk)));
        }).sort((a, b) => b.metadata.priority - a.metadata.priority);
    }
    /**
     * Obtiene herramientas compatibles (sin conflictos)
     */
    getCompatibleTools(selectedToolIds) {
        const selectedTools = selectedToolIds.map(id => this.tools.get(id)).filter(Boolean);
        const conflictingIds = new Set(selectedTools.flatMap(tool => tool.metadata.conflictsWith || []));
        return this.getAllTools().filter(tool => !conflictingIds.has(tool.metadata.id) && !selectedToolIds.includes(tool.metadata.id));
    }
    /**
     * Obtiene solo las FunctionDeclarations para el SDK de GenAI
     */
    getFunctionDeclarations(toolIds) {
        return toolIds
            .map(id => this.tools.get(id))
            .filter(Boolean)
            .map(tool => tool.declaration);
    }
    /**
     * Registra una nueva herramienta
     */
    registerTool(tool) {
        this.tools.set(tool.metadata.id, tool);
    }
    /**
     * Obtiene herramientas para un contexto específico
     */
    getToolsForContext(context) {
        const tools = Array.from(this.tools.values());
        return tools.filter(tool => {
            // Filtrar por dominios si se especifican
            if (context.domains && context.domains.length > 0) {
                const hasMatchingDomain = tool.metadata.clinicalDomain.some(domain => context.domains.includes(domain));
                if (!hasMatchingDomain)
                    return false;
            }
            // Filtrar por tipos de entidad si se especifican
            if (context.entityTypes && context.entityTypes.length > 0) {
                const hasMatchingKeyword = tool.metadata.contextKeywords.some(keyword => context.entityTypes.some(entityType => entityType.toLowerCase().includes(keyword.toLowerCase()) ||
                    keyword.toLowerCase().includes(entityType.toLowerCase())));
                if (!hasMatchingKeyword)
                    return false;
            }
            return true;
        }).slice(0, 5); // Limitar a 5 herramientas más relevantes
    }
    /**
     * Obtiene herramientas básicas para fallback
     */
    getBasicTools() {
        return Array.from(this.tools.values())
            .filter(tool => tool.metadata.category === ToolCategory.EMOTIONAL_EXPLORATION)
            .slice(0, 3);
    }
    /**
     * Obtiene estadísticas del registro
     */
    getRegistryStats() {
        const tools = this.getAllTools();
        const toolsByCategory = {};
        tools.forEach(tool => {
            const category = tool.metadata.category;
            toolsByCategory[category] = (toolsByCategory[category] || 0) + 1;
        });
        const averagePriority = tools.reduce((sum, tool) => sum + tool.metadata.priority, 0) / tools.length;
        return {
            totalTools: tools.length,
            toolsByCategory,
            averagePriority: Math.round(averagePriority * 100) / 100
        };
    }
}
exports.ToolRegistry = ToolRegistry;
// ============================================================================
// EXPORTACIONES
// ============================================================================
exports.toolRegistry = ToolRegistry.getInstance();
