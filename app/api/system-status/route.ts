import { NextRequest, NextResponse } from 'next/server'
import { getSingletonStatus, getSingletonReport } from '@/lib/singleton-monitor'
import { HopeAISystemSingleton } from '@/lib/hopeai-system'

/**
 * API Route para monitorear el estado del sistema HopeAI optimizado
 * Proporciona información detallada sobre el singleton y su rendimiento
 * 
 * Endpoints:
 * GET /api/system-status - Estado básico del sistema
 * GET /api/system-status?detailed=true - Reporte detallado
 * GET /api/system-status?format=json - Respuesta en formato JSON
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const detailed = searchParams.get('detailed') === 'true'
    const format = searchParams.get('format') || 'json'

    // Obtener estado del singleton
    const singletonStatus = HopeAISystemSingleton.getStatus()
    const monitorStatus = getSingletonStatus()

    if (detailed) {
      if (format === 'text') {
        // Retornar reporte en texto plano
        const report = getSingletonReport()
        return new Response(report, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
          },
        })
      } else {
        // Retornar reporte detallado en JSON
        return NextResponse.json({
          timestamp: new Date().toISOString(),
          system: 'HopeAI Optimized Singleton',
          version: '2.0.0-optimized',
          status: 'operational',
          singleton: singletonStatus,
          monitoring: monitorStatus,
          performance: {
            optimizationActive: true,
            multipleInitializationsPrevented: monitorStatus.monitorMetrics.initializationAttempts <= 1,
            systemHealth: monitorStatus.healthCheck.isHealthy ? 'excellent' : 'needs_attention'
          },
          recommendations: monitorStatus.healthCheck.recommendations,
          textReport: getSingletonReport()
        })
      }
    } else {
      // Estado básico del sistema
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        status: 'operational',
        singleton: {
          hasInstance: singletonStatus.hasInstance,
          isInitialized: singletonStatus.isInitialized,
          isInitializing: singletonStatus.isInitializing
        },
        health: {
          isHealthy: monitorStatus.healthCheck.isHealthy,
          issuesCount: monitorStatus.healthCheck.issues.length,
          optimizationActive: true
        },
        metrics: {
          instanceCount: monitorStatus.monitorMetrics.instanceCreationCount,
          initializationAttempts: monitorStatus.monitorMetrics.initializationAttempts,
          lastInitTime: monitorStatus.monitorMetrics.performanceMetrics.lastInitTime,
          averageInitTime: monitorStatus.monitorMetrics.performanceMetrics.averageInitTime
        }
      })
    }

  } catch (error) {
    console.error('❌ Error in system-status API:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to get system status',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

/**
 * POST endpoint para operaciones de mantenimiento del sistema
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...params } = body

    switch (action) {
      case 'reset_metrics':
        // Solo permitido en desarrollo/testing
        if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
          return NextResponse.json(
            { error: 'Reset metrics only allowed in development/test environments' },
            { status: 403 }
          )
        }
        
        // Resetear métricas del monitor
        const { singletonMonitor } = await import('@/lib/singleton-monitor')
        singletonMonitor.resetMetrics()
        
        return NextResponse.json({
          success: true,
          message: 'Metrics reset successfully',
          timestamp: new Date().toISOString()
        })

      case 'health_check':
        const status = getSingletonStatus()
        return NextResponse.json({
          success: true,
          healthCheck: status.healthCheck,
          recommendations: status.healthCheck.recommendations,
          timestamp: new Date().toISOString()
        })

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('❌ Error in system-status POST:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to process system operation',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}