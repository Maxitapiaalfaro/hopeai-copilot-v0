"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.clinicalModelConfig = exports.clinicalSafetySettings = exports.ai = exports.genAI = void 0;
const genai_1 = require("@google/genai");
const dotenv = __importStar(require("dotenv"));
// Load environment variables
dotenv.config();
// Initialize Google Gen AI client with proper environment handling
function createGenAIClient() {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
        // Browser environment - use NEXT_PUBLIC_GOOGLE_AI_API_KEY
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY;
        if (!apiKey) {
            throw new Error('NEXT_PUBLIC_GOOGLE_AI_API_KEY no está configurada en el entorno del navegador');
        }
        return new genai_1.GoogleGenAI({ apiKey });
    }
    else {
        // Server environment - fallback to GOOGLE_AI_API_KEY if NEXT_PUBLIC is not set
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY;
        if (!apiKey) {
            throw new Error('API Key de Google GenAI no está configurada. Verifica NEXT_PUBLIC_GOOGLE_AI_API_KEY o GOOGLE_AI_API_KEY');
        }
        return new genai_1.GoogleGenAI({ apiKey });
    }
}
exports.genAI = createGenAIClient();
// Export the ai instance for the new SDK API
exports.ai = exports.genAI;
// Clinical safety settings for healthcare applications
exports.clinicalSafetySettings = [
    {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
    {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
    {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
    {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
];
// Model configuration for clinical use
exports.clinicalModelConfig = {
    model: "gemini-2.5-flash",
    temperature: 0.3, // Conservative for clinical recommendations
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 2048,
    safetySettings: exports.clinicalSafetySettings,
};
