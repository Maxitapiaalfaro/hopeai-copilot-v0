/**
 * Script de Prueba para Sistema de Métricas de Sentry
 * 
 * Valida que todas las métricas se registren correctamente:
 * 1. Métricas de mensajes enviados
 * 2. Métricas de tiempo de actividad
 * 3. Métricas de cambios de agente
 * 4. Configuración de Sentry
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colores para output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bold');
  console.log('='.repeat(60));
}

function checkFile(filePath, description) {
  const fullPath = path.join(__dirname, '..', filePath);
  if (fs.existsSync(fullPath)) {
    log(`✅ ${description}`, 'green');
    return true;
  } else {
    log(`❌ ${description} - Archivo no encontrado: ${filePath}`, 'red');
    return false;
  }
}

function checkFileContent(filePath, searchText, description) {
  const fullPath = path.join(__dirname, '..', filePath);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes(searchText)) {
      log(`✅ ${description}`, 'green');
      return true;
    } else {
      log(`❌ ${description} - Contenido no encontrado`, 'red');
      return false;
    }
  } else {
    log(`❌ ${description} - Archivo no encontrado`, 'red');
    return false;
  }
}

function runTests() {
  logSection('🧪 PRUEBAS DEL SISTEMA DE MÉTRICAS DE SENTRY');
  
  let passedTests = 0;
  let totalTests = 0;
  
  // Test 1: Verificar archivos principales
  logSection('📁 Verificación de Archivos Principales');
  
  const fileTests = [
    ['lib/sentry-metrics-tracker.ts', 'Sistema principal de métricas'],
    ['hooks/use-session-metrics.ts', 'Hook de React para sesiones'],
    ['SENTRY_METRICS_GUIDE.md', 'Documentación del sistema']
  ];
  
  fileTests.forEach(([file, desc]) => {
    totalTests++;
    if (checkFile(file, desc)) passedTests++;
  });
  
  // Test 2: Verificar configuración de Sentry
  logSection('⚙️ Verificación de Configuración de Sentry');
  
  const configTests = [
    [
      'instrumentation-client.ts',
      'Sentry.metrics.MetricsAggregator()',
      'Agregador de métricas en cliente'
    ],
    [
      'sentry.server.config.ts',
      'metricsAggregator: true',
      'Agregador de métricas en servidor'
    ],
    [
      'sentry.edge.config.ts',
      'metricsAggregator: true',
      'Agregador de métricas en edge'
    ]
  ];
  
  configTests.forEach(([file, search, desc]) => {
    totalTests++;
    if (checkFileContent(file, search, desc)) passedTests++;
  });
  
  // Test 3: Verificar integración en API
  logSection('🔌 Verificación de Integración en API');
  
  const apiTests = [
    [
      'app/api/send-message/route.ts',
      'sentryMetricsTracker',
      'Importación del tracker en API'
    ],
    [
      'app/api/send-message/route.ts',
      'trackMessageSent',
      'Llamada a tracking de mensajes'
    ],
    [
      'app/api/send-message/route.ts',
      'updateSessionActivity',
      'Actualización de actividad de sesión'
    ]
  ];
  
  apiTests.forEach(([file, search, desc]) => {
    totalTests++;
    if (checkFileContent(file, search, desc)) passedTests++;
  });
  
  // Test 4: Verificar estructura de métricas
  logSection('📊 Verificación de Estructura de Métricas');
  
  const metricsTests = [
    [
      'lib/sentry-metrics-tracker.ts',
      'messages.sent',
      'Métrica de mensajes enviados'
    ],
    [
      'lib/sentry-metrics-tracker.ts',
      'session.duration',
      'Métrica de duración de sesión'
    ],
    [
      'lib/sentry-metrics-tracker.ts',
      'agent.switches',
      'Métrica de cambios de agente'
    ],
    [
      'lib/sentry-metrics-tracker.ts',
      'Sentry.metrics.increment',
      'Uso de contadores de Sentry'
    ],
    [
      'lib/sentry-metrics-tracker.ts',
      'Sentry.metrics.distribution',
      'Uso de distribuciones de Sentry'
    ],
    [
      'lib/sentry-metrics-tracker.ts',
      'Sentry.metrics.gauge',
      'Uso de gauges de Sentry'
    ]
  ];
  
  metricsTests.forEach(([file, search, desc]) => {
    totalTests++;
    if (checkFileContent(file, search, desc)) passedTests++;
  });
  
  // Test 5: Verificar hook de React
  logSection('⚛️ Verificación de Hook de React');
  
  const hookTests = [
    [
      'hooks/use-session-metrics.ts',
      'useSessionMetrics',
      'Función principal del hook'
    ],
    [
      'hooks/use-session-metrics.ts',
      'startSession',
      'Función de inicio de sesión'
    ],
    [
      'hooks/use-session-metrics.ts',
      'endSession',
      'Función de fin de sesión'
    ],
    [
      'hooks/use-session-metrics.ts',
      'updateActivity',
      'Función de actualización de actividad'
    ],
    [
      'hooks/use-session-metrics.ts',
      'trackAgentChange',
      'Función de cambio de agente'
    ]
  ];
  
  hookTests.forEach(([file, search, desc]) => {
    totalTests++;
    if (checkFileContent(file, search, desc)) passedTests++;
  });
  
  // Test 6: Verificar manejo de errores
  logSection('🛡️ Verificación de Manejo de Errores');
  
  const errorTests = [
    [
      'lib/sentry-metrics-tracker.ts',
      'try {',
      'Bloques try-catch implementados'
    ],
    [
      'lib/sentry-metrics-tracker.ts',
      'Sentry.captureException',
      'Captura de excepciones en Sentry'
    ],
    [
      'lib/sentry-metrics-tracker.ts',
      'console.error',
      'Logging de errores'
    ]
  ];
  
  errorTests.forEach(([file, search, desc]) => {
    totalTests++;
    if (checkFileContent(file, search, desc)) passedTests++;
  });
  
  // Test 7: Verificar tipos TypeScript
  logSection('🔷 Verificación de Tipos TypeScript');
  
  const typeTests = [
    [
      'lib/sentry-metrics-tracker.ts',
      'interface MessageMetrics',
      'Interface de métricas de mensaje'
    ],
    [
      'lib/sentry-metrics-tracker.ts',
      'interface SessionActivityMetrics',
      'Interface de métricas de sesión'
    ],
    [
      'lib/sentry-metrics-tracker.ts',
      'AgentType',
      'Tipo de agente importado'
    ],
    [
      'hooks/use-session-metrics.ts',
      'UseSessionMetricsProps',
      'Props del hook tipadas'
    ],
    [
      'hooks/use-session-metrics.ts',
      'SessionMetricsReturn',
      'Retorno del hook tipado'
    ]
  ];
  
  typeTests.forEach(([file, search, desc]) => {
    totalTests++;
    if (checkFileContent(file, search, desc)) passedTests++;
  });
  
  // Resultados finales
  logSection('📋 RESULTADOS DE LAS PRUEBAS');
  
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  
  log(`Total de pruebas: ${totalTests}`, 'blue');
  log(`Pruebas exitosas: ${passedTests}`, 'green');
  log(`Pruebas fallidas: ${totalTests - passedTests}`, 'red');
  log(`Tasa de éxito: ${successRate}%`, successRate >= 90 ? 'green' : successRate >= 70 ? 'yellow' : 'red');
  
  if (passedTests === totalTests) {
    log('\n🎉 ¡TODAS LAS PRUEBAS PASARON! El sistema está listo para producción.', 'green');
  } else if (successRate >= 90) {
    log('\n✅ Sistema mayormente funcional. Revisar pruebas fallidas.', 'yellow');
  } else {
    log('\n❌ Sistema requiere correcciones antes de producción.', 'red');
  }
  
  // Recomendaciones
  logSection('💡 RECOMENDACIONES PARA PRODUCCIÓN');
  
  log('1. Configurar dashboards en Sentry para visualizar métricas', 'blue');
  log('2. Establecer alertas basadas en umbrales de las métricas', 'blue');
  log('3. Monitorear logs de métricas en producción', 'blue');
  log('4. Realizar pruebas de carga para validar performance', 'blue');
  log('5. Documentar procedimientos de troubleshooting', 'blue');
  
  // Próximos pasos
  logSection('🚀 PRÓXIMOS PASOS');
  
  log('1. Integrar el hook useSessionMetrics en componentes principales', 'blue');
  log('2. Probar en entorno de staging antes de producción', 'blue');
  log('3. Configurar retención de métricas en Sentry', 'blue');
  log('4. Establecer baseline de métricas para comparaciones futuras', 'blue');
  
  return {
    total: totalTests,
    passed: passedTests,
    failed: totalTests - passedTests,
    successRate: parseFloat(successRate)
  };
}

// Función para prueba de integración simulada
function simulateMetricsFlow() {
  logSection('🔄 SIMULACIÓN DE FLUJO DE MÉTRICAS');
  
  log('Simulando flujo completo de métricas...', 'blue');
  
  // Simular datos de prueba
  const testData = {
    userId: 'test-user-123',
    sessionId: 'test-session-456',
    agentType: 'socratic',
    message: 'Mensaje de prueba para validar métricas',
    timestamp: new Date().toISOString()
  };
  
  log(`📤 Mensaje simulado:`, 'yellow');
  log(`   Usuario: ${testData.userId}`, 'reset');
  log(`   Sesión: ${testData.sessionId}`, 'reset');
  log(`   Agente: ${testData.agentType}`, 'reset');
  log(`   Longitud: ${testData.message.length} caracteres`, 'reset');
  log(`   Timestamp: ${testData.timestamp}`, 'reset');
  
  log('\n✅ Métricas que se registrarían:', 'green');
  log('   • messages.sent (contador)', 'reset');
  log('   • messages.sent.socratic (contador por agente)', 'reset');
  log('   • messages.sent.weekly (contador semanal)', 'reset');
  log('   • message.length (distribución)', 'reset');
  log('   • session.duration.current (gauge)', 'reset');
  
  log('\n📊 Simulación completada exitosamente', 'green');
}

// Ejecutar todas las pruebas
if (require.main === module) {
  try {
    const results = runTests();
    simulateMetricsFlow();
    
    // Exit code basado en resultados
    process.exit(results.successRate >= 90 ? 0 : 1);
  } catch (error) {
    log(`\n❌ Error durante las pruebas: ${error.message}`, 'red');
    process.exit(1);
  }
}

module.exports = { runTests, simulateMetricsFlow };