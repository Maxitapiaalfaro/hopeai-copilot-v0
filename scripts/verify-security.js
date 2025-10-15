#!/usr/bin/env node

/**
 * 🔒 SCRIPT DE VERIFICACIÓN DE SEGURIDAD
 * 
 * Verifica que todas las medidas de seguridad estén correctamente implementadas
 * antes de hacer deployment a producción.
 */

const fs = require('fs');
const path = require('path');

// Colores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFile(filePath, description) {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    log(`✅ ${description}`, 'green');
    return true;
  } else {
    log(`❌ ${description} - Archivo no encontrado: ${filePath}`, 'red');
    return false;
  }
}

function checkFileContent(filePath, searchString, description) {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    log(`❌ ${description} - Archivo no encontrado: ${filePath}`, 'red');
    return false;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  if (content.includes(searchString)) {
    log(`✅ ${description}`, 'green');
    return true;
  } else {
    log(`❌ ${description} - No se encontró: "${searchString}"`, 'red');
    return false;
  }
}

function checkEnvVar(varName, description) {
  if (process.env[varName]) {
    log(`✅ ${description}: ${process.env[varName]}`, 'green');
    return true;
  } else {
    log(`⚠️  ${description} - No configurada (OK en desarrollo)`, 'yellow');
    return false;
  }
}

async function main() {
  log('\n🔒 VERIFICACIÓN DE SEGURIDAD - HopeAI\n', 'cyan');
  
  let passed = 0;
  let failed = 0;
  let warnings = 0;

  // ============================================
  // 1. ARCHIVOS DE SEGURIDAD
  // ============================================
  log('📁 Verificando archivos de seguridad...', 'blue');
  
  const securityFiles = [
    ['lib/security/console-blocker.ts', 'Console blocker'],
    ['lib/security/rate-limiter.ts', 'Rate limiter'],
    ['lib/security/admin-auth.ts', 'Admin authentication'],
    ['lib/security/error-sanitizer.ts', 'Error sanitizer'],
    ['lib/security/audit-logger.ts', 'Audit logger'],
    ['middleware.ts', 'Security middleware'],
  ];

  securityFiles.forEach(([file, desc]) => {
    if (checkFile(file, desc)) {
      passed++;
    } else {
      failed++;
    }
  });

  log('');

  // ============================================
  // 2. IMPORTACIÓN DE CONSOLE BLOCKER
  // ============================================
  log('🔒 Verificando importación de console blocker...', 'blue');
  
  if (checkFileContent(
    'app/layout.tsx',
    "import '@/lib/security/console-blocker'",
    'Console blocker importado en app/layout.tsx'
  )) {
    passed++;
  } else {
    failed++;
  }

  log('');

  // ============================================
  // 3. PROTECCIÓN DE ENDPOINTS
  // ============================================
  log('🛡️  Verificando protección de endpoints...', 'blue');
  
  const protectedEndpoints = [
    ['app/api/system-status/route.ts', 'verifyAdminRequest', 'System status protegido'],
    ['app/api/sentry-example-api/route.ts', 'NODE_ENV', 'Sentry example bloqueado en producción'],
  ];

  protectedEndpoints.forEach(([file, search, desc]) => {
    if (checkFileContent(file, search, desc)) {
      passed++;
    } else {
      failed++;
    }
  });

  log('');

  // ============================================
  // 4. CONFIGURACIÓN DE NEXT.JS
  // ============================================
  log('⚙️  Verificando configuración de Next.js...', 'blue');
  
  const nextConfigChecks = [
    ['next.config.mjs', 'productionBrowserSourceMaps: false', 'Source maps deshabilitados'],
    ['next.config.mjs', 'drop_console', 'Console.log eliminados en build'],
  ];

  nextConfigChecks.forEach(([file, search, desc]) => {
    if (checkFileContent(file, search, desc)) {
      passed++;
    } else {
      failed++;
    }
  });

  log('');

  // ============================================
  // 5. CONFIGURACIÓN DE SENTRY
  // ============================================
  log('📊 Verificando configuración de Sentry...', 'blue');
  
  const sentryChecks = [
    ['sentry.server.config.ts', 'beforeSend', 'Sentry beforeSend configurado'],
    ['sentry.edge.config.ts', 'beforeSend', 'Sentry edge beforeSend configurado'],
  ];

  sentryChecks.forEach(([file, search, desc]) => {
    if (checkFileContent(file, search, desc)) {
      passed++;
    } else {
      failed++;
    }
  });

  log('');

  // ============================================
  // 6. VARIABLES DE ENTORNO
  // ============================================
  log('🔐 Verificando variables de entorno...', 'blue');
  
  const envVars = [
    ['NEXT_PUBLIC_FORCE_PRODUCTION_MODE', 'Modo producción forzado'],
    ['NEXT_PUBLIC_ENABLE_PRODUCTION_LOGS', 'Control de logs en producción'],
    ['ADMIN_API_TOKEN', 'Token administrativo'],
  ];

  envVars.forEach(([varName, desc]) => {
    if (checkEnvVar(varName, desc)) {
      passed++;
    } else {
      warnings++;
    }
  });

  log('');

  // ============================================
  // 7. DOCUMENTACIÓN
  // ============================================
  log('📚 Verificando documentación...', 'blue');
  
  const docs = [
    ['SECURITY-ENTERPRISE-GUIDE.md', 'Guía de seguridad enterprise'],
    ['.env.production.secure', 'Template de variables de producción'],
  ];

  docs.forEach(([file, desc]) => {
    if (checkFile(file, desc)) {
      passed++;
    } else {
      failed++;
    }
  });

  log('');

  // ============================================
  // 8. VERIFICACIÓN DE PATRONES PELIGROSOS
  // ============================================
  log('⚠️  Verificando patrones peligrosos...', 'blue');
  
  // Verificar que no haya console.log sin protección en archivos críticos
  const criticalFiles = [
    'lib/hopeai-system.ts',
    'lib/orchestrator/dynamic-orchestrator.ts',
    'lib/agents/clinical-agent-router.ts',
  ];

  let dangerousPatterns = 0;
  criticalFiles.forEach(file => {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const consoleLogCount = (content.match(/console\.log\(/g) || []).length;
      if (consoleLogCount > 0) {
        log(`⚠️  ${file} contiene ${consoleLogCount} console.log`, 'yellow');
        dangerousPatterns++;
      }
    }
  });

  if (dangerousPatterns === 0) {
    log('✅ No se encontraron console.log en archivos críticos', 'green');
    passed++;
  } else {
    log(`⚠️  Se encontraron ${dangerousPatterns} archivos con console.log (se eliminarán en build)`, 'yellow');
    warnings++;
  }

  log('');

  // ============================================
  // RESUMEN
  // ============================================
  log('═══════════════════════════════════════════', 'cyan');
  log('📊 RESUMEN DE VERIFICACIÓN', 'cyan');
  log('═══════════════════════════════════════════', 'cyan');
  log(`✅ Verificaciones exitosas: ${passed}`, 'green');
  log(`❌ Verificaciones fallidas: ${failed}`, 'red');
  log(`⚠️  Advertencias: ${warnings}`, 'yellow');
  log('');

  if (failed === 0) {
    log('🎉 ¡TODAS LAS VERIFICACIONES PASARON!', 'green');
    log('✅ El sistema está listo para deployment a producción', 'green');
    log('');
    log('📋 PRÓXIMOS PASOS:', 'cyan');
    log('1. Configurar variables en Vercel (ver .env.production.secure)', 'blue');
    log('2. Hacer deployment: git push origin main', 'blue');
    log('3. Verificar logs en producción (deben estar bloqueados)', 'blue');
    log('4. Probar endpoints protegidos con token', 'blue');
    log('');
    process.exit(0);
  } else {
    log('❌ ALGUNAS VERIFICACIONES FALLARON', 'red');
    log('⚠️  Por favor corrige los errores antes de hacer deployment', 'yellow');
    log('');
    process.exit(1);
  }
}

main().catch(error => {
  log(`\n❌ Error durante la verificación: ${error.message}`, 'red');
  process.exit(1);
});

