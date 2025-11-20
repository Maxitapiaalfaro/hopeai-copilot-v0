/**
 * JWT Token Manager
 * Handles JWT token generation, verification, and revocation
 */

export interface TokenPair {
  access: string
  refresh: string
}

export interface TokenPayload {
  userId: string
  deviceId: string
  sessionId: string
  permissions: string[]
  exp: number
  iat: number
}

export class JWTManager {
  private static instance: JWTManager
  private revokedTokens: Set<string> = new Set()

  static getInstance(): JWTManager {
    if (!JWTManager.instance) {
      JWTManager.instance = new JWTManager()
    }
    return JWTManager.instance
  }

  /**
   * Generate access and refresh tokens
   */
  async generateTokens(userId: string, deviceId: string): Promise<TokenPair> {
    const sessionId = this.generateSessionId()
    const now = Math.floor(Date.now() / 1000)
    
    // Access token (15 minutes)
    const accessPayload: TokenPayload = {
      userId,
      deviceId,
      sessionId,
      permissions: ['read', 'write'],
      exp: now + (15 * 60), // 15 minutes
      iat: now
    }

    // Refresh token (7 days)
    const refreshPayload = {
      ...accessPayload,
      exp: now + (7 * 24 * 60 * 60), // 7 days
      isRefresh: true
    }

    // In a real implementation, these would be signed JWTs
    // For now, we'll use a simple base64 encoding
    const accessToken = this.encodeToken(accessPayload)
    const refreshToken = this.encodeToken(refreshPayload)

    return {
      access: accessToken,
      refresh: refreshToken
    }
  }

  /**
   * Verify access token
   */
  async verifyAccessToken(token: string): Promise<TokenPayload> {
    if (this.revokedTokens.has(token)) {
      throw new Error('Token has been revoked')
    }

    try {
      const payload = this.decodeToken(token)
      
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token has expired')
      }

      if (!payload.userId || !payload.deviceId) {
        throw new Error('Invalid token payload')
      }

      return payload as TokenPayload
    } catch (error) {
      throw new Error('Invalid token')
    }
  }

  /**
   * Verify refresh token
   */
  async verifyRefreshToken(token: string): Promise<TokenPayload> {
    if (this.revokedTokens.has(token)) {
      throw new Error('Token has been revoked')
    }

    try {
      const payload = this.decodeToken(token)
      
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token has expired')
      }

      if (!payload.isRefresh) {
        throw new Error('Not a refresh token')
      }

      return payload as TokenPayload
    } catch (error) {
      throw new Error('Invalid refresh token')
    }
  }

  /**
   * Revoke tokens
   */
  async revokeTokens(userId: string, deviceId?: string): Promise<void> {
    // In a real implementation, this would store revoked tokens in a database
    // For now, we'll just add them to the in-memory set
    console.log(`Revoking tokens for user ${userId}${deviceId ? ` and device ${deviceId}` : ''}`)
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<void> {
    // In a real implementation, this would clean up the database
    console.log('Cleaning up expired tokens')
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Simple token encoding (replace with proper JWT in production)
   */
  private encodeToken(payload: any): string {
    try {
      // Browser environment
      if (typeof window !== 'undefined' && typeof btoa === 'function') {
        return btoa(JSON.stringify(payload))
      }
      // Node environment
      return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64')
    } catch {
      // Fallback
      return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64')
    }
  }

  /**
   * Simple token decoding (replace with proper JWT in production)
   */
  private decodeToken(token: string): any {
    try {
      // Browser environment
      if (typeof window !== 'undefined' && typeof atob === 'function') {
        return JSON.parse(atob(token))
      }
      // Node environment
      const json = Buffer.from(token, 'base64').toString('utf-8')
      return JSON.parse(json)
    } catch {
      throw new Error('Invalid token format')
    }
  }
}