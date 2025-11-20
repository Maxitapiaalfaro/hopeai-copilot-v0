/**
 * Local Data Migrator
 * 
 * Handles migration of existing IndexedDB data to user accounts in MongoDB
 * Ensures data integrity, security, and rollback capability
 */

import { EnhancedIndexedDBAdapter } from '@/lib/storage/enhanced-indexeddb-adapter';
import { APIClientAdapter } from '@/lib/storage/api-client-adapter';
import { EncryptionService } from '@/lib/security/encryption';
import { getEffectiveUserId, getDeviceId } from '@/lib/user-identity';
import { loggers } from '@/lib/logger';

export interface MigrationOptions {
  batchSize?: number;
  encryptionEnabled?: boolean;
  dryRun?: boolean;
  backupLocalData?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export interface MigrationResult {
  success: boolean;
  migratedRecords: number;
  failedRecords: number;
  skippedRecords: number;
  errors: MigrationError[];
  backupLocation?: string;
  duration: number;
}

export interface MigrationError {
  recordId: string;
  entityType: string;
  error: string;
  timestamp: Date;
}

export interface MigrationBackup {
  timestamp: Date;
  userId: string;
  deviceId: string;
  data: Record<string, any>;
  checksum: string;
}

export class LocalDataMigrator {
  private localStorage: EnhancedIndexedDBAdapter;
  private remoteStorage: APIClientAdapter;
  private encryption: EncryptionService;
  private options: Required<MigrationOptions>;

  constructor(
    localStorage: EnhancedIndexedDBAdapter,
    remoteStorage: APIClientAdapter,
    options: MigrationOptions = {}
  ) {
    this.localStorage = localStorage;
    this.remoteStorage = remoteStorage;
    this.encryption = new EncryptionService();
    this.options = {
      batchSize: options.batchSize || 100,
      encryptionEnabled: options.encryptionEnabled ?? true,
      dryRun: options.dryRun || false,
      backupLocalData: options.backupLocalData ?? true,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000
    };
  }

  /**
   * Main migration method - migrates all local data to user account
   */
  async migrateUserData(): Promise<MigrationResult> {
    const startTime = Date.now();
    const userId = getEffectiveUserId();
    const deviceId = getDeviceId();

    loggers.storage.info('Starting user data migration', { userId, deviceId });

    const result: MigrationResult = {
      success: false,
      migratedRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
      errors: [],
      duration: 0
    };

    // Declare backup outside try block for catch block access
    let backup: MigrationBackup | null = null;

    try {
      // Step 1: Create backup if enabled
      if (this.options.backupLocalData) {
        backup = await this.createBackup(userId, deviceId);
        result.backupLocation = `backup_${userId}_${Date.now()}`;
        loggers.storage.info('Backup created', { backupLocation: result.backupLocation });
      }

      // Step 2: Get all local data to migrate
      const entities = await this.getEntitiesToMigrate();
      loggers.storage.info('Entities to migrate', { count: entities.length });

      // Step 3: Process entities in batches
      for (let i = 0; i < entities.length; i += this.options.batchSize) {
        const batch = entities.slice(i, i + this.options.batchSize);
        await this.processBatch(batch, result);
        
        loggers.storage.info('Batch processed', { 
          batch: Math.floor(i / this.options.batchSize) + 1,
          processed: Math.min(i + this.options.batchSize, entities.length),
          total: entities.length
        });
      }

      // Step 4: Update local storage to mark migration complete
      if (!this.options.dryRun) {
        await this.markMigrationComplete(userId, deviceId);
      }

      result.success = result.failedRecords === 0;
      result.duration = Date.now() - startTime;

      loggers.storage.info('Migration completed', {
        success: result.success,
        migrated: result.migratedRecords,
        failed: result.failedRecords,
        skipped: result.skippedRecords,
        duration: result.duration
      });

      return result;

    } catch (error) {
      loggers.storage.error('Migration failed', { error, userId, deviceId });
      result.errors.push({
        recordId: 'migration',
        entityType: 'system',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });
      
      // Attempt rollback if backup exists
      if (backup && this.options.backupLocalData) {
        await this.rollbackMigration(backup);
        loggers.storage.info('Rollback completed', { backupLocation: result.backupLocation });
      }

      result.duration = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Create encrypted backup of local data before migration
   */
  private async createBackup(userId: string, deviceId: string): Promise<MigrationBackup> {
    loggers.storage.info('Creating backup', { userId, deviceId });

    const allData: Record<string, any> = {};
    
    // Get all data from different stores (usar nombres reales de IndexedDB)
    const stores = [
      'chat_sessions',
      'patient_records',
      'clinical_files',
      'user_preferences',
      'fichas_clinicas',
      'pattern_analyses'
    ];
    
    for (const store of stores) {
      try {
        const data = await this.localStorage.find(store, {});
        allData[store] = data;
      } catch (error) {
        loggers.storage.warn('Failed to backup store', { store, error });
      }
    }

    // Calculate checksum for integrity
    const checksum = this.calculateChecksum(allData);

    // Encrypt backup data if enabled
    let backupData = allData;
    if (this.options.encryptionEnabled) {
      const password = process.env.ENCRYPTION_PASSWORD || 'aurora-default-password';
      const encryptedResult = await this.encryption.encrypt(JSON.stringify(allData), password);
      backupData = { 
        encrypted: true, 
        data: encryptedResult.encrypted,
        salt: encryptedResult.salt,
        iv: encryptedResult.iv,
        tag: encryptedResult.tag
      };
    }

    const backup: MigrationBackup = {
      timestamp: new Date(),
      userId,
      deviceId,
      data: backupData,
      checksum
    };

    // Store backup in local storage
    await this.localStorage.create('migration_backups', backup);

    return backup;
  }

  /**
   * Get list of entities that need to be migrated
   */
  private async getEntitiesToMigrate(): Promise<Array<{store: string, id: string, data: any}>> {
    const entities: Array<{store: string, id: string, data: any}> = [];
    
    // Definir stores reales y su key principal
    const entityTypes = [
      { store: 'chat_sessions', key: 'sessionId' },
      { store: 'patient_records', key: 'id' },
      { store: 'clinical_files', key: 'id' },
      { store: 'user_preferences', key: 'userId' },
      { store: 'fichas_clinicas', key: 'fichaId' },
      { store: 'pattern_analyses', key: 'analysisId' }
    ];

    for (const { store, key } of entityTypes) {
      try {
        const data = await this.localStorage.find(store, {});
        
        // Filter out already migrated or system records
        const filteredData = data.filter(item => {
          const itemKey = item[key];
          return itemKey && !item._migrated && !item._system;
        });

        entities.push(...filteredData.map(item => ({
          store,
          id: item[key],
          data: item
        })));

      } catch (error) {
        loggers.storage.warn('Failed to get entities', { store, error });
      }
    }

    return entities;
  }

  /**
   * Process a batch of entities for migration
   */
  private async processBatch(
    batch: Array<{store: string, id: string, data: any}>, 
    result: MigrationResult
  ): Promise<void> {
    
    for (const entity of batch) {
      try {
        // Skip if already migrated (double-check)
        if (entity.data._migrated) {
          result.skippedRecords++;
          continue;
        }

        // Prepare data for migration
        const migrationData = await this.prepareEntityForMigration(entity);

        if (this.options.dryRun) {
          // In dry-run mode, just validate the data
          await this.validateMigrationData(migrationData);
          result.migratedRecords++;
        } else {
          // Perform actual migration
          await this.migrateEntity(migrationData);
          result.migratedRecords++;
          
          // Mark as migrated in local storage
          await this.markEntityAsMigrated(entity.store, entity.id);
        }

      } catch (error) {
        result.failedRecords++;
        result.errors.push({
          recordId: entity.id,
          entityType: this.mapStoreToRemoteType(entity.store),
          error: error instanceof Error ? error.message : 'Migration failed',
          timestamp: new Date()
        });

        loggers.storage.error('Entity migration failed', {
          store: entity.store,
          entityId: entity.id,
          error
        });
      }
    }
  }

  /**
   * Prepare entity data for migration
   */
  private async prepareEntityForMigration(entity: {store: string, id: string, data: any}): Promise<{ entityType: string; payload: any }> {
    const userId = getEffectiveUserId();
    const deviceId = getDeviceId();

    const remoteType = this.mapStoreToRemoteType(entity.store);

    const payload = {
      ...entity.data,
      userId: entity.data.userId || userId,
      _migrated: true,
      _migratedAt: new Date(),
      _migratedBy: userId,
      _originalDeviceId: deviceId,
      _migrationVersion: '1.0.0'
    };

    return { entityType: remoteType, payload };
  }

  /**
   * Check if entity type contains sensitive data
   */
  private containsSensitiveData(store: string): boolean {
    const sensitiveStores = ['patient_records', 'chat_sessions', 'fichas_clinicas', 'pattern_analyses'];
    return sensitiveStores.includes(store);
  }

  /**
   * Validate migration data before actual migration
   */
  private async validateMigrationData(data: { entityType: string; payload: any }): Promise<void> {
    if (!data || typeof data !== 'object') throw new Error('Invalid migration data');
    if (!data.entityType || typeof data.entityType !== 'string') throw new Error('Missing entity type');
    if (!data.payload || typeof data.payload !== 'object') throw new Error('Invalid payload');
  }

  /**
   * Perform actual entity migration to remote storage
   */
  private async migrateEntity(data: { entityType: string; payload: any }): Promise<void> {
    let retries = 0;
    let lastError: Error | null = null;

    while (retries < this.options.maxRetries) {
      try {
        await this.remoteStorage.create(data.entityType, data.payload);
        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Migration failed');
        retries++;
        
        if (retries < this.options.maxRetries) {
          loggers.storage.warn('Migration attempt failed, retrying', {
            attempt: retries,
            maxRetries: this.options.maxRetries,
            error: lastError.message
          });
          
          await this.delay(this.options.retryDelay * retries);
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Mark entity as migrated in local storage
   */
  private async markEntityAsMigrated(store: string, entityId: string): Promise<void> {
    try {
      const keyField = this.getKeyFieldForStore(store);
      const query = keyField ? { [keyField]: entityId } : { id: entityId };
      await this.localStorage.update(store, {
        _migrated: true,
        _migratedAt: new Date()
      }, query);
    } catch (error) {
      loggers.storage.warn('Failed to mark entity as migrated', { store, entityId, error });
    }
  }

  private mapStoreToRemoteType(store: string): string {
    const map: Record<string, string> = {
      'chat_sessions': 'chat-session',
      'patient_records': 'patient',
      'clinical_files': 'clinical-file',
      'pattern_analyses': 'pattern-analysis',
      'fichas_clinicas': 'ficha-clinica',
      'user_preferences': 'user-preferences'
    };
    return map[store] || 'unknown';
  }

  private getKeyFieldForStore(store: string): string | undefined {
    const map: Record<string, string> = {
      'chat_sessions': 'sessionId',
      'patient_records': 'id',
      'clinical_files': 'id',
      'pattern_analyses': 'analysisId',
      'fichas_clinicas': 'fichaId',
      'user_preferences': 'userId'
    };
    return map[store];
  }

  /**
   * Mark migration as complete for user/device
   */
  private async markMigrationComplete(userId: string, deviceId: string): Promise<void> {
    const migrationRecord = {
      userId,
      deviceId,
      completedAt: new Date(),
      version: '1.0.0',
      _system: true
    };

    await this.localStorage.create('migration_status', migrationRecord);
    loggers.storage.info('Migration marked as complete', { userId, deviceId });
  }

  /**
   * Rollback migration using backup data
   */
  public async rollbackMigration(backup: MigrationBackup): Promise<void> {
    loggers.storage.info('Starting migration rollback', { 
      userId: backup.userId, 
      deviceId: backup.deviceId,
      timestamp: backup.timestamp 
    });

    try {
      let backupData = backup.data;
      
      // Decrypt if encrypted
      if (backupData.encrypted && backupData.data) {
        // Necesitamos obtener la contraseña de algún lugar - usaremos una contraseña temporal
        // En producción, esto debería venir de una configuración segura
        const password = process.env.ENCRYPTION_PASSWORD || 'aurora-default-password';
        const decrypted = await this.encryption.decrypt(
          backupData.data.data,
          password,
          backupData.data.salt,
          backupData.data.iv,
          backupData.data.tag
        );
        backupData = JSON.parse(decrypted);
      }

      // Restore each entity type
      for (const [entityType, entities] of Object.entries(backupData)) {
        if (Array.isArray(entities)) {
          for (const entity of entities) {
            // Remove migration flags
            const { _migrated, _migratedAt, ...originalData } = entity;
            
            // Restore to local storage
            await this.localStorage.update(entityType, { id: originalData.id }, originalData);
          }
        }
      }

      // Remove migration status
      await this.localStorage.delete('migration_status', { userId: backup.userId });

      loggers.storage.info('Rollback completed successfully', { 
        userId: backup.userId, 
        deviceId: backup.deviceId 
      });

    } catch (error) {
      loggers.storage.error('Rollback failed', { error, backup });
      throw error;
    }
  }

  /**
   * Calculate checksum for data integrity
   */
  private calculateChecksum(data: any): string {
    // Simple checksum implementation - can be enhanced
    const dataString = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if migration has been completed for current user/device
   */
  static async isMigrationComplete(userId?: string): Promise<boolean> {
    try {
      const effectiveUserId = userId || getEffectiveUserId();
      const deviceId = getDeviceId();
      
      const localStorage = new EnhancedIndexedDBAdapter({
        enableEncryption: true,
        maxRetryAttempts: 3,
        syncInterval: 30000,
        offlineTimeout: 60000
      });
      await localStorage.initialize(effectiveUserId);
      
      const migrationStatus = await localStorage.find('migration_status', {
        userId: effectiveUserId,
        deviceId
      });

      return migrationStatus.length > 0;
    } catch (error) {
      loggers.storage.error('Failed to check migration status', { error });
      return false;
    }
  }

  /**
   * Get migration history for current user
   */
  static async getMigrationHistory(userId?: string): Promise<Array<{timestamp: Date, status: string, details: any}>> {
    try {
      const effectiveUserId = userId || getEffectiveUserId();
      
      const localStorage = new EnhancedIndexedDBAdapter({
        enableEncryption: true,
        maxRetryAttempts: 3,
        syncInterval: 30000,
        offlineTimeout: 60000
      });
      await localStorage.initialize(effectiveUserId);
      
      const backups = await localStorage.find('migration_backups', { userId: effectiveUserId });
      const status = await localStorage.find('migration_status', { userId: effectiveUserId });

      const history = [
        ...backups.map((backup: any) => ({
          timestamp: backup.timestamp,
          status: 'backup_created',
          details: {
            deviceId: backup.deviceId,
            checksum: backup.checksum
          }
        })),
        ...status.map((record: any) => ({
          timestamp: record.completedAt,
          status: 'migration_completed',
          details: {
            deviceId: record.deviceId,
            version: record.version
          }
        }))
      ];

      return history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      loggers.storage.error('Failed to get migration history', { error });
      return [];
    }
  }
}

export default LocalDataMigrator;
