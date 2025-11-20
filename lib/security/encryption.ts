import crypto from 'crypto';

export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private keyLength = 32; // 256 bits
  private ivLength = 16; // 128 bits
  private saltLength = 64; // 512 bits
  private tagLength = 16; // 128 bits

  /**
   * Generate a secure encryption key from a password
   */
  generateKey(password: string, salt?: Buffer): { key: Buffer; salt: Buffer } {
    if (!salt) {
      salt = crypto.randomBytes(this.saltLength);
    }
    
    const key = crypto.pbkdf2Sync(password, salt, 100000, this.keyLength, 'sha256');
    return { key, salt };
  }

  /**
   * Encrypt data with AES-256-GCM
   */
  encrypt(data: string, password: string): { 
    encrypted: string; 
    salt: string; 
    iv: string; 
    tag: string 
  } {
    const { key, salt } = this.generateKey(password);
    const iv = crypto.randomBytes(this.ivLength);
    
    const cipher = crypto.createCipheriv(this.algorithm, key, iv) as crypto.CipherGCM;
    cipher.setAAD(Buffer.from('aurora-clinical-data'));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    };
  }

  /**
   * Decrypt data with AES-256-GCM
   */
  decrypt(
    encryptedData: string, 
    password: string, 
    salt: string, 
    iv: string, 
    tag: string
  ): string {
    const { key } = this.generateKey(password, Buffer.from(salt, 'hex'));
    const decipher = crypto.createDecipheriv(this.algorithm, key, Buffer.from(iv, 'hex')) as crypto.DecipherGCM;
    
    decipher.setAAD(Buffer.from('aurora-clinical-data'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Encrypt sensitive data for storage
   */
  encryptForStorage(data: any, password: string): string {
    const jsonData = JSON.stringify(data);
    const encrypted = this.encrypt(jsonData, password);
    
    return JSON.stringify({
      data: encrypted.encrypted,
      salt: encrypted.salt,
      iv: encrypted.iv,
      tag: encrypted.tag,
      version: 1,
      algorithm: this.algorithm,
    });
  }

  /**
   * Decrypt sensitive data from storage
   */
  decryptFromStorage(encryptedData: string, password: string): any {
    try {
      const parsed = JSON.parse(encryptedData);
      const decrypted = this.decrypt(
        parsed.data,
        password,
        parsed.salt,
        parsed.iv,
        parsed.tag
      );
      
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error('Failed to decrypt data: Invalid password or corrupted data');
    }
  }

  /**
   * Generate a secure random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash sensitive data (one-way encryption)
   */
  hash(data: string, salt?: string): { hash: string; salt: string } {
    if (!salt) {
      salt = crypto.randomBytes(this.saltLength).toString('hex');
    }
    
    const hash = crypto.pbkdf2Sync(data, salt, 100000, this.keyLength, 'sha256');
    
    return {
      hash: hash.toString('hex'),
      salt,
    };
  }

  /**
   * Verify a hash against data
   */
  verifyHash(data: string, hash: string, salt: string): boolean {
    const { hash: computedHash } = this.hash(data, salt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
  }

  /**
   * Generate a secure API key
   */
  generateApiKey(): string {
    const prefix = 'aur_';
    const randomPart = crypto.randomBytes(32).toString('hex');
    const checksum = crypto.createHash('sha256').update(randomPart).digest('hex').substring(0, 8);
    
    return `${prefix}${randomPart}${checksum}`;
  }

  /**
   * Validate an API key format
   */
  validateApiKey(apiKey: string): boolean {
    const apiKeyRegex = /^aur_[a-f0-9]{64}[a-f0-9]{8}$/;
    return apiKeyRegex.test(apiKey);
  }

  /**
   * Securely compare two strings (timing attack resistant)
   */
  secureCompare(a: string, b: string): boolean {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}

export const encryptionService = new EncryptionService();