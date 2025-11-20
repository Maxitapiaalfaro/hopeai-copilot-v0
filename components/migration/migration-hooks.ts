/**
 * Migration Hooks
 * 
 * React hooks for managing migration state and operations
 */

import { useState, useEffect, useCallback } from 'react';
import { useHopeAISystem } from '@/hooks/use-hopeai-system';
import { LocalDataMigrator } from '@/lib/migration/local-data-migrator';
import { ProgressiveRollout } from '@/lib/migration/progressive-rollout';
import { EnhancedIndexedDBAdapter } from '@/lib/storage/enhanced-indexeddb-adapter';
import { APIClientAdapter } from '@/lib/storage/api-client-adapter';
import authService from '@/lib/auth/auth-service';

export interface MigrationState {
  isEligible: boolean;
  isMigrated: boolean;
  isProcessing: boolean;
  queueStatus?: {
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
    priority: number;
    attempts: number;
    requestedAt: string;
  };
  error?: string;
  lastMigration?: {
    id: string;
    status: 'completed' | 'failed' | 'rolled_back';
    startedAt: string;
    completedAt?: string;
    entitiesMigrated?: number;
    sizeInBytes?: number;
  };
}

export interface UseMigrationReturn {
  state: MigrationState;
  requestMigration: () => Promise<void>;
  checkStatus: () => Promise<void>;
  isLoading: boolean;
}

/**
 * Hook for managing user migration state
 */
export function useMigration(): UseMigrationReturn {
  const { systemState } = useHopeAISystem();
  const [state, setState] = useState<MigrationState>({
    isEligible: false,
    isMigrated: false,
    isProcessing: false
  });
  const [isLoading, setIsLoading] = useState(true);

  // Check migration status
  const checkStatus = useCallback(async () => {
    if (!systemState.userId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // Create storage adapters
      const localStorage = new EnhancedIndexedDBAdapter({
        enableEncryption: true,
        maxRetryAttempts: 3,
        syncInterval: 30000,
        offlineTimeout: 60000
      });
      await localStorage.initialize(systemState.userId);

      // Get authentication token from auth service
      const tokens = authService.getCurrentTokens();
      const authToken = tokens?.access || '';

      const remoteStorage = new APIClientAdapter(
        process.env.NEXT_PUBLIC_API_URL || '/api',
        authToken,
        {
          enableEncryption: true,
          maxRetryAttempts: 3,
          syncInterval: 30000,
          offlineTimeout: 60000
        }
      );

      // Create rollout instance
      const rollout = new ProgressiveRollout(localStorage, remoteStorage, {
        enabled: true,
        rolloutPercentage: 100,
        maxConcurrentMigrations: 5,
        migrationCooldownHours: 24,
        autoRollbackOnFailure: true
      });
      await rollout.initialize();

      // Check if user is eligible for migration
      const isEligible = await rollout.isUserEligible(systemState.userId);
      
      // Check migration status
      const isMigrated = await LocalDataMigrator.isMigrationComplete();
      
      // Get queue status if applicable
      let queueStatus;
      if (!isMigrated && isEligible) {
        const queueStatusArray = await rollout.getQueueStatus();
        queueStatus = queueStatusArray.find(item => item.userId === systemState.userId);
      }
      
      // Get last migration history
      const history = await LocalDataMigrator.getMigrationHistory();
      const lastMigration = history.length > 0 ? {
        id: `${history[0].timestamp.getTime()}`,
        status: history[0].status === 'migration_completed' ? 'completed' as const : 'failed' as const,
        startedAt: history[0].timestamp.toISOString(),
        completedAt: history[0].timestamp.toISOString(),
        entitiesMigrated: history[0].details?.entitiesMigrated || 0,
        sizeInBytes: history[0].details?.sizeInBytes || 0
      } : undefined;

      setState({
        isEligible,
        isMigrated,
        isProcessing: queueStatus?.status === 'processing',
        queueStatus: queueStatus ? {
          status: queueStatus.status,
          priority: queueStatus.priority,
          attempts: queueStatus.attempts,
          requestedAt: queueStatus.requestedAt instanceof Date ? queueStatus.requestedAt.toISOString() : queueStatus.requestedAt
        } : undefined,
        lastMigration
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to check migration status'
      }));
    } finally {
      setIsLoading(false);
    }
  }, [systemState.userId]);

  // Request migration
  const requestMigration = useCallback(async () => {
    if (!systemState.userId) return;

    try {
      setState(prev => ({ ...prev, isProcessing: true }));
      
      // Get authentication token
      const tokens = await authService.getCurrentTokens();
      const authToken = tokens?.access || '';
      
      // Create storage adapters
      const localStorage = new EnhancedIndexedDBAdapter({
        enableEncryption: true,
        maxRetryAttempts: 3,
        syncInterval: 30000,
        offlineTimeout: 60000
      });
      await localStorage.initialize(systemState.userId);

      const remoteStorage = new APIClientAdapter(
        process.env.NEXT_PUBLIC_API_URL || '/api',
        authToken,
        {
          enableEncryption: true,
          maxRetryAttempts: 3,
          syncInterval: 30000,
          offlineTimeout: 60000
        }
      );

      // Create rollout instance
      const rollout = new ProgressiveRollout(localStorage, remoteStorage, {
        enabled: true,
        rolloutPercentage: 100,
        maxConcurrentMigrations: 5,
        migrationCooldownHours: 24,
        autoRollbackOnFailure: true
      });
      await rollout.initialize();

      // Request migration with priority
      const success = await rollout.requestMigration(5);
      
      // Check status after request
      await checkStatus();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to request migration',
        isProcessing: false
      }));
    }
  }, [systemState.userId, checkStatus]);

  // Initial status check
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Poll for status updates when processing
  useEffect(() => {
    if (!state.isProcessing) return;

    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [state.isProcessing, checkStatus]);

  return {
    state,
    requestMigration,
    checkStatus,
    isLoading
  };
}

/**
 * Hook for monitoring migration progress
 */
export function useMigrationProgress(userId?: string) {
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    percentage: 0,
    stage: 'idle'
  });
  const [isActive, setIsActive] = useState(false);
  const { systemState } = useHopeAISystem();
  const MIGRATION_ENABLED = typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_MIGRATION_ENABLED === 'true') : true

  useEffect(() => {
    if (!userId) return;
    if (!MIGRATION_ENABLED) return;
    // Pausar polling si el chat está en transición (streaming activo)
    if (systemState.transitionState !== 'idle') return;

    const checkProgress = async () => {
      try {
        const tokens = authService.getCurrentTokens();
        const authToken = tokens?.access || '';
        let attempt = 0;
        let delay = 200;
        let data: any = null;
        while (true) {
          const response = await fetch('/api/migration/status', {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
            credentials: 'include'
          });
          if (response.status === 401) {
            throw new Error('Unauthorized');
          }
          if (response.status === 429 || response.status >= 500) {
            if (attempt >= 4) throw new Error(`HTTP ${response.status}`);
            await new Promise(r => setTimeout(r, delay + Math.floor(Math.random() * 50)));
            attempt++;
            delay = Math.min(delay * 2, 2000);
            continue;
          }
          data = await response.json();
          break;
        }
        
        if (data.isMigrated) {
          setIsActive(false);
          setProgress({
            current: 100,
            total: 100,
            percentage: 100,
            stage: 'completed'
          });
        } else if (data.queuePosition !== undefined && data.queuePosition > 0) {
          setIsActive(true);
          setProgress({
            current: 0,
            total: 1,
            percentage: 0,
            stage: 'queued'
          });
        } else {
          setIsActive(false);
          setProgress({
            current: 0,
            total: 0,
            percentage: 0,
            stage: 'idle'
          });
        }
      } catch (error) {
        console.error('Failed to check migration progress:', error);
      }
    };

    checkProgress();
    
    if (isActive && systemState.transitionState === 'idle') {
      const interval = setInterval(checkProgress, 5000);
      return () => clearInterval(interval);
    }
  }, [userId, isActive, systemState.transitionState]);

  return { progress, isActive };
}

/**
 * Hook for managing migration notifications
 */
export function useMigrationNotifications() {
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
  }>>([]);

  const addNotification = useCallback((notification: Omit<typeof notifications[0], 'id' | 'timestamp'>) => {
    setNotifications(prev => [{
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date()
    }, ...prev]);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Listen for migration events
  useEffect(() => {
    const handleMigrationEvent = (event: CustomEvent) => {
      const { type, data } = event.detail;
      
      switch (type) {
        case 'migration_started':
          addNotification({
            type: 'info',
            title: 'Migration Started',
            message: 'Your data migration has begun. This may take a few minutes.',
            read: false
          });
          break;
          
        case 'migration_completed':
          addNotification({
            type: 'success',
            title: 'Migration Completed',
            message: `Successfully migrated ${data.entitiesMigrated} entities to the cloud.`,
            read: false
          });
          break;
          
        case 'migration_failed':
          addNotification({
            type: 'error',
            title: 'Migration Failed',
            message: data.error || 'Migration failed. Please try again.',
            read: false
          });
          break;
          
        case 'migration_rolled_back':
          addNotification({
            type: 'warning',
            title: 'Migration Rolled Back',
            message: 'Your migration has been rolled back to maintain data integrity.',
            read: false
          });
          break;
      }
    };

    window.addEventListener('migration-event', handleMigrationEvent as EventListener);
    
    return () => {
      window.removeEventListener('migration-event', handleMigrationEvent as EventListener);
    };
  }, [addNotification]);

  return {
    notifications,
    unreadCount: notifications.filter(n => !n.read).length,
    addNotification,
    markAsRead,
    clearNotifications
  };
}

/**
 * Hook for managing migration settings
 */
export function useMigrationSettings() {
  const [settings, setSettings] = useState({
    autoBackup: true,
    encryptionEnabled: true,
    compressionEnabled: true,
    batchSize: 100,
    retryAttempts: 3,
    migrationTimeout: 300000 // 5 minutes
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = localStorage.getItem('migration-settings');
        if (savedSettings) {
          setSettings(JSON.parse(savedSettings));
        }
      } catch (error) {
        console.error('Failed to load migration settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const updateSetting = useCallback(async (key: keyof typeof settings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    try {
      localStorage.setItem('migration-settings', JSON.stringify(newSettings));
      
      // Apply settings to migrator (we'll need to create a new instance with updated settings)
      // For now, just save to localStorage
    } catch (error) {
      console.error('Failed to update migration settings:', error);
    }
  }, [settings]);

  return {
    settings,
    updateSetting,
    isLoading
  };
}
