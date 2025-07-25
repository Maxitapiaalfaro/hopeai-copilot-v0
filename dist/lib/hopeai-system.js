"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hopeAI = exports.HopeAISystem = void 0;
exports.getHopeAIInstance = getHopeAIInstance;
const clinical_agent_router_1 = require("./clinical-agent-router");
const server_storage_adapter_1 = require("./server-storage-adapter");
const clinical_file_manager_1 = require("./clinical-file-manager");
const intelligent_intent_router_1 = require("./intelligent-intent-router");
class HopeAISystem {
    constructor() {
        this.initialized = false;
        this.storage = null;
        this.intentRouter = null;
    }
    // Getter público para acceder al storage desde la API
    get storageAdapter() {
        return this.storage;
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            // Inicializar el storage adapter
            this.storage = await (0, server_storage_adapter_1.getStorageAdapter)();
            // Asegurar que el storage esté inicializado
            if (this.storage && typeof this.storage.initialize === 'function') {
                await this.storage.initialize();
            }
            // Inicializar el router de intenciones inteligente
            this.intentRouter = (0, intelligent_intent_router_1.createIntelligentIntentRouter)(clinical_agent_router_1.clinicalAgentRouter, {
                confidenceThreshold: 0.8,
                fallbackAgent: 'socratico',
                enableLogging: true,
                maxRetries: 2
            });
            this.initialized = true;
            console.log("HopeAI System initialized successfully with Intelligent Intent Router");
        }
        catch (error) {
            console.error("Failed to initialize HopeAI System:", error);
            throw error;
        }
    }
    async createClinicalSession(userId, mode, agent, sessionId) {
        if (!this.initialized)
            await this.initialize();
        const finalSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        let chatHistory = [];
        // Try to restore existing session
        if (sessionId) {
            const existingState = await this.storage.loadChatSession(sessionId);
            if (existingState) {
                chatHistory = existingState.history;
            }
        }
        // Create chat session with agent router
        await clinical_agent_router_1.clinicalAgentRouter.createChatSession(finalSessionId, agent, chatHistory);
        // Create initial chat state
        const chatState = {
            sessionId: finalSessionId,
            userId,
            mode,
            activeAgent: agent,
            history: chatHistory,
            metadata: {
                createdAt: new Date(),
                lastUpdated: new Date(),
                totalTokens: 0,
                fileReferences: [],
            },
            clinicalContext: {
                sessionType: mode,
                confidentialityLevel: "high",
            },
        };
        // Save initial state
        await this.storage.saveChatSession(chatState);
        return { sessionId: finalSessionId, chatState };
    }
    async sendMessage(sessionId, message, useStreaming = true) {
        if (!this.initialized)
            await this.initialize();
        // Load current session state
        const currentState = await this.storage.loadChatSession(sessionId);
        if (!currentState) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        // Add user message to history
        const userMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content: message,
            role: "user",
            timestamp: new Date(),
        };
        currentState.history.push(userMessage);
        try {
            // Convertir historial al formato Content[] esperado por el router
            const sessionContext = currentState.history.map((msg) => ({
                role: msg.role,
                parts: [{ text: msg.content }]
            }));
            // Usar el router inteligente para clasificar la intención y enrutar automáticamente
            const routingResult = await this.intentRouter.routeUserInput(message, sessionContext, currentState.activeAgent);
            // Si se detectó un cambio de agente, actualizar la sesión
            if (routingResult.targetAgent !== currentState.activeAgent) {
                console.log(`[HopeAI] Intelligent routing: ${currentState.activeAgent} → ${routingResult.targetAgent}`);
                // Close current chat session
                clinical_agent_router_1.clinicalAgentRouter.closeChatSession(sessionId);
                // Create new chat session with new agent
                await clinical_agent_router_1.clinicalAgentRouter.createChatSession(sessionId, routingResult.targetAgent, currentState.history);
                // Update state
                currentState.activeAgent = routingResult.targetAgent;
                currentState.metadata.lastUpdated = new Date();
            }
            // Send message through agent router with enriched context
            const response = await clinical_agent_router_1.clinicalAgentRouter.sendMessage(sessionId, message, useStreaming, routingResult.enrichedContext);
            // Save state with user message immediately (for both streaming and non-streaming)
            currentState.metadata.lastUpdated = new Date();
            await this.storage.saveChatSession(currentState);
            // Handle response based on streaming or not
            let responseContent = "";
            if (useStreaming) {
                // For streaming, we need to preserve the async generator while adding routing info
                // The response from clinical router is already an async generator
                const streamingResponse = response;
                // Add routing info as a property on the async generator
                if (streamingResponse && typeof streamingResponse[Symbol.asyncIterator] === 'function') {
                    streamingResponse.routingInfo = {
                        detectedIntent: routingResult.enrichedContext?.detectedIntent || 'unknown',
                        targetAgent: routingResult.targetAgent,
                        confidence: routingResult.enrichedContext?.confidence || 0,
                        extractedEntities: routingResult.enrichedContext?.extractedEntities || []
                    };
                }
                return {
                    response: streamingResponse,
                    updatedState: currentState
                };
            }
            else {
                responseContent = response.text;
                // Add AI response to history
                const aiMessage = {
                    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    content: responseContent,
                    role: "model",
                    agent: currentState.activeAgent,
                    timestamp: new Date(),
                };
                currentState.history.push(aiMessage);
            }
            // Update metadata
            currentState.metadata.lastUpdated = new Date();
            currentState.metadata.totalTokens += this.estimateTokens(message + responseContent);
            // Save updated state
            await this.storage.saveChatSession(currentState);
            return {
                response: {
                    ...response,
                    routingInfo: {
                        detectedIntent: routingResult.enrichedContext?.detectedIntent || 'unknown',
                        targetAgent: routingResult.targetAgent,
                        confidence: routingResult.enrichedContext?.confidence || 0,
                        extractedEntities: routingResult.enrichedContext?.extractedEntities || []
                    }
                },
                updatedState: currentState
            };
        }
        catch (error) {
            console.error("Error sending message:", error);
            throw error;
        }
    }
    async switchAgent(sessionId, newAgent) {
        if (!this.initialized)
            await this.initialize();
        const currentState = await this.storage.loadChatSession(sessionId);
        if (!currentState) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        // Close current chat session
        clinical_agent_router_1.clinicalAgentRouter.closeChatSession(sessionId);
        // Create new chat session with new agent
        await clinical_agent_router_1.clinicalAgentRouter.createChatSession(sessionId, newAgent, currentState.history);
        // Update state
        currentState.activeAgent = newAgent;
        currentState.metadata.lastUpdated = new Date();
        // Save updated state
        await this.storage.saveChatSession(currentState);
        return currentState;
    }
    async uploadDocument(sessionId, file, userId) {
        if (!this.initialized)
            await this.initialize();
        if (!clinical_file_manager_1.clinicalFileManager.isValidClinicalFile(file)) {
            throw new Error("Invalid file type or size. Please upload PDF, Word, or image files under 10MB.");
        }
        const uploadedFile = await clinical_file_manager_1.clinicalFileManager.uploadFile(file, sessionId, userId);
        // Update session metadata
        const currentState = await this.storage.loadChatSession(sessionId);
        if (currentState) {
            currentState.metadata.fileReferences.push(uploadedFile.id);
            currentState.metadata.lastUpdated = new Date();
            await this.storage.saveChatSession(currentState);
        }
        return uploadedFile;
    }
    async getUserSessions(userId) {
        if (!this.initialized)
            await this.initialize();
        return await this.storage.getUserSessions(userId);
    }
    async deleteSession(sessionId) {
        if (!this.initialized)
            await this.initialize();
        // Close active chat session
        clinical_agent_router_1.clinicalAgentRouter.closeChatSession(sessionId);
        // Delete from storage
        await this.storage.deleteChatSession(sessionId);
    }
    async addStreamingResponseToHistory(sessionId, responseContent, agent) {
        if (!this.initialized)
            await this.initialize();
        const currentState = await this.storage.loadChatSession(sessionId);
        if (!currentState) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        // Add AI response to history
        const aiMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content: responseContent,
            role: "model",
            agent: agent,
            timestamp: new Date(),
        };
        currentState.history.push(aiMessage);
        // Update metadata
        currentState.metadata.lastUpdated = new Date();
        currentState.metadata.totalTokens += this.estimateTokens(responseContent);
        // Save updated state
        await this.storage.saveChatSession(currentState);
    }
    async getChatState(sessionId) {
        if (!this.initialized)
            await this.initialize();
        const currentState = await this.storage.loadChatSession(sessionId);
        if (!currentState) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        return currentState;
    }
    estimateTokens(text) {
        // Rough estimation: ~4 characters per token
        return Math.ceil(text.length / 4);
    }
    async getSystemStatus() {
        const allSessions = await this.storage.getUserSessions("all"); // This would need to be implemented
        return {
            initialized: this.initialized,
            activeAgents: Array.from(clinical_agent_router_1.clinicalAgentRouter.getAllAgents().keys()),
            totalSessions: allSessions.length,
        };
    }
}
exports.HopeAISystem = HopeAISystem;
// Global singleton instance for server-side usage
let globalHopeAI = null;
// Function to get or create singleton instance
function getHopeAIInstance() {
    if (!globalHopeAI) {
        globalHopeAI = new HopeAISystem();
    }
    return globalHopeAI;
}
// Export singleton instance
exports.hopeAI = getHopeAIInstance();
