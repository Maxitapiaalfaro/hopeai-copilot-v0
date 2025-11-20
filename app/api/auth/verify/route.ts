import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth/auth-service'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token no proporcionado' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    
    // Verificar el token con el servicio de autenticación
    const authService = AuthService.getInstance()
    
    try {
      // Intentar verificar el token
      await authService.verifyToken(token)
      
      // Si el token es válido, obtener el usuario actual
      const currentUser = authService.getCurrentUser()
      
      if (currentUser) {
        return NextResponse.json(currentUser)
      } else {
        return NextResponse.json(
          { error: 'Usuario no encontrado' },
          { status: 401 }
        )
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('Error verificando token:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}