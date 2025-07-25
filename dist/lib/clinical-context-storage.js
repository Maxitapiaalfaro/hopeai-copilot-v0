"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clinicalStorage = exports.ClinicalContextStorage = void 0;
class ClinicalContextStorage {
    constructor() {
        this.dbName = "hopeai_clinical_db";
        this.version = 1;
        this.db = null;
    }
    async initialize() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Store for chat sessions
                if (!db.objectStoreNames.contains("chat_sessions")) {
                    const chatStore = db.createObjectStore("chat_sessions", {
                        keyPath: "sessionId",
                    });
                    chatStore.createIndex("userId", "userId", { unique: false });
                    chatStore.createIndex("lastUpdated", "metadata.lastUpdated", { unique: false });
                    chatStore.createIndex("mode", "mode", { unique: false });
                }
                // Store for clinical files
                if (!db.objectStoreNames.contains("clinical_files")) {
                    const filesStore = db.createObjectStore("clinical_files", {
                        keyPath: "id",
                    });
                    filesStore.createIndex("sessionId", "sessionId", { unique: false });
                    filesStore.createIndex("status", "status", { unique: false });
                }
                // Store for user preferences
                if (!db.objectStoreNames.contains("user_preferences")) {
                    const prefsStore = db.createObjectStore("user_preferences", {
                        keyPath: "userId",
                    });
                }
            };
        });
    }
    async saveChatSession(chatState) {
        if (!this.db)
            throw new Error("Database not initialized");
        const transaction = this.db.transaction(["chat_sessions"], "readwrite");
        const store = transaction.objectStore("chat_sessions");
        return new Promise((resolve, reject) => {
            const request = store.put({
                ...chatState,
                metadata: {
                    ...chatState.metadata,
                    lastUpdated: new Date(),
                },
            });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    async loadChatSession(sessionId) {
        if (!this.db)
            throw new Error("Database not initialized");
        const transaction = this.db.transaction(["chat_sessions"], "readonly");
        const store = transaction.objectStore("chat_sessions");
        return new Promise((resolve, reject) => {
            const request = store.get(sessionId);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }
    async getUserSessions(userId) {
        if (!this.db)
            throw new Error("Database not initialized");
        const transaction = this.db.transaction(["chat_sessions"], "readonly");
        const store = transaction.objectStore("chat_sessions");
        const index = store.index("userId");
        return new Promise((resolve, reject) => {
            const request = index.getAll(userId);
            request.onsuccess = () => {
                const sessions = request.result.sort((a, b) => new Date(b.metadata.lastUpdated).getTime() - new Date(a.metadata.lastUpdated).getTime());
                resolve(sessions);
            };
            request.onerror = () => reject(request.error);
        });
    }
    async deleteChatSession(sessionId) {
        if (!this.db)
            throw new Error("Database not initialized");
        const transaction = this.db.transaction(["chat_sessions"], "readwrite");
        const store = transaction.objectStore("chat_sessions");
        return new Promise((resolve, reject) => {
            const request = store.delete(sessionId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    async saveClinicalFile(file) {
        if (!this.db)
            throw new Error("Database not initialized");
        const transaction = this.db.transaction(["clinical_files"], "readwrite");
        const store = transaction.objectStore("clinical_files");
        return new Promise((resolve, reject) => {
            const request = store.put(file);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    async getClinicalFiles(sessionId) {
        if (!this.db)
            throw new Error("Database not initialized");
        const transaction = this.db.transaction(["clinical_files"], "readonly");
        const store = transaction.objectStore("clinical_files");
        return new Promise((resolve, reject) => {
            if (sessionId) {
                const index = store.index("sessionId");
                const request = index.getAll(sessionId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            }
            else {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            }
        });
    }
    async clearAllData() {
        if (!this.db)
            throw new Error("Database not initialized");
        const transaction = this.db.transaction(["chat_sessions", "clinical_files", "user_preferences"], "readwrite");
        await Promise.all([
            new Promise((resolve, reject) => {
                const request = transaction.objectStore("chat_sessions").clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }),
            new Promise((resolve, reject) => {
                const request = transaction.objectStore("clinical_files").clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }),
            new Promise((resolve, reject) => {
                const request = transaction.objectStore("user_preferences").clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }),
        ]);
    }
}
exports.ClinicalContextStorage = ClinicalContextStorage;
// Singleton instance
exports.clinicalStorage = new ClinicalContextStorage();
