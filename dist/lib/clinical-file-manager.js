"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clinicalFileManager = exports.ClinicalFileManager = void 0;
const google_genai_config_1 = require("./google-genai-config");
const clinical_context_storage_1 = require("./clinical-context-storage");
class ClinicalFileManager {
    async uploadFile(file, sessionId, userId) {
        const clinicalFile = {
            id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            type: file.type,
            size: file.size,
            uploadDate: new Date(),
            status: "uploading",
        };
        // Save initial file record
        await clinical_context_storage_1.clinicalStorage.saveClinicalFile({
            ...clinicalFile,
            sessionId,
        });
        try {
            // Update status to processing
            clinicalFile.status = "processing";
            await clinical_context_storage_1.clinicalStorage.saveClinicalFile({
                ...clinicalFile,
                sessionId,
            });
            // Upload to Google AI Files API
            const uploadResult = await google_genai_config_1.genAI.files.upload({
                file: file,
                config: {
                    mimeType: file.type,
                    displayName: `clinical_${clinicalFile.id}`,
                }
            });
            // Update with Gemini file ID and processed status
            clinicalFile.geminiFileId = uploadResult.name;
            clinicalFile.status = "processed";
            await clinical_context_storage_1.clinicalStorage.saveClinicalFile({
                ...clinicalFile,
                sessionId,
            });
            return clinicalFile;
        }
        catch (error) {
            console.error("Error uploading file:", error);
            // Update status to error
            clinicalFile.status = "error";
            await clinical_context_storage_1.clinicalStorage.saveClinicalFile({
                ...clinicalFile,
                sessionId,
            });
            throw error;
        }
    }
    async getFileInfo(geminiFileId) {
        try {
            return await google_genai_config_1.genAI.files.get({ name: geminiFileId });
        }
        catch (error) {
            console.error("Error getting file info:", error);
            throw error;
        }
    }
    async deleteFile(fileId) {
        try {
            const files = await clinical_context_storage_1.clinicalStorage.getClinicalFiles();
            const file = files.find((f) => f.id === fileId);
            if (file?.geminiFileId) {
                await google_genai_config_1.genAI.files.delete({ name: file.geminiFileId });
            }
            // Remove from IndexedDB (implement delete method)
            // await clinicalStorage.deleteClinicalFile(fileId);
        }
        catch (error) {
            console.error("Error deleting file:", error);
            throw error;
        }
    }
    formatFileSize(bytes) {
        if (bytes === 0)
            return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }
    isValidClinicalFile(file) {
        const allowedTypes = [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain",
            "image/jpeg",
            "image/png",
            "image/gif",
        ];
        const maxSize = 10 * 1024 * 1024; // 10MB
        return allowedTypes.includes(file.type) && file.size <= maxSize;
    }
}
exports.ClinicalFileManager = ClinicalFileManager;
// Singleton instance
exports.clinicalFileManager = new ClinicalFileManager();
