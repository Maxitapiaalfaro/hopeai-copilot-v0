/**
 * User Profile Interface
 * Defines the structure for user profiles in Aurora
 */

export interface UserProfile {
  id: string
  email: string
  displayName: string
  avatar?: string
  metadata: {
    createdAt: Date
    lastLoginAt: Date
    subscriptionType: 'free' | 'pro' | 'enterprise'
    betaFeatures: string[]
  }
  preferences: {
    language: string
    timezone: string
    clinicalSpecialty?: string
    dataRetention: '30d' | '90d' | '1y' | 'forever'
  }
  security: {
    twoFactorEnabled: boolean
    lastPasswordChange: Date
    loginAttempts: number
  }
}

export interface UserMetadata {
  displayName?: string
  clinicalSpecialty?: string
  timezone?: string
  language?: string
}

export interface DeviceInfo {
  deviceId: string
  deviceName: string
  deviceType: 'desktop' | 'mobile' | 'tablet'
  os: string
  browser: string
  lastActive: Date
  isCurrentDevice: boolean
}