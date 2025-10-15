# 🚀 Checklist de Deployment Seguro - HopeAI

## ⚠️ ANTES DE HACER DEPLOYMENT A PRODUCCIÓN

### 📋 Checklist Pre-Deployment

- [ ] **Verificar configuración de seguridad**
  ```bash
  npm run verify:security
  ```

- [ ] **Confirmar variables de entorno en Vercel**
  - [ ] `NEXT_PUBLIC_FORCE_PRODUCTION_MODE=true`
  - [ ] `NEXT_PUBLIC_ENABLE_PRODUCTION_LOGS=false`
  - [ ] `NODE_ENV=production`
  - [ ] Todas las API keys de producción configuradas

- [ ] **Verificar .env.local (NO debe tener configuración de producción)**
  - [ ] `NEXT_PUBLIC_FORCE_PRODUCTION_MODE=false`
  - [ ] `NODE_ENV=development`

- [ ] **Probar build local de producción**
  ```bash
  # Temporal: activar modo producción
  NEXT_PUBLIC_FORCE_PRODUCTION_MODE=true npm run build
  NEXT_PUBLIC_FORCE_PRODUCTION_MODE=true npm start
  
  # Verificar en http://localhost:3000 que NO hay logs
  # Abrir consola del navegador y verificar
  
  # Revertir después de probar
  ```

- [ ] **Verificar que el código use el sistema de logging**
  - [ ] No hay `console.log` directos en código nuevo
  - [ ] Se usa `loggers.*` del sistema de logging
  - [ ] Información sensible está sanitizada

---

## 🔒 Configuración en Vercel

### Variables de Entorno Críticas

Copiar y pegar en Vercel Dashboard → Settings → Environment Variables:

```bash
# 🔒 SEGURIDAD - CRÍTICO
NEXT_PUBLIC_FORCE_PRODUCTION_MODE=true
NEXT_PUBLIC_ENABLE_PRODUCTION_LOGS=false
NODE_ENV=production

# 🔒 DEBUG - DESHABILITADO
DEBUG_MEMBERSHIP=false
DEBUG_STRIPE_EVENTS=false
DEBUG_USAGE_LIMITS=false
NEXT_PUBLIC_ENABLE_DETAILED_LOGGING=false
NEXT_PUBLIC_ENABLE_DEBUG_MODE=false
```

### Scope de Variables

- **Production**: Todas las variables con valores de producción
- **Preview**: Puede usar valores de staging/test
- **Development**: Usar valores de desarrollo (opcional)

---

## ✅ Post-Deployment Verification

### 1. Verificar Consola del Navegador

```
1. Abrir https://tu-dominio-produccion.com
2. Abrir DevTools (F12)
3. Ir a Console
4. Verificar que NO aparezcan:
   ✅ Nombres de archivos (.ts, .tsx)
   ✅ Rutas de directorios (lib/, components/)
   ✅ Nombres de clases (DynamicOrchestrator, HopeAISystem)
   ✅ Información de estructura interna
   ✅ Logs con emojis (🔧, 🧠, 🤖, etc.)
```

### 2. Verificar Network Tab

```
1. Ir a Network tab
2. Hacer una interacción (enviar mensaje)
3. Verificar respuestas de API
4. Confirmar que NO contengan logs en el body
```

### 3. Verificar Source Maps

```
1. Ir a Sources tab
2. Verificar que NO haya archivos .ts/.tsx visibles
3. Solo debe haber archivos minificados
```

### 4. Verificar Sentry

```
1. Ir a Sentry Dashboard
2. Verificar que solo lleguen errores críticos
3. NO deben llegar logs informativos
4. Verificar que los mensajes estén sanitizados
```

---

## 🚨 Si Algo Sale Mal

### Logs Visibles en Producción

**Acción Inmediata:**

1. Ir a Vercel Dashboard
2. Settings → Environment Variables
3. Verificar que `NEXT_PUBLIC_FORCE_PRODUCTION_MODE=true`
4. Si está en `false`, cambiar a `true`
5. Hacer redeploy inmediato

### Source Maps Expuestos

**Acción Inmediata:**

1. Verificar `next.config.mjs`:
   ```javascript
   productionBrowserSourceMaps: false
   hideSourceMaps: true
   ```
2. Hacer redeploy

### Información Sensible en Logs

**Acción Inmediata:**

1. Identificar el archivo que está loggeando
2. Reemplazar `console.log` con `loggers.*`
3. Commit y push
4. Redeploy automático

---

## 🔄 Proceso de Deployment Estándar

### Opción 1: Deployment Automático (Recomendado)

```bash
# 1. Verificar seguridad
npm run verify:security

# 2. Commit y push a main/production branch
git add .
git commit -m "feat: nueva funcionalidad"
git push origin main

# 3. Vercel hace deployment automático
# 4. Verificar post-deployment (ver arriba)
```

### Opción 2: Deployment Manual

```bash
# 1. Verificar seguridad
npm run verify:security

# 2. Build local
npm run build:production

# 3. Si el build pasa, hacer deployment
vercel --prod

# 4. Verificar post-deployment
```

---

## 📝 Desarrollo de Nuevas Features

### Reglas de Logging

```typescript
// ❌ NUNCA hacer esto
console.log('Procesando con DynamicOrchestrator')
console.log('Archivo:', filePath)
console.log('Usuario:', userId)

// ✅ SIEMPRE hacer esto
import { loggers } from '@/lib/logger'

loggers.orchestration.info('Procesando solicitud', { 
  sessionId // OK: IDs son sanitizados automáticamente
})

loggers.system.debug('Operación completada', {
  duration: Date.now() - start // OK: métricas numéricas
})

loggers.api.error('Error en endpoint', error, {
  endpoint: '/api/send-message' // OK: información pública
})
```

### Información que NUNCA debe loggearse

- ❌ Nombres de clases propietarias
- ❌ Rutas de archivos completas
- ❌ Estructura de directorios
- ❌ Lógica de negocio detallada
- ❌ Algoritmos de orquestación
- ❌ API keys o tokens
- ❌ Datos de pacientes sin sanitizar
- ❌ Información de usuarios

### Información que SÍ puede loggearse

- ✅ IDs genéricos (sessionId, userId) - se sanitizan automáticamente
- ✅ Métricas numéricas (duración, tokens, etc.)
- ✅ Estados genéricos ('success', 'error', 'pending')
- ✅ Mensajes de error sanitizados
- ✅ Endpoints públicos

---

## 🧪 Testing de Seguridad

### Test Manual

```bash
# 1. Activar modo producción temporalmente
export NEXT_PUBLIC_FORCE_PRODUCTION_MODE=true

# 2. Iniciar app
npm run dev

# 3. Verificar que NO hay logs en consola
# 4. Desactivar modo producción
unset NEXT_PUBLIC_FORCE_PRODUCTION_MODE
```

### Test Automatizado

```bash
# Ejecutar verificación de seguridad
npm run verify:security

# Debe pasar todas las verificaciones
# Si falla, resolver problemas antes de deployment
```

---

## 📊 Monitoreo Post-Deployment

### Métricas a Monitorear

1. **Sentry**
   - Tasa de errores
   - Tipos de errores
   - Verificar que no lleguen logs informativos

2. **Vercel Analytics**
   - Performance
   - Errores de build
   - Logs de deployment

3. **Consola del Navegador** (muestreo aleatorio)
   - Verificar periódicamente que no haya logs
   - Especialmente después de nuevos deployments

---

## 🔐 Seguridad de Credenciales

### Variables que NUNCA deben commitearse

- ❌ `.env.local` con valores reales
- ❌ `.env.production` con valores reales
- ❌ Archivos de configuración con API keys
- ❌ Certificados o claves privadas

### Archivos Seguros para Commit

- ✅ `.env.example`
- ✅ `.env.production.example`
- ✅ Archivos de configuración sin valores sensibles

---

## 📞 Contacto en Emergencias

Si encuentras un problema de seguridad crítico:

1. **NO hacer más deployments**
2. Contactar al equipo de desarrollo inmediatamente
3. Documentar el problema encontrado
4. Esperar instrucciones antes de proceder

---

## 🎯 Resumen Rápido

```bash
# Antes de deployment
npm run verify:security

# Verificar Vercel
NEXT_PUBLIC_FORCE_PRODUCTION_MODE=true ✅
NEXT_PUBLIC_ENABLE_PRODUCTION_LOGS=false ✅

# Después de deployment
- Abrir consola del navegador ✅
- Verificar que NO hay logs ✅
- Verificar Sentry ✅
- Monitorear por 24h ✅
```

---

**🔒 RECUERDA**: La protección de la propiedad intelectual es responsabilidad de todo el equipo. Siempre verifica antes de hacer deployment.

