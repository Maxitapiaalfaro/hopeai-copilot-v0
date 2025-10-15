# 🔒 Guía de Seguridad para Deployment en Producción

## ⚠️ CRÍTICO: Protección de Propiedad Intelectual

Este documento describe cómo configurar el deployment de HopeAI en producción para **proteger completamente la arquitectura propietaria** y prevenir la exposición de información sensible a través de logs.

---

## 🎯 Objetivo

**BLOQUEAR COMPLETAMENTE** todos los logs del servidor en producción para prevenir:
- ✅ Exposición de estructura de archivos y directorios
- ✅ Revelación de lógica de negocio y algoritmos propietarios
- ✅ Filtración de nombres de clases, funciones y componentes internos
- ✅ Exposición de flujos de orquestación y decisiones de agentes
- ✅ Revelación de estrategias de optimización y diferenciadores competitivos

---

## 🚀 Configuración en Vercel

### Paso 1: Variables de Entorno en Vercel

En el dashboard de Vercel, configura las siguientes variables de entorno:

#### Variables Críticas de Seguridad

```bash
# 🔒 ACTIVAR MODO PRODUCCIÓN SEGURO
NEXT_PUBLIC_FORCE_PRODUCTION_MODE=true

# 🔒 DESHABILITAR LOGS EN PRODUCCIÓN (mantener en false)
NEXT_PUBLIC_ENABLE_PRODUCTION_LOGS=false

# Entorno de Node
NODE_ENV=production

# 🔒 Deshabilitar debugging
DEBUG_MEMBERSHIP=false
DEBUG_STRIPE_EVENTS=false
DEBUG_USAGE_LIMITS=false
NEXT_PUBLIC_ENABLE_DETAILED_LOGGING=false
NEXT_PUBLIC_ENABLE_DEBUG_MODE=false
```

#### Variables de Aplicación

```bash
# API Keys (usar valores de producción)
NEXT_PUBLIC_GOOGLE_AI_API_KEY=tu_api_key_de_produccion

# Backend
NEXT_PUBLIC_PYTHON_BACKEND_URL=https://tu-backend-produccion.com

# Sentry
SENTRY_DSN=tu_sentry_dsn
SENTRY_ORG=hopeai-rh
SENTRY_PROJECT=javascript-nextjs
SENTRY_ENVIRONMENT=production

# Firebase (Producción)
NEXT_PUBLIC_FIREBASE_USE_EMULATOR=false
FIREBASE_PROJECT_ID=tu_proyecto_firebase
# ... resto de variables de Firebase

# Stripe (Producción)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_tu_key
STRIPE_SECRET_KEY=sk_live_tu_key
NEXT_PUBLIC_STRIPE_USE_MOCK=false
# ... resto de variables de Stripe

# App URL
NEXT_PUBLIC_APP_URL=https://tu-dominio-produccion.com
```

### Paso 2: Configuración de Build en Vercel

En la configuración de tu proyecto en Vercel:

1. **Build Command**: `npm run build` (o el comando que uses actualmente)
2. **Output Directory**: `.next`
3. **Install Command**: `npm install`

### Paso 3: Verificar Configuración

Después del deployment, verifica que los logs estén bloqueados:

1. Abre la consola del navegador en tu sitio de producción
2. Verifica que NO aparezcan logs con:
   - Nombres de archivos (`.ts`, `.tsx`)
   - Rutas de directorios (`lib/`, `components/`)
   - Nombres de clases propietarias (`DynamicOrchestrator`, `HopeAISystem`, etc.)
   - Información de estructura interna

---

## 🧪 Testing Local del Modo Producción

Para probar localmente cómo se comportará en producción:

### Opción 1: Build de Producción Local

```bash
# 1. Actualizar .env.local temporalmente
NEXT_PUBLIC_FORCE_PRODUCTION_MODE=true
NEXT_PUBLIC_ENABLE_PRODUCTION_LOGS=false

# 2. Hacer build de producción
npm run build

# 3. Iniciar servidor de producción
npm start

# 4. Verificar en http://localhost:3000 que NO hay logs
```

### Opción 2: Variable de Entorno Temporal

```bash
# Build y start con variable de entorno
NEXT_PUBLIC_FORCE_PRODUCTION_MODE=true npm run build
NEXT_PUBLIC_FORCE_PRODUCTION_MODE=true npm start
```

**IMPORTANTE**: Después de probar, revertir `.env.local` a:
```bash
NEXT_PUBLIC_FORCE_PRODUCTION_MODE=false
```

---

## 🔍 Verificación Post-Deployment

### Checklist de Seguridad

- [ ] **Consola del Navegador**: No debe mostrar logs con información propietaria
- [ ] **Network Tab**: Verificar que las respuestas de API no incluyan logs en el body
- [ ] **Source Maps**: Verificar que NO estén disponibles públicamente
- [ ] **Sentry**: Verificar que solo se envíen errores críticos, no logs informativos
- [ ] **Performance**: Verificar que el bloqueo de logs no afecte el rendimiento

### Comandos de Verificación

```bash
# Verificar que el build eliminó console.log
# Buscar en el bundle generado
grep -r "console.log" .next/

# Verificar configuración de producción
curl https://tu-dominio.com/api/health | jq
```

---

## 🚨 Debugging en Producción (Emergencias)

Si necesitas temporalmente habilitar logs en producción para debuggear un problema crítico:

### ⚠️ SOLO PARA EMERGENCIAS

1. En Vercel, actualizar temporalmente:
   ```bash
   NEXT_PUBLIC_ENABLE_PRODUCTION_LOGS=true
   ```

2. Hacer redeploy

3. **IMPORTANTE**: Después de resolver el problema, INMEDIATAMENTE revertir a:
   ```bash
   NEXT_PUBLIC_ENABLE_PRODUCTION_LOGS=false
   ```

4. Hacer redeploy nuevamente

### Alternativa Segura: Usar Sentry

En lugar de habilitar logs, usa Sentry para monitoreo:

```typescript
import { loggers } from '@/lib/logger'

// Esto enviará a Sentry sin mostrar en consola
loggers.system.error('Error crítico', error, { context: 'info' })
```

---

## 📋 Sistema de Logging Seguro

### Uso Correcto en el Código

```typescript
import { loggers } from '@/lib/logger'

// ✅ CORRECTO: Usar el sistema de logging
loggers.api.info('Procesando solicitud', { sessionId })
loggers.orchestration.debug('Seleccionando agente', { confidence })
loggers.system.error('Error crítico', error, { context })

// ❌ INCORRECTO: NO usar console.log directamente
console.log('Esto se bloqueará en producción')
```

### Categorías de Loggers Disponibles

- `loggers.system` - Sistema general
- `loggers.orchestration` - Orquestación de agentes
- `loggers.agent` - Agentes individuales
- `loggers.api` - Rutas de API
- `loggers.storage` - Persistencia y almacenamiento
- `loggers.file` - Gestión de archivos
- `loggers.patient` - Datos de pacientes
- `loggers.session` - Sesiones de chat
- `loggers.metrics` - Métricas y analytics
- `loggers.performance` - Performance y optimización

---

## 🔐 Niveles de Seguridad

### Nivel 1: Desarrollo Local
- ✅ Todos los logs visibles
- ✅ Información detallada de debugging
- ✅ Stack traces completos

### Nivel 2: Staging/Preview (Vercel)
- ⚠️ Logs limitados
- ⚠️ Solo errores y warnings
- ⚠️ Información sanitizada

### Nivel 3: Producción
- 🔒 **CERO LOGS** en consola
- 🔒 Solo errores críticos a Sentry
- 🔒 Información completamente sanitizada
- 🔒 Source maps ocultos

---

## 📞 Soporte

Si tienes problemas con la configuración de seguridad:

1. Verificar que todas las variables de entorno estén configuradas
2. Revisar los logs de build en Vercel
3. Verificar que el sistema de logging esté importado correctamente
4. Contactar al equipo de desarrollo

---

## 🔄 Actualización de Configuración

Cuando actualices el código:

1. **Siempre** usar `loggers.*` en lugar de `console.log`
2. **Nunca** loggear información sensible (API keys, tokens, etc.)
3. **Verificar** que los nuevos logs respeten el sistema de sanitización
4. **Probar** localmente con `NEXT_PUBLIC_FORCE_PRODUCTION_MODE=true`

---

## ✅ Resumen

| Aspecto | Desarrollo | Producción |
|---------|-----------|------------|
| console.log | ✅ Visible | 🔒 Bloqueado |
| console.error | ✅ Visible | ⚠️ Sanitizado |
| Logs de sistema | ✅ Detallados | 🔒 Bloqueados |
| Source maps | ✅ Disponibles | 🔒 Ocultos |
| Sentry logs | ⚠️ Todos | 🔒 Solo errores |
| Información propietaria | ✅ Visible | 🔒 Protegida |

---

**🔒 RECUERDA**: La protección de la propiedad intelectual es crítica para el éxito de HopeAI. Mantén siempre `NEXT_PUBLIC_FORCE_PRODUCTION_MODE=true` en producción.

