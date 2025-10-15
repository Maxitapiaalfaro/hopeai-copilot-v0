#!/usr/bin/env node

/**
 * 🔒 Script de Verificación de Seguridad para Producción
 * 
 * Verifica que la configuración de seguridad esté correcta antes del deployment
 * Previene deployment accidental con logs habilitados
 */

const fs = require('fs');
const path = require('path');

// Colores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Verificaciones
const checks = {
  passed: 0,
  warnings: 0,
  failed: 0,
  critical: 0
};

/**
 * Verificar variables de entorno
 */
function checkEnvironmentVariables() {
  logSection('🔍 Verificando Variables de Entorno');
  
  const envFile = path.join(process.cwd(), '.env.local');
  
  if (!fs.existsSync(envFile)) {
    logWarning('.env.local no encontrado');
    checks.warnings++;
    return;
  }
  
  const envContent = fs.readFileSync(envFile, 'utf8');
  
  // Verificar NEXT_PUBLIC_FORCE_PRODUCTION_MODE
  if (envContent.includes('NEXT_PUBLIC_FORCE_PRODUCTION_MODE=true')) {
    logError('CRÍTICO: NEXT_PUBLIC_FORCE_PRODUCTION_MODE está en true en .env.local');
    logError('Esto bloqueará los logs en desarrollo local');
    logInfo('Cambiar a false para desarrollo local');
    checks.critical++;
  } else {
    logSuccess('NEXT_PUBLIC_FORCE_PRODUCTION_MODE configurado correctamente para desarrollo');
    checks.passed++;
  }
  
  // Verificar NEXT_PUBLIC_ENABLE_PRODUCTION_LOGS
  if (envContent.includes('NEXT_PUBLIC_ENABLE_PRODUCTION_LOGS=true')) {
    logWarning('NEXT_PUBLIC_ENABLE_PRODUCTION_LOGS está en true');
    logInfo('Asegúrate de que esto sea intencional');
    checks.warnings++;
  } else {
    logSuccess('NEXT_PUBLIC_ENABLE_PRODUCTION_LOGS deshabilitado correctamente');
    checks.passed++;
  }
  
  // Verificar NODE_ENV
  if (envContent.includes('NODE_ENV=production')) {
    logWarning('NODE_ENV está en production en .env.local');
    logInfo('Esto puede afectar el desarrollo local');
    checks.warnings++;
  } else {
    logSuccess('NODE_ENV configurado para desarrollo');
    checks.passed++;
  }
}

/**
 * Verificar configuración de Sentry
 */
function checkSentryConfig() {
  logSection('🔍 Verificando Configuración de Sentry');
  
  const sentryServerConfig = path.join(process.cwd(), 'sentry.server.config.ts');
  
  if (!fs.existsSync(sentryServerConfig)) {
    logError('sentry.server.config.ts no encontrado');
    checks.failed++;
    return;
  }
  
  const sentryContent = fs.readFileSync(sentryServerConfig, 'utf8');
  
  // Verificar que consoleLoggingIntegration esté condicionado
  if (sentryContent.includes('consoleLoggingIntegration') && 
      sentryContent.includes('isProduction')) {
    logSuccess('Sentry configurado para bloquear logs en producción');
    checks.passed++;
  } else {
    logWarning('Sentry puede estar enviando logs a producción');
    checks.warnings++;
  }
  
  // Verificar beforeSend
  if (sentryContent.includes('beforeSend')) {
    logSuccess('Sentry tiene filtro beforeSend configurado');
    checks.passed++;
  } else {
    logWarning('Sentry no tiene filtro beforeSend');
    checks.warnings++;
  }
}

/**
 * Verificar next.config.mjs
 */
function checkNextConfig() {
  logSection('🔍 Verificando next.config.mjs');
  
  const nextConfig = path.join(process.cwd(), 'next.config.mjs');
  
  if (!fs.existsSync(nextConfig)) {
    logError('next.config.mjs no encontrado');
    checks.failed++;
    return;
  }
  
  const configContent = fs.readFileSync(nextConfig, 'utf8');
  
  // Verificar productionBrowserSourceMaps
  if (configContent.includes('productionBrowserSourceMaps: false')) {
    logSuccess('Source maps deshabilitados en producción');
    checks.passed++;
  } else {
    logError('CRÍTICO: Source maps pueden estar expuestos en producción');
    checks.critical++;
  }
  
  // Verificar hideSourceMaps en Sentry config
  if (configContent.includes('hideSourceMaps: true')) {
    logSuccess('Source maps ocultos en configuración de Sentry');
    checks.passed++;
  } else {
    logWarning('Source maps pueden estar visibles');
    checks.warnings++;
  }
  
  // Verificar Terser/drop_console
  if (configContent.includes('drop_console') || configContent.includes('pure_funcs')) {
    logSuccess('Configuración de eliminación de console.log encontrada');
    checks.passed++;
  } else {
    logWarning('No se encontró configuración para eliminar console.log en build');
    checks.warnings++;
  }
}

/**
 * Verificar sistema de logging
 */
function checkLoggingSystem() {
  logSection('🔍 Verificando Sistema de Logging');
  
  const loggerFile = path.join(process.cwd(), 'lib', 'logger.ts');
  
  if (!fs.existsSync(loggerFile)) {
    logError('CRÍTICO: lib/logger.ts no encontrado');
    logError('El sistema de logging seguro no está implementado');
    checks.critical++;
    return;
  }
  
  const loggerContent = fs.readFileSync(loggerFile, 'utf8');
  
  // Verificar que tenga sanitización
  if (loggerContent.includes('sanitizeString') && loggerContent.includes('SENSITIVE_PATTERNS')) {
    logSuccess('Sistema de sanitización implementado');
    checks.passed++;
  } else {
    logError('Sistema de sanitización no encontrado');
    checks.failed++;
  }
  
  // Verificar bloqueo de console en producción
  if (loggerContent.includes('console.log = ') && loggerContent.includes('isProduction')) {
    logSuccess('Bloqueo de console.log en producción implementado');
    checks.passed++;
  } else {
    logError('CRÍTICO: console.log no está bloqueado en producción');
    checks.critical++;
  }
  
  // Verificar detección de producción
  if (loggerContent.includes('VERCEL_ENV') || loggerContent.includes('NEXT_PUBLIC_FORCE_PRODUCTION_MODE')) {
    logSuccess('Detección de entorno de producción configurada');
    checks.passed++;
  } else {
    logWarning('Detección de producción puede ser limitada');
    checks.warnings++;
  }
}

/**
 * Buscar console.log en el código
 */
function scanForConsoleLogs() {
  logSection('🔍 Escaneando console.log en el Código');
  
  const dirsToScan = ['lib', 'app', 'components'];
  let consoleLogsFound = 0;
  const filesWithLogs = [];
  
  function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        scanDirectory(filePath);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(/console\.(log|info|debug)/g);
        
        if (matches) {
          consoleLogsFound += matches.length;
          filesWithLogs.push({
            file: filePath,
            count: matches.length
          });
        }
      }
    });
  }
  
  dirsToScan.forEach(dir => scanDirectory(dir));
  
  if (consoleLogsFound > 0) {
    logWarning(`Se encontraron ${consoleLogsFound} console.log/info/debug en el código`);
    logInfo('Archivos con más logs:');
    filesWithLogs
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .forEach(({ file, count }) => {
        console.log(`  - ${file}: ${count} logs`);
      });
    logInfo('Considera migrar a loggers.* del sistema de logging');
    checks.warnings++;
  } else {
    logSuccess('No se encontraron console.log en el código');
    checks.passed++;
  }
}

/**
 * Generar reporte final
 */
function generateReport() {
  logSection('📊 Reporte de Seguridad');
  
  console.log(`✅ Verificaciones Pasadas: ${colors.green}${checks.passed}${colors.reset}`);
  console.log(`⚠️  Advertencias: ${colors.yellow}${checks.warnings}${colors.reset}`);
  console.log(`❌ Fallos: ${colors.red}${checks.failed}${colors.reset}`);
  console.log(`🚨 Críticos: ${colors.red}${checks.critical}${colors.reset}`);
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  if (checks.critical > 0) {
    logError('🚨 DEPLOYMENT BLOQUEADO: Se encontraron problemas críticos de seguridad');
    logError('Resolver los problemas críticos antes de hacer deployment');
    process.exit(1);
  } else if (checks.failed > 0) {
    logWarning('⚠️  Se encontraron problemas que deben resolverse');
    logInfo('Revisa los problemas antes de hacer deployment a producción');
    process.exit(1);
  } else if (checks.warnings > 0) {
    logWarning('⚠️  Se encontraron advertencias');
    logInfo('Revisa las advertencias antes de hacer deployment');
    logInfo('Puedes continuar si las advertencias son esperadas');
  } else {
    logSuccess('🎉 Todas las verificaciones de seguridad pasaron');
    logSuccess('El proyecto está listo para deployment seguro');
  }
}

/**
 * Main
 */
function main() {
  log('\n🔒 VERIFICACIÓN DE SEGURIDAD PARA PRODUCCIÓN', 'magenta');
  log('HopeAI - Protección de Propiedad Intelectual\n', 'magenta');
  
  checkEnvironmentVariables();
  checkSentryConfig();
  checkNextConfig();
  checkLoggingSystem();
  scanForConsoleLogs();
  generateReport();
}

// Ejecutar
main();

