import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { databaseService } from '@/lib/database'
import { loggers } from '@/lib/logger'
import { JWTManager } from '@/lib/auth/jwt-manager'
import { deviceTrustService } from '@/lib/security/device-trust'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, deviceId: bodyDeviceId, deviceName, deviceType } = body || {}

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing email or password' }, { status: 400 })
    }

    try {
      await databaseService.initialize()
    } catch (e) {
      const msg = String((e as any)?.message || e as any)
      loggers.api.error('Database initialization failed during login', e, { message: msg })
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    }

    const user = await databaseService.users.findOne({ email: String(email).toLowerCase() })
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Compare password against stored encryptionKey (bcrypt hash)
    // Guard against missing or invalid encryptionKey
    if (!user.encryptionKey || typeof user.encryptionKey !== 'string') {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    const isValid = await bcrypt.compare(password, user.encryptionKey)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Update last login timestamp
    await databaseService.users.updateOne(
      { userId: user.userId },
      { $set: { lastLoginAt: new Date(), updatedAt: new Date() } }
    )

    // Resolve deviceId
    const headerDeviceId = request.headers.get('x-device-id') || undefined
    const deviceId = bodyDeviceId || headerDeviceId || `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Ensure device is registered/tracked
    await deviceTrustService.ensureDeviceRegistered(
      user.userId,
      deviceId,
      deviceName || 'unknown',
      deviceType || 'desktop'
    )

    // Issue tokens compatible with server verification
    const jwtManager = JWTManager.getInstance()
    const tokens = await jwtManager.generateTokens(user.userId, deviceId)

    // Shape a lightweight user profile for the client
    const userProfile = {
      id: user.userId,
      email: user.email,
      name: user.name,
      role: user.role || 'psychologist',
    }

    return NextResponse.json({
      user: userProfile,
      tokens,
      deviceId,
    })
  } catch (error) {
    const msg = String((error as any)?.message || error as any)
    loggers.api.error('Login error', error, { message: msg })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
