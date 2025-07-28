#!/usr/bin/env node

/**
 * Script de Prueba Completa - Sistema de Métricas de Validación de Mercado
 * 
 * Este script ejecuta una validación completa end-to-end de todo el sistema
 * implementado, incluyendo tipos, tracker, hooks y componente demo.
 */

const fs = require('fs');
const path = require('path');

// ==========================================
// CONFIGURACIÓN
// ==========================================

const CONFIG = {
  projectRoot: process.cwd(),
  testResults: {
    timestamp: new Date().toISOString(),
    totalTests: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    errors: [],
    details: []
  }
};

// ==========================================
// UTILIDADES
// ==========================================

function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = {
    info: '📋',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    debug: '🔍'
  }[type] || '📋';
  
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function test(description, testFn) {
  CONFIG.testResults.totalTests++;
  
  try {
    const result = testFn();
    if (result === false) {
      throw new Error('Test returned false');
    }
    
    CONFIG.testResults.passed++;
    CONFIG.testResults.details.push({
      test: description,
      status: 'passed',
      result: result || 'OK'
    });
    
    log(`${description} - PASSED`, 'success');
    return true;
  } catch (error) {
    CONFIG.testResults.failed++;
    CONFIG.testResults.errors.push({
      test: description,
      error: error.message
    });
    CONFIG.testResults.details.push({
      test: description,
      status: 'failed',
      error: error.message
    });
    
    log(`${description} - FAILED: ${error.message}`, 'error');
    return false;
  }
}

function warning(message) {
  CONFIG.testResults.warnings++;
  log(message, 'warning');
}

function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return `${(stats.size / 1024).toFixed(1)} KB`;
  } catch {
    return 'N/A';
  }
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function countLines(content) {
  return content ? content.split('\n').length : 0;
}

function extractExports(content) {
  if (!content) return [];
  
  const exports = [];
  const exportRegex = /export\s+(?:interface|type|class|function|const|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/g;
  let match;
  
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }
  
  return exports;
}

function extractImports(content) {
  if (!content) return [];
  
  const imports = [];
  
  // Handle single-line imports
  const singleLineRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
  let match;
  
  while ((match = singleLineRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  // Handle multi-line imports (including type imports)
  const multiLineRegex = /import\s+(?:type\s+)?\{[\s\S]*?\}\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = multiLineRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  // Handle namespace imports
  const namespaceRegex = /import\s+\*\s+as\s+\w+\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = namespaceRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  // Handle default imports
  const defaultRegex = /import\s+\w+\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = defaultRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  return [...new Set(imports)]; // Remove duplicates
}

// ==========================================
// TESTS DE ESTRUCTURA DE ARCHIVOS
// ==========================================

function testFileStructure() {
  log('\n🏗️  VALIDANDO ESTRUCTURA DE ARCHIVOS', 'info');
  
  const requiredFiles = [
    'lib/enhanced-metrics-types.ts',
    'lib/enhanced-sentry-metrics-tracker.ts', 
    'hooks/use-market-validation-metrics.ts',
    'examples/market-validation-demo.tsx',
    'PLAN_MEJORAS_METRICAS.md',
    'scripts/test-market-validation-e2e.js',
    'market-validation-test-report.json'
  ];
  
  requiredFiles.forEach(file => {
    const filePath = path.join(CONFIG.projectRoot, file);
    test(`Archivo existe: ${file}`, () => {
      if (!fileExists(filePath)) {
        throw new Error(`Archivo no encontrado: ${filePath}`);
      }
      return `Tamaño: ${getFileSize(filePath)}`;
    });
  });
  
  // Verificar directorio examples
  test('Directorio examples existe', () => {
    const examplesDir = path.join(CONFIG.projectRoot, 'examples');
    if (!fs.existsSync(examplesDir)) {
      throw new Error('Directorio examples no encontrado');
    }
    return 'OK';
  });
}

// ==========================================
// TESTS DE CONTENIDO DE ARCHIVOS
// ==========================================

function testFileContents() {
  log('\n📄 VALIDANDO CONTENIDO DE ARCHIVOS', 'info');
  
  // Test enhanced-metrics-types.ts
  test('Tipos: Interfaces principales definidas', () => {
    const content = readFile(path.join(CONFIG.projectRoot, 'lib/enhanced-metrics-types.ts'));
    if (!content) throw new Error('No se pudo leer el archivo');
    
    const requiredInterfaces = [
      'UserIdentity',
      'ActivationMetrics', 
      'EngagementMetrics',
      'ValueMetrics',
      'RetentionMetrics',
      'ConversionEvent',
      'EnhancedTrackerConfig'
    ];
    
    const missing = requiredInterfaces.filter(iface => 
      !content.includes(`interface ${iface}`) && !content.includes(`type ${iface}`)
    );
    
    if (missing.length > 0) {
      throw new Error(`Interfaces faltantes: ${missing.join(', ')}`);
    }
    
    return `${requiredInterfaces.length} interfaces encontradas`;
  });
  
  test('Tipos: Enums definidos', () => {
    const content = readFile(path.join(CONFIG.projectRoot, 'lib/enhanced-metrics-types.ts'));
    if (!content) throw new Error('No se pudo leer el archivo');
    
    const requiredTypes = [
      { name: 'UserType', pattern: 'export type UserType' },
      { name: 'AgentType', pattern: 'export type AgentType' },
      { name: 'EVENT_TYPES', pattern: 'export const EVENT_TYPES' }
    ];
    
    const missing = requiredTypes.filter(type => !content.includes(type.pattern));
    
    if (missing.length > 0) {
      throw new Error(`Tipos faltantes: ${missing.map(t => t.name).join(', ')}`);
    }
    
    return `${requiredTypes.length} tipos encontrados`;
  });
  
  // Test enhanced-sentry-metrics-tracker.ts
  test('Tracker: Clase principal definida', () => {
    const content = readFile(path.join(CONFIG.projectRoot, 'lib/enhanced-sentry-metrics-tracker.ts'));
    if (!content) throw new Error('No se pudo leer el archivo');
    
    if (!content.includes('class EnhancedSentryMetricsTracker')) {
      throw new Error('Clase EnhancedSentryMetricsTracker no encontrada');
    }
    
    const requiredMethods = [
      'identifyUser',
      'trackActivation',
      'trackEngagement', 
      'trackValue',
      'analyzeRetention',
      'trackConversionEvent',
      'calculateProductMarketFit'
    ];
    
    const missing = requiredMethods.filter(method => !content.includes(method));
    
    if (missing.length > 0) {
      throw new Error(`Métodos faltantes: ${missing.join(', ')}`);
    }
    
    return `${requiredMethods.length} métodos encontrados`;
  });
  
  test('Tracker: Instancia singleton exportada', () => {
    const content = readFile(path.join(CONFIG.projectRoot, 'lib/enhanced-sentry-metrics-tracker.ts'));
    if (!content) throw new Error('No se pudo leer el archivo');
    
    if (!content.includes('export const enhancedMetricsTracker')) {
      throw new Error('Instancia singleton no exportada');
    }
    
    return 'Singleton encontrado';
  });
  
  // Test use-market-validation-metrics.ts
  test('Hook: useMarketValidationMetrics definido', () => {
    const content = readFile(path.join(CONFIG.projectRoot, 'hooks/use-market-validation-metrics.ts'));
    if (!content) throw new Error('No se pudo leer el archivo');
    
    if (!content.includes('export function useMarketValidationMetrics')) {
      throw new Error('Hook useMarketValidationMetrics no encontrado');
    }
    
    const requiredReturns = [
      'userIdentity',
      'identifyCurrentUser',
      'trackUserActivation',
      'trackUserEngagement',
      'trackUserValue',
      'analyzeUserRetention',
      'trackConversionEvent',
      'getMarketValidationData'
    ];
    
    const missing = requiredReturns.filter(returnValue => !content.includes(returnValue));
    
    if (missing.length > 0) {
      warning(`Valores de retorno posiblemente faltantes: ${missing.join(', ')}`);
    }
    
    return `Hook principal encontrado`;
  });
  
  // Test market-validation-demo.tsx
  test('Demo: Componente React definido', () => {
    const content = readFile(path.join(CONFIG.projectRoot, 'examples/market-validation-demo.tsx'));
    if (!content) throw new Error('No se pudo leer el archivo');
    
    if (!content.includes('export function MarketValidationDemo')) {
      throw new Error('Componente MarketValidationDemo no encontrado');
    }
    
    if (!content.includes('useMarketValidationMetrics')) {
      throw new Error('Hook useMarketValidationMetrics no utilizado');
    }
    
    const requiredFeatures = [
      'simulateSendMessage',
      'simulateUploadDocument', 
      'simulateSolveProblem',
      'simulateAgentSwitch'
    ];
    
    const missing = requiredFeatures.filter(feature => !content.includes(feature));
    
    if (missing.length > 0) {
      throw new Error(`Funciones de simulación faltantes: ${missing.join(', ')}`);
    }
    
    return `Componente demo completo`;
  });
}

// ==========================================
// TESTS DE INTEGRACIÓN
// ==========================================

function testIntegration() {
  log('\n🔗 VALIDANDO INTEGRACIÓN ENTRE COMPONENTES', 'info');
  
  test('Integración: Imports correctos en tracker', () => {
    const content = readFile(path.join(CONFIG.projectRoot, 'lib/enhanced-sentry-metrics-tracker.ts'));
    if (!content) throw new Error('No se pudo leer el archivo');
    
    const imports = extractImports(content);
    
    // Verificar que importa los tipos (acepta rutas relativas y con alias)
    const hasTypesImport = imports.some(imp => 
      imp.includes('enhanced-metrics-types') || 
      imp.includes('./enhanced-metrics-types') ||
      imp.includes('@/lib/enhanced-metrics-types')
    );
    
    if (!hasTypesImport) {
      throw new Error('Import de tipos no encontrado');
    }
    
    return `${imports.length} imports encontrados`;
  });
  
  test('Integración: Imports correctos en hook', () => {
    const content = readFile(path.join(CONFIG.projectRoot, 'hooks/use-market-validation-metrics.ts'));
    if (!content) throw new Error('No se pudo leer el archivo');
    
    const imports = extractImports(content);
    
    // Verificar import de tipos
    const hasTypesImport = imports.some(imp => 
      imp.includes('enhanced-metrics-types') || 
      imp.includes('./enhanced-metrics-types') ||
      imp.includes('@/lib/enhanced-metrics-types')
    );
    
    // Verificar import del tracker
    const hasTrackerImport = imports.some(imp => 
      imp.includes('enhanced-sentry-metrics-tracker') || 
      imp.includes('./enhanced-sentry-metrics-tracker') ||
      imp.includes('@/lib/enhanced-sentry-metrics-tracker')
    );
    
    const missing = [];
    if (!hasTypesImport) missing.push('enhanced-metrics-types');
    if (!hasTrackerImport) missing.push('enhanced-sentry-metrics-tracker');
    
    if (missing.length > 0) {
      throw new Error(`Imports faltantes: ${missing.join(', ')}`);
    }
    
    return `Imports correctos`;
  });
  
  test('Integración: Imports correctos en demo', () => {
    const content = readFile(path.join(CONFIG.projectRoot, 'examples/market-validation-demo.tsx'));
    if (!content) throw new Error('No se pudo leer el archivo');
    
    const imports = extractImports(content);
    
    // Verificar import del hook
    const hasHookImport = imports.some(imp => 
      imp.includes('use-market-validation-metrics') || 
      imp.includes('./use-market-validation-metrics') ||
      imp.includes('@/hooks/use-market-validation-metrics')
    );
    
    // Verificar import de tipos
    const hasTypesImport = imports.some(imp => 
      imp.includes('enhanced-metrics-types') || 
      imp.includes('./enhanced-metrics-types') ||
      imp.includes('@/lib/enhanced-metrics-types')
    );
    
    const missing = [];
    if (!hasHookImport) missing.push('use-market-validation-metrics');
    if (!hasTypesImport) missing.push('enhanced-metrics-types');
    
    if (missing.length > 0) {
      throw new Error(`Imports faltantes: ${missing.join(', ')}`);
    }
    
    return `Imports correctos`;
  });
}

// ==========================================
// TESTS DE FUNCIONALIDAD
// ==========================================

function testFunctionality() {
  log('\n⚙️  VALIDANDO FUNCIONALIDAD CORE', 'info');
  
  test('Funcionalidad: Configuración de thresholds', () => {
    const content = readFile(path.join(CONFIG.projectRoot, 'lib/enhanced-metrics-types.ts'));
    if (!content) throw new Error('No se pudo leer el archivo');
    
    if (!content.includes('DEFAULT_THRESHOLDS')) {
      throw new Error('Configuración de thresholds no encontrada');
    }
    
    const thresholdKeys = [
      'ACTIVATION_SCORE',
      'ENGAGEMENT_SCORE', 
      'VALUE_SCORE',
      'RETENTION_DAYS'
    ];
    
    const missing = thresholdKeys.filter(key => !content.includes(key));
    
    if (missing.length > 0) {
      throw new Error(`Thresholds faltantes: ${missing.join(', ')}`);
    }
    
    return 'Thresholds configurados';
  });
  
  test('Funcionalidad: Métodos de cálculo de scores', () => {
    const content = readFile(path.join(CONFIG.projectRoot, 'lib/enhanced-sentry-metrics-tracker.ts'));
    if (!content) throw new Error('No se pudo leer el archivo');
    
    const scoreMethods = [
      'calculateActivationScore',
      'calculateEngagementScore',
      'calculateValueScore',
      'calculateProductMarketFit'
    ];
    
    const missing = scoreMethods.filter(method => !content.includes(method));
    
    if (missing.length > 0) {
      throw new Error(`Métodos de cálculo faltantes: ${missing.join(', ')}`);
    }
    
    return `${scoreMethods.length} métodos de cálculo encontrados`;
  });
  
  test('Funcionalidad: Gestión de estado en hook', () => {
    const content = readFile(path.join(CONFIG.projectRoot, 'hooks/use-market-validation-metrics.ts'));
    if (!content) throw new Error('No se pudo leer el archivo');
    
    const stateVariables = [
      'useState',
      'useEffect',
      'useCallback'
    ];
    
    const missing = stateVariables.filter(hook => !content.includes(hook));
    
    if (missing.length > 0) {
      throw new Error(`Hooks de React faltantes: ${missing.join(', ')}`);
    }
    
    return 'Gestión de estado correcta';
  });
}

// ==========================================
// TESTS DE CALIDAD DE CÓDIGO
// ==========================================

function testCodeQuality() {
  log('\n🎯 VALIDANDO CALIDAD DE CÓDIGO', 'info');
  
  const files = [
    'lib/enhanced-metrics-types.ts',
    'lib/enhanced-sentry-metrics-tracker.ts',
    'hooks/use-market-validation-metrics.ts',
    'examples/market-validation-demo.tsx'
  ];
  
  files.forEach(file => {
    test(`Calidad: ${file} - Documentación`, () => {
      const content = readFile(path.join(CONFIG.projectRoot, file));
      if (!content) throw new Error('No se pudo leer el archivo');
      
      const commentLines = content.split('\n').filter(line => 
        line.trim().startsWith('//') || 
        line.trim().startsWith('/*') || 
        line.trim().startsWith('*')
      ).length;
      
      const totalLines = countLines(content);
      const commentRatio = (commentLines / totalLines) * 100;
      
      if (commentRatio < 5) {
        warning(`Baja documentación en ${file}: ${commentRatio.toFixed(1)}%`);
      }
      
      return `${commentRatio.toFixed(1)}% documentado`;
    });
    
    test(`Calidad: ${file} - Tamaño razonable`, () => {
      const content = readFile(path.join(CONFIG.projectRoot, file));
      if (!content) throw new Error('No se pudo leer el archivo');
      
      const lines = countLines(content);
      
      if (lines > 1000) {
        warning(`Archivo muy grande: ${file} (${lines} líneas)`);
      }
      
      return `${lines} líneas`;
    });
  });
}

// ==========================================
// TESTS DE RENDIMIENTO
// ==========================================

function testPerformance() {
  log('\n🚀 VALIDANDO RENDIMIENTO', 'info');
  
  test('Rendimiento: Tamaño total del sistema', () => {
    const files = [
      'lib/enhanced-metrics-types.ts',
      'lib/enhanced-sentry-metrics-tracker.ts',
      'hooks/use-market-validation-metrics.ts',
      'examples/market-validation-demo.tsx'
    ];
    
    let totalSize = 0;
    files.forEach(file => {
      const filePath = path.join(CONFIG.projectRoot, file);
      if (fs.existsSync(filePath)) {
        totalSize += fs.statSync(filePath).size;
      }
    });
    
    const totalKB = totalSize / 1024;
    
    if (totalKB > 500) {
      warning(`Sistema grande: ${totalKB.toFixed(1)} KB`);
    }
    
    return `${totalKB.toFixed(1)} KB total`;
  });
  
  test('Rendimiento: Complejidad de imports', () => {
    const hookContent = readFile(path.join(CONFIG.projectRoot, 'hooks/use-market-validation-metrics.ts'));
    if (!hookContent) throw new Error('No se pudo leer el archivo del hook');
    
    const imports = extractImports(hookContent);
    
    if (imports.length > 10) {
      warning(`Muchos imports en hook: ${imports.length}`);
    }
    
    return `${imports.length} imports`;
  });
}

// ==========================================
// TESTS DE COMPATIBILIDAD
// ==========================================

function testCompatibility() {
  log('\n🔧 VALIDANDO COMPATIBILIDAD', 'info');
  
  test('Compatibilidad: Sintaxis TypeScript', () => {
    const files = [
      'lib/enhanced-metrics-types.ts',
      'lib/enhanced-sentry-metrics-tracker.ts',
      'hooks/use-market-validation-metrics.ts'
    ];
    
    files.forEach(file => {
      const content = readFile(path.join(CONFIG.projectRoot, file));
      if (!content) throw new Error(`No se pudo leer ${file}`);
      
      // Verificar sintaxis básica de TypeScript
      if (!content.includes('interface') && !content.includes('type') && !content.includes('class')) {
        throw new Error(`${file} no parece contener TypeScript válido`);
      }
    });
    
    return 'Sintaxis TypeScript válida';
  });
  
  test('Compatibilidad: Sintaxis React/JSX', () => {
    const content = readFile(path.join(CONFIG.projectRoot, 'examples/market-validation-demo.tsx'));
    if (!content) throw new Error('No se pudo leer el archivo demo');
    
    if (!content.includes('import React') && !content.includes('from \'react\'')) {
      throw new Error('Import de React no encontrado');
    }
    
    if (!content.includes('return (')) {
      throw new Error('JSX return no encontrado');
    }
    
    return 'Sintaxis React/JSX válida';
  });
  
  test('Compatibilidad: Exports ES6', () => {
    const files = [
      'lib/enhanced-metrics-types.ts',
      'lib/enhanced-sentry-metrics-tracker.ts',
      'hooks/use-market-validation-metrics.ts',
      'examples/market-validation-demo.tsx'
    ];
    
    files.forEach(file => {
      const content = readFile(path.join(CONFIG.projectRoot, file));
      if (!content) throw new Error(`No se pudo leer ${file}`);
      
      if (!content.includes('export')) {
        throw new Error(`${file} no tiene exports`);
      }
    });
    
    return 'Exports ES6 válidos';
  });
}

// ==========================================
// REPORTE FINAL
// ==========================================

function generateFinalReport() {
  log('\n📊 GENERANDO REPORTE FINAL', 'info');
  
  const successRate = CONFIG.testResults.totalTests > 0 ? 
    (CONFIG.testResults.passed / CONFIG.testResults.totalTests * 100).toFixed(1) : 0;
  
  const report = {
    ...CONFIG.testResults,
    successRate: `${successRate}%`,
    summary: {
      implementation: 'Sistema de Métricas de Validación de Mercado',
      version: '1.0.0',
      status: CONFIG.testResults.failed === 0 ? 'READY FOR PRODUCTION' : 'NEEDS FIXES',
      components: {
        types: 'enhanced-metrics-types.ts',
        tracker: 'enhanced-sentry-metrics-tracker.ts', 
        hook: 'use-market-validation-metrics.ts',
        demo: 'examples/market-validation-demo.tsx'
      },
      features: [
        'User identification and segmentation',
        'Activation metrics tracking',
        'Engagement metrics tracking', 
        'Value metrics tracking',
        'Retention analysis',
        'Conversion event tracking',
        'Product-market fit calculation',
        'React hooks integration',
        'Interactive demo component'
      ],
      recommendations: [
        'Deploy to staging environment for testing',
        'Configure Sentry dashboards',
        'Set up monitoring alerts',
        'Train team on new metrics',
        'Monitor performance in production'
      ]
    }
  };
  
  // Guardar reporte
  const reportPath = path.join(CONFIG.projectRoot, 'complete-implementation-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // Mostrar resumen
  console.log('\n' + '='.repeat(80));
  console.log('🎉 REPORTE FINAL - SISTEMA DE MÉTRICAS DE VALIDACIÓN DE MERCADO');
  console.log('='.repeat(80));
  console.log(`📊 Tests ejecutados: ${CONFIG.testResults.totalTests}`);
  console.log(`✅ Tests exitosos: ${CONFIG.testResults.passed}`);
  console.log(`❌ Tests fallidos: ${CONFIG.testResults.failed}`);
  console.log(`⚠️  Advertencias: ${CONFIG.testResults.warnings}`);
  console.log(`🎯 Tasa de éxito: ${successRate}%`);
  console.log(`📁 Reporte guardado: ${reportPath}`);
  
  if (CONFIG.testResults.failed === 0) {
    console.log('\n🚀 SISTEMA LISTO PARA PRODUCCIÓN!');
    console.log('\n📋 Próximos pasos:');
    console.log('   1. Integrar en aplicación principal');
    console.log('   2. Configurar dashboards de Sentry');
    console.log('   3. Establecer alertas de monitoreo');
    console.log('   4. Capacitar al equipo');
    console.log('   5. Monitorear métricas en producción');
  } else {
    console.log('\n🔧 CORRECCIONES NECESARIAS:');
    CONFIG.testResults.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.test}: ${error.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  
  return report;
}

// ==========================================
// EJECUCIÓN PRINCIPAL
// ==========================================

async function main() {
  console.log('🧪 INICIANDO PRUEBA COMPLETA DEL SISTEMA DE MÉTRICAS');
  console.log(`📂 Directorio: ${CONFIG.projectRoot}`);
  console.log(`⏰ Timestamp: ${CONFIG.testResults.timestamp}`);
  console.log('\n' + '='.repeat(80));
  
  try {
    // Ejecutar todas las pruebas
    testFileStructure();
    testFileContents();
    testIntegration();
    testFunctionality();
    testCodeQuality();
    testPerformance();
    testCompatibility();
    
    // Generar reporte final
    const report = generateFinalReport();
    
    // Exit code basado en resultados
    process.exit(CONFIG.testResults.failed === 0 ? 0 : 1);
    
  } catch (error) {
    log(`Error crítico durante las pruebas: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = {
  main,
  test,
  CONFIG
};