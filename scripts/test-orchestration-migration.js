/**
 * Script de Prueba para la Migración del Sistema de Orquestación HopeAI
 * 
 * Este script valida que la migración del sistema legacy al sistema de orquestación
 * avanzado funcione correctamente y genera un reporte de estado.
 * 
 * Uso: node scripts/test-orchestration-migration.js
 */

const https = require('https');
const http = require('http');

// Configuración
const BASE_URL = 'http://localhost:3000';
const TEST_SESSION_ID = `test_session_${Date.now()}`;
const TEST_USER_ID = 'test_user_migration';

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Función para hacer peticiones HTTP
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({ status: res.statusCode, data: jsonBody });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Función para imprimir con colores
function colorLog(color, message) {
  console.log(colors[color] + message + colors.reset);
}

// Función para imprimir encabezados
function printHeader(title) {
  console.log('\n' + '='.repeat(60));
  colorLog('cyan', `🔍 ${title}`);
  console.log('='.repeat(60));
}

// Función para imprimir resultados de prueba
function printTestResult(testName, success, details = '') {
  const icon = success ? '✅' : '❌';
  const color = success ? 'green' : 'red';
  colorLog(color, `${icon} ${testName}`);
  if (details) {
    console.log(`   ${details}`);
  }
}

// Prueba 1: Verificar estado de salud del sistema
async function testSystemHealth() {
  printHeader('PRUEBA 1: Estado de Salud del Sistema');
  
  try {
    const response = await makeRequest('GET', '/api/orchestration/health');
    
    if (response.status === 200 && response.data.success) {
      const health = response.data.health;
      printTestResult('Sistema de orquestación inicializado', true);
      printTestResult(`Estado general: ${health.overall}`, health.overall === 'healthy');
      printTestResult(`Tool Registry: ${health.components.toolRegistry}`, health.components.toolRegistry === 'healthy');
      printTestResult(`Orchestration Bridge: ${health.components.orchestrationBridge}`, health.components.orchestrationBridge === 'healthy');
      printTestResult(`Monitoring: ${health.components.monitoring}`, health.components.monitoring === 'healthy');
      
      colorLog('blue', `📊 Métricas del sistema:`);
      console.log(`   - Uptime: ${Math.round(health.metrics.uptime / 1000)}s`);
      console.log(`   - Total orquestaciones: ${health.metrics.totalOrchestrations}`);
      console.log(`   - Sesiones activas: ${health.metrics.currentSessions}`);
      console.log(`   - Tiempo promedio de respuesta: ${health.metrics.averageResponseTime}ms`);
      console.log(`   - Tasa de error: ${(health.metrics.errorRate * 100).toFixed(2)}%`);
      console.log(`   - Alertas críticas: ${health.alerts.critical}`);
      console.log(`   - Alertas de advertencia: ${health.alerts.warnings}`);
      
      return true;
    } else {
      printTestResult('Sistema de orquestación no disponible', false, `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    printTestResult('Error al verificar estado de salud', false, error.message);
    return false;
  }
}

// Prueba 2: Enviar mensajes de prueba
async function testMessageOrchestration() {
  printHeader('PRUEBA 2: Orquestación de Mensajes');
  
  const testMessages = [
    {
      message: "Hola, necesito ayuda con un caso de ansiedad en un paciente joven",
      expectedAgent: "clinical-supervisor",
      description: "Mensaje que debería activar el Supervisor Clínico"
    },
    {
      message: "Genera un resumen del caso de María con TEPT",
      expectedAgent: "documentation-specialist",
      description: "Mensaje que debería activar el Especialista en Documentación"
    },
    {
      message: "Busca investigaciones recientes sobre EMDR para veteranos",
      expectedAgent: "academic-researcher",
      description: "Mensaje que debería activar el Investigador Académico"
    }
  ];
  
  let successCount = 0;
  let dynamicCount = 0;
  let legacyCount = 0;
  
  for (let i = 0; i < testMessages.length; i++) {
    const test = testMessages[i];
    
    try {
      colorLog('yellow', `\n🧪 Prueba ${i + 1}: ${test.description}`);
      console.log(`   Mensaje: "${test.message.substring(0, 50)}..."`);;
      
      const response = await makeRequest('POST', '/api/send-message', {
        sessionId: TEST_SESSION_ID,
        message: test.message,
        userId: TEST_USER_ID,
        useStreaming: false
      });
      
      if (response.status === 200 && response.data.success) {
        const orchestration = response.data.orchestration;
        
        printTestResult('Mensaje procesado correctamente', true);
        printTestResult(`Tipo de orquestación: ${orchestration.type}`, true, 
          `Confianza: ${orchestration.confidence}`);
        printTestResult(`Agente seleccionado: ${orchestration.agent}`, true);
        
        if (orchestration.toolsUsed > 0) {
          printTestResult(`Herramientas utilizadas: ${orchestration.toolsUsed}`, true);
        }
        
        if (orchestration.responseTime) {
          printTestResult(`Tiempo de respuesta: ${orchestration.responseTime}ms`, 
            orchestration.responseTime < 5000);
        }
        
        // Contar tipos de orquestación
        if (orchestration.type === 'dynamic') {
          dynamicCount++;
        } else if (orchestration.type === 'legacy' || orchestration.type === 'legacy-fallback') {
          legacyCount++;
        }
        
        successCount++;
      } else {
        printTestResult('Error al procesar mensaje', false, 
          `Status: ${response.status}, Error: ${response.data.error || 'Desconocido'}`);
      }
      
      // Esperar un poco entre mensajes
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      printTestResult(`Error en prueba ${i + 1}`, false, error.message);
    }
  }
  
  // Resumen de la prueba
  colorLog('blue', `\n📈 Resumen de Orquestación:`);
  console.log(`   - Mensajes exitosos: ${successCount}/${testMessages.length}`);
  console.log(`   - Orquestación dinámica: ${dynamicCount}`);
  console.log(`   - Orquestación legacy: ${legacyCount}`);
  console.log(`   - Porcentaje dinámico: ${((dynamicCount / successCount) * 100).toFixed(1)}%`);
  
  return successCount === testMessages.length;
}

// Prueba 3: Verificar métricas del sistema
async function testSystemMetrics() {
  printHeader('PRUEBA 3: Métricas del Sistema');
  
  try {
    const response = await makeRequest('GET', '/api/orchestration/metrics?includeAlerts=true');
    
    if (response.status === 200 && response.data.success) {
      const metrics = response.data.metrics;
      
      printTestResult('Métricas obtenidas correctamente', true);
      
      colorLog('blue', `📊 Métricas detalladas:`);
      console.log(`   Orquestador:`);
      console.log(`     - Total orquestaciones: ${metrics.orchestrator.totalOrchestrations}`);
      console.log(`     - Tiempo promedio: ${metrics.orchestrator.averageResponseTime}ms`);
      console.log(`     - Orquestaciones fallidas: ${metrics.orchestrator.failedOrchestrations}`);
      
      console.log(`   Bridge:`);
      console.log(`     - Total requests: ${metrics.bridge.totalRequests}`);
      console.log(`     - Requests dinámicos: ${metrics.bridge.dynamicRequests || 'N/A'}`);
      console.log(`     - Requests legacy: ${metrics.bridge.legacyRequests || 'N/A'}`);
      console.log(`     - Tasa de error: ${(metrics.bridge.errorRate * 100).toFixed(2)}%`);
      
      console.log(`   Tool Registry:`);
      console.log(`     - Total herramientas: ${metrics.toolRegistry.totalTools}`);
      console.log(`     - Herramientas activas: ${metrics.toolRegistry.activeTools || 'N/A'}`);
      
      console.log(`   Sistema:`);
      console.log(`     - Uptime: ${Math.round(metrics.system.uptime / 1000)}s`);
      console.log(`     - Inicializado: ${metrics.system.initialized}`);
      
      if (response.data.alerts && response.data.alerts.length > 0) {
        colorLog('yellow', `⚠️  Alertas activas: ${response.data.alerts.length}`);
        response.data.alerts.forEach(alert => {
          console.log(`     - ${alert.level}: ${alert.message}`);
        });
      } else {
        printTestResult('Sin alertas activas', true);
      }
      
      return true;
    } else {
      printTestResult('Error al obtener métricas', false, `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    printTestResult('Error al verificar métricas', false, error.message);
    return false;
  }
}

// Prueba 4: Configuración dinámica
async function testDynamicConfiguration() {
  printHeader('PRUEBA 4: Configuración Dinámica');
  
  try {
    // Cambiar el porcentaje de migración
    colorLog('yellow', '🔧 Cambiando porcentaje de migración a 90%...');
    
    const configResponse = await makeRequest('POST', '/api/orchestration/health', {
      migrationPercentage: 90,
      enableDynamicOrchestration: true,
      enableMonitoring: true
    });
    
    if (configResponse.status === 200 && configResponse.data.success) {
      printTestResult('Configuración actualizada correctamente', true);
      
      // Verificar que el cambio se aplicó
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const healthResponse = await makeRequest('GET', '/api/orchestration/health');
      if (healthResponse.status === 200) {
        printTestResult('Verificación de configuración', true, 
          'El sistema responde correctamente después del cambio');
        return true;
      }
    }
    
    printTestResult('Error al actualizar configuración', false);
    return false;
    
  } catch (error) {
    printTestResult('Error en configuración dinámica', false, error.message);
    return false;
  }
}

// Función principal
async function runMigrationTests() {
  colorLog('bright', '🚀 INICIANDO PRUEBAS DE MIGRACIÓN DEL SISTEMA DE ORQUESTACIÓN HOPEAI');
  colorLog('bright', `📅 Fecha: ${new Date().toISOString()}`);
  colorLog('bright', `🔗 URL Base: ${BASE_URL}`);
  
  const results = {
    systemHealth: false,
    messageOrchestration: false,
    systemMetrics: false,
    dynamicConfiguration: false
  };
  
  // Ejecutar pruebas
  results.systemHealth = await testSystemHealth();
  results.messageOrchestration = await testMessageOrchestration();
  results.systemMetrics = await testSystemMetrics();
  results.dynamicConfiguration = await testDynamicConfiguration();
  
  // Reporte final
  printHeader('REPORTE FINAL DE MIGRACIÓN');
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  const successRate = (passedTests / totalTests) * 100;
  
  colorLog('blue', `📊 Resultados de las pruebas:`);
  printTestResult('Estado de Salud del Sistema', results.systemHealth);
  printTestResult('Orquestación de Mensajes', results.messageOrchestration);
  printTestResult('Métricas del Sistema', results.systemMetrics);
  printTestResult('Configuración Dinámica', results.dynamicConfiguration);
  
  console.log('\n' + '='.repeat(60));
  colorLog('bright', `🎯 TASA DE ÉXITO: ${successRate.toFixed(1)}% (${passedTests}/${totalTests})`);
  
  if (successRate >= 75) {
    colorLog('green', '✅ MIGRACIÓN EXITOSA - El sistema está funcionando correctamente');
  } else if (successRate >= 50) {
    colorLog('yellow', '⚠️  MIGRACIÓN PARCIAL - Algunos componentes requieren atención');
  } else {
    colorLog('red', '❌ MIGRACIÓN FALLIDA - Se requiere intervención inmediata');
  }
  
  console.log('='.repeat(60));
  
  // Recomendaciones
  if (successRate < 100) {
    colorLog('cyan', '💡 Recomendaciones:');
    
    if (!results.systemHealth) {
      console.log('   - Verificar que el servidor esté ejecutándose en el puerto 3000');
      console.log('   - Revisar logs del sistema de orquestación');
    }
    
    if (!results.messageOrchestration) {
      console.log('   - Verificar configuración del bridge de orquestación');
      console.log('   - Revisar logs de procesamiento de mensajes');
    }
    
    if (!results.systemMetrics) {
      console.log('   - Verificar sistema de monitoreo');
      console.log('   - Revisar configuración de métricas');
    }
    
    if (!results.dynamicConfiguration) {
      console.log('   - Verificar permisos de configuración');
      console.log('   - Revisar validación de parámetros');
    }
  }
  
  process.exit(successRate >= 75 ? 0 : 1);
}

// Ejecutar las pruebas
if (require.main === module) {
  runMigrationTests().catch(error => {
    colorLog('red', `❌ Error fatal en las pruebas: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runMigrationTests,
  testSystemHealth,
  testMessageOrchestration,
  testSystemMetrics,
  testDynamicConfiguration
};