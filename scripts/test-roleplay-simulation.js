const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  const colorCode = colors[color] || colors.reset;
  console.log(`${colorCode}${message}${colors.reset}`);
}

function logSection(title) {
  log('cyan', `\n${'='.repeat(70)}`);
  log('bold', `🧠 ${title}`);
  log('cyan', `${'='.repeat(70)}`);
}

function logResult(testName, status, details = '') {
  const icons = { PASS: '✅', FAIL: '❌', WARN: '⚠️' };
  const color = status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : 'yellow';
  log(color, `${icons[status]} ${testName}`);
  if (details) {
    log('reset', `   ${details}`);
  }
}

class RoleplayAgentTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      details: []
    };
  }

  addResult(testName, status, details = '', data = null) {
    if (status === 'PASS') this.results.passed += 1;
    else if (status === 'FAIL') this.results.failed += 1;
    else this.results.warnings += 1;

    this.results.details.push({
      test: testName,
      status,
      details,
      data,
      timestamp: new Date().toISOString()
    });

    logResult(testName, status, details);
  }

  resolveFile(relativePath) {
    return path.join(process.cwd(), relativePath);
  }

  readFile(relativePath) {
    const filePath = this.resolveFile(relativePath);
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      this.addResult(
        `Lectura de ${relativePath}`,
        'FAIL',
        `No se pudo leer el archivo: ${error.message}`
      );
      return null;
    }
  }

  testFilePresence() {
    logSection('Verificación de archivos base');
    const files = [
      'lib/hopeai-system.ts',
      'lib/intelligent-intent-router.ts',
      'lib/clinical-agent-router.ts',
      'types/clinical-types.ts'
    ];

    files.forEach(file => {
      const pathToFile = this.resolveFile(file);
      if (fs.existsSync(pathToFile)) {
        const stats = fs.statSync(pathToFile);
        this.addResult(
          `Archivo ${file}`,
          'PASS',
          `Tamaño ${(stats.size / 1024).toFixed(2)} KB`
        );
      } else {
        this.addResult(
          `Archivo ${file}`,
          'FAIL',
          'No se encontró en el repositorio'
        );
      }
    });
  }

  testAgentRegistration() {
    logSection('Registro del agente de roleplay');
    const content = this.readFile('lib/clinical-agent-router.ts');
    if (!content) return;

    const expectations = [
      {
        name: 'Definición del agente "roleplay"',
        check: content.includes('this.agents.set("roleplay"'),
        detail: 'El agente debe registrarse en ClinicalAgentRouter'
      },
      {
        name: 'Identidad Paciente Simulado',
        check: content.includes('Paciente Simulado'),
        detail: 'La instrucción base debe reflejar la identidad del roleplay'
      },
      {
        name: 'Actualización de RoleplayPatientState',
        check: content.includes("Actualiza tu 'RoleplayPatientState'"),
        detail: 'Las instrucciones deben indicar cómo evolucionar el estado interno'
      },
      {
        name: 'Resguardo de confidencialidad en roleplay',
        check: content.includes('No inventes contenidos fuera del marco clínico'),
        detail: 'El agente debe mantener límites clínicos explícitos'
      }
    ];

    expectations.forEach(expectation => {
      this.addResult(
        expectation.name,
        expectation.check ? 'PASS' : 'FAIL',
        expectation.detail
      );
    });
  }

  testIntentRouterConfig() {
    logSection('Orquestador de intenciones');
    const content = this.readFile('lib/intelligent-intent-router.ts');
    if (!content) return;

    const expectations = [
      {
        name: 'Función activar_modo_roleplay',
        check: content.includes("name: 'activar_modo_roleplay'"),
        detail: 'La función debe existir en la lista de intenciones'
      },
      {
        name: 'Parámetros de roleplay',
        check: content.includes('motivo_roleplay') && content.includes('aspectos_paciente'),
        detail: 'Se esperan parámetros dedicados al contexto de simulación'
      },
      {
        name: 'Mapeo agente roleplay',
        check: content.includes("'activar_modo_roleplay': 'roleplay'"),
        detail: 'El router debe mapear la intención al agente roleplay'
      },
      {
        name: 'Pesos de confianza para roleplay',
        check: content.includes("functionName === 'activar_modo_roleplay'"),
        detail: 'El cálculo de confianza contempla el nuevo modo'
      },
      {
        name: 'Contexto enriquecido roleplay',
        check: content.includes('roleplay_profile?:') && content.includes('roleplay_state?:'),
        detail: 'EnrichedContext expone perfil y estado del paciente simulado'
      }
    ];

    expectations.forEach(expectation => {
      this.addResult(
        expectation.name,
        expectation.check ? 'PASS' : 'FAIL',
        expectation.detail
      );
    });
  }

  testHopeAISystemRoleplayContext() {
    logSection('Gestión de contexto en HopeAISystem');
    const content = this.readFile('lib/hopeai-system.ts');
    if (!content) return;

    const expectations = [
      {
        name: 'Método ensureRoleplayContext',
        check: content.includes('ensureRoleplayContext('),
        detail: 'Debe existir el método que hidrata el contexto de roleplay'
      },
      {
        name: 'Método buildRoleplayContext',
        check: content.includes('buildRoleplayContext('),
        detail: 'Se requiere la construcción inicial del contexto'
      },
      {
        name: 'Derivación de RoleplayPatientState',
        check: content.includes('deriveRoleplayState('),
        detail: 'El estado del paciente simulado debe derivarse automáticamente'
      },
      {
        name: 'Inyección de roleplay_profile en enrichedContext',
        check: content.includes('enrichedContext.roleplay_profile'),
        detail: 'El perfil debe propagarse para routing y trazabilidad'
      },
      {
        name: 'Inyección de roleplay_state en enrichedSessionContext',
        check: content.includes('enrichedSessionContext.roleplay_state'),
        detail: 'El estado debe persistir en la sesión'
      },
      {
        name: 'Persistencia de ficha clínica en roleplay',
        check: content.includes('roleplay_ficha_snapshot'),
        detail: 'La ficha clínica debe acompañar la simulación'
      }
    ];

    expectations.forEach(expectation => {
      this.addResult(
        expectation.name,
        expectation.check ? 'PASS' : 'FAIL',
        expectation.detail
      );
    });
  }

  testTypesSupport() {
    logSection('Compatibilidad tipada');
    const content = this.readFile('types/clinical-types.ts');
    if (!content) return;

    const expectations = [
      {
        name: 'AgentType incluye roleplay',
        check: content.includes('"roleplay"'),
        detail: 'El nuevo agente debe estar tipado'
      },
      {
        name: 'ChatState con roleplayContext',
        check: content.includes('roleplayContext?: RoleplaySessionContext'),
        detail: 'El estado de chat debe almacenar la simulación'
      },
      {
        name: 'Definición RoleplaySessionContext',
        check: content.includes('export interface RoleplaySessionContext'),
        detail: 'El contrato del contexto debe existir'
      },
      {
        name: 'RoleplayPatientProfile tipado',
        check: content.includes('export interface RoleplayPatientProfile'),
        detail: 'El perfil del paciente simulado debe estar definido'
      },
      {
        name: 'RoleplayPatientState tipado',
        check: content.includes('export interface RoleplayPatientState'),
        detail: 'El estado dinámico del paciente debe estar definido'
      }
    ];

    expectations.forEach(expectation => {
      this.addResult(
        expectation.name,
        expectation.check ? 'PASS' : 'FAIL',
        expectation.detail
      );
    });
  }

  testScenarioReadiness() {
    logSection('Preparación para escenarios clínicos simulados');
    const routerContent = this.readFile('lib/intelligent-intent-router.ts');
    const systemContent = this.readFile('lib/hopeai-system.ts');

    if (!routerContent || !systemContent) return;

    const hasFocusDerivation = systemContent.includes('deriveCurrentFocusFromMessage');
    const hasExplicitKeywords = routerContent.includes("'activar_modo_roleplay': ['roleplay'");

    this.addResult(
      'Detección de foco terapéutico',
      hasFocusDerivation ? 'PASS' : 'WARN',
      'La simulación debe actualizar el foco según el mensaje del terapeuta'
    );

    this.addResult(
      'Palabras clave para activar roleplay',
      hasExplicitKeywords ? 'PASS' : 'WARN',
      'El router debe reconocer solicitudes explícitas de simulación'
    );
  }

  generateReport() {
    const summary = {
      timestamp: new Date().toISOString(),
      totals: {
        passed: this.results.passed,
        failed: this.results.failed,
        warnings: this.results.warnings,
        total: this.results.passed + this.results.failed + this.results.warnings
      },
      details: this.results.details
    };

    const reportPath = this.resolveFile('roleplay-agent-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
    log('blue', `\n📄 Reporte guardado en ${reportPath}`);

    const successRate = summary.totals.total === 0
      ? 0
      : Math.round((summary.totals.passed / summary.totals.total) * 100);

    log('bold', `\n🎯 Tasa de éxito: ${successRate}%`);
    return summary;
  }

  runAllTests() {
    log('bold', '\n🚀 HopeAI - Validación del Agente de Roleplay Clínico');
    log('cyan', `Fecha: ${new Date().toLocaleString()}`);

    this.testFilePresence();
    this.testAgentRegistration();
    this.testIntentRouterConfig();
    this.testHopeAISystemRoleplayContext();
    this.testTypesSupport();
    this.testScenarioReadiness();

    const summary = this.generateReport();

    if (summary.totals.failed > 0) {
      log('red', '\n❌ Se detectaron fallas. Revise los detalles antes de continuar.');
    } else if (summary.totals.warnings > 0) {
      log('yellow', '\n⚠️ Validación con advertencias. Considere fortalecer las áreas señaladas.');
    } else {
      log('green', '\n✅ Validación completada sin errores.');
    }

    return summary;
  }
}

if (require.main === module) {
  const tester = new RoleplayAgentTester();
  tester.runAllTests();
}

module.exports = { RoleplayAgentTester };
