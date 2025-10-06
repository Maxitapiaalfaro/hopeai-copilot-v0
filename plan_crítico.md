## **Oracle_Hope: From Vision to Build Mode**

*"No hay mas dudas, hay trabajo con esfuerzo, sentido y proposito."*

That sentence just shifted us from **strategic dialogue** to **execution architecture**. Let's build.

---

## **I. The Foundation: Pattern Mirror - Week by Week**

### **Week 1: Core Analysis Engine**

**Goal:** Extract clinical domains from conversation history using SDK

**What We're Building:**

```typescript
// lib/clinical-pattern-analyzer.ts

import { GoogleGenAI, FunctionCallingConfigMode, type FunctionDeclaration } from '@google/genai';
import { ai } from './google-genai-config';
import type { ChatMessage } from '@/types/clinical-types';

export interface ClinicalDomain {
  name: string;
  category: 'cognitive' | 'behavioral' | 'emotional' | 'relational' | 'trauma' | 'existential' | 'systemic';
  frequency: 'high' | 'medium' | 'low';
  lastExplored: Date | null;
  techniques: string[];
  patientMentions: Array<{
    content: string;
    sessionIndex: number;
    wasExplored: boolean;
  }>;
}

export interface PatternAnalysis {
  patientId: string;
  patientName: string;
  sessionCount: number;
  dateRange: { start: Date; end: Date };
  
  // What's being consistently explored
  exploredDomains: ClinicalDomain[];
  
  // What patient mentions but therapist doesn't pursue
  unexploredDomains: ClinicalDomain[];
  
  // Supervision-style reflections
  supervisionQuestions: string[];
  
  // Growth edges
  developmentOpportunities: Array<{
    area: string;
    observation: string;
    suggestedAction: string;
  }>;
  
  generatedAt: Date;
}

export class ClinicalPatternAnalyzer {
  private ai: GoogleGenAI;
  
  constructor() {
    this.ai = ai;
  }
  
  /**
   * Main analysis entry point
   * Analyzes conversation history for a specific patient
   */
  async analyzePatientPatterns(
    patientId: string,
    patientName: string,
    conversationHistory: ChatMessage[]
  ): Promise<PatternAnalysis> {
    
    console.log(`🔍 [PatternAnalyzer] Starting analysis for ${patientName}`, {
      sessionCount: conversationHistory.length,
      patientId
    });
    
    // Step 1: Extract clinical domains from full conversation
    const domains = await this.extractClinicalDomains(conversationHistory);
    
    // Step 2: Classify domains as explored vs unexplored
    const { exploredDomains, unexploredDomains } = this.classifyDomains(domains);
    
    // Step 3: Generate supervision questions based on patterns
    const supervisionQuestions = await this.generateSupervisionQuestions(
      exploredDomains,
      unexploredDomains,
      conversationHistory
    );
    
    // Step 4: Identify development opportunities
    const developmentOpportunities = this.identifyDevelopmentOpportunities(
      exploredDomains,
      unexploredDomains
    );
    
    const dateRange = this.calculateDateRange(conversationHistory);
    
    return {
      patientId,
      patientName,
      sessionCount: conversationHistory.length,
      dateRange,
      exploredDomains,
      unexploredDomains,
      supervisionQuestions,
      developmentOpportunities,
      generatedAt: new Date()
    };
  }
  
  /**
   * SDK-powered domain extraction using Function Calling
   */
  private async extractClinicalDomains(
    conversationHistory: ChatMessage[]
  ): Promise<ClinicalDomain[]> {
    
    const prompt = this.buildDomainExtractionPrompt(conversationHistory);
    
    const result = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        tools: [{
          functionDeclarations: this.getDomainExtractionFunctions()
        }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY
          }
        },
        temperature: 0.1, // Low temperature for consistent analysis
        maxOutputTokens: 8192,
        systemInstruction: `You are an expert clinical supervisor analyzing therapeutic conversations.

Your task is to identify clinical domains being explored in the conversation history.

ANALYTICAL FRAMEWORK:
1. Cognitive Domain: Thought patterns, beliefs, cognitive distortions, restructuring
2. Behavioral Domain: Actions, habits, behavioral activation, exposure work
3. Emotional Domain: Affect regulation, emotional processing, expression
4. Relational Domain: Attachment, interpersonal patterns, therapeutic alliance
5. Trauma Domain: Trauma processing, safety, memory work, somatic responses
6. Existential Domain: Meaning, values, identity, life purpose
7. Systemic Domain: Family dynamics, cultural context, social systems

DETECTION CRITERIA:
- Mark as HIGH frequency if explored in 50%+ of sessions
- Mark as MEDIUM if explored in 20-49% of sessions  
- Mark as LOW if mentioned but rarely explored (<20%)
- Track specific techniques used (e.g., "cognitive restructuring", "empty chair")
- Note when patient raises topic but therapist doesn't pursue

BE PRECISE. BE EVIDENCE-BASED. Cite specific moments from the transcript.`
      }
    });
    
    return this.parseDomainExtractionResults(result);
  }
  
  private getDomainExtractionFunctions(): FunctionDeclaration[] {
    return [{
      name: 'identify_clinical_domains',
      description: 'Identify clinical domains and therapeutic approaches being used in conversation',
      parametersJsonSchema: {
        type: 'object',
        properties: {
          domains: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { 
                  type: 'string',
                  description: 'Name of clinical domain or therapeutic approach'
                },
                category: { 
                  type: 'string',
                  enum: ['cognitive', 'behavioral', 'emotional', 'relational', 'trauma', 'existential', 'systemic']
                },
                frequency: { 
                  type: 'string',
                  enum: ['high', 'medium', 'low']
                },
                techniques: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific therapeutic techniques observed'
                },
                evidence_quotes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Direct quotes from conversation showing this domain'
                },
                patient_initiated: {
                  type: 'boolean',
                  description: 'Did patient bring this up or did therapist introduce it?'
                },
                depth_of_exploration: {
                  type: 'string',
                  enum: ['surface', 'moderate', 'deep'],
                  description: 'How deeply was this domain explored?'
                }
              },
              required: ['name', 'category', 'frequency', 'techniques']
            }
          }
        },
        required: ['domains']
      }
    }];
  }
  
  private buildDomainExtractionPrompt(conversationHistory: ChatMessage[]): string {
    // Format conversation history as readable transcript
    const transcript = conversationHistory.map((msg, idx) => {
      const speaker = msg.role === 'user' ? 'Paciente' : 'Terapeuta';
      const sessionNum = Math.floor(idx / 2) + 1;
      return `[Sesión ${sessionNum}] ${speaker}: ${msg.content}`;
    }).join('\n\n');
    
    return `Analiza el siguiente historial de conversaciones terapéuticas e identifica todos los dominios clínicos que están siendo explorados.

HISTORIAL DE CONVERSACIONES:
${transcript}

INSTRUCCIONES:
1. Identifica cada dominio clínico presente en las conversaciones
2. Clasifica cada dominio según su categoría
3. Determina la frecuencia de exploración (high/medium/low)
4. Lista técnicas terapéuticas específicas observadas
5. Provee citas directas como evidencia
6. Nota si el paciente inició el tema o el terapeuta lo introdujo
7. Evalúa la profundidad de exploración

Ejecuta la función identify_clinical_domains con tu análisis completo.`;
  }
  
  private parseDomainExtractionResults(result: any): ClinicalDomain[] {
    // Parse SDK function call results into ClinicalDomain objects
    if (!result.functionCalls || result.functionCalls.length === 0) {
      console.warn('No function calls in domain extraction result');
      return [];
    }
    
    const functionCall = result.functionCalls[0];
    const domains = functionCall.args?.domains || [];
    
    return domains.map((d: any) => ({
      name: d.name,
      category: d.category,
      frequency: d.frequency,
      lastExplored: null, // Will be set by classifyDomains
      techniques: d.techniques || [],
      patientMentions: [] // Will be populated by classifyDomains
    }));
  }
  
  private classifyDomains(domains: ClinicalDomain[]): {
    exploredDomains: ClinicalDomain[];
    unexploredDomains: ClinicalDomain[];
  } {
    // Domains with high/medium frequency are "explored"
    // Domains with low frequency but patient-initiated are "unexplored opportunities"
    
    const exploredDomains = domains.filter(d => 
      d.frequency === 'high' || d.frequency === 'medium'
    );
    
    const unexploredDomains = domains.filter(d => 
      d.frequency === 'low'
    );
    
    return { exploredDomains, unexploredDomains };
  }
  
  private async generateSupervisionQuestions(
    exploredDomains: ClinicalDomain[],
    unexploredDomains: ClinicalDomain[],
    conversationHistory: ChatMessage[]
  ): Promise<string[]> {
    
    const prompt = `Eres un supervisor clínico experto generando preguntas reflexivas para un psicólogo.

DOMINIOS EXPLORADOS CONSISTENTEMENTE:
${exploredDomains.map(d => `- ${d.name} (${d.frequency}): ${d.techniques.join(', ')}`).join('\n')}

DOMINIOS MENCIONADOS PERO POCO EXPLORADOS:
${unexploredDomains.map(d => `- ${d.name}: ${d.techniques.join(', ')}`).join('\n')}

Genera 3-5 preguntas de supervisión que:
1. Inviten a la reflexión, no critiquen
2. Exploren las razones detrás de las decisiones clínicas
3. Sugieran áreas de crecimiento sin ser prescriptivas
4. Mantengan un tono de curiosidad genuina

ESTILO: Cálido, curioso, respetuoso. Como un mentor, no un evaluador.`;
    
    const result = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7, // More creative for question generation
        maxOutputTokens: 2048
      }
    });
    
    const text = result.text || '';
    // Parse questions (assuming they're numbered or bulleted)
    const questions = text
      .split('\n')
      .filter(line => line.match(/^(\d+\.|\-|\*)/))
      .map(line => line.replace(/^(\d+\.|\-|\*)\s*/, '').trim())
      .filter(q => q.length > 10);
    
    return questions.slice(0, 5);
  }
  
  private identifyDevelopmentOpportunities(
    exploredDomains: ClinicalDomain[],
    unexploredDomains: ClinicalDomain[]
  ): Array<{ area: string; observation: string; suggestedAction: string; }> {
    
    const opportunities: Array<{ area: string; observation: string; suggestedAction: string; }> = [];
    
    // If heavily focused on one category, suggest branching out
    const categoryCount = exploredDomains.reduce((acc, d) => {
      acc[d.category] = (acc[d.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const dominantCategory = Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (dominantCategory && dominantCategory[1] >= exploredDomains.length * 0.6) {
      opportunities.push({
        area: 'Diversidad de enfoques',
        observation: `Enfoque predominante en intervenciones ${this.translateCategory(dominantCategory[0])}`,
        suggestedAction: `Considera explorar dominios ${this.getSuggestedComplementaryDomains(dominantCategory[0])}`
      });
    }
    
    // Highlight high-value unexplored domains
    if (unexploredDomains.length > 0) {
      unexploredDomains.slice(0, 2).forEach(domain => {
        opportunities.push({
          area: domain.name,
          observation: `El paciente ha mencionado temas relacionados con ${domain.name}`,
          suggestedAction: `Podría valer la pena profundizar en este área en futuras sesiones`
        });
      });
    }
    
    return opportunities;
  }
  
  private translateCategory(category: string): string {
    const translations: Record<string, string> = {
      'cognitive': 'cognitivas',
      'behavioral': 'conductuales',
      'emotional': 'emocionales',
      'relational': 'relacionales',
      'trauma': 'de trauma',
      'existential': 'existenciales',
      'systemic': 'sistémicas'
    };
    return translations[category] || category;
  }
  
  private getSuggestedComplementaryDomains(dominantCategory: string): string {
    const complements: Record<string, string> = {
      'cognitive': 'emocionales o relacionales',
      'behavioral': 'cognitivos o existenciales',
      'emotional': 'cognitivos o sistémicos',
      'relational': 'de trauma o existenciales',
      'trauma': 'relacionales o somáticos',
      'existential': 'relacionales o sistémicos',
      'systemic': 'emocionales o existenciales'
    };
    return complements[dominantCategory] || 'complementarios';
  }
  
  private calculateDateRange(conversationHistory: ChatMessage[]): { start: Date; end: Date } {
    const dates = conversationHistory.map(msg => new Date(msg.timestamp));
    return {
      start: new Date(Math.min(...dates.map(d => d.getTime()))),
      end: new Date(Math.max(...dates.map(d => d.getTime())))
    };
  }
}

// Singleton export
export const clinicalPatternAnalyzer = new ClinicalPatternAnalyzer();
```

**Testing This Week:**
```bash
# You run this with one of your real patient histories
const analysis = await clinicalPatternAnalyzer.analyzePatientPatterns(
  'patient_001',
  'Test Patient',
  conversationHistory
);

console.log('Explored:', analysis.exploredDomains);
console.log('Unexplored:', analysis.unexploredDomains);
console.log('Questions:', analysis.supervisionQuestions);
```

---

### **Week 2: Storage & API**

**Goal:** Persist pattern analyses, trigger on demand, expose via API

**New Files:**

```typescript
// types/clinical-types.ts - Add to existing types

export interface PatternAnalysisState {
  analysisId: string;
  patientId: string;
  status: 'generating' | 'completed' | 'error';
  analysis: PatternAnalysis | null;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

// Extend StorageAdapter interface
export interface StorageAdapter {
  // ... existing methods ...
  
  // Pattern Analysis methods
  savePatternAnalysis(analysis: PatternAnalysisState): Promise<void>;
  getPatternAnalysisByPatient(patientId: string): Promise<PatternAnalysisState[]>;
  getLatestPatternAnalysis(patientId: string): Promise<PatternAnalysisState | null>;
}
```

```typescript
// lib/clinical-context-storage.ts - Extend existing implementation

// Add to ClinicalContextStorage class:

async savePatternAnalysis(analysis: PatternAnalysisState): Promise<void> {
  if (!this.db) throw new Error('Database not initialized');
  
  const transaction = this.db.transaction(['pattern_analyses'], 'readwrite');
  const store = transaction.objectStore('pattern_analyses');
  
  const serialized = {
    ...analysis,
    createdAt: analysis.createdAt.toISOString(),
    completedAt: analysis.completedAt?.toISOString()
  };
  
  await store.put(serialized);
  console.log(`✅ Pattern analysis saved: ${analysis.analysisId}`);
}

async getPatternAnalysisByPatient(patientId: string): Promise<PatternAnalysisState[]> {
  if (!this.db) throw new Error('Database not initialized');
  
  const transaction = this.db.transaction(['pattern_analyses'], 'readonly');
  const store = transaction.objectStore('pattern_analyses');
  const index = store.index('by_patient');
  
  const analyses = await index.getAll(patientId);
  
  return analyses.map(this.deserializePatternAnalysis);
}

async getLatestPatternAnalysis(patientId: string): Promise<PatternAnalysisState | null> {
  const analyses = await this.getPatternAnalysisByPatient(patientId);
  if (analyses.length === 0) return null;
  
  return analyses.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];
}

// In initialize() method, add new object store:
db.createObjectStore('pattern_analyses', { keyPath: 'analysisId' })
  .createIndex('by_patient', 'patientId', { unique: false });
```

```typescript
// app/api/patients/[id]/pattern-analysis/route.ts (NEW FILE)

import { NextRequest, NextResponse } from 'next/server';
import { clinicalPatternAnalyzer } from '@/lib/clinical-pattern-analyzer';
import { getStorageAdapter } from '@/lib/server-storage-adapter';
import * as Sentry from '@sentry/nextjs';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return await Sentry.startSpan(
    { op: 'api.pattern_analysis.generate', name: 'Generate Pattern Analysis' },
    async (span) => {
      try {
        const patientId = params.id;
        const { sessionHistory, patientName } = await request.json();
        
        span.setAttribute('patient.id', patientId);
        span.setAttribute('session.count', sessionHistory.length);
        
        console.log(`🔍 Generating pattern analysis for patient: ${patientId}`);
        
        // Generate analysis
        const analysis = await clinicalPatternAnalyzer.analyzePatientPatterns(
          patientId,
          patientName,
          sessionHistory
        );
        
        // Save to storage
        const storage = await getStorageAdapter();
        const analysisState: PatternAnalysisState = {
          analysisId: `analysis_${patientId}_${Date.now()}`,
          patientId,
          status: 'completed',
          analysis,
          createdAt: new Date(),
          completedAt: new Date()
        };
        
        await storage.savePatternAnalysis(analysisState);
        
        console.log(`✅ Pattern analysis completed for ${patientId}`);
        
        return NextResponse.json({
          success: true,
          analysisId: analysisState.analysisId,
          analysis
        });
        
      } catch (error) {
        console.error('Error generating pattern analysis:', error);
        Sentry.captureException(error);
        
        return NextResponse.json(
          { success: false, error: 'Failed to generate pattern analysis' },
          { status: 500 }
        );
      }
    }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const patientId = params.id;
    const storage = await getStorageAdapter();
    
    const latestAnalysis = await storage.getLatestPatternAnalysis(patientId);
    
    if (!latestAnalysis) {
      return NextResponse.json({ success: true, analysis: null });
    }
    
    return NextResponse.json({
      success: true,
      analysis: latestAnalysis
    });
    
  } catch (error) {
    console.error('Error retrieving pattern analysis:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve analysis' },
      { status: 500 }
    );
  }
}
```

**Testing This Week:**
- Generate analysis via API
- Verify storage in IndexedDB
- Retrieve analysis
- Handle errors gracefully

---

### **Week 3: UI Integration**

**Goal:** Display Pattern Mirror insights in Patient Library

**New Component:**

```typescript
// components/patient-library/PatternMirrorPanel.tsx

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, AlertCircle, Lightbulb, RefreshCw } from 'lucide-react';
import type { PatternAnalysis, PatternAnalysisState } from '@/types/clinical-types';

interface PatternMirrorPanelProps {
  patientId: string;
  patientName: string;
  sessionHistory: ChatMessage[];
  onAnalysisComplete?: (analysis: PatternAnalysis) => void;
}

export function PatternMirrorPanel({
  patientId,
  patientName,
  sessionHistory,
  onAnalysisComplete
}: PatternMirrorPanelProps) {
  
  const [analysisState, setAnalysisState] = useState<PatternAnalysisState | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load existing analysis on mount
  useEffect(() => {
    loadExistingAnalysis();
  }, [patientId]);
  
  const loadExistingAnalysis = async () => {
    try {
      const response = await fetch(`/api/patients/${patientId}/pattern-analysis`);
      const data = await response.json();
      
      if (data.success && data.analysis) {
        setAnalysisState(data.analysis);
      }
    } catch (err) {
      console.error('Error loading analysis:', err);
    }
  };
  
  const generateAnalysis = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/patients/${patientId}/pattern-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName,
          sessionHistory
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAnalysisState({
          analysisId: data.analysisId,
          patientId,
          status: 'completed',
          analysis: data.analysis,
          createdAt: new Date()
        });
        
        onAnalysisComplete?.(data.analysis);
      } else {
        setError(data.error || 'Failed to generate analysis');
      }
      
    } catch (err) {
      setError('Error generating pattern analysis');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };
  
  if (!analysisState && !isGenerating) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Pattern Mirror
          </CardTitle>
          <CardDescription>
            Análisis de patrones terapéuticos para {patientName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-4">
              Genera un análisis de los patrones clínicos explorados y áreas de oportunidad.
            </p>
            <Button onClick={generateAnalysis} disabled={sessionHistory.length < 3}>
              <TrendingUp className="mr-2 h-4 w-4" />
              Generar Análisis de Patrones
            </Button>
            {sessionHistory.length < 3 && (
              <p className="text-xs text-muted-foreground mt-2">
                Se requieren al menos 3 sesiones para análisis de patrones
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (isGenerating) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Analizando patrones clínicos...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const analysis = analysisState?.analysis;
  if (!analysis) return null;
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Pattern Mirror
              </CardTitle>
              <CardDescription>
                Análisis de {analysis.sessionCount} sesiones con {patientName}
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={generateAnalysis}
              disabled={isGenerating}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </CardHeader>
      </Card>
      
      {/* Explored Domains */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">✅ Dominios Explorados Consistentemente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {analysis.exploredDomains.map((domain, idx) => (
            <div key={idx} className="border-l-4 border-green-500 pl-4 py-2">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium">{domain.name}</h4>
                <Badge variant={
                  domain.frequency === 'high' ? 'default' :
                  domain.frequency === 'medium' ? 'secondary' : 'outline'
                }>
                  {domain.frequency}
                </Badge>
              </div>
              {domain.techniques.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Técnicas: {domain.techniques.join(', ')}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
      
      {/* Unexplored Domains */}
      {analysis.unexploredDomains.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Áreas Mencionadas Pero Poco Exploradas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis.unexploredDomains.map((domain, idx) => (
              <div key={idx} className="border-l-4 border-amber-500 pl-4 py-2">
                <h4 className="font-medium mb-1">{domain.name}</h4>
                <p className="text-sm text-muted-foreground">
                  El paciente ha mencionado estos temas, pero no se han profundizado.
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      {/* Supervision Questions */}
      {analysis.supervisionQuestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-blue-500" />
              Preguntas de Supervisión
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {analysis.supervisionQuestions.map((question, idx) => (
                <li key={idx} className="flex gap-3">
                  <span className="text-blue-500 font-semibold">{idx + 1}.</span>
                  <span className="text-sm">{question}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      
      {/* Development Opportunities */}
      {analysis.developmentOpportunities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">🎯 Oportunidades de Desarrollo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.developmentOpportunities.map((opp, idx) => (
              <div key={idx} className="space-y-1">
                <h4 className="font-medium">{opp.area}</h4>
                <p className="text-sm text-muted-foreground">{opp.observation}</p>
                <p className="text-sm text-primary">{opp.suggestedAction}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Integration into Patient Library:**

```typescript
// In components/patient-library-section.tsx
// Add new tab alongside Ficha Clínica

<Tabs>
  <TabsList>
    <TabsTrigger value="overview">Vista General</TabsTrigger>
    <TabsTrigger value="ficha">Ficha Clínica</TabsTrigger>
    <TabsTrigger value="patterns">Pattern Mirror</TabsTrigger> {/* NEW */}
  </TabsList>
  
  <TabsContent value="patterns">
    <PatternMirrorPanel
      patientId={selectedPatient.id}
      patientName={selectedPatient.displayName}
      sessionHistory={systemState.history}
    />
  </TabsContent>
</Tabs>
```

---

### **Week 4: Testing & Refinement with You**

**Your Role This Week:**
1. Use Pattern Mirror on 2-3 real patient histories (anonymized)
2. Evaluate domain detection accuracy
3. Assess supervision questions quality
4. Validate that insights are **clinically valuable** and **non-threatening**

**We iterate based on your feedback.**

---

## **II. Role Play Hub: "The Flight Simulator Cockpit"**

### **Design Principle: Serious Play**

**The Balance:**
- ✅ Feels like real therapy (immersive, professional)
- ✅ Safe to fail (no real patient harm)
- ✅ Progress visible (gamification without trivialization)
- ✅ Skill-focused (deliberate practice, not entertainment)

**The Cockpit Metaphor:**
A flight simulator doesn't have cartoon planes. It has a **realistic cockpit** with **clear instrumentation** showing your performance. That's what we build.

---

### **Week 5-6: Patient Simulator Agent**

**The Chat Interface Adaptation:**

```typescript
// New mode for ChatInterface: simulation={true}

<ChatInterface
  mode="simulation"  // NEW PROP
  scenario={currentScenario}
  onSimulationComplete={handleComplete}
  // Everything else stays the same
/>
```

**Visual Indicators of Simulation Mode:**

1. **Subtle Environment Shift**
   - Border glow (amber) around chat area
   - "🎭 Simulation Mode" badge in header
   - Patient name shows as fictional (e.g., "Sofia (Simulación)")

2. **HUD Elements (Heads-Up Display)**
   ```
   Top Right Corner:
   ┌─────────────────────────┐
   │ ⏱️ 18:32 / 50:00        │
   │ 🎯 Objetivos: 3/5       │
   │ 💬 Intercambios: 12     │
   └─────────────────────────┘
   ```

3. **Learning Objectives Tracker (Collapsible Sidebar)**
   ```
   Objetivos de Aprendizaje:
   ✅ Evaluación de seguridad
   ⏳ Psicoeducación sobre pánico
   ⏳ Construcción de alianza
   ⏳ Plan de tratamiento inicial
   ```

**The Patient Simulator responds like this:**

```typescript
// Example interaction

Therapist: "Sofia, cuéntame qué te trae a consulta hoy."

Sofia (AI): *se retuerce las manos* 
"No sé ni cómo empezar... hace tres meses tuve... no sé cómo llamarlo. 
Pensé que me estaba muriendo. Mi corazón latía tan rápido que podía 
escucharlo en mis oídos. No podía respirar. Fui a urgencias tres veces 
este mes y los doctores dicen que no tengo nada. Pero yo SÉ que algo 
está mal."

*su voz tiembla ligeramente*

[Learning Objective Tracker updated: ✅ Patient presented chief complaint with emotional authenticity]
```

**Key Implementation Detail:**

The Patient Simulator Agent uses:
1. **Emotional modeling** - Tracks alliance, affects responses
2. **Realistic resistance** - Doesn't make it easy
3. **Subtle feedback** - Alliance warming/cooling based on your interventions
4. **No explicit teaching** - Never breaks character to say "You should ask about X"

---

### **Week 7-8: Post-Brief Evaluation System**

**The "Debrief Cockpit":**

After simulation ends, psychologist sees:

```
┌─────────────────────────────────────────────────────────────┐
│                    🎓 SIMULATION DEBRIEF                     │
│                                                              │
│  Scenario: Panic Disorder - First Session                   │
│  Duration: 48:23                                            │
│  Completed: December 28, 2024                               │
└─────────────────────────────────────────────────────────────┘

📊 COMPETENCY ASSESSMENT

Alliance Building          ████████░░ 8/10
Assessment Skills          ██████░░░░ 6/10
Intervention Quality       ███████░░░ 7/10
Cultural Sensitivity       ████████░░ 8/10
Safety Awareness          ██████████ 10/10

✅ STRENGTHS OBSERVED

1. Excellent Safety Assessment
   "When you asked 'Have you had thoughts of ending your life?', 
   your timing and tone created safety for disclosure."
   
2. Empathic Attunement
   Moment: [18:45] When Sofia said "nobody understands"
   "You leaned in with curiosity rather than reassurance. 
   This deepened the alliance."

⚠️ GROWTH OPPORTUNITIES

1. Pacing & Exploration
   Moment: [08:30] Moved to breathing technique quickly
   "Consider: What was Sofia inviting you to explore when she 
   said 'I feel like I'm going crazy'? What would happen if you 
   stayed with that feeling longer before offering a tool?"
   
2. Systemic Context
   "You gathered individual symptoms well, but didn't explore 
   Sofia's support system or relational context. In a first session, 
   understanding her isolation matters as much as her panic symptoms."

🎯 SUPERVISION QUESTIONS

1. What made you decide to introduce the breathing exercise at minute 8?
   
2. Sofia mentioned "nobody understands" three times. What do you think 
   she was really communicating? How might you explore that differently?
   
3. When you feel a patient's distress acutely (as with Sofia's panic), 
   how do you balance providing immediate relief with the need to fully 
   understand their experience?

📚 RECOMMENDED RESOURCES

• Panic-Focused Psychodynamic Psychotherapy (Busch et al., 2012)
• "The Art of Staying With It" - Therapeutic presence training
• Video: Expert demonstration of first-session panic assessment

🔄 NEXT STEPS

[ Try This Scenario Again ]  [ Practice Related Skill ]  [ Continue to Next Scenario ]

Scenarios Completed: 3 | Total Practice Time: 2h 41m | Competency Growth: +12%
```

**Gamification Without Trivialization:**

- ✅ Progress bars (skill development)
- ✅ Completion tracking
- ✅ Time invested visible
- ✅ Growth trends over time
- ❌ NO points/badges/leaderboards (too game-like)
- ❌ NO "unlocking levels" (condescending)

**This is professional development metrics, not a game.**

---

## **III. Your Testing Protocol**

**Week 1-4 (Pattern Mirror):**
- Monday: I deliver implementation
- Tuesday-Thursday: You test with real histories
- Friday: We discuss, iterate

**Week 5-8 (Role Play Hub):**
- Monday: I deliver simulation mode
- Tuesday: You test first scenario (I'll co-design it with you)
- Wednesday: Your power user tests
- Thursday: We iterate based on both feedbacks
- Friday: Refinement

**Week 9-12: Integration**
- Pattern Mirror suggests scenarios
- Track improvement across simulations
- Build 5 more scenarios together

---

## **IV. First 5 Scenarios to Build (Together)**

**Beginner Tier:**
1. **Major Depression - First Session** (Sofia variant)
2. **Generalized Anxiety - Intake Assessment**
3. **Relationship Conflict - Couples Introduction**

**Intermediate Tier:**
4. **Trauma Disclosure - Third Session**
5. **Therapeutic Rupture - Alliance Repair**

**For each scenario, I need from you:**
- Patient presentation you'd find realistic
- Common mistakes you've seen/made
- What makes this scenario challenging
- What expert clinicians do differently

---

## **V. The Question That Defines Success**

**How do we know Pattern Mirror + Role Play Hub is working?**

**Success Metrics:**
1. **Pattern Mirror:** Psychologists report "I hadn't noticed that pattern" at least 70% of the time
2. **Role Play Hub:** After 5 scenarios, psychologists feel **more confident** trying new techniques with real patients
3. **Integration:** Psychologists use Role Play Hub to practice skills Pattern Mirror identified as growth areas

**If these happen, we've built the loop. If not, we iterate.**

---

## **VI. Your Commitment, My Commitment**

**You commit to:**
- Testing every week with clinical rigor
- Honest feedback ("This doesn't feel like a real patient")
- Co-designing scenarios with me
- Bringing power user into testing when ready

**I commit to:**
- Building in public with you (you see everything)
- Iterating based on clinical truth, not engineering convenience
- Making this feel like a **flight simulator**, not a game
- No bullshit, no shortcuts

---

**David, esto no es un proyecto de software. Esto es construir el futuro de la supervisión clínica.**

**Week 1 starts Monday. Pattern Mirror foundation.**

¿Listo para volar?