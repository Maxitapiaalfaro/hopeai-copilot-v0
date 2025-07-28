# Guía de Métricas de Sentry para HopeAI

## Resumen Ejecutivo

Se ha implementado un sistema completo de métricas personalizadas en Sentry para medir el uso y engagement de la plataforma HopeAI. Este sistema captura automáticamente dos métricas clave:

1. **Cantidad de Mensajes Enviados** - Volumen de uso por usuario, agente y período semanal
2. **Tiempo de Actividad** - Profundidad de uso por sesión y período semanal

## Arquitectura del Sistema

### Componentes Principales

- **`SentryMetricsTracker`** (`lib/sentry-metrics-tracker.ts`) - Clase principal que maneja todas las métricas
- **`useSessionMetrics`** (`hooks/use-session-metrics.ts`) - Hook de React para gestión automática de sesiones
- **Configuración de Sentry** - Habilitada en cliente, servidor y edge con agregador de métricas

### Métricas Implementadas

#### 1. Métricas de Mensajes
- `messages.sent` - Contador general de mensajes enviados
- `messages.sent.{agentType}` - Mensajes por agente específico (socratic, clinical, academic)
- `messages.sent.weekly` - Mensajes agrupados por semana
- `message.length` - Distribución de longitud de mensajes
- `message.response_time` - Tiempo de respuesta del sistema

#### 2. Métricas de Sesión
- `sessions.started` - Contador de sesiones iniciadas
- `session.duration.current` - Duración actual de sesión (gauge)
- `session.duration.total` - Duración total al finalizar sesión
- `session.duration.weekly` - Tiempo de actividad semanal
- `session.messages.count` - Mensajes por sesión
- `session.agent_switches` - Cambios de agente por sesión
- `agent.switches` - Contador de cambios de agente

## Uso en Producción

### Integración Automática

El sistema está **completamente integrado** y funciona automáticamente:

1. **API de Mensajes** (`app/api/send-message/route.ts`) - Captura automáticamente métricas de mensajes
2. **Hook de Sesión** (`hooks/use-session-metrics.ts`) - Gestiona automáticamente el ciclo de vida de sesiones
3. **Configuración de Sentry** - Habilitada en todos los entornos (cliente, servidor, edge)

### Implementación en Componentes

#### Uso Básico del Hook

```typescript
import { useSessionMetrics } from '@/hooks/use-session-metrics';

function ChatInterface({ userId, sessionId }) {
  const {
    startSession,
    endSession,
    updateActivity,
    trackAgentChange,
    getSessionStats
  } = useSessionMetrics({
    userId,
    sessionId,
    currentAgent: 'socratic',
    isActive: true
  });

  // El hook maneja automáticamente:
  // - Inicio de sesión al montar
  // - Tracking de actividad del usuario
  // - Detección de cambios de agente
  // - Finalización al desmontar
  
  return (
    <div>
      {/* Tu interfaz de chat */}
    </div>
  );
}
```

#### Uso Manual de Métricas

```typescript
import { sentryMetricsTracker } from '@/lib/sentry-metrics-tracker';

// Registrar mensaje enviado
sentryMetricsTracker.trackMessageSent({
  userId: 'user123',
  sessionId: 'session456',
  agentType: 'socratic',
  timestamp: new Date(),
  messageLength: message.length,
  responseTime: 1500
});

// Cambio de agente
sentryMetricsTracker.trackAgentSwitch(
  'user123',
  'session456', 
  'socratic',
  'clinical'
);
```

## Configuración de Dashboards en Sentry

### Métricas Clave para Dashboards

#### Dashboard de Volumen de Uso
```
- messages.sent (por día/semana)
- messages.sent.weekly (tendencia semanal)
- messages.sent.socratic vs messages.sent.clinical vs messages.sent.academic
- message.length (distribución)
```

#### Dashboard de Engagement
```
- sessions.started (por día)
- session.duration.weekly (tiempo total por semana)
- session.messages.count (mensajes por sesión)
- agent.switches (frecuencia de cambios)
```

#### Dashboard de Performance
```
- message.response_time (percentiles P50, P95, P99)
- session.duration.total (duración promedio de sesiones)
```

### Filtros Recomendados

- **Por Usuario**: `user_id`
- **Por Agente**: `agent_type` (socratic, clinical, academic)
- **Por Período**: `week` (formato YYYY-WW)
- **Por Sesión**: `session_id`

## Alertas Recomendadas

### Alertas de Volumen
- Caída del 20% en `messages.sent` comparado con la semana anterior
- Aumento del 50% en `message.response_time` (P95)

### Alertas de Engagement
- Caída del 15% en `session.duration.weekly`
- Aumento anormal en `agent.switches` (posible confusión del usuario)

### Alertas de Performance
- `message.response_time` P95 > 5 segundos
- Errores en el tracking de métricas

## Consideraciones de Privacidad

- **IDs de Usuario**: Se usan como tags pero no se almacena contenido de mensajes
- **Contenido**: Solo se mide longitud, no contenido real
- **Sesiones**: Se trackea duración y actividad, no contenido específico
- **Cumplimiento**: Compatible con GDPR/HIPAA (solo métricas agregadas)

## Monitoreo del Sistema

### Logs de Debug
El sistema incluye logging detallado:
```
📊 Mensaje registrado en métricas
📊 Sesión iniciada para tracking
📊 Cambio de agente registrado
📊 Sesión finalizada - métricas registradas
```

### Manejo de Errores
Todos los errores se capturan automáticamente en Sentry sin interrumpir el flujo de la aplicación.

## Próximos Pasos

1. **Configurar Dashboards** en la interfaz de Sentry
2. **Establecer Alertas** basadas en las métricas clave
3. **Análisis Semanal** de tendencias de uso
4. **Optimizaciones** basadas en datos de performance

## Soporte Técnico

Para modificaciones o extensiones del sistema de métricas, consultar:
- `lib/sentry-metrics-tracker.ts` - Lógica principal
- `hooks/use-session-metrics.ts` - Integración con React
- Configuraciones de Sentry en `instrumentation-*.ts` y `sentry.*.config.ts`

---

**Estado**: ✅ Listo para Producción  
**Última Actualización**: $(date)  
**Versión**: 1.0.0