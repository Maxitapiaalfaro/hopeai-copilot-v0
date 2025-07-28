# 📊 HopeAI Sentry Dashboard Creator

Script automatizado para crear dashboards y widgets de Sentry programáticamente usando la API REST.

## 🚀 Configuración Inicial

### 1. Crear Token de Autenticación en Sentry

1. Ve a tu organización en Sentry: `https://[tu-org].sentry.io`
2. Navega a **Settings** > **Custom Integrations**
3. Haz clic en **Create New Integration**
4. Configura la integración:
   - **Name**: `HopeAI Dashboard Creator`
   - **Webhook URL**: (opcional, puedes dejarlo vacío)
   - **Permissions**:
     - ✅ `org:read`
     - ✅ `org:write`
     - ✅ `project:read`
     - ✅ `project:write`
5. Guarda y copia el **Token** generado (solo se muestra una vez)

### 2. Obtener IDs Necesarios

#### Organization Slug:
- Es la parte de tu URL de Sentry: `https://[ORGANIZATION_SLUG].sentry.io`
- Ejemplo: Si tu URL es `https://hopeai.sentry.io`, tu slug es `hopeai`

#### Project ID:
1. Ve a **Settings** > **Projects**
2. Selecciona tu proyecto
3. En la URL verás algo como: `/settings/projects/[PROJECT_NAME]/`
4. O busca en **Project Settings** > **General** el **Project ID**

## 🔧 Configuración del Script

### Opción 1: Variables de Entorno (Recomendado)

Crea un archivo `.env` en la carpeta `scripts/`:

```bash
# .env
SENTRY_TOKEN=tu_token_aqui
SENTRY_ORG=tu_organization_slug
SENTRY_PROJECT_ID=123
```

### Opción 2: Editar el Script Directamente

Edita el archivo `create-sentry-dashboard.js` y actualiza la sección `CONFIG`:

```javascript
const CONFIG = {
  SENTRY_TOKEN: 'tu_token_aqui',
  ORGANIZATION_SLUG: 'tu_organization_slug',
  PROJECT_ID: 123,
  // ...
};
```

## 🏃‍♂️ Ejecución

### 1. Instalar Dependencias (si es necesario)

El script usa solo módulos nativos de Node.js, no requiere instalación adicional.

### 2. Ejecutar el Script

```bash
# Desde la carpeta raíz del proyecto
cd scripts
node create-sentry-dashboard.js
```

### 3. Salida Esperada

```
🎯 HopeAI Sentry Dashboard Creator
=====================================
🚀 Iniciando creación del dashboard de HopeAI...
📊 Creando dashboard...
✅ Dashboard creado exitosamente!
📋 ID del Dashboard: 12345
🔗 URL: https://tu-org.sentry.io/dashboards/12345/
📈 Widgets creados: 6
💾 Información guardada en: ./sentry-dashboard-info.json

🎉 ¡Dashboard creado exitosamente!

📝 Próximos pasos:
1. Visita el dashboard en Sentry
2. Ajusta los filtros según necesites
3. Configura alertas si es necesario
4. Comparte con tu equipo
```

## 📈 Widgets Creados

El script crea automáticamente 6 widgets optimizados para HopeAI:

### 1. **Adopción y Engagement por Usuario**
- **Tipo**: Tabla
- **Métricas**: Usuario, Total Mensajes, Sesiones
- **Propósito**: Identificar usuarios más activos

### 2. **Distribución de Uso por Agente**
- **Tipo**: Gráfico de barras
- **Métricas**: Cantidad de mensajes por agente
- **Propósito**: Ver qué agentes son más utilizados

### 3. **Tiempo de Respuesta (P50 vs P95)**
- **Tipo**: Gráfico de líneas
- **Métricas**: Percentiles 50 y 95 del tiempo de respuesta
- **Propósito**: Monitorear rendimiento del sistema

### 4. **Distribución de Longitud de Mensajes**
- **Tipo**: Tabla
- **Métricas**: Longitud promedio por agente
- **Propósito**: Analizar complejidad de interacciones

### 5. **Usuarios Activos (7 días)**
- **Tipo**: Número grande
- **Métricas**: Usuarios únicos en 7 días
- **Propósito**: Seguimiento de adopción

### 6. **Sesiones por Día**
- **Tipo**: Gráfico de líneas
- **Métricas**: Sesiones únicas diarias
- **Propósito**: Tendencias de uso

## 🔍 Personalización

### Modificar Widgets

Edita la sección `WIDGET_DEFINITIONS` en el script para:
- Cambiar títulos
- Ajustar métricas
- Modificar tipos de visualización
- Personalizar filtros

### Agregar Nuevos Widgets

```javascript
// Ejemplo de nuevo widget
nuevoWidget: {
  title: 'Mi Widget Personalizado',
  displayType: 'line', // 'table', 'bar', 'line', 'big_number'
  queries: [{
    name: '',
    fields: ['count()', 'mi_campo'],
    aggregates: ['count()'],
    columns: ['mi_campo'],
    fieldAliases: ['Total', 'Mi Campo'],
    conditions: 'mi_campo:*',
    orderby: '-count()'
  }],
  widgetType: 'error-events',
  layout: { x: 0, y: 6, w: 4, h: 3, minH: 2 }
}
```

## 🚨 Solución de Problemas

### Error: "API Error 401"
- ✅ Verifica que el token sea correcto
- ✅ Confirma que el token tenga los permisos necesarios

### Error: "API Error 404"
- ✅ Verifica el organization slug
- ✅ Confirma que el project ID sea correcto

### Error: "Parse Error"
- ✅ Revisa la conectividad a internet
- ✅ Verifica que Sentry esté disponible

### Widgets No Muestran Datos
- ✅ Confirma que las métricas personalizadas estén siendo enviadas
- ✅ Verifica que los nombres de campos coincidan con tu implementación
- ✅ Ajusta el rango de tiempo en el dashboard

## 📁 Archivos Generados

- `sentry-dashboard-info.json`: Información del dashboard creado
- Contiene: ID, URL, lista de widgets, fecha de creación

## 🔄 Actualizaciones

Para actualizar un dashboard existente:
1. Modifica el script según necesites
2. Cambia el método de `POST` a `PUT` en `sentryApiRequest`
3. Incluye el ID del dashboard en la URL del endpoint

## 📞 Soporte

Si encuentras problemas:
1. Revisa los logs de error detallados
2. Verifica la documentación de la API de Sentry
3. Consulta el archivo de métricas: `SENTRY_METRICS_GUIDE.md`

---

**Nota**: Este script está optimizado para la fase alfa de HopeAI. Los widgets pueden necesitar ajustes según evolucione la implementación de métricas.