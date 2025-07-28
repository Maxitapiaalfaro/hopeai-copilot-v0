# Configuración de Sentry MCP (Model Context Protocol)

Este proyecto ya tiene Sentry configurado para monitoreo de errores. Ahora puedes integrar Sentry MCP para acceder a los datos de Sentry directamente desde tu IDE compatible con MCP.

## ¿Qué es Sentry MCP?

Sentry MCP Server proporciona una forma segura de traer el contexto completo de issues de Sentry a sistemas que pueden aprovechar el Model Context Protocol (MCP). Con MCP puedes:

- ✅ Acceder a issues y errores de Sentry
- 🔍 Buscar errores en archivos específicos
- 📊 Consultar proyectos y organizaciones
- 🔧 Listar y crear DSNs de Sentry para proyectos
- 🤖 Invocar Seer para arreglar issues automáticamente
- 📈 Acceder a datos de rendimiento y releases

## Configuraciones Disponibles

### 1. Configuración con OAuth (Recomendada)

**Archivo:** `claude_desktop_config.json`

```json
{
  "mcpServers": {
    "Sentry": {
      "url": "https://mcp.sentry.dev/mcp"
    }
  }
}
```

**Características:**
- ✅ Autenticación OAuth automática
- ✅ Transporte HTTP con fallback SSE
- ✅ Acceso a todas las 16+ herramientas disponibles
- ✅ Manejo automático de autenticación y sesiones

### 2. Configuración Alternativa (Sin OAuth)

**Archivo:** `mcp-config-alternative.json`

```json
{
  "mcpServers": {
    "Sentry": {
      "command": "npx",
      "args": ["-y", "mcp-remote@latest", "https://mcp.sentry.dev/mcp"]
    }
  }
}
```

### 3. Configuración Local STDIO (Para Sentry Self-Hosted)

Para instalaciones de Sentry auto-hospedadas:

```bash
npx @sentry/mcp-server@latest --access-token=tu-token-sentry --host=sentry.ejemplo.com
```

**Variables de entorno:**
```bash
SENTRY_ACCESS_TOKEN=tu-token
SENTRY_HOST=tu-host-sentry
```

## Configuración por IDE

### Claude Desktop
1. Accede a herramientas de desarrollador: `CMD + ,` → Developer → Edit Config
2. Edita `claude_desktop_config.json`
3. Copia el contenido del archivo `claude_desktop_config.json` de este proyecto

### Cursor
1. Ve a Settings → Profile → Integrations
2. Selecciona "Add More"
3. Agrega la URL del servidor Sentry MCP: `https://mcp.sentry.dev/mcp`

### Claude Code
```bash
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
claude
```

### Cascade
1. Usa `CMD+Shift+P` y selecciona "MCP: Add Server"
2. O configura via "Configure MCP" (`CMD + L`)

## Información del Proyecto Actual

**DSN de Sentry configurado:**
```
https://da82e6d85538fbb3f2f5337705c12919@o4509744324673536.ingest.us.sentry.io/4509744325853184
```

**Características habilitadas:**
- ✅ Logging de consola
- ✅ Agregador de métricas
- ✅ Trazas de rendimiento
- ✅ Configuración para servidor y edge runtime

## Ejemplos de Prompts para Sentry MCP

Una vez configurado, puedes usar estos prompts:

```
# Revisar issues del proyecto
"Dime sobre los issues en mi proyecto hopeai-copilot"

# Buscar errores específicos
"Revisa Sentry por errores en components/chat-interface.tsx y propón soluciones"

# Diagnosticar issue específico
"Diagnostica el issue PROYECTO-123 y propón soluciones"

# Crear nuevo proyecto
"Crea un nuevo proyecto en Sentry para nuevo-servicio y configura instrumentación local"

# Usar Seer AI
"Usa Seer de Sentry para analizar y proponer una solución para el issue PROYECTO-456"

# Revisar releases
"Muéstrame los releases más recientes de mi organización"

# Buscar crashes
"Encuentra todos los crashes no resueltos en mi app React Native"
```

## Verificación de Configuración

Para verificar que MCP está funcionando:

1. **En Claude Desktop:** Los tools de Sentry aparecerán en la lista de herramientas disponibles
2. **En Cursor:** Verás "Sentry MCP" en la lista de integraciones activas
3. **En Claude Code:** Ejecuta `claude` y verifica que Sentry esté listado en los servidores MCP

## Autenticación OAuth

Cuando uses la configuración OAuth, serás dirigido a:

1. ✅ Aceptar la autorización OAuth
2. 🔐 Iniciar sesión via tu organización Sentry existente
3. ✅ Otorgar acceso a los permisos necesarios

Una vez autenticado, las herramientas estarán disponibles en tu cliente MCP.

## Troubleshooting

### Error: "No se puede conectar a Sentry MCP"
- Verifica tu conexión a internet
- Asegúrate de que la URL esté correcta: `https://mcp.sentry.dev/mcp`
- Intenta la configuración alternativa sin OAuth

### Error: "Token de acceso inválido" (modo STDIO)
- Verifica que tu token tenga los scopes necesarios:
  - `org:read`
  - `project:read`
  - `project:write`
  - `team:read`
  - `team:write`
  - `event:write`

### Error: "Herramientas no disponibles"
- Reinicia tu IDE después de la configuración
- Verifica que el archivo de configuración esté en la ubicación correcta
- Comprueba la sintaxis JSON del archivo de configuración

## Recursos Adicionales

- 📖 [Documentación oficial de Sentry MCP](https://docs.sentry.io/product/sentry-mcp/)
- 🧪 [Página de pruebas de Sentry MCP](https://mcp.sentry.dev/)
- 💬 [Soporte de Sentry](https://sentry.io/support/)

---

**Nota:** Este proyecto ya tiene Sentry configurado y funcionando. La configuración MCP es un complemento que te permitirá interactuar con los datos de Sentry directamente desde tu IDE compatible con MCP.