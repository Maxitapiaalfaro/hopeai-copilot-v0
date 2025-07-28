/**
 * Script para crear dashboards y widgets de Sentry programáticamente
 * Basado en la API REST de Sentry v0
 * 
 * Requisitos:
 * 1. Token de autenticación de Sentry (Internal Integration)
 * 2. Organization ID/slug
 * 3. Project ID
 * 
 * Uso:
 * node create-sentry-dashboard.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno desde .env
function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          process.env[key.trim()] = value.trim().replace(/"/g, '');
        }
      });
      console.log('✅ Variables de entorno cargadas desde .env');
    }
  } catch (error) {
    console.log('⚠️  No se pudo cargar .env, usando variables del sistema');
  }
}

// Cargar variables de entorno
loadEnvFile();

// Extraer PROJECT_ID del DSN si está disponible
function extractProjectIdFromDSN(dsn) {
  if (!dsn) return null;
  const match = dsn.match(/\/([0-9]+)$/);
  return match ? parseInt(match[1]) : null;
}

// Configuración - Actualizar con tus valores
const CONFIG = {
  // Obtener de: Settings > Custom Integrations > Create New Integration
  SENTRY_TOKEN: process.env.SENTRY_TOKEN || 'YOUR_SENTRY_TOKEN_HERE',
  
  // Tu organization slug (ej: 'hopeai' si tu URL es hopeai.sentry.io)
  ORGANIZATION_SLUG: process.env.SENTRY_ORG || 'YOUR_ORG_SLUG_HERE',
  
  // ID del proyecto (encontrar en Project Settings o extraer del DSN)
  PROJECT_ID: process.env.SENTRY_PROJECT_ID || 
             extractProjectIdFromDSN(process.env.NEXT_PUBLIC_SENTRY_DSN) || 
             1,
  
  // Base URL de Sentry
  SENTRY_BASE_URL: 'sentry.io',
  
  // Configuración del dashboard
  DASHBOARD_TITLE: process.env.DASHBOARD_TITLE || 'HopeAI Analytics Dashboard - Fase Alfa'
};

/**
 * Realiza una petición HTTP a la API de Sentry
 */
function sentryApiRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: CONFIG.SENTRY_BASE_URL,
      port: 443,
      path: `/api/0/organizations/${CONFIG.ORGANIZATION_SLUG}${endpoint}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${CONFIG.SENTRY_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsedData);
          } else {
            reject(new Error(`API Error ${res.statusCode}: ${JSON.stringify(parsedData)}`));
          }
        } catch (error) {
          reject(new Error(`Parse Error: ${error.message}. Response: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * Definiciones de widgets para HopeAI
 */
const WIDGET_DEFINITIONS = {
  // Widget 1: Adopción y Engagement por Usuario
  userEngagement: {
    title: 'Adopción y Engagement por Usuario',
    displayType: 'table',
    queries: [{
      name: '',
      fields: ['user_id', 'count()', 'count_unique(session_id)'],
      aggregates: ['count()', 'count_unique(session_id)'],
      columns: ['user_id'],
      fieldAliases: ['Usuario', 'Total Mensajes', 'Sesiones'],
      conditions: 'message.agent:*',
      orderby: '-count()'
    }],
    widgetType: 'error-events',
    layout: { x: 0, y: 0, w: 4, h: 3, minH: 2 }
  },

  // Widget 2: Distribución de Uso por Agente
  agentDistribution: {
    title: 'Distribución de Uso por Agente',
    displayType: 'bar',
    queries: [{
      name: '',
      fields: ['count()', 'message.agent'],
      aggregates: ['count()'],
      columns: ['message.agent'],
      fieldAliases: ['Cantidad', 'Agente'],
      conditions: 'message.agent:*',
      orderby: '-count()'
    }],
    widgetType: 'error-events',
    layout: { x: 4, y: 0, w: 4, h: 3, minH: 2 }
  },

  // Widget 3: Tiempo de Respuesta (P50 vs P95)
  responseTime: {
    title: 'Tiempo de Respuesta (P50 vs P95)',
    displayType: 'line',
    queries: [{
      name: '',
      fields: ['p50(message.response_time)', 'p95(message.response_time)'],
      aggregates: ['p50(message.response_time)', 'p95(message.response_time)'],
      columns: [],
      fieldAliases: ['P50 Tiempo Respuesta', 'P95 Tiempo Respuesta'],
      conditions: 'message.response_time:>0',
      orderby: ''
    }],
    widgetType: 'error-events',
    layout: { x: 8, y: 0, w: 4, h: 3, minH: 2 }
  },

  // Widget 4: Distribución de Longitud de Mensajes
  messageLength: {
    title: 'Distribución de Longitud de Mensajes',
    displayType: 'table',
    queries: [{
      name: '',
      fields: ['message.agent', 'avg(message.length)', 'count()'],
      aggregates: ['avg(message.length)', 'count()'],
      columns: ['message.agent'],
      fieldAliases: ['Agente', 'Longitud Promedio', 'Total Mensajes'],
      conditions: 'message.length:>0',
      orderby: '-avg(message.length)'
    }],
    widgetType: 'error-events',
    layout: { x: 0, y: 3, w: 6, h: 3, minH: 2 }
  },

  // Widget 5: Usuarios Activos (7 días)
  activeUsers: {
    title: 'Usuarios Activos (7 días)',
    displayType: 'big_number',
    queries: [{
      name: '',
      fields: ['count_unique(user_id)'],
      aggregates: ['count_unique(user_id)'],
      columns: [],
      fieldAliases: ['Usuarios Únicos'],
      conditions: '',
      orderby: ''
    }],
    widgetType: 'error-events',
    layout: { x: 6, y: 3, w: 3, h: 2, minH: 2 }
  },

  // Widget 6: Sesiones por Día
  dailySessions: {
    title: 'Sesiones por Día',
    displayType: 'line',
    queries: [{
      name: '',
      fields: ['count_unique(session_id)'],
      aggregates: ['count_unique(session_id)'],
      columns: [],
      fieldAliases: ['Sesiones Únicas'],
      conditions: '',
      orderby: ''
    }],
    widgetType: 'error-events',
    layout: { x: 9, y: 3, w: 3, h: 2, minH: 2 }
  }
};

/**
 * Crea un dashboard con widgets
 */
async function createDashboard() {
  try {
    console.log('🚀 Iniciando creación del dashboard de HopeAI...');
    
    // Verificar configuración
    if (CONFIG.SENTRY_TOKEN === 'YOUR_SENTRY_TOKEN_HERE') {
      throw new Error('❌ Por favor configura SENTRY_TOKEN en las variables de entorno o en CONFIG');
    }
    
    if (CONFIG.ORGANIZATION_SLUG === 'YOUR_ORG_SLUG_HERE') {
      throw new Error('❌ Por favor configura SENTRY_ORG en las variables de entorno o en CONFIG');
    }

    // Convertir definiciones de widgets al formato de Sentry
    const widgets = Object.values(WIDGET_DEFINITIONS).map((widget, index) => ({
      title: widget.title,
      displayType: widget.displayType,
      queries: widget.queries,
      widgetType: widget.widgetType,
      layout: widget.layout,
      interval: '5m'
    }));

    // Crear el dashboard
    const dashboardData = {
      title: CONFIG.DASHBOARD_TITLE,
      widgets: widgets,
      projects: [parseInt(CONFIG.PROJECT_ID)],
      environment: [], // Todos los entornos
      period: '7d', // Últimos 7 días por defecto
      filters: {},
      permissions: {
        isEditableByEveryone: true,
        teamsWithEditAccess: []
      }
    };

    console.log('📊 Creando dashboard...');
    const dashboard = await sentryApiRequest('POST', '/dashboards/', dashboardData);
    
    console.log('✅ Dashboard creado exitosamente!');
    console.log(`📋 ID del Dashboard: ${dashboard.id}`);
    console.log(`🔗 URL: https://${CONFIG.ORGANIZATION_SLUG}.sentry.io/dashboards/${dashboard.id}/`);
    console.log(`📈 Widgets creados: ${dashboard.widgets.length}`);
    
    // Guardar información del dashboard
    const dashboardInfo = {
      id: dashboard.id,
      title: dashboard.title,
      url: `https://${CONFIG.ORGANIZATION_SLUG}.sentry.io/dashboards/${dashboard.id}/`,
      widgets: dashboard.widgets.map(w => ({ id: w.id, title: w.title })),
      createdAt: new Date().toISOString()
    };
    
    const outputPath = path.join(__dirname, 'sentry-dashboard-info.json');
    fs.writeFileSync(outputPath, JSON.stringify(dashboardInfo, null, 2));
    console.log(`💾 Información guardada en: ${outputPath}`);
    
    return dashboard;
    
  } catch (error) {
    console.error('❌ Error creando dashboard:', error.message);
    throw error;
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log('🎯 HopeAI Sentry Dashboard Creator');
    console.log('=====================================');
    
    await createDashboard();
    
    console.log('\n🎉 ¡Dashboard creado exitosamente!');
    console.log('\n📝 Próximos pasos:');
    console.log('1. Visita el dashboard en Sentry');
    console.log('2. Ajusta los filtros según necesites');
    console.log('3. Configura alertas si es necesario');
    console.log('4. Comparte con tu equipo');
    
  } catch (error) {
    console.error('\n💥 Error en la ejecución:', error.message);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = {
  createDashboard,
  sentryApiRequest,
  CONFIG,
  WIDGET_DEFINITIONS
};