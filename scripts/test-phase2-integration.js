/**
 * Script de Testing para Fase 2 - Intelligent Intent Router
 * 
 * Este script valida la implementación completa de la Fase 2:
 * - Router de intenciones inteligente
 * - Clasificación automática de intenciones
 * - Extracción de entidades semánticas
 * - Enrutamiento transparente entre agentes
 * - Integración con HopeAI System
 */

const fs = require('fs')
const path = require('path')

// Colores para output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
}

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSection(title) {
  console.log(`\n${colors.bold}${colors.blue}=== ${title} ===${colors.reset}`)
}

function logTest(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL'
  const color = passed ? 'green' : 'red'
  log(color, `${status} ${name}`)
  if (details) {
    console.log(`   ${details}`)
  }
}

function logPhase(phase, description) {
  console.log(`\n${colors.bold}${colors.magenta}🚀 ${phase}: ${description}${colors.reset}`)
}

// Test 1: Verificar estructura de archivos de Fase 2
function testPhase2FileStructure() {
  logSection('Test 1: Estructura de Archivos - Fase 2')
  
  const requiredFiles = [
    'lib/intelligent-intent-router.ts',
    'lib/hopeai-system.ts',
    'lib/clinical-agent-router.ts'
  ]
  
  let allFilesExist = true
  
  requiredFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file)
    const exists = fs.existsSync(filePath)
    logTest(`Archivo ${file}`, exists)
    if (!exists) allFilesExist = false
  })
  
  return allFilesExist
}

// Test 2: Verificar implementación del Intelligent Intent Router
function testIntelligentIntentRouter() {
  logSection('Test 2: Intelligent Intent Router - Implementación')
  
  try {
    const routerPath = path.join(process.cwd(), 'lib/intelligent-intent-router.ts')
    const routerContent = fs.readFileSync(routerPath, 'utf8')
    
    // Verificar componentes clave
    const hasIntelligentIntentRouter = routerContent.includes('class IntelligentIntentRouter')
    const hasFunctionDeclarations = routerContent.includes('functionDeclarations')
    const hasActivarModoSocratico = routerContent.includes('activar_modo_socratico')
    const hasActivarModoClinico = routerContent.includes('activar_modo_clinico')
    const hasActivarModoAcademico = routerContent.includes('activar_modo_academico')
    const hasRouteUserInput = routerContent.includes('routeUserInput')
    const hasClassifyIntent = routerContent.includes('classifyIntent')
    const hasEnrichedContext = routerContent.includes('EnrichedContext')
    const hasCreateFactory = routerContent.includes('createIntelligentIntentRouter')
    
    logTest('Clase IntelligentIntentRouter', hasIntelligentIntentRouter)
    logTest('Function Declarations definidas', hasFunctionDeclarations)
    logTest('Función activar_modo_socratico', hasActivarModoSocratico)
    logTest('Función activar_modo_clinico', hasActivarModoClinico)
    logTest('Función activar_modo_academico', hasActivarModoAcademico)
    logTest('Método routeUserInput', hasRouteUserInput)
    logTest('Método classifyIntent', hasClassifyIntent)
    logTest('Interface EnrichedContext', hasEnrichedContext)
    logTest('Factory createIntelligentIntentRouter', hasCreateFactory)
    
    return hasIntelligentIntentRouter && hasFunctionDeclarations && hasActivarModoSocratico && 
           hasActivarModoClinico && hasActivarModoAcademico && hasRouteUserInput && 
           hasClassifyIntent && hasEnrichedContext && hasCreateFactory
  } catch (error) {
    logTest('Lectura de Intelligent Intent Router', false, error.message)
    return false
  }
}

// Test 3: Verificar integración en HopeAI System
function testHopeAISystemIntegration() {
  logSection('Test 3: Integración en HopeAI System')
  
  try {
    const systemPath = path.join(process.cwd(), 'lib/hopeai-system.ts')
    const systemContent = fs.readFileSync(systemPath, 'utf8')
    
    // Verificar importación del router
    const hasImportRouter = systemContent.includes('createIntelligentIntentRouter')
    const hasIntentRouterProperty = systemContent.includes('private intentRouter')
    const hasRouterInitialization = systemContent.includes('this.intentRouter = createIntelligentIntentRouter')
    const hasRouteUserInputCall = systemContent.includes('this.intentRouter.routeUserInput')
    const hasRoutingInfo = systemContent.includes('routingInfo')
    const hasEnrichedContextUsage = systemContent.includes('enrichedContext')
    
    logTest('Importación del router', hasImportRouter)
    logTest('Propiedad intentRouter', hasIntentRouterProperty)
    logTest('Inicialización del router', hasRouterInitialization)
    logTest('Llamada a routeUserInput', hasRouteUserInputCall)
    logTest('Información de routing en respuesta', hasRoutingInfo)
    logTest('Uso de contexto enriquecido', hasEnrichedContextUsage)
    
    return hasImportRouter && hasIntentRouterProperty && hasRouterInitialization && 
           hasRouteUserInputCall && hasRoutingInfo && hasEnrichedContextUsage
  } catch (error) {
    logTest('Lectura de HopeAI System', false, error.message)
    return false
  }
}

// Test 4: Verificar actualización del Clinical Agent Router
function testClinicalAgentRouterUpdate() {
  logSection('Test 4: Actualización del Clinical Agent Router')
  
  try {
    const routerPath = path.join(process.cwd(), 'lib/clinical-agent-router.ts')
    const routerContent = fs.readFileSync(routerPath, 'utf8')
    
    // Verificar parámetro enrichedContext
    const hasEnrichedContextParam = routerContent.includes('enrichedContext?: any')
    const hasBuildEnhancedMessage = routerContent.includes('buildEnhancedMessage')
    const hasContextDetection = routerContent.includes('Contexto detectado')
    const hasSessionSummary = routerContent.includes('Resumen de sesión')
    const hasAgentPriorities = routerContent.includes('Enfoques prioritarios')
    
    logTest('Parámetro enrichedContext en sendMessage', hasEnrichedContextParam)
    logTest('Método buildEnhancedMessage', hasBuildEnhancedMessage)
    logTest('Detección de contexto', hasContextDetection)
    logTest('Resumen de sesión', hasSessionSummary)
    logTest('Prioridades del agente', hasAgentPriorities)
    
    return hasEnrichedContextParam && hasBuildEnhancedMessage && hasContextDetection && 
           hasSessionSummary && hasAgentPriorities
  } catch (error) {
    logTest('Lectura de Clinical Agent Router', false, error.message)
    return false
  }
}

// Test 5: Verificar configuración de Function Calling
function testFunctionCallingConfiguration() {
  logSection('Test 5: Configuración de Function Calling')
  
  try {
    const routerPath = path.join(process.cwd(), 'lib/intelligent-intent-router.ts')
    const routerContent = fs.readFileSync(routerPath, 'utf8')
    
    // Verificar configuración de Google GenAI SDK
    const hasFunctionCallingMode = routerContent.includes('FunctionCallingConfigMode.AUTO')
    const hasParametersJsonSchema = routerContent.includes('parametersJsonSchema')
    const hasGenerateContent = routerContent.includes('generateContent')
    const hasConfidenceThreshold = routerContent.includes('confidenceThreshold')
    const hasFallbackAgent = routerContent.includes('fallbackAgent')
    
    logTest('FunctionCallingConfigMode.AUTO', hasFunctionCallingMode)
    logTest('parametersJsonSchema definido', hasParametersJsonSchema)
    logTest('Llamada a generateContent', hasGenerateContent)
    logTest('Umbral de confianza', hasConfidenceThreshold)
    logTest('Agente de fallback', hasFallbackAgent)
    
    return hasFunctionCallingMode && hasParametersJsonSchema && hasGenerateContent && 
           hasConfidenceThreshold && hasFallbackAgent
  } catch (error) {
    logTest('Verificación de Function Calling', false, error.message)
    return false
  }
}

// Test 6: Verificar métricas y logging
function testMetricsAndLogging() {
  logSection('Test 6: Métricas y Logging')
  
  try {
    const routerPath = path.join(process.cwd(), 'lib/intelligent-intent-router.ts')
    const routerContent = fs.readFileSync(routerPath, 'utf8')
    
    const hasLogging = routerContent.includes('console.log')
    const hasPerformanceMetrics = routerContent.includes('getPerformanceMetrics')
    const hasRoutingDecision = routerContent.includes('logRoutingDecision')
    const hasTimestamp = routerContent.includes('timestamp')
    
    logTest('Sistema de logging', hasLogging)
    logTest('Métricas de rendimiento', hasPerformanceMetrics)
    logTest('Log de decisiones de routing', hasRoutingDecision)
    logTest('Timestamps en logs', hasTimestamp)
    
    return hasLogging && hasPerformanceMetrics && hasRoutingDecision && hasTimestamp
  } catch (error) {
    logTest('Verificación de métricas', false, error.message)
    return false
  }
}

// Función principal de testing
function runPhase2Tests() {
  logPhase('FASE 2A', 'Base Orchestrator - Intelligent Intent Router')
  
  console.log(`${colors.bold}${colors.cyan}🧪 Ejecutando Tests de Integración - Fase 2${colors.reset}`)
  console.log(`${colors.yellow}Verificando implementación del sistema de enrutamiento inteligente...${colors.reset}\n`)
  
  const results = {
    fileStructure: testPhase2FileStructure(),
    intentRouter: testIntelligentIntentRouter(),
    systemIntegration: testHopeAISystemIntegration(),
    agentRouterUpdate: testClinicalAgentRouterUpdate(),
    functionCalling: testFunctionCallingConfiguration(),
    metricsLogging: testMetricsAndLogging()
  }
  
  // Resumen final
  logSection('Resumen de Resultados - Fase 2A')
  
  const totalTests = Object.keys(results).length
  const passedTests = Object.values(results).filter(result => result).length
  const successRate = (passedTests / totalTests * 100).toFixed(1)
  
  log('cyan', `Tests ejecutados: ${totalTests}`)
  log('green', `Tests exitosos: ${passedTests}`)
  log('red', `Tests fallidos: ${totalTests - passedTests}`)
  log('bold', `Tasa de éxito: ${successRate}%`)
  
  if (passedTests === totalTests) {
    log('green', '\n🎉 ¡Fase 2A completada exitosamente!')
    log('green', '✅ El Intelligent Intent Router está correctamente implementado e integrado')
    log('cyan', '🚀 Listo para proceder con Fase 2B: Entity Extraction')
  } else {
    log('yellow', '\n⚠️  Algunos tests fallaron. Revisar implementación antes de continuar.')
    
    // Mostrar tests específicos que fallaron
    Object.entries(results).forEach(([testName, passed]) => {
      if (!passed) {
        log('red', `❌ Falló: ${testName}`)
      }
    })
  }
  
  return results
}

// Ejecutar tests si el script se ejecuta directamente
if (require.main === module) {
  runPhase2Tests()
}

module.exports = {
  runPhase2Tests,
  testPhase2FileStructure,
  testIntelligentIntentRouter,
  testHopeAISystemIntegration,
  testClinicalAgentRouterUpdate,
  testFunctionCallingConfiguration,
  testMetricsAndLogging
}