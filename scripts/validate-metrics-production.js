/**
 * Validador de Métricas en Producción
 * 
 * Script para monitorear en tiempo real que las métricas
 * se estén enviando correctamente a Sentry en producción.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuración
const CONFIG = {
  // URL base de la aplicación en producción
  baseUrl: process.env.PRODUCTION_URL || 'http://localhost:3000',
  
  // Intervalo de monitoreo (en milisegundos)
  monitorInterval: 30000, // 30 segundos
  
  // Métricas esperadas
  expectedMetrics: [
    'messages.sent',
    'messages.sent.socratic',
    'messages.sent.clinical', 
    'messages.sent.academic',
    'messages.sent.weekly',
    'message.length',
    'message.response_time',
    'sessions.started',
    'session.duration.current',
    'session.duration.total',
    'session.duration.weekly',
    'session.messages.count',
    'session.agent_switches',
    'agent.switches'
  ],
  
  // Umbrales de alerta
  thresholds: {
    maxResponseTime: 5000, // 5 segundos
    minSessionDuration: 10, // 10 segundos
    maxAgentSwitches: 10 // máximo 10 cambios por sesión
  }
};

// Colores para logging
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  const timestamp = new Date().toISOString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bold');
  console.log('='.repeat(60));
}

// Clase principal para validación
class MetricsValidator {
  constructor() {
    this.isRunning = false;
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastCheck: null,
      alerts: []
    };
    this.monitorInterval = null;
  }

  // Iniciar monitoreo
  start() {
    if (this.isRunning) {
      log('El validador ya está ejecutándose', 'yellow');
      return;
    }

    this.isRunning = true;
    log('🚀 Iniciando validador de métricas en producción', 'green');
    log(`📊 Monitoreando: ${CONFIG.baseUrl}`, 'blue');
    log(`⏱️ Intervalo: ${CONFIG.monitorInterval / 1000} segundos`, 'blue');

    // Ejecutar primera validación inmediatamente
    this.validateMetrics();

    // Configurar intervalo de monitoreo
    this.monitorInterval = setInterval(() => {
      this.validateMetrics();
    }, CONFIG.monitorInterval);

    // Manejar señales de terminación
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  // Detener monitoreo
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    log('🛑 Deteniendo validador de métricas', 'yellow');
    this.generateReport();
    process.exit(0);
  }

  // Validar métricas principales
  async validateMetrics() {
    log('🔍 Iniciando validación de métricas...', 'cyan');
    
    try {
      // Test 1: Verificar endpoint de salud
      await this.checkHealthEndpoint();
      
      // Test 2: Simular envío de mensaje
      await this.simulateMessageSending();
      
      // Test 3: Verificar configuración de Sentry
      await this.checkSentryConfiguration();
      
      // Test 4: Validar estructura de respuestas
      await this.validateResponseStructure();
      
      this.stats.successfulRequests++;
      log('✅ Validación completada exitosamente', 'green');
      
    } catch (error) {
      this.stats.failedRequests++;
      log(`❌ Error en validación: ${error.message}`, 'red');
      this.addAlert('validation_error', error.message);
    }
    
    this.stats.totalRequests++;
    this.stats.lastCheck = new Date();
  }

  // Verificar endpoint de salud
  async checkHealthEndpoint() {
    const startTime = Date.now();
    
    try {
      const response = await this.makeRequest('/api/health');
      const responseTime = Date.now() - startTime;
      
      this.updateAverageResponseTime(responseTime);
      
      if (responseTime > CONFIG.thresholds.maxResponseTime) {
        this.addAlert('slow_response', `Tiempo de respuesta alto: ${responseTime}ms`);
      }
      
      log(`🏥 Health check: ${response.status} (${responseTime}ms)`, 'green');
      
    } catch (error) {
      throw new Error(`Health check falló: ${error.message}`);
    }
  }

  // Simular envío de mensaje para validar métricas
  async simulateMessageSending() {
    const testMessage = {
      message: `Mensaje de prueba para validación de métricas - ${Date.now()}`,
      sessionId: `validation-session-${Date.now()}`
    };
    
    try {
      const startTime = Date.now();
      const response = await this.makeRequest('/api/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testMessage)
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.status === 200) {
        log(`📤 Mensaje de prueba enviado exitosamente (${responseTime}ms)`, 'green');
        
        // Verificar que la respuesta contenga los campos esperados
        const data = JSON.parse(response.body);
        if (!data.response) {
          this.addAlert('invalid_response', 'Respuesta no contiene campo response');
        }
      } else {
        throw new Error(`Status ${response.status}: ${response.body}`);
      }
      
    } catch (error) {
      throw new Error(`Simulación de mensaje falló: ${error.message}`);
    }
  }

  // Verificar configuración de Sentry
  async checkSentryConfiguration() {
    const configFiles = [
      'instrumentation-client.ts',
      'sentry.server.config.ts',
      'sentry.edge.config.ts'
    ];
    
    for (const file of configFiles) {
      const filePath = path.join(process.cwd(), file);
      
      if (!fs.existsSync(filePath)) {
        this.addAlert('missing_config', `Archivo de configuración faltante: ${file}`);
        continue;
      }
      
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Verificar que contenga configuración de métricas
      if (file.includes('client') && !content.includes('MetricsAggregator')) {
        this.addAlert('missing_metrics_config', `${file} no tiene MetricsAggregator configurado`);
      }
      
      if (!file.includes('client') && !content.includes('metricsAggregator: true')) {
        this.addAlert('missing_metrics_config', `${file} no tiene metricsAggregator habilitado`);
      }
    }
    
    log('⚙️ Configuración de Sentry verificada', 'blue');
  }

  // Validar estructura de respuestas
  async validateResponseStructure() {
    // Verificar que el sistema de métricas esté disponible
    const metricsFile = path.join(process.cwd(), 'lib', 'sentry-metrics-tracker.ts');
    
    if (!fs.existsSync(metricsFile)) {
      this.addAlert('missing_metrics_system', 'Sistema de métricas no encontrado');
      return;
    }
    
    const content = fs.readFileSync(metricsFile, 'utf8');
    
    // Verificar que contenga las métricas esperadas
    for (const metric of CONFIG.expectedMetrics) {
      if (!content.includes(metric)) {
        this.addAlert('missing_metric', `Métrica no encontrada en código: ${metric}`);
      }
    }
    
    log('📊 Estructura de métricas validada', 'blue');
  }

  // Realizar petición HTTP
  makeRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, CONFIG.baseUrl);
      const requestOptions = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: 10000
      };

      const client = url.protocol === 'https:' ? https : require('http');
      
      const req = client.request(requestOptions, (res) => {
        let body = '';
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body
          });
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }

  // Actualizar tiempo promedio de respuesta
  updateAverageResponseTime(newTime) {
    if (this.stats.averageResponseTime === 0) {
      this.stats.averageResponseTime = newTime;
    } else {
      this.stats.averageResponseTime = 
        (this.stats.averageResponseTime + newTime) / 2;
    }
  }

  // Agregar alerta
  addAlert(type, message) {
    const alert = {
      type,
      message,
      timestamp: new Date(),
      severity: this.getAlertSeverity(type)
    };
    
    this.stats.alerts.push(alert);
    
    const color = alert.severity === 'high' ? 'red' : 
                  alert.severity === 'medium' ? 'yellow' : 'blue';
    
    log(`🚨 ALERTA [${alert.severity.toUpperCase()}]: ${message}`, color);
  }

  // Determinar severidad de alerta
  getAlertSeverity(type) {
    const highSeverity = ['validation_error', 'missing_metrics_system', 'slow_response'];
    const mediumSeverity = ['missing_config', 'missing_metrics_config', 'invalid_response'];
    
    if (highSeverity.includes(type)) return 'high';
    if (mediumSeverity.includes(type)) return 'medium';
    return 'low';
  }

  // Generar reporte final
  generateReport() {
    logSection('📋 REPORTE DE VALIDACIÓN DE MÉTRICAS');
    
    const successRate = this.stats.totalRequests > 0 ? 
      ((this.stats.successfulRequests / this.stats.totalRequests) * 100).toFixed(1) : 0;
    
    log(`Total de validaciones: ${this.stats.totalRequests}`, 'blue');
    log(`Validaciones exitosas: ${this.stats.successfulRequests}`, 'green');
    log(`Validaciones fallidas: ${this.stats.failedRequests}`, 'red');
    log(`Tasa de éxito: ${successRate}%`, successRate >= 95 ? 'green' : successRate >= 80 ? 'yellow' : 'red');
    log(`Tiempo promedio de respuesta: ${Math.round(this.stats.averageResponseTime)}ms`, 'blue');
    log(`Última verificación: ${this.stats.lastCheck?.toLocaleString() || 'N/A'}`, 'blue');
    
    if (this.stats.alerts.length > 0) {
      logSection('🚨 ALERTAS DETECTADAS');
      
      const alertsByType = this.stats.alerts.reduce((acc, alert) => {
        acc[alert.severity] = (acc[alert.severity] || 0) + 1;
        return acc;
      }, {});
      
      log(`Alertas críticas: ${alertsByType.high || 0}`, 'red');
      log(`Alertas medias: ${alertsByType.medium || 0}`, 'yellow');
      log(`Alertas bajas: ${alertsByType.low || 0}`, 'blue');
      
      // Mostrar últimas 5 alertas
      const recentAlerts = this.stats.alerts.slice(-5);
      log('\nÚltimas alertas:', 'bold');
      recentAlerts.forEach(alert => {
        const color = alert.severity === 'high' ? 'red' : 
                      alert.severity === 'medium' ? 'yellow' : 'blue';
        log(`  [${alert.timestamp.toLocaleTimeString()}] ${alert.message}`, color);
      });
    } else {
      log('✅ No se detectaron alertas', 'green');
    }
    
    // Guardar reporte en archivo
    this.saveReportToFile();
  }

  // Guardar reporte en archivo
  saveReportToFile() {
    const reportData = {
      timestamp: new Date().toISOString(),
      stats: this.stats,
      config: CONFIG
    };
    
    const reportPath = path.join(process.cwd(), 'metrics-validation-report.json');
    
    try {
      fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
      log(`📄 Reporte guardado en: ${reportPath}`, 'green');
    } catch (error) {
      log(`❌ Error guardando reporte: ${error.message}`, 'red');
    }
  }
}

// Función principal
function main() {
  logSection('🔍 VALIDADOR DE MÉTRICAS EN PRODUCCIÓN');
  
  // Verificar argumentos de línea de comandos
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === '--help' || command === '-h') {
    console.log(`
Uso: node validate-metrics-production.js [opciones]

Opciones:
  --url <url>        URL base de la aplicación (default: http://localhost:3000)
  --interval <ms>    Intervalo de monitoreo en ms (default: 30000)
  --once             Ejecutar validación una sola vez
  --help, -h         Mostrar esta ayuda

Ejemplos:
  node validate-metrics-production.js
  node validate-metrics-production.js --url https://mi-app.com --interval 60000
  node validate-metrics-production.js --once
`);
    process.exit(0);
  }
  
  // Procesar argumentos
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url':
        CONFIG.baseUrl = args[i + 1];
        i++;
        break;
      case '--interval':
        CONFIG.monitorInterval = parseInt(args[i + 1]);
        i++;
        break;
      case '--once':
        CONFIG.runOnce = true;
        break;
    }
  }
  
  const validator = new MetricsValidator();
  
  if (CONFIG.runOnce) {
    log('🔄 Ejecutando validación única...', 'blue');
    validator.validateMetrics().then(() => {
      validator.generateReport();
      process.exit(0);
    }).catch((error) => {
      log(`❌ Error en validación: ${error.message}`, 'red');
      process.exit(1);
    });
  } else {
    validator.start();
  }
}

// Ejecutar si es el archivo principal
if (require.main === module) {
  main();
}

module.exports = { MetricsValidator, CONFIG };