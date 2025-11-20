/**
 * Authentication Service
 * Central service for user authentication and device management
 */

import { JWTManager, TokenPair } from './jwt-manager'
import { UserProfile, UserMetadata, DeviceInfo } from './user-profile'
import { setCurrentUserId, clearCurrentUserId } from '@/lib/user-identity'
import { auditLog } from '@/lib/security/audit-logger'

export interface AuthResult {
  user: UserProfile
  tokens: TokenPair
  deviceId: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface SignupData {
  email: string
  password: string
  metadata: UserMetadata
}

export class AuthService {
  private static instance: AuthService
  private jwtManager: JWTManager
  private currentUser: UserProfile | null = null
  private currentTokens: TokenPair | null = null
  private currentDeviceId: string | null = null
  private apiUrl: string = process.env.NEXT_PUBLIC_API_URL || '/api'
  private useRealApi: boolean = false

  private constructor() {
    this.jwtManager = JWTManager.getInstance()
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService()
    }
    return AuthService.instance
  }

  /**
   * Enable real API calls instead of simulation (for testing)
   */
  enableRealApi(url?: string): void {
    this.useRealApi = true
    if (url) {
      this.apiUrl = url
    }
  }

  /**
   * Disable real API calls and use simulation
   */
  disableRealApi(): void {
    this.useRealApi = false
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<AuthResult> {
    try {
      // Validate input
      if (!email || !password) {
        throw new Error('Email and password are required')
      }

      let userProfile: UserProfile
      let tokens: TokenPair
      let deviceId: string

      if (this.useRealApi && typeof fetch !== 'undefined') {
        // Use real API call
        const response = await fetch(`${this.apiUrl}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Login failed' }))
          throw new Error(errorData.message || 'Login failed')
        }

        const data = await response.json()
        userProfile = data.user
        tokens = data.tokens
        deviceId = data.deviceId
      } else {
        // Use simulation
        userProfile = await this.simulateBackendLogin(email, password)
        deviceId = this.generateDeviceId()
        tokens = await this.jwtManager.generateTokens(userProfile.id, deviceId)
      }

      // Update current state
      this.currentUser = userProfile
      this.currentTokens = tokens
      this.currentDeviceId = deviceId
      
      // Set the authenticated user ID in the identity system
      setCurrentUserId(userProfile.id)
      
      // Log successful login
      auditLog.userAction(userProfile.id, 'login', 'success', {
        deviceId,
        method: 'email'
      })

      return {
        user: userProfile,
        tokens,
        deviceId
      }
    } catch (error) {
      // Log failed login attempt
      auditLog.userAction(email, 'login', 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Sign up with email and password
   */
  async signup(email: string, password: string, metadata: UserMetadata): Promise<AuthResult> {
    try {
      // Validate input
      if (!email || !password) {
        throw new Error('Email and password are required')
      }

      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long')
      }
      let userProfile: UserProfile
      let tokens: TokenPair
      let deviceId: string

      if (this.useRealApi && typeof fetch !== 'undefined') {
        // Real API: register user, then login to obtain tokens
        const registerResp = await fetch(`${this.apiUrl}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            name: metadata?.displayName || email.split('@')[0],
            role: 'psychologist'
          })
        })

        if (!registerResp.ok) {
          const errorData = await registerResp.json().catch(() => ({ error: 'Signup failed' }))
          throw new Error(errorData.error || 'Signup failed')
        }

        // Now login via API to obtain tokens and device registration
        const loginResp = await fetch(`${this.apiUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        })

        if (!loginResp.ok) {
          const errorData = await loginResp.json().catch(() => ({ error: 'Login after signup failed' }))
          throw new Error(errorData.error || 'Login after signup failed')
        }

        const data = await loginResp.json()
        userProfile = data.user
        tokens = data.tokens
        deviceId = data.deviceId
      } else {
        // Simulated signup
        userProfile = await this.simulateBackendSignup(email, password, metadata)
        deviceId = this.generateDeviceId()
        tokens = await this.jwtManager.generateTokens(userProfile.id, deviceId)

        // Register the device (simulated)
        await this.registerDevice({
          deviceId,
          deviceName: this.getDeviceName(),
          deviceType: this.getDeviceType(),
          os: this.getOS(),
          browser: this.getBrowser(),
          lastActive: new Date(),
          isCurrentDevice: true
        })
      }

      // Update current state
      this.currentUser = userProfile
      this.currentTokens = tokens
      this.currentDeviceId = deviceId

      // Set the authenticated user ID in the identity system
      setCurrentUserId(userProfile.id)

      // Log successful signup
      auditLog.userAction(userProfile.id, 'signup', 'success', {
        deviceId,
        metadata
      })

      return {
        user: userProfile,
        tokens,
        deviceId
      }
    } catch (error) {
      // Log failed signup attempt
      auditLog.userAction(email, 'signup', 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Login with OAuth provider
   */
  async loginWithOAuth(provider: 'google' | 'github'): Promise<AuthResult> {
    try {
      // In a real implementation, this would redirect to OAuth provider
      // For now, we'll simulate a successful OAuth login
      const userProfile = await this.simulateBackendOAuth(provider)
      
      // Generate device ID
      const deviceId = this.generateDeviceId()
      
      // Generate tokens
      const tokens = await this.jwtManager.generateTokens(userProfile.id, deviceId)
      
      // Update current state
      this.currentUser = userProfile
      this.currentTokens = tokens
      this.currentDeviceId = deviceId
      
      // Set the authenticated user ID in the identity system
      setCurrentUserId(userProfile.id)
      
      // Log successful OAuth login
      auditLog.userAction(userProfile.id, 'oauth_login', 'success', {
        deviceId,
        provider
      })

      return {
        user: userProfile,
        tokens,
        deviceId
      }
    } catch (error) {
      // Log failed OAuth attempt
      auditLog.userAction(provider, 'oauth_login', 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<string> {
    if (!this.currentTokens?.refresh) {
      throw new Error('No refresh token available')
    }

    try {
      // Verify the refresh token
      const payload = await this.jwtManager.verifyRefreshToken(this.currentTokens.refresh)
      
      // Generate new tokens
      const newTokens = await this.jwtManager.generateTokens(payload.userId, payload.deviceId)
      
      // Update current tokens
      this.currentTokens = newTokens
      
      // Log token refresh
      auditLog.userAction(payload.userId, 'token_refresh', 'success', {
        deviceId: payload.deviceId
      })

      return newTokens.access
    } catch (error) {
      // Log failed token refresh
      auditLog.userAction(this.currentUser?.id || 'unknown', 'token_refresh', 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    if (!this.currentUser || !this.currentTokens) {
      return
    }

    try {
      const userId = this.currentUser.id
      const deviceId = this.currentDeviceId

      // Revoke tokens
      if (this.currentTokens) {
        await this.jwtManager.revokeTokens(userId, deviceId || undefined)
      }

      // Log logout
      auditLog.userAction(userId, 'logout', 'success', {
        deviceId
      })

      // Clear current state
      this.currentUser = null
      this.currentTokens = null
      this.currentDeviceId = null

      // Clear authenticated user ID from identity system
      clearCurrentUserId()
    } catch (error) {
      // Log failed logout
      auditLog.userAction(this.currentUser?.id || 'unknown', 'logout', 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Verify a token
   */
  async verifyToken(token: string): Promise<TokenPair> {
    const payload = await this.jwtManager.verifyAccessToken(token)
    return { access: token, refresh: '' } // In a real implementation, this would include the refresh token
  }

  /**
   * Register a device
   */
  async registerDevice(deviceInfo: DeviceInfo): Promise<void> {
    if (!this.currentUser) {
      throw new Error('No authenticated user')
    }

    try {
      // In a real implementation, this would call the backend API
      // For now, we'll simulate device registration
      console.log(`Registering device ${deviceInfo.deviceId} for user ${this.currentUser.id}`)
      
      // Log device registration
      auditLog.userAction(this.currentUser.id, 'device_register', 'success', {
        deviceId: deviceInfo.deviceId,
        deviceInfo
      })
    } catch (error) {
      // Log failed device registration
      auditLog.userAction(this.currentUser?.id || 'unknown', 'device_register', 'failed', {
        deviceId: deviceInfo.deviceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Get user devices
   */
  async getUserDevices(): Promise<DeviceInfo[]> {
    if (!this.currentUser) {
      throw new Error('No authenticated user')
    }

    try {
      // In a real implementation, this would call the backend API
      // For now, we'll return a simulated list with the current device
      const currentDevice: DeviceInfo = {
        deviceId: this.currentDeviceId || 'unknown',
        deviceName: this.getDeviceName(),
        deviceType: this.getDeviceType(),
        os: this.getOS(),
        browser: this.getBrowser(),
        lastActive: new Date(),
        isCurrentDevice: true
      }

      return [currentDevice]
    } catch (error) {
      // Log failed device retrieval
      auditLog.userAction(this.currentUser?.id || 'unknown', 'get_devices', 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Revoke a device
   */
  async revokeDevice(deviceId: string): Promise<void> {
    if (!this.currentUser) {
      throw new Error('No authenticated user')
    }

    try {
      // In a real implementation, this would call the backend API
      // For now, we'll simulate device revocation
      console.log(`Revoking device ${deviceId} for user ${this.currentUser.id}`)
      
      // Log device revocation
      auditLog.userAction(this.currentUser.id, 'device_revoke', 'success', {
        deviceId
      })
    } catch (error) {
      // Log failed device revocation
      auditLog.userAction(this.currentUser?.id || 'unknown', 'device_revoke', 'failed', {
        deviceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): UserProfile | null {
    return this.currentUser
  }

  /**
   * Get current tokens
   */
  getCurrentTokens(): TokenPair | null {
    return this.currentTokens
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null && this.currentTokens !== null
  }

  // Simulation methods (replace with real backend calls)
  private async simulateBackendLogin(email: string, password: string): Promise<UserProfile> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Simulate successful login
    return this.createMockUserProfile(email)
  }

  private async simulateBackendSignup(email: string, password: string, metadata: UserMetadata): Promise<UserProfile> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Simulate successful signup
    return this.createMockUserProfile(email, metadata)
  }

  private async simulateBackendOAuth(provider: 'google' | 'github'): Promise<UserProfile> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Simulate successful OAuth login
    const email = `${provider}_user@example.com`
    return this.createMockUserProfile(email)
  }

  private createMockUserProfile(email: string, metadata?: UserMetadata): UserProfile {
    const userId = `user_${btoa(email).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)}`
    const now = new Date()
    
    return {
      id: userId,
      email,
      displayName: metadata?.displayName || email.split('@')[0],
      avatar: undefined,
      metadata: {
        createdAt: now,
        lastLoginAt: now,
        subscriptionType: 'free',
        betaFeatures: []
      },
      preferences: {
        language: metadata?.language || 'es',
        timezone: metadata?.timezone || 'America/Santiago',
        clinicalSpecialty: metadata?.clinicalSpecialty,
        dataRetention: '90d'
      },
      security: {
        twoFactorEnabled: false,
        lastPasswordChange: now,
        loginAttempts: 0
      }
    }
  }

  private generateDeviceId(): string {
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getDeviceName(): string {
    return navigator.userAgent || 'Unknown Device'
  }

  private getDeviceType(): 'desktop' | 'mobile' | 'tablet' {
    const ua = navigator.userAgent
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
    if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(ua)) return 'mobile'
    return 'desktop'
  }

  private getOS(): string {
    const ua = navigator.userAgent
    if (/windows/i.test(ua)) return 'Windows'
    if (/macintosh|mac os/i.test(ua)) return 'macOS'
    if (/linux/i.test(ua)) return 'Linux'
    if (/android/i.test(ua)) return 'Android'
    if (/iphone|ipad/i.test(ua)) return 'iOS'
    return 'Unknown'
  }

  private getBrowser(): string {
    const ua = navigator.userAgent
    if (/chrome/i.test(ua) && !/edge/i.test(ua)) return 'Chrome'
    if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari'
    if (/firefox/i.test(ua)) return 'Firefox'
    if (/edge/i.test(ua)) return 'Edge'
    if (/opera/i.test(ua)) return 'Opera'
    return 'Unknown'
  }
}

export default AuthService.getInstance()