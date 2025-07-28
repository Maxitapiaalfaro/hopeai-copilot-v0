/**
 * Hook personalizado para gestión de métricas de sesión
 * 
 * Maneja automáticamente:
 * - Inicio y fin de sesiones
 * - Tracking de actividad del usuario
 * - Detección de cambios de agente
 * - Métricas de tiempo de actividad
 */

import { useEffect, useRef, useCallback } from 'react';
import { sentryMetricsTracker } from '@/lib/sentry-metrics-tracker';
import type { AgentType } from '@/types/clinical-types';

interface UseSessionMetricsProps {
  userId: string;
  sessionId: string;
  currentAgent?: AgentType;
  isActive?: boolean;
}

interface SessionMetricsReturn {
  startSession: (agentType: AgentType) => void;
  endSession: () => void;
  updateActivity: () => void;
  trackAgentChange: (fromAgent: AgentType, toAgent: AgentType) => void;
  getSessionStats: () => {
    duration: number;
    messageCount: number;
    agentSwitches: number;
  } | null;
}

export function useSessionMetrics({
  userId,
  sessionId,
  currentAgent = 'socratico',
  isActive = true
}: UseSessionMetricsProps): SessionMetricsReturn {
  const sessionStartedRef = useRef(false);
  const lastActivityRef = useRef<Date>(new Date());
  const previousAgentRef = useRef<AgentType>(currentAgent);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Función para iniciar una sesión
  const startSession = useCallback((agentType: AgentType) => {
    if (!sessionStartedRef.current) {
      sentryMetricsTracker.startSessionTracking(userId, sessionId, agentType);
      sessionStartedRef.current = true;
      lastActivityRef.current = new Date();
      
      console.log('📊 Sesión iniciada:', {
        userId,
        sessionId,
        agentType
      });
    }
  }, [userId, sessionId]);

  // Función para finalizar una sesión
  const endSession = useCallback(() => {
    if (sessionStartedRef.current) {
      sentryMetricsTracker.endSessionTracking(userId, sessionId, currentAgent);
      sessionStartedRef.current = false;
      
      // Limpiar timers
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
        activityTimeoutRef.current = null;
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      
      console.log('📊 Sesión finalizada:', {
        userId,
        sessionId,
        currentAgent
      });
    }
  }, [userId, sessionId, currentAgent]);

  // Función para actualizar actividad
  const updateActivity = useCallback(() => {
    if (sessionStartedRef.current) {
      lastActivityRef.current = new Date();
      sentryMetricsTracker.updateSessionActivity(userId, sessionId, currentAgent);
      
      // Resetear timeout de inactividad
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      
      // Configurar nuevo timeout de inactividad (30 minutos)
      activityTimeoutRef.current = setTimeout(() => {
        console.log('📊 Sesión inactiva - finalizando automáticamente');
        endSession();
      }, 30 * 60 * 1000); // 30 minutos
    }
  }, [userId, sessionId, currentAgent, endSession]);

  // Función para trackear cambio de agente
  const trackAgentChange = useCallback((fromAgent: AgentType, toAgent: AgentType) => {
    if (sessionStartedRef.current && fromAgent !== toAgent) {
      sentryMetricsTracker.trackAgentSwitch({
        userId,
        sessionId,
        fromAgent,
        toAgent,
        switchType: 'manual',
        confidence: 1.0
      });
      previousAgentRef.current = toAgent;
      updateActivity(); // Actualizar actividad en cambio de agente
      
      console.log('📊 Cambio de agente registrado:', {
        userId,
        sessionId,
        fromAgent,
        toAgent
      });
    }
  }, [userId, sessionId, updateActivity]);

  // Función para obtener estadísticas de la sesión
  const getSessionStats = useCallback(() => {
    return sentryMetricsTracker.getSessionStats(sessionId);
  }, [sessionId]);

  // Efecto para detectar cambios de agente
  useEffect(() => {
    if (sessionStartedRef.current && previousAgentRef.current !== currentAgent) {
      trackAgentChange(previousAgentRef.current, currentAgent);
    }
  }, [currentAgent, trackAgentChange]);

  // Efecto para iniciar sesión automáticamente
  useEffect(() => {
    if (isActive && !sessionStartedRef.current) {
      startSession(currentAgent);
    }
  }, [isActive, currentAgent, startSession]);

  // Efecto para heartbeat periódico (cada 5 minutos)
  useEffect(() => {
    if (sessionStartedRef.current && isActive) {
      heartbeatIntervalRef.current = setInterval(() => {
        updateActivity();
      }, 5 * 60 * 1000); // 5 minutos
      
      return () => {
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
      };
    }
  }, [isActive, updateActivity]);

  // Efecto para detectar actividad del usuario (eventos de mouse, teclado, etc.)
  useEffect(() => {
    if (!isActive || !sessionStartedRef.current) return;

    const handleUserActivity = () => {
      updateActivity();
    };

    // Eventos que indican actividad del usuario
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    // Throttle para evitar demasiadas llamadas
    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledHandler = () => {
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          handleUserActivity();
          throttleTimeout = null;
        }, 30000); // Throttle de 30 segundos
      }
    };

    events.forEach(event => {
      document.addEventListener(event, throttledHandler, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, throttledHandler);
      });
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
    };
  }, [isActive, updateActivity]);

  // Efecto para cleanup al desmontar
  useEffect(() => {
    return () => {
      if (sessionStartedRef.current) {
        endSession();
      }
    };
  }, [endSession]);

  // Efecto para manejar visibilidad de la página
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Página oculta - pausar tracking activo pero no finalizar sesión
        console.log('📊 Página oculta - pausando tracking activo');
      } else {
        // Página visible - reanudar tracking
        if (sessionStartedRef.current) {
          updateActivity();
          console.log('📊 Página visible - reanudando tracking');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [updateActivity]);

  return {
    startSession,
    endSession,
    updateActivity,
    trackAgentChange,
    getSessionStats
  };
}

// Hook simplificado para casos básicos
export function useBasicSessionMetrics(userId: string, sessionId: string) {
  return useSessionMetrics({
    userId,
    sessionId,
    currentAgent: 'socratico',
    isActive: true
  });
}