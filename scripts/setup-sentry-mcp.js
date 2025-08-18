9#!/usr/bin/env node

/**
 * Script de configuración automática para Sentry MCP
 * Ayuda a configurar Sentry MCP en diferentes IDEs
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class SentryMCPSetup {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.homeDir = os.homedir();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '✅',
      warn: '⚠️',
      error: '❌',
      success: '🎉'
    }[type] || 'ℹ️';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async setupClaudeDesktop() {
    this.log('Configurando Claude Desktop...');
    
    const claudeConfigPath = path.join(this.homeDir, '.claude', 'claude_desktop_config.json');
    const claudeDir = path.dirname(claudeConfigPath);
    
    try {
      // Crear directorio si no existe
      if (!fs.existsSync(claudeDir)) {
        fs.mkdirSync(claudeDir, { recursive: true });
        this.log(`Directorio creado: ${claudeDir}`);
      }
      
      let config = {};
      
      // Leer configuración existente si existe
      if (fs.existsSync(claudeConfigPath)) {
        const existingConfig = fs.readFileSync(claudeConfigPath, 'utf8');
        config = JSON.parse(existingConfig);
        this.log('Configuración existente encontrada, actualizando...');
      }
      
      // Agregar configuración de Sentry MCP
      if (!config.mcpServers) {
        config.mcpServers = {};
      }
      
      config.mcpServers.Sentry = {
        url: "https://mcp.sentry.dev/mcp"
      };
      
      // Escribir configuración
      fs.writeFileSync(claudeConfigPath, JSON.stringify(config, null, 2));
      this.log(`Claude Desktop configurado en: ${claudeConfigPath}`, 'success');
      
      return true;
    } catch (error) {
      this.log(`Error configurando Claude Desktop: ${error.message}`, 'error');
      return false;
    }
  }

  async setupCursor() {
    this.log('Configurando Cursor...');
    
    const cursorConfigPath = path.join(this.homeDir, '.cursor', 'mcp.json');
    const cursorDir = path.dirname(cursorConfigPath);
    
    try {
      // Crear directorio si no existe
      if (!fs.existsSync(cursorDir)) {
        fs.mkdirSync(cursorDir, { recursive: true });
        this.log(`Directorio creado: ${cursorDir}`);
      }
      
      const config = {
        mcpServers: {
          Sentry: {
            url: "https://mcp.sentry.dev/mcp"
          }
        }
      };
      
      fs.writeFileSync(cursorConfigPath, JSON.stringify(config, null, 2));
      this.log(`Cursor configurado en: ${cursorConfigPath}`, 'success');
      
      return true;
    } catch (error) {
      this.log(`Error configurando Cursor: ${error.message}`, 'error');
      return false;
    }
  }

  async copyConfigFiles() {
    this.log('Copiando archivos de configuración al proyecto...');
    
    const configs = [
      {
        source: path.join(this.projectRoot, 'claude_desktop_config.json'),
        dest: path.join(this.homeDir, '.claude', 'claude_desktop_config.json'),
        name: 'Claude Desktop'
      }
    ];
    
    for (const config of configs) {
      try {
        if (fs.existsSync(config.source)) {
          const destDir = path.dirname(config.dest);
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          
          fs.copyFileSync(config.source, config.dest);
          this.log(`${config.name} configurado desde: ${config.source}`, 'success');
        }
      } catch (error) {
        this.log(`Error copiando configuración de ${config.name}: ${error.message}`, 'error');
      }
    }
  }

  async validateSentryConfig() {
    this.log('Validando configuración de Sentry existente...');
    
    const sentryConfigFiles = [
      'sentry.server.config.ts',
      'sentry.edge.config.ts',
      'next.config.mjs'
    ];
    
    let validConfig = true;
    
    for (const file of sentryConfigFiles) {
      const filePath = path.join(this.projectRoot, file);
      if (fs.existsSync(filePath)) {
        this.log(`✅ ${file} encontrado`);
      } else {
        this.log(`❌ ${file} no encontrado`, 'warn');
        validConfig = false;
      }
    }
    
    if (validConfig) {
      this.log('Configuración de Sentry válida', 'success');
    } else {
      this.log('Algunos archivos de configuración de Sentry faltan', 'warn');
    }
    
    return validConfig;
  }

  async showInstructions() {
    this.log('\n📋 INSTRUCCIONES POST-CONFIGURACIÓN:', 'info');
    console.log(`
🔧 Para completar la configuración:

1. **Claude Desktop:**
   - Reinicia Claude Desktop
   - Los tools de Sentry aparecerán automáticamente
   - Usa OAuth para autenticarte

2. **Cursor:**
   - Ve a Settings → Profile → Integrations
   - Agrega: https://mcp.sentry.dev/mcp
   - O usa el archivo mcp.json creado

3. **Claude Code:**
   - Ejecuta: claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
   - Luego: claude

4. **Ejemplos de prompts:**
   - "Dime sobre los issues en mi proyecto"
   - "Revisa errores en components/chat-interface.tsx"
   - "Usa Seer para analizar issue PROYECTO-123"

📖 Documentación completa: SENTRY_MCP_SETUP.md
`);
  }

  async run() {
    this.log('🚀 Iniciando configuración de Sentry MCP...', 'info');
    
    // Validar configuración de Sentry existente
    await this.validateSentryConfig();
    
    // Configurar diferentes IDEs
    await this.setupClaudeDesktop();
    await this.setupCursor();
    
    // Mostrar instrucciones
    await this.showInstructions();
    
    this.log('🎉 Configuración de Sentry MCP completada!', 'success');
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  const setup = new SentryMCPSetup();
  setup.run().catch(error => {
    console.error('❌ Error durante la configuración:', error);
    process.exit(1);
  });
}

module.exports = SentryMCPSetup;