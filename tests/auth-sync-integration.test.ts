/**
 * Test de integración completa: Autenticación + Sincronización + Almacenamiento Híbrido
 * 
 * Este test valida el flujo completo de:
 * 1. Autenticación de usuario
 * 2. Inicialización de adaptadores de almacenamiento
 * 3. Operaciones CRUD en almacenamiento local (IndexedDB)
 * 4. Sincronización con almacenamiento remoto (API)
 * 5. Manejo de conflictos y resolución
 * 6. Gestión de estado offline/online
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { AuthService } from '@/lib/auth/auth-service'
import { SyncOrchestrator } from '@/lib/sync/sync-orchestrator'
import { EnhancedIndexedDBAdapter } from '@/lib/storage/enhanced-indexeddb-adapter'
import { APIClientAdapter } from '@/lib/storage/api-client-adapter'
import { setCurrentUserId, clearCurrentUserId, getEffectiveUserId } from '@/lib/user-identity'
import { ChatState, PatientRecord, ClinicalFile } from '@/types/clinical-types'
import { SyncMetadata } from '@/lib/storage/unified-storage-interface'

// Mock de fetch para simular API
const mockFetch = vi.fn()
global.fetch = mockFetch as any

// Helper para crear datos de prueba
function createTestChatState(sessionId: string, title: string = 'Test Session'): ChatState {
  return {
    sessionId,
    userId: 'user-123',
    mode: 'therapeutic_assistance',
      activeAgent: 'clinico',
    history: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hola, necesito ayuda con mi ansiedad',
        timestamp: new Date()
      },
      {
        id: 'msg-2',
        role: 'model',
        content: 'Entiendo que estás experimentando ansiedad. ¿Podrías contarme más sobre cómo te sientes?',
        timestamp: new Date()
      }
    ],
    title,
    metadata: {
      createdAt: new Date(),
      lastUpdated: new Date(),
      totalTokens: 100,
      fileReferences: []
    },
    clinicalContext: {
      patientId: 'patient-123',
      sessionType: 'individual_therapy',
      confidentialityLevel: 'high'
    }
  }
}

function createTestPatientRecord(patientId: string): PatientRecord {
  return {
    id: patientId,
    displayName: 'María González',
    demographics: {
      ageRange: '30-40',
      gender: 'female',
      occupation: 'Profesional',
      location: 'Ciudad'
    },
    tags: ['ansiedad', 'terapia-individual'],
    notes: 'Paciente con trastorno de ansiedad generalizada',
    attachments: [],
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

function createTestClinicalFile(fileId: string): ClinicalFile {
  return {
    id: fileId,
    name: 'informe_psicologico.pdf',
    type: 'application/pdf',
    size: 1024000,
    uploadDate: new Date(),
    status: 'processed'
  }
}

describe('Flujo Completo: Autenticación y Sincronización', () => {
  let authService: AuthService
  let syncOrchestrator: SyncOrchestrator
  let localStorage: EnhancedIndexedDBAdapter
  let remoteStorage: APIClientAdapter

  beforeAll(() => {
    // No limpiar aquí - localStorage no está inicializado todavía
    clearCurrentUserId()
  })

  beforeEach(() => {
    // Resetear mocks y estado
    vi.clearAllMocks()
    mockFetch.mockReset()
    
    // Reset singleton instances to ensure clean state for each test
    SyncOrchestrator.resetInstance()
    
    // Inicializar servicios
    authService = AuthService.getInstance()
    syncOrchestrator = SyncOrchestrator.getInstance()
    
    // Habilitar API real para que use fetch
    authService.enableRealApi()
    
    // Mock de respuestas de API exitosas por defecto
    mockFetch.mockImplementation((url: string, options: any) => {
      const method = options?.method || 'GET'
      
      // Respuestas mock según endpoint
      if (url.includes('/api/auth/login')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            user: {
              id: 'user-123',
              email: 'test@example.com',
              name: 'Test User',
              role: 'therapist'
            },
            tokens: {
              access: 'mock-access-token',
              refresh: 'mock-refresh-token'
            },
            deviceId: 'device-123'
          })
        })
      }
      
      if (url.includes('/api/storage/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      })
    })
  })

  afterEach(async () => {
    // Limpiar después de cada test
    try {
      // First reset sync state to clear all flags
      syncOrchestrator.resetSyncState()
      // Then stop sync to ensure no background processes
      await syncOrchestrator.stopSync()
    } catch (error) {
      // Ignorar errores de limpieza
    }
    clearCurrentUserId()
    // Clear IndexedDB if initialized
    if (localStorage && typeof localStorage.clearAllData === 'function') {
      await localStorage.clearAllData()
    }
    // Reset singleton instance to ensure clean state for next test
    SyncOrchestrator.resetInstance()
  })

  describe('1. Autenticación de Usuario', () => {
    it('debe autenticar usuario exitosamente', async () => {
      // Act
      const result = await authService.login('test@example.com', 'password123')
      
      // Assert
      expect(result).toBeDefined()
      expect(result.user).toBeDefined()
      expect(result.user.email).toBe('test@example.com')
      expect(result.tokens).toBeDefined()
      expect(result.tokens.access).toBe('mock-access-token')
      expect(result.deviceId).toBeDefined()
      
      // Verificar que el user ID está establecido
      const userId = getEffectiveUserId()
      expect(userId).toBe('user-123')
    })

    it('debe manejar error de autenticación', async () => {
      // Mock de respuesta de error
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: 'Invalid credentials' })
        })
      )
      
      // Act & Assert
      await expect(authService.login('wrong@example.com', 'wrongpass'))
        .rejects.toThrow()
    })
  })

  describe('2. Inicialización de Almacenamiento', () => {
    it('debe inicializar el sistema de sincronización después de autenticación', async () => {
      // Arrange
      await authService.login('test@example.com', 'password123')
      
      // Act
      await syncOrchestrator.initialize('mock-access-token')
      
      // Assert - el sistema debería estar inicializado
      expect(getEffectiveUserId()).toBe('user-123')
    })

    it('debe crear instancias de almacenamiento local y remoto', async () => {
      // Arrange
      await authService.login('test@example.com', 'password123')
      
      // Act
      localStorage = new EnhancedIndexedDBAdapter({
        enableEncryption: true,
        maxRetryAttempts: 3,
        syncInterval: 30000,
        offlineTimeout: 60000
      })
      
      remoteStorage = new APIClientAdapter(
        'http://localhost:3000/api',
        'mock-access-token',
        {
          enableEncryption: true,
          maxRetryAttempts: 3,
          syncInterval: 30000,
          offlineTimeout: 60000
        }
      )
      
      // Initialize local storage with user ID to avoid "Database not initialized" error
      const userId = getEffectiveUserId()
      await localStorage.initialize(userId)
      
      // Assert - las instancias deberían crearse sin errores
      expect(localStorage).toBeDefined()
      expect(remoteStorage).toBeDefined()
    })
  })

  describe('3. Operaciones de Almacenamiento Local', () => {
    it('debe guardar y recuperar sesión de chat en almacenamiento local', async () => {
      // Arrange
      await authService.login('test@example.com', 'password123')
      const userId = getEffectiveUserId()
      await localStorage.initialize(userId)
      
      const testSession = createTestChatState('session-001', 'Primera Sesión')
      
      // Act
      await localStorage.saveChatSession(testSession)
      const retrievedSession = await localStorage.loadChatSession('session-001')
      
      // Assert
      expect(retrievedSession).toBeDefined()
      expect(retrievedSession?.sessionId).toBe('session-001')
      expect(retrievedSession?.title).toBe('Primera Sesión')
      expect(retrievedSession?.history).toHaveLength(2)
    })

    it('debe guardar y recuperar registro de paciente en almacenamiento local', async () => {
      // Arrange
      await authService.login('test@example.com', 'password123')
      const userId = getEffectiveUserId()
      await localStorage.initialize(userId)
      
      const testPatient = createTestPatientRecord('patient-001')
      
      // Act
      await localStorage.savePatientRecord(testPatient)
      const retrievedPatient = await localStorage.loadPatientRecord('patient-001')
      
      // Assert
      expect(retrievedPatient).toBeDefined()
      expect(retrievedPatient?.id).toBe('patient-001')
      expect(retrievedPatient?.displayName).toBe('María González')
      expect(retrievedPatient?.notes).toBe('Paciente con trastorno de ansiedad generalizada')
    })

    it('debe rastrear cambios en almacenamiento local', async () => {
      // Arrange
      await authService.login('test@example.com', 'password123')
      const userId = getEffectiveUserId()
      await localStorage.initialize(userId)
      
      const testSession = createTestChatState('session-002', 'Segunda Sesión')
      const oneHourAgo = new Date(Date.now() - 3600000)
      
      // Act - guardar sesión
      await localStorage.saveChatSession(testSession)
      
      // Obtener cambios desde hace una hora
      const changes = await localStorage.getChangesSince(oneHourAgo)
      
      // Assert
      expect(changes).toBeDefined()
      expect(changes.length).toBeGreaterThan(0)
      
      const sessionChange = changes.find(c => c.entityId === 'session-002')
      expect(sessionChange).toBeDefined()
      expect(sessionChange?.operation).toBe('create')
      expect(sessionChange?.entityType).toBe('chat')
    })
  })

  describe('4. Sincronización entre Almacenamiento Local y Remoto', () => {
    it('debe sincronizar nueva sesión de chat con el servidor', async () => {
      // Arrange
      await authService.login('test@example.com', 'password123')
      await syncOrchestrator.initialize('mock-access-token')
      
      const testSession = createTestChatState('session-003', 'Sesión a Sincronizar')
      
      // Mock de respuesta exitosa del servidor
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })
      )
      
      // Act
      await localStorage.saveChatSession(testSession)
      await syncOrchestrator.forceSync()
      
      // Assert - verificar que se llamó a la API
      expect(mockFetch).toHaveBeenCalled()
      const syncCall = mockFetch.mock.calls.find(call => 
        call[0].includes('/api/storage/chat-sessions')
      )
      expect(syncCall).toBeDefined()
    })

    it('debe manejar escenario offline y sincronizar al volver online', async () => {
      // Arrange
      await authService.login('test@example.com', 'password123')
      await syncOrchestrator.initialize('mock-access-token')
      
      const testSession = createTestChatState('session-004', 'Sesión Offline')
      
      // Simular fallo de red (offline)
      mockFetch.mockImplementationOnce(() => 
        Promise.reject(new Error('Network error'))
      )
      
      // Act - guardar mientras está offline
      await localStorage.saveChatSession(testSession)
      
      let syncResult: any
      try {
        syncResult = await syncOrchestrator.forceSync()
      } catch (error) {
        // Se espera que falle la sincronización
      }
      
      // Verificar que hay operaciones pendientes
      const pendingOps = await localStorage.getPendingOperations()
      expect(pendingOps.length).toBeGreaterThan(0)
      
      // Simular reconexión - mock exitoso
      mockFetch.mockImplementation(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })
      )
      
      // Intentar sincronización nuevamente
      syncResult = await syncOrchestrator.forceSync()
      
      // Assert
      expect(syncResult.success).toBe(true)
    })

    it('debe detectar y resolver conflictos de sincronización', async () => {
      // Arrange
      await authService.login('test@example.com', 'password123')
      await syncOrchestrator.initialize('mock-access-token')
      
      const sessionId = 'session-conflict-001'
      
      // Crear versión local
      const localSession = createTestChatState(sessionId, 'Título Local')
      await localStorage.saveChatSession(localSession)
      
      // Simular que el servidor tiene una versión diferente (via changes endpoint)
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/storage/changes')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              {
                id: 'change-001',
                operation: 'update',
                timestamp: new Date(Date.now() + 1000), // Más reciente
                data: {
                  sessionId,
                  title: 'Título del Servidor',
                  messages: [],
                  metadata: { conflict: true },
                  createdAt: new Date(),
                  updatedAt: new Date(Date.now() + 1000)
                },
                userId: 'user-123',
                deviceId: 'device-123',
                checksum: 'server-checksum',
                entityType: 'chat'
              }
            ])
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })
      
      // Act - forzar sincronización
      const syncResult = await syncOrchestrator.forceSync()
      
      // Debug: Log the sync result to understand why it's failing
      console.log('Sync result:', JSON.stringify(syncResult, null, 2))
      console.log('Sync result details:', {
        success: syncResult.success,
        error: syncResult.error,
        changesProcessed: syncResult.changesProcessed,
        conflictsDetected: syncResult.conflictsDetected,
        conflictsResolved: syncResult.conflictsResolved
      })
      
      // Assert - debería detectar conflicto
      expect(syncResult.success).toBe(true)
      
      // Verificar que se llamó a resolución de conflictos
      const conflictCall = mockFetch.mock.calls.find(call => 
        call[0].includes('/api/storage/conflicts/resolve')
      )
      expect(conflictCall).toBeDefined()
    })
  })

  describe('5. Gestión de Estado y Métricas', () => {
    it('debe proporcionar estadísticas de almacenamiento', async () => {
      // Arrange
      await authService.login('test@example.com', 'password123')
      const userId = getEffectiveUserId()
      await localStorage.initialize(userId)
      
      // Crear múltiples registros
      await localStorage.saveChatSession(createTestChatState('session-stats-1'))
      await localStorage.saveChatSession(createTestChatState('session-stats-2'))
      await localStorage.savePatientRecord(createTestPatientRecord('patient-stats-1'))
      await localStorage.saveClinicalFile(createTestClinicalFile('file-stats-1'))
      
      // Act
      const stats = await localStorage.getStorageStats()
      
      // Assert
      expect(stats).toBeDefined()
      expect(stats.entityCounts.chats).toBeGreaterThanOrEqual(2)
      expect(stats.entityCounts.patients).toBeGreaterThanOrEqual(1)
      expect(stats.entityCounts.files).toBeGreaterThanOrEqual(1)
      expect(stats.isEncrypted).toBe(true)
      expect(stats.pendingOperations).toBeDefined()
    })

    it('debe manejar cierre de sesión y limpieza', async () => {
      // Arrange
      await authService.login('test@example.com', 'password123')
      await syncOrchestrator.initialize('mock-access-token')
      
      // Crear algunos datos
      await localStorage.saveChatSession(createTestChatState('session-logout'))
      
      // Act
      await syncOrchestrator.stopSync()
      clearCurrentUserId()
      
      // Assert
      const userId = getEffectiveUserId()
      expect(userId).not.toBe('user-123')
      
      // El sistema de sincronización debería estar detenido
      expect(syncOrchestrator).toBeDefined()
    })
  })

  describe('6. Escenarios de Error y Recuperación', () => {
    it('debe manejar errores de autenticación y recuperarse', async () => {
      // Mock de error de autenticación
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: 'Invalid credentials' })
        })
      )
      
      // Act & Assert - primer intento falla
      await expect(authService.login('wrong@example.com', 'wrongpass'))
        .rejects.toThrow()
      
      // Mock de autenticación exitosa
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            user: {
              id: 'user-recovered',
              email: 'recovered@example.com',
              name: 'Recovered User',
              role: 'therapist'
            },
            tokens: {
              accessToken: 'recovered-token',
              refreshToken: 'recovered-refresh'
            },
            deviceId: 'device-recovered'
          })
        })
      )
      
      // Segundo intento exitoso
      const result = await authService.login('recovered@example.com', 'correctpass')
      expect(result.user.email).toBe('recovered@example.com')
    })

    it('debe manejar errores de red y reintentar sincronización', async () => {
      // Arrange
      await authService.login('test@example.com', 'password123')
      await syncOrchestrator.initialize('mock-access-token')
      
      const testSession = createTestChatState('session-retry-001')
      await localStorage.saveChatSession(testSession)
      
      // Mock de fallos seguidos por éxito
      let callCount = 0
      mockFetch.mockImplementation((url: string) => {
        callCount++
        // Make the metadata call fail first to trigger retry
        if (url.includes('/api/storage/metadata') && callCount <= 2) {
          return Promise.reject(new Error('Network timeout'))
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })
      })
      
      // Act - forzar sincronización (debería reintentar)
      const syncResult = await syncOrchestrator.forceSync()
      
      // Debug: Log the network retry results
      console.log('Network retry test - callCount:', callCount)
      console.log('Network retry test - syncResult:', JSON.stringify(syncResult, null, 2))
      
      // Assert - debería haber reintentado y eventualmente tener éxito
      expect(callCount).toBeGreaterThan(1)
      expect(syncResult.success).toBe(true)
    })
  })
})