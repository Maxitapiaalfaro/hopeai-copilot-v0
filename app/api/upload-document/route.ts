import { NextRequest, NextResponse } from 'next/server'
import { hopeAI } from '@/lib/hopeai-system'

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
    })
    
    // Asegurar que el sistema esté inicializado
    await hopeAI.initialize()
    
    const uploadedFile = await hopeAI.uploadDocument(sessionId, file, userId)
    
    console.log('✅ API: Documento subido exitosamente:', uploadedFile.id)
    
    return NextResponse.json({
      success: true,
      uploadedFile
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