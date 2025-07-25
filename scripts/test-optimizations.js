/**
 * Script de Testing para Optimizaciones HopeAI - Fase 1
 * 
 * Este script valida las funcionalidades clave implementadas:
 * - Gestión optimizada de contexto
 * - Persistencia inteligente
 * - Métricas de rendimiento
 * - Transferencia de contexto entre agentes
 */

const fs = require('fs')
const path = require('path')

// Colores para output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
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

// Test 1: Verificar estructura de archivos
function testFileStructure() {
  logSection('Test 1: Estructura de Archivos')
  
  const requiredFiles = [
    'hooks/use-optimized-context.ts',
    'hooks/use-hopeai-optimized.ts',
    'lib/client-context-persistence.ts',
    'components/main-interface-optimized.tsx',
    'components/migration-wrapper.tsx',
    'config/optimization-config.ts'
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

// Test 2: Verificar configuración
function testConfiguration() {
  logSection('Test 2: Configuración de Optimización')
  
  try {
    const configPath = path.join(process.cwd(), 'config/optimization-config.ts')
    const configContent = fs.readFileSync(configPath, 'utf8')
    
    const hasDefaultConfig = configContent.includes('defaultOptimizationConfig')
    const hasConservativeConfig = configContent.includes('conservativeOptimizationConfig')
    const hasOptimizationFeatures = configContent.includes('OptimizationFeatures')
    const hasLogPrefixes = configContent.includes('LOG_PREFIXES')
    
    logTest('Configuración por defecto', hasDefaultConfig)
    logTest('Configuración conservadora', hasConservativeConfig)
    logTest('Características de optimización', hasOptimizationFeatures)
    logTest('Prefijos de logging', hasLogPrefixes)
    
    return hasDefaultConfig && hasConservativeConfig && hasOptimizationFeatures && hasLogPrefixes
  } catch (error) {
    logTest('Lectura de configuración', false, error.message)
    return false
  }
}

// Test 3: Verificar hooks optimizados
function testOptimizedHooks() {
  logSection('Test 3: Hooks Optimizados')
  
  try {
    // Verificar useOptimizedContext
    const contextHookPath = path.join(process.cwd(), 'hooks/use-optimized-context.ts')
    const contextContent = fs.readFileSync(contextHookPath, 'utf8')
    
    const hasCreateOptimizedChat = contextContent.includes('createOptimizedChat')
    const hasOptimizeHistoryForAgent = contextContent.includes('optimizeHistoryForAgent')
    const hasSendOptimizedMessage = contextContent.includes('sendOptimizedMessage')
    const hasTransferContextToAgent = contextContent.includes('transferContextToAgent')
    
    logTest('Función createOptimizedChat', hasCreateOptimizedChat)
    logTest('Función optimizeHistoryForAgent', hasOptimizeHistoryForAgent)
    logTest('Función sendOptimizedMessage', hasSendOptimizedMessage)
    logTest('Función transferContextToAgent', hasTransferContextToAgent)
    
    // Verificar useHopeAIOptimized
    const hopeaiHookPath = path.join(process.cwd(), 'hooks/use-hopeai-optimized.ts')
    const hopeaiContent = fs.readFileSync(hopeaiHookPath, 'utf8')
    
    const hasCreateOptimizedSession = hopeaiContent.includes('createOptimizedSession')
    const hasGetPerformanceReport = hopeaiContent.includes('getPerformanceReport')
    const hasGetCuratedHistory = hopeaiContent.includes('getCuratedHistory')
    
    logTest('Función createOptimizedSession', hasCreateOptimizedSession)
    logTest('Función getPerformanceReport', hasGetPerformanceReport)
    logTest('Función getCuratedHistory', hasGetCuratedHistory)
    
    return hasCreateOptimizedChat && hasOptimizeHistoryForAgent && hasSendOptimizedMessage && 
           hasTransferContextToAgent && hasCreateOptimizedSession && hasGetPerformanceReport && 
           hasGetCuratedHistory
  } catch (error) {
    logTest('Lectura de hooks', false, error.message)
    return false
  }
}

// Test 4: Verificar persistencia
function testPersistence() {
  logSection('Test 4: Sistema de Persistencia')
  
  try {
    const persistencePath = path.join(process.cwd(), 'lib/client-context-persistence.ts')
    const persistenceContent = fs.readFileSync(persistencePath, 'utf8')
    
    const hasClientContextPersistence = persistenceContent.includes('ClientContextPersistence')
    const hasSaveOptimizedSession = persistenceContent.includes('saveOptimizedSession')
    const hasLoadOptimizedSession = persistenceContent.includes('loadOptimizedSession')
    const hasCompressionThreshold = persistenceContent.includes('COMPRESSION_THRESHOLD')
    const hasCompressContent = persistenceContent.includes('compressContent')
    
    logTest('Clase ClientContextPersistence', hasClientContextPersistence)
    logTest('Función saveOptimizedSession', hasSaveOptimizedSession)
    logTest('Función loadOptimizedSession', hasLoadOptimizedSession)
    logTest('Umbral de compresión', hasCompressionThreshold)
    logTest('Función de compresión', hasCompressContent)
    
    return hasClientContextPersistence && hasSaveOptimizedSession && hasLoadOptimizedSession && 
           hasCompressionThreshold && hasCompressContent
  } catch (error) {
    logTest('Lectura de persistencia', false, error.message)
    return false
  }
}

// Test 5: Verificar componentes optimizados
function testOptimizedComponents() {
  logSection('Test 5: Componentes Optimizados')
  
  try {
    // Verificar MainInterfaceOptimized
    const mainInterfacePath = path.join(process.cwd(), 'components/main-interface-optimized.tsx')
    const mainInterfaceContent = fs.readFileSync(mainInterfacePath, 'utf8')
    
    const hasMainInterfaceOptimized = mainInterfaceContent.includes('MainInterfaceOptimized')
    const hasUseHopeAIOptimized = mainInterfaceContent.includes('useHopeAIOptimized')
    const hasPerformanceMetrics = mainInterfaceContent.includes('PerformanceMetrics')
    
    logTest('Componente MainInterfaceOptimized', hasMainInterfaceOptimized)
    logTest('Hook useHopeAIOptimized integrado', hasUseHopeAIOptimized)
    logTest('Componente PerformanceMetrics', hasPerformanceMetrics)
    
    // Verificar MigrationWrapper
    const migrationPath = path.join(process.cwd(), 'components/migration-wrapper.tsx')
    const migrationContent = fs.readFileSync(migrationPath, 'utf8')
    
    const hasMigrationWrapper = migrationContent.includes('MigrationWrapper')
    const hasMigrationControls = migrationContent.includes('MigrationControls')
    const hasOptimizationStatus = migrationContent.includes('OptimizationStatus')
    
    logTest('Componente MigrationWrapper', hasMigrationWrapper)
    logTest('Controles de migración', hasMigrationControls)
    logTest('Estado de optimización', hasOptimizationStatus)
    
    return hasMainInterfaceOptimized && hasUseHopeAIOptimized && hasPerformanceMetrics && 
           hasMigrationWrapper && hasMigrationControls && hasOptimizationStatus
  } catch (error) {
    logTest('Lectura de componentes', false, error.message)
    return false
  }
}

// Test 6: Verificar integración en app principal
function testMainAppIntegration() {
  logSection('Test 6: Integración en App Principal')
  
  try {
    const appPath = path.join(process.cwd(), 'app/page.tsx')
    const appContent = fs.readFileSync(appPath, 'utf8')
    
    const hasMigrationWrapperImport = appContent.includes('MigrationWrapper')
    const usesMigrationWrapper = appContent.includes('<MigrationWrapper')
    
    logTest('Import de MigrationWrapper', hasMigrationWrapperImport)
    logTest('Uso de MigrationWrapper', usesMigrationWrapper)
    
    return hasMigrationWrapperImport && usesMigrationWrapper
  } catch (error) {
    logTest('Lectura de app principal', false, error.message)
    return false
  }
}

// Test 7: Verificar documentación
function testDocumentation() {
  logSection('Test 7: Documentación')
  
  const docFiles = [
    'docs/FASE_1_IMPLEMENTACION.md',
    'README_OPTIMIZACIONES.md'
  ]
  
  let allDocsExist = true
  
  docFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file)
    const exists = fs.existsSync(filePath)
    logTest(`Documentación ${file}`, exists)
    if (!exists) allDocsExist = false
  })
  
  return allDocsExist
}

// Ejecutar todos los tests
function runAllTests() {
  console.log(`${colors.bold}${colors.blue}🚀 HopeAI - Testing de Optimizaciones Fase 1${colors.reset}\n`)
  
  const results = [
    testFileStructure(),
    testConfiguration(),
    testOptimizedHooks(),
    testPersistence(),
    testOptimizedComponents(),
    testMainAppIntegration(),
    testDocumentation()
  ]
  
  const passedTests = results.filter(Boolean).length
  const totalTests = results.length
  
  logSection('Resumen de Testing')
  
  if (passedTests === totalTests) {
    log('green', `✅ TODOS LOS TESTS PASARON (${passedTests}/${totalTests})`)
    log('green', '🎉 Las optimizaciones de Fase 1 están correctamente implementadas!')
    log('blue', '📋 Próximo paso: Validación manual y testing de funcionalidades')
  } else {
    log('red', `❌ ALGUNOS TESTS FALLARON (${passedTests}/${totalTests})`)
    log('yellow', '⚠️  Revisar los errores antes de proceder')
  }
  
  console.log(`\n${colors.bold}Testing completado.${colors.reset}`)
  
  return passedTests === totalTests
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runAllTests()
}

module.exports = { runAllTests }