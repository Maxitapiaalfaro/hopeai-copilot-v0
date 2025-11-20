/**
 * HIPAA-Compliant Encryption Utilities
 *
 * ⚠️ SERVER-ONLY MODULE - Do not import in client components
 *
 * Implementa AES-256-GCM para encriptación at-rest de datos clínicos sensibles.
 * Cumple con los requisitos de HIPAA Security Rule §164.312(a)(2)(iv) y §164.312(e)(2)(ii)
 *
 * Características de seguridad:
 * - AES-256-GCM (Galois/Counter Mode) para autenticación y encriptación
 * - IV (Initialization Vector) único por cada operación de encriptación
 * - Auth Tag para verificar integridad de datos
 * - Key derivation con PBKDF2 (opcional para passwords)
 *
 * @author Aurora Development Team
 * @version 1.0.0
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

/**
 * Configuración de encriptación
 */
const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm' as const,
  keyLength: 32, // 256 bits
  ivLength: 16,  // 128 bits
  saltLength: 32,
  authTagLength: 16,
  scryptCost: 16384, // CPU/memory cost parameter
}

/**
 * Obtiene la clave de encriptación desde variables de entorno
 * En producción, esta clave debe estar en un servicio de gestión de secretos (AWS KMS, Azure Key Vault, etc.)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.AURORA_ENCRYPTION_KEY
  
  if (!key) {
    // En desarrollo, generar una clave temporal (NO USAR EN PRODUCCIÓN)
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ [ENCRYPTION] No AURORA_ENCRYPTION_KEY found, using temporary key for development')
      console.warn('⚠️ [ENCRYPTION] Set AURORA_ENCRYPTION_KEY in production for data persistence')
      
      // Generar clave determinística para desarrollo (basada en un seed fijo)
      const devSeed = 'aurora-dev-encryption-seed-do-not-use-in-production'
      return scryptSync(devSeed, 'salt', ENCRYPTION_CONFIG.keyLength)
    }
    
    throw new Error(
      'AURORA_ENCRYPTION_KEY environment variable is required for production. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    )
  }
  
  // Decodificar la clave desde base64
  const keyBuffer = Buffer.from(key, 'base64')
  
  if (keyBuffer.length !== ENCRYPTION_CONFIG.keyLength) {
    throw new Error(
      `Invalid encryption key length. Expected ${ENCRYPTION_CONFIG.keyLength} bytes, got ${keyBuffer.length}`
    )
  }
  
  return keyBuffer
}

/**
 * Encripta datos sensibles usando AES-256-GCM
 * 
 * @param plaintext - Texto plano a encriptar (string o Buffer)
 * @returns Buffer encriptado que contiene: [IV (16 bytes)][Auth Tag (16 bytes)][Ciphertext]
 * 
 * @example
 * const encrypted = encrypt(JSON.stringify(sensitiveData))
 * // Guardar encrypted en base de datos
 */
export function encrypt(plaintext: string | Buffer): Buffer {
  try {
    const key = getEncryptionKey()
    const iv = randomBytes(ENCRYPTION_CONFIG.ivLength)
    
    const cipher = createCipheriv(ENCRYPTION_CONFIG.algorithm, key, iv, {
      authTagLength: ENCRYPTION_CONFIG.authTagLength
    })
    
    const plaintextBuffer = typeof plaintext === 'string' 
      ? Buffer.from(plaintext, 'utf8') 
      : plaintext
    
    // Encriptar
    const encrypted = Buffer.concat([
      cipher.update(plaintextBuffer),
      cipher.final()
    ])
    
    // Obtener authentication tag
    const authTag = cipher.getAuthTag()
    
    // Formato: [IV][Auth Tag][Ciphertext]
    // Esto permite que el IV y el auth tag viajen con los datos encriptados
    return Buffer.concat([iv, authTag, encrypted])
    
  } catch (error) {
    console.error('❌ [ENCRYPTION] Error encrypting data:', error)
    throw new Error('Failed to encrypt data: ' + (error instanceof Error ? error.message : 'Unknown error'))
  }
}

/**
 * Desencripta datos usando AES-256-GCM
 * 
 * @param encryptedData - Buffer encriptado en formato [IV][Auth Tag][Ciphertext]
 * @returns Texto plano desencriptado como string
 * 
 * @throws Error si la autenticación falla (datos corruptos o manipulados)
 * 
 * @example
 * const decrypted = decrypt(encryptedBuffer)
 * const data = JSON.parse(decrypted)
 */
export function decrypt(encryptedData: Buffer): string {
  try {
    const key = getEncryptionKey()

    const ensureBufferLike = (data: any): Buffer => {
      if (Buffer.isBuffer(data)) return data
      if (data instanceof Uint8Array) return Buffer.from(data)
      if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data))
      if (data && typeof data === 'object') {
        if ((data as any).type === 'Buffer' && Array.isArray((data as any).data)) {
          return Buffer.from((data as any).data)
        }
        if (typeof (data as any).value === 'function') {
          try {
            const v = (data as any).value(true)
            if (Buffer.isBuffer(v)) return v
            if (v instanceof Uint8Array) return Buffer.from(v)
          } catch {}
        }
        if ((data as any).buffer != null) {
          const b = (data as any).buffer
          if (Buffer.isBuffer(b)) return b
          if (b instanceof Uint8Array) return Buffer.from(b)
          if (b instanceof ArrayBuffer) return Buffer.from(new Uint8Array(b))
        }
        const maybe = data as any
        if (maybe && maybe.data && maybe.iv && maybe.tag) {
          const decode = (x: string): Buffer => {
            if (typeof x !== 'string') return Buffer.from([])
            const hex = /^[0-9a-fA-F]+$/.test(x)
            if (hex && x.length % 2 === 0) return Buffer.from(x, 'hex')
            try { return Buffer.from(x, 'base64') } catch { return Buffer.from(x, 'utf8') }
          }
          const ivB = decode(maybe.iv)
          const tagB = decode(maybe.tag)
          const ctB = decode(maybe.data)
          return Buffer.concat([ivB, tagB, ctB])
        }
      }
      if (typeof data === 'string') {
        const s = data.trim()
        if (s.startsWith('{') && s.endsWith('}')) {
          try {
            const parsed = JSON.parse(s)
            return ensureBufferLike(parsed)
          } catch {}
        }
        const isHex = /^[0-9a-fA-F]+$/.test(s)
        if (isHex && s.length % 2 === 0) {
          return Buffer.from(s, 'hex')
        }
        try {
          return Buffer.from(s, 'base64')
        } catch {
          return Buffer.from(s, 'utf8')
        }
      }
      throw new Error('Encrypted data is not a Buffer/Binary/Uint8Array')
    }

    const normalized = ensureBufferLike(encryptedData as any)
    
    // Extraer componentes del buffer
    const iv = normalized.subarray(0, ENCRYPTION_CONFIG.ivLength)
    const authTag = normalized.subarray(
      ENCRYPTION_CONFIG.ivLength, 
      ENCRYPTION_CONFIG.ivLength + ENCRYPTION_CONFIG.authTagLength
    )
    const ciphertext = normalized.subarray(
      ENCRYPTION_CONFIG.ivLength + ENCRYPTION_CONFIG.authTagLength
    )
    
    const decipher = createDecipheriv(ENCRYPTION_CONFIG.algorithm, key, iv, {
      authTagLength: ENCRYPTION_CONFIG.authTagLength
    })
    
    // Configurar auth tag para verificación
    decipher.setAuthTag(authTag)
    
    // Desencriptar
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ])
    
    return decrypted.toString('utf8')
    
  } catch (error) {
    console.error('❌ [ENCRYPTION] Error decrypting data:', error)
    
    // Si falla la autenticación, los datos fueron manipulados
    if (error instanceof Error && error.message.includes('Unsupported state or unable to authenticate data')) {
      throw new Error('Data integrity check failed - data may have been tampered with')
    }
    
    throw new Error('Failed to decrypt data: ' + (error instanceof Error ? error.message : 'Unknown error'))
  }
}

/**
 * Genera una nueva clave de encriptación para uso en producción
 * 
 * @returns Clave de 256 bits en formato base64
 * 
 * @example
 * const key = generateEncryptionKey()
 * console.log('Set this as AURORA_ENCRYPTION_KEY:', key)
 */
export function generateEncryptionKey(): string {
  const key = randomBytes(ENCRYPTION_CONFIG.keyLength)
  return key.toString('base64')
}

/**
 * Deriva una clave de encriptación desde una contraseña usando PBKDF2
 * Útil para encriptación basada en password del usuario
 * 
 * @param password - Contraseña del usuario
 * @param salt - Salt único (si no se provee, se genera uno nuevo)
 * @returns Objeto con la clave derivada y el salt usado
 * 
 * @example
 * const { key, salt } = deriveKeyFromPassword(userPassword)
 * // Guardar salt junto con los datos encriptados
 */
export function deriveKeyFromPassword(
  password: string, 
  salt?: Buffer
): { key: Buffer; salt: Buffer } {
  const actualSalt = salt || randomBytes(ENCRYPTION_CONFIG.saltLength)
  
  const key = scryptSync(
    password,
    actualSalt,
    ENCRYPTION_CONFIG.keyLength,
    { N: ENCRYPTION_CONFIG.scryptCost }
  )
  
  return { key, salt: actualSalt }
}

/**
 * Verifica que la configuración de encriptación sea válida
 * Útil para health checks y diagnóstico
 * 
 * @returns true si la configuración es válida
 */
export function verifyEncryptionSetup(): boolean {
  try {
    // Test de encriptación/desencriptación
    const testData = 'HIPAA compliance test data'
    const encrypted = encrypt(testData)
    const decrypted = decrypt(encrypted)
    
    if (decrypted !== testData) {
      console.error('❌ [ENCRYPTION] Encryption verification failed: data mismatch')
      return false
    }
    
    console.log('✅ [ENCRYPTION] Encryption setup verified successfully')
    return true
    
  } catch (error) {
    console.error('❌ [ENCRYPTION] Encryption verification failed:', error)
    return false
  }
}

/**
 * Información sobre la configuración de encriptación (sin exponer secretos)
 */
export function getEncryptionInfo(): {
  algorithm: string
  keyLength: number
  ivLength: number
  isConfigured: boolean
  environment: string
} {
  return {
    algorithm: ENCRYPTION_CONFIG.algorithm,
    keyLength: ENCRYPTION_CONFIG.keyLength * 8, // En bits
    ivLength: ENCRYPTION_CONFIG.ivLength * 8,   // En bits
    isConfigured: !!process.env.AURORA_ENCRYPTION_KEY,
    environment: process.env.NODE_ENV || 'development'
  }
}

