# 🔒 Guía de Seguridad Enterprise - HopeAI

## 📋 Resumen Ejecutivo

Se ha implementado un sistema de seguridad **Enterprise-grade** para proteger completamente la arquitectura propietaria de HopeAI y prevenir accesos no autorizados.

---

## ✅ Protecciones Implementadas

### 1. 🔒 Bloqueo Agresivo de Logs en Producción

**Archivo:** `lib/security/console-blocker.ts`

**Características:**
- Bloqueo TOTAL de `console.log`, `console.info`, `console.debug`, `console.warn`
- Se ejecuta ANTES que cualquier otro código
- Sanitización de `console.error` antes de mostrar
- Prevención de restauración desde DevTools
- Detección multi-método de entorno de producción

**Protege:**
- ✅ Nombres de clases propietarias
- ✅ Rutas de archivos
- ✅ Lógica de negocio
- ✅ Estructura de código
- ✅ IDs y tokens

---

### 2. 🛡️ Middleware de Seguridad

**Archivo:** `middleware.ts`

**Características:**
- Rate limiting por IP
- Autenticación para endpoints administrativos
- Headers de seguridad (CSP, HSTS, X-Frame-Options, etc.)
- Detección de actividad sospechosa
- Logging de intentos de acceso no autorizado

**Protege contra:**
- ✅ Ataques de fuerza bruta
- ✅ Scraping de API
- ✅ Path traversal
- ✅ SQL injection
- ✅ XSS attacks
- ✅ Clickjacking
- ✅ MIME sniffing

---

### 3. 🚦 Rate Limiting Inteligente

**Archivo:** `lib/security/rate-limiter.ts`

**Límites por tipo de endpoint:**

| Endpoint | Límite | Ventana | Bloqueo |
|----------|--------|---------|---------|
| APIs públicas | 20 req | 1 min | 5 min |
| Mensajes | 10 req | 1 min | 2 min |
| Uploads | 5 req | 1 min | 10 min |
| Admin | 5 req | 1 min | 30 min |
| Health | 10 req | 10 seg | 1 min |

**Protege contra:**
- ✅ Abuse de API
- ✅ Costos elevados (Google AI)
- ✅ DDoS básicos
- ✅ Scraping automatizado

---

### 4. 🔐 Autenticación Administrativa

**Archivo:** `lib/security/admin-auth.ts`

**Endpoints Protegidos:**
- `/api/system-status` - Estado del sistema
- `/api/orchestration/health` - Health del orquestador
- `/api/orchestration/metrics` - Métricas
- `/api/orchestration/reports` - Reportes
- `/api/orchestration/alerts` - Alertas

**Métodos de autenticación:**
1. Header `Authorization: Bearer TOKEN`
2. Header `X-Admin-Token: TOKEN`
3. Query parameter `?token=TOKEN` (solo desarrollo)

**Protege:**
- ✅ Información interna del sistema
- ✅ Métricas de performance
- ✅ Reportes clínicos
- ✅ Configuración del sistema

---

### 5. 🧹 Sanitización de Errores

**Archivo:** `lib/security/error-sanitizer.ts`

**Características:**
- Sanitización automática de mensajes de error
- Remoción de stack traces en producción
- Envío de errores completos a Sentry (interno)
- Mensajes genéricos para usuarios

**Sanitiza:**
- ✅ Rutas de archivos
- ✅ Nombres de clases
- ✅ IDs y tokens
- ✅ Variables de entorno
- ✅ URLs de base de datos
- ✅ Stack traces

---

## 🚀 Configuración de Deployment

### Paso 1: Generar Token Administrativo

```bash
# Opción A: Con OpenSSL
openssl rand -hex 32

# Opción B: Con Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Opción C: Online (seguro)
# https://generate-secret.vercel.app/32
```

**Ejemplo de token:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

---

### Paso 2: Configurar Variables en Vercel

1. **Ve a Vercel Dashboard**
   - https://vercel.com/dashboard
   - Selecciona tu proyecto HopeAI
   - Settings → Environment Variables

2. **Agregar Variables (SOLO Production)**

```bash
# 🔒 Seguridad - Logs
NEXT_PUBLIC_FORCE_PRODUCTION_MODE=true
NEXT_PUBLIC_ENABLE_PRODUCTION_LOGS=false

# 🔒 Seguridad - Autenticación
ADMIN_API_TOKEN=tu_token_generado_aqui
```

3. **Marcar SOLO el checkbox de "Production"**
   - ✅ Production
   - ❌ Preview
   - ❌ Development

---

### Paso 3: Deployment

```bash
# Commit y push
git add .
git commit -m "feat: implement enterprise security"
git push origin main

# Vercel hace deployment automático
```

---

### Paso 4: Verificación Post-Deployment

#### A. Verificar Bloqueo de Logs

1. Abrir sitio en producción
2. Abrir DevTools (F12) → Console
3. **Debe mostrar SOLO:**
   ```
   🔒 SECURITY: Console logging disabled in production
   ```
4. **NO debe mostrar:**
   - ❌ Logs con emojis (🔧, 🧠, 🤖, etc.)
   - ❌ Nombres de archivos (.ts, .tsx)
   - ❌ Nombres de clases (DynamicOrchestrator, etc.)
   - ❌ Información de sistema

#### B. Verificar Autenticación

```bash
# Sin token - debe fallar
curl https://tu-dominio.com/api/system-status

# Respuesta esperada:
# {
#   "error": "Unauthorized",
#   "message": "This endpoint requires authentication",
#   ...
# }

# Con token - debe funcionar
curl -H "Authorization: Bearer TU_TOKEN" \
     https://tu-dominio.com/api/system-status

# Respuesta esperada:
# {
#   "timestamp": "...",
#   "status": "operational",
#   ...
# }
```

#### C. Verificar Rate Limiting

```bash
# Hacer 25 requests rápidos
for i in {1..25}; do
  curl https://tu-dominio.com/api/health
done

# Después de 20 requests, debe devolver:
# {
#   "error": "Too Many Requests",
#   "retryAfter": 60,
#   ...
# }
```

---

## 🔧 Uso de Endpoints Protegidos

### Desde cURL

```bash
# System Status
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://tu-dominio.com/api/system-status

# System Status Detallado
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://tu-dominio.com/api/system-status?detailed=true"

# Orchestration Health
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://tu-dominio.com/api/orchestration/health
```

### Desde JavaScript

```javascript
const token = 'YOUR_ADMIN_TOKEN';

const response = await fetch('https://tu-dominio.com/api/system-status', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const data = await response.json();
console.log(data);
```

### Desde Postman

1. Crear nueva request
2. URL: `https://tu-dominio.com/api/system-status`
3. Authorization → Type: Bearer Token
4. Token: `YOUR_ADMIN_TOKEN`
5. Send

---

## 📊 Monitoreo de Seguridad

### Eventos que se Loggean a Sentry

1. **Intentos de acceso no autorizado**
   - Endpoint intentado
   - IP del atacante
   - User agent
   - Timestamp

2. **Rate limiting activado**
   - IP bloqueada
   - Endpoint afectado
   - Duración del bloqueo

3. **Actividad sospechosa detectada**
   - Patrón detectado (SQL injection, XSS, etc.)
   - IP del atacante
   - Request completo

### Revisar Logs de Seguridad

1. Ve a Sentry Dashboard
2. Filtra por tag: `security`
3. Revisa eventos con level: `warning` o `error`

---

## 🚨 Troubleshooting

### Problema: Logs Siguen Apareciendo

**Solución:**
1. Verificar variables en Vercel:
   ```
   NEXT_PUBLIC_FORCE_PRODUCTION_MODE=true
   ```
2. Hacer redeploy forzado:
   ```bash
   vercel --prod --force
   ```
3. Limpiar caché del navegador (Ctrl+Shift+Delete)
4. Verificar que el deployment sea de producción (no preview)

### Problema: No Puedo Acceder a Endpoints Administrativos

**Solución:**
1. Verificar que el token esté configurado en Vercel
2. Verificar formato del header:
   ```
   Authorization: Bearer tu_token_aqui
   ```
3. Verificar que el token sea correcto (sin espacios extra)
4. En desarrollo, el token no es necesario

### Problema: Rate Limiting Muy Agresivo

**Solución:**
1. Ajustar límites en `lib/security/rate-limiter.ts`
2. Aumentar `maxRequests` para el tipo de endpoint
3. Redeploy

---

## 🔄 Mantenimiento

### Rotación de Tokens (cada 90 días)

1. Generar nuevo token
2. Actualizar en Vercel
3. Actualizar en herramientas de monitoreo
4. Verificar que todo funcione
5. Eliminar token antiguo

### Auditoría de Seguridad (mensual)

1. Revisar logs de Sentry
2. Verificar intentos de acceso no autorizado
3. Revisar estadísticas de rate limiting
4. Actualizar patrones de sanitización si es necesario

---

## 📞 Soporte

Si encuentras problemas de seguridad:

1. **NO** exponerlos públicamente
2. Contactar al equipo de desarrollo directamente
3. Incluir detalles técnicos (sin información sensible)
4. Revisar logs de Sentry para más contexto

---

## ✅ Checklist de Seguridad

- [ ] Token administrativo generado y guardado de forma segura
- [ ] Variables configuradas en Vercel (Production only)
- [ ] Deployment realizado
- [ ] Logs bloqueados verificados (consola limpia)
- [ ] Autenticación verificada (401 sin token)
- [ ] Rate limiting verificado (429 después de límite)
- [ ] Endpoints de testing deshabilitados en producción
- [ ] Monitoreo de Sentry configurado
- [ ] Documentación revisada por el equipo
- [ ] Plan de rotación de tokens establecido

---

**Fecha de Implementación:** 2025-01-15
**Versión:** 1.0.0 Enterprise
**Estado:** ✅ Listo para Producción

