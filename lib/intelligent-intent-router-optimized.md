# Optimización: Combinar Clasificación de Intención + Extracción de Entidades

## Cambios Necesarios

### 1. Modificar `orchestrateWithTools()` en `intelligent-intent-router.ts`

**ANTES (líneas 256-287):**
```typescript
try {
  // 1. Clasificación de intención
  const intentResult = await this.classifyIntent(userInput, sessionContext);
  if (!intentResult) {
    return this.createFallbackOrchestration(userInput, sessionContext, 'Intent classification failed');
  }

  // 2. Extracción de entidades
  const entityResult = await this.entityExtractor.extractEntities(userInput, sessionContext);
  
  // 3. Selección contextual de herramientas
  const toolSelectionContext: ToolSelectionContext = {
    conversationHistory: sessionContext,
    currentIntent: intentResult.functionName,
    extractedEntities: entityResult.entities,
    sessionMetadata: {
      previousAgent,
      sessionLength: sessionContext.length,
      recentTopics: this.extractRecentTopics(sessionContext)
    }
  };

  const selectedTools = await this.selectContextualTools(toolSelectionContext);
  const selectedAgent = this.mapFunctionToAgent(intentResult.functionName);

  return {
    selectedAgent,
    contextualTools: selectedTools.map(tool => tool.declaration),
    toolMetadata: selectedTools,
    confidence: this.calculateCombinedConfidence(intentResult.confidence, entityResult.confidence, intentResult.functionName),
    reasoning: this.generateOrchestrationReasoning(intentResult, entityResult, selectedTools)
  };
```

**DESPUÉS:**
```typescript
try {
  // 🚀 OPTIMIZACIÓN: Single LLM call para intención + entidades (~500ms ahorrados)
  const combinedResult = await this.classifyIntentAndExtractEntities(userInput, sessionContext);
  
  if (!combinedResult.intentResult) {
    return this.createFallbackOrchestration(userInput, sessionContext, 'Intent classification failed');
  }

  // Selección contextual de herramientas usando resultados combinados
  const toolSelectionContext: ToolSelectionContext = {
    conversationHistory: sessionContext,
    currentIntent: combinedResult.intentResult.functionName,
    extractedEntities: combinedResult.entityResult.entities,
    sessionMetadata: {
      previousAgent,
      sessionLength: sessionContext.length,
      recentTopics: this.extractRecentTopics(sessionContext)
    }
  };

  const selectedTools = await this.selectContextualTools(toolSelectionContext);
  const selectedAgent = this.mapFunctionToAgent(combinedResult.intentResult.functionName);

  return {
    selectedAgent,
    contextualTools: selectedTools.map(tool => tool.declaration),
    toolMetadata: selectedTools,
    confidence: this.calculateCombinedConfidence(
      combinedResult.intentResult.confidence, 
      combinedResult.entityResult.confidence, 
      combinedResult.intentResult.functionName
    ),
    reasoning: this.generateOrchestrationReasoning(
      combinedResult.intentResult, 
      combinedResult.entityResult, 
      selectedTools
    )
  };
```

### 2. Agregar nuevo método `classifyIntentAndExtractEntities()` ANTES de `classifyIntent()`

**Insertar ANTES de la línea 519:**
```typescript
  /**
   * 🚀 OPTIMIZACIÓN: Clasificación combinada de intención + extracción de entidades en UNA SOLA llamada
   * Elimina un roundtrip LLM completo (~300-700ms ahorrados)
   */
  private async classifyIntentAndExtractEntities(
    userInput: string,
    sessionContext: Content[]
  ): Promise<{
    intentResult: IntentClassificationResult | null;
    entityResult: EntityExtractionResult;
  }> {
    const startTime = Date.now();
    
    try {
      // Construir prompt contextual
      const contextPrompt = this.buildContextualPrompt(userInput, sessionContext, undefined);
      
      // 🎯 CRITICAL: Combinar function declarations de intención + entidades
      const entityFunctions = this.entityExtractor.getEntityExtractionFunctions();
      const combinedFunctions = [...this.intentFunctions, ...entityFunctions];
      
      const result = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [{ role: 'user', parts: [{ text: contextPrompt }] }],
        config: {
          tools: [{
            functionDeclarations: combinedFunctions
          }],
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.ANY
            }
          },
          temperature: 0.0,
          topP: 0.1,
          topK: 1,
          seed: 42,
          maxOutputTokens: 2048
        }
      });

      // Validar respuesta
      if (!result.candidates || result.candidates.length === 0 || !result.functionCalls) {
        console.warn('⚠️ No se recibieron function calls en la respuesta combinada');
        return {
          intentResult: null,
          entityResult: {
            entities: [],
            primaryEntities: [],
            secondaryEntities: [],
            confidence: 0,
            processingTime: Date.now() - startTime
          }
        };
      }

      const functionCalls = result.functionCalls;

      // Separar function calls de intención vs entidades
      const intentCalls = functionCalls.filter(fc => 
        ['activar_modo_socratico', 'activar_modo_clinico', 'activar_modo_academico'].includes(fc.name!)
      );
      const entityCalls = functionCalls.filter(fc => 
        !['activar_modo_socratico', 'activar_modo_clinico', 'activar_modo_academico'].includes(fc.name!)
      );

      // Procesar intención (tomar el primero)
      let intentResult: IntentClassificationResult | null = null;
      if (intentCalls.length > 0) {
        const intentCall = intentCalls[0];
        if (this.validateFunctionCall(intentCall)) {
          const confidence = this.calculateEnhancedConfidence(intentCall, userInput, result.usageMetadata);
          intentResult = {
            functionName: intentCall.name!,
            parameters: intentCall.args || {},
            confidence,
            requiresClarification: confidence < 0.7
          };
        }
      }

      // Procesar entidades usando el método público del EntityExtractor
      const entityResult = await this.entityExtractor.processFunctionCallsPublic(entityCalls, startTime);

      if (this.config.enableLogging) {
        console.log(`⚡ Combined orchestration: intent=${intentResult?.functionName || 'none'} (${(intentResult?.confidence || 0).toFixed(2)}), entities=${entityResult.entities.length} in ${Date.now() - startTime}ms`);
      }

      return { intentResult, entityResult };

    } catch (error) {
      console.error('[IntelligentIntentRouter] Error en clasificación combinada:', error);
      return {
        intentResult: null,
        entityResult: {
          entities: [],
          primaryEntities: [],
          secondaryEntities: [],
          confidence: 0,
          processingTime: Date.now() - startTime
        }
      };
    }
  }
```

### 3. Exponer métodos necesarios en `entity-extraction-engine.ts`

**Agregar estos métodos públicos:**

```typescript
  /**
   * 🚀 OPTIMIZACIÓN: Exponer function declarations para llamada combinada
   */
  public getEntityExtractionFunctions(): FunctionDeclaration[] {
    return entityExtractionFunctions;
  }

  /**
   * 🚀 OPTIMIZACIÓN: Procesar function calls de forma pública (para llamada combinada)
   */
  public async processFunctionCallsPublic(
    functionCalls: any[], 
    startTime?: number
  ): Promise<EntityExtractionResult> {
    const processingStartTime = startTime || Date.now();
    
    const entities = await this.processFunctionCalls(functionCalls);
    const { primaryEntities, secondaryEntities } = this.classifyEntitiesByImportance(entities);
    const overallConfidence = this.calculateOverallConfidence(entities);
    
    return {
      entities,
      primaryEntities,
      secondaryEntities,
      confidence: overallConfidence,
      processingTime: Date.now() - processingStartTime
    };
  }
```

## Beneficios Esperados

- ⚡ **~300-700ms menos de latencia** antes del streaming
- 🔥 **1 roundtrip LLM eliminado** (de 2 a 1)
- 💰 **Menor costo** (tokens de prompt compartidos)
- 🎯 **Mayor coherencia** entre intención y entidades

## Testing

Después de implementar, verifica en los logs:
- Busca: `⚡ Combined orchestration:` 
- El tiempo total debe ser significativamente menor
- Debe aparecer solo UNA vez el log de model call en lugar de dos
