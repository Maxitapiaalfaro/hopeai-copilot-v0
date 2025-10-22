import { GoogleGenAI } from "@google/genai"

// Load environment variables only on server side
if (typeof window === 'undefined') {
  require('dotenv').config()
}

// Initialize Google Gen AI client with proper environment handling
function createGenAIClient(): GoogleGenAI {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    // Browser environment - use NEXT_PUBLIC_GOOGLE_AI_API_KEY
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('NEXT_PUBLIC_GOOGLE_AI_API_KEY no está configurada en el entorno del navegador');
    }
    return new GoogleGenAI({ apiKey });
  } else {
    // Server environment - fallback to GOOGLE_AI_API_KEY if NEXT_PUBLIC is not set
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('API Key de Google GenAI no está configurada. Verifica NEXT_PUBLIC_GOOGLE_AI_API_KEY o GOOGLE_AI_API_KEY');
    }
    return new GoogleGenAI({ apiKey });
  }
}

export const genAI = createGenAIClient()

// Export the ai instance for the new SDK API
export const ai = genAI

// Clinical safety settings for healthcare applications
export const clinicalSafetySettings = [
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
]

// Model configuration for clinical use (base config - model set individually per agent)
export const clinicalModelConfig = {
  model: "gemini-2.5-flash", // Default model (overridden per agent)
  temperature: 0.3, // Conservative for clinical recommendations
  topK: 40,
  topP: 0.95,
  thinkingConfig: {
    thinkingBudget: -1},
  maxOutputTokens: 35000,
  safetySettings: clinicalSafetySettings,
}
