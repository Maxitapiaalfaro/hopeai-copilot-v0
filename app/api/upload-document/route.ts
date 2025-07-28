import { NextRequest, NextResponse } from 'next/server'
import { getGlobalOrchestrationSystem } from '@/lib/orchestration-singleton'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const sessionId = formData.get('sessionId') as string
    const userId = formData.get('userId') as string
    
    if (!file || !sessionId || !userId) {
      return NextResponse.json(
        { error: 'file, sessionId y userId son requeridos' },
        { status: 400 }
      )
    }
    
    console.log('🔄 API: Subiendo documento...', {
      fileName: file.name,
      fileSize: file.size,
      sessionId,
      userId
    })
    
    const orchestrationSystem = await getGlobalOrchestrationSystem()
    
    // Usar el sistema de orquestación para manejar la subida de documentos
    const result = await orchestrationSystem.orchestrate(
      `Subir documento: ${file.name}`,
      sessionId,
      userId,
      {
        forceMode: 'dynamic'
      }
    )
    
    console.log('✅ API: Documento procesado exitosamente')
    
    return NextResponse.json({
      ...result,
      success: true
    })
  } catch (error) {
    console.error('❌ API Error (Upload Document):', error)
    return NextResponse.json(
      { 
        error: 'Error al subir documento',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}