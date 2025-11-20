/**
 * Script para inicializar MongoDB con datos de prueba y esquema completo
 * Ejecutar con: npx tsx scripts/init-mongodb.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { connectToDatabase, closeDatabaseConnection } from '../lib/database/mongodb'
import { databaseService } from '../lib/database'

// Cargar variables de entorno
config({ path: resolve(process.cwd(), '.env.local') })

async function initializeMongoDB() {
  console.log('🚀 Inicializando MongoDB con esquema Aurora...')
  
  try {
    // Conectar a MongoDB
    console.log('🔗 Conectando a MongoDB...')
    const db = await connectToDatabase()
    console.log('✅ Conexión establecida')

    // Inicializar el servicio de base de datos
    await databaseService.initialize()
    console.log('✅ Servicio de base de datos inicializado')

    // Crear usuarios de prueba
    console.log('👥 Creando usuarios de prueba...')
    const testUsers = [
      {
        userId: 'user_001',
        email: 'psicologo1@aurora.cl',
        name: 'Dr. María González',
        role: 'psychologist' as const,
        isActive: true,
        devices: [{
          deviceId: 'device_001',
          deviceName: 'MacBook Pro Oficina',
          deviceType: 'desktop' as const,
          lastSeenAt: new Date(),
          isActive: true,
        }],
        createdAt: new Date(),
        updatedAt: new Date(),
        preferences: {
          theme: 'light' as const,
          language: 'es',
          timezone: 'America/Santiago',
          notifications: {
            email: true,
            push: true,
            clinicalAlerts: true,
          },
          clinical: {
            defaultSessionDuration: 50,
            autoSaveInterval: 300,
            backupFrequency: 'daily' as const,
          },
        },
      },
      {
        userId: 'user_002',
        email: 'psicologo2@aurora.cl',
        name: 'Dr. Carlos Rodríguez',
        role: 'psychologist' as const,
        isActive: true,
        devices: [{
          deviceId: 'device_002',
          deviceName: 'iPad Consulta',
          deviceType: 'tablet' as const,
          lastSeenAt: new Date(),
          isActive: true,
        }],
        createdAt: new Date(),
        updatedAt: new Date(),
        preferences: {
          theme: 'dark' as const,
          language: 'es',
          timezone: 'America/Santiago',
          notifications: {
            email: false,
            push: true,
            clinicalAlerts: true,
          },
          clinical: {
            defaultSessionDuration: 45,
            autoSaveInterval: 600,
            backupFrequency: 'weekly' as const,
          },
        },
      },
    ]

    for (const user of testUsers) {
      await databaseService.users.insertOne(user)
      console.log(`✅ Usuario creado: ${user.email}`)
    }

    // Crear pacientes de prueba
    console.log('🏥 Creando pacientes de prueba...')
    const testPatients = [
      {
        patientId: 'patient_001',
        userId: 'user_001',
        deviceId: 'device_001',
        basicInfo: {
          name: 'Ana Martínez',
          dateOfBirth: new Date('1990-05-15'),
          gender: 'female' as const,
          phone: '+56912345678',
          email: 'ana.martinez@email.com',
          address: 'Av. Principal 123, Santiago',
          emergencyContact: {
            name: 'Juan Martínez',
            phone: '+56987654321',
            relationship: 'padre',
          },
        },
        clinicalInfo: {
          diagnosis: ['Ansiedad Generalizada', 'Trastorno de Sueño'],
          treatmentPlan: 'Terapia cognitivo-conductual, 12 sesiones',
          medications: ['Sertralina 50mg'],
          allergies: ['Penicilina'],
          medicalHistory: ['Cirugía apendicitis 2015'],
        },
        sessions: [{
          sessionId: 'session_001',
          date: new Date('2024-01-15'),
          duration: 50,
          type: 'individual' as const,
          notes: 'Primera sesión. Paciente muestra ansiedad moderada.',
          nextAppointment: new Date('2024-01-22'),
          billingCode: 'PSYCH_001',
        }],
        files: ['file_001'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSessionAt: new Date('2024-01-15'),
      },
      {
        patientId: 'patient_002',
        userId: 'user_001',
        deviceId: 'device_001',
        basicInfo: {
          name: 'Pedro Sánchez',
          dateOfBirth: new Date('1985-08-20'),
          gender: 'male' as const,
          phone: '+56923456789',
          email: 'pedro.sanchez@email.com',
          address: 'Calle Secundaria 456, Providencia',
          emergencyContact: {
            name: 'María Sánchez',
            phone: '+56998765432',
            relationship: 'hermana',
          },
        },
        clinicalInfo: {
          diagnosis: ['Depresión Leve'],
          treatmentPlan: 'Terapia interpersonal, 8 sesiones',
          medications: [],
          allergies: [],
          medicalHistory: ['Hipertensión controlada'],
        },
        sessions: [],
        files: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSessionAt: undefined,
      },
    ]

    for (const patient of testPatients) {
      await databaseService.patients.insertOne(patient)
      console.log(`✅ Paciente creado: ${patient.basicInfo.name}`)
    }

    // Crear archivos de prueba
    console.log('📁 Creando archivos de prueba...')
    const testFiles = [
      {
        fileId: 'file_001',
        userId: 'user_001',
        patientId: 'patient_001',
        sessionId: 'session_001',
        fileName: 'notas_ana_martinez_2024.pdf',
        originalName: 'notas_clinicas.pdf',
        mimeType: 'application/pdf',
        size: 1024000,
        checksum: 'sha256:abc123def456',
        encryptionMetadata: {
          algorithm: 'AES-256-GCM',
          keyId: 'key_001',
          iv: 'iv_123456789',
        },
        metadata: {
          category: 'clinical_notes',
          tags: ['ansiedad', 'primera_sesion'],
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    for (const file of testFiles) {
      await databaseService.files.insertOne(file)
      console.log(`✅ Archivo creado: ${file.fileName}`)
    }

    // Crear registros de cambios de prueba
    console.log('📝 Creando registros de cambios...')
    const testChanges = [
      {
        changeId: 'change_001',
        userId: 'user_001',
        deviceId: 'device_001',
        entityType: 'patient' as const,
        entityId: 'patient_001',
        operation: 'update' as const,
        changes: {
          'clinicalInfo.diagnosis': ['Ansiedad Generalizada', 'Trastorno de Sueño', 'Estrés Laboral'],
        },
        previousValues: {
          'clinicalInfo.diagnosis': ['Ansiedad Generalizada', 'Trastorno de Sueño'],
        },
        newValues: {
          'clinicalInfo.diagnosis': ['Ansiedad Generalizada', 'Trastorno de Sueño', 'Estrés Laboral'],
        },
        timestamp: new Date(),
        syncStatus: 'synced' as const,
        retryCount: 0,
      },
    ]

    for (const change of testChanges) {
      await databaseService.changeLogs.insertOne(change)
      console.log(`✅ Cambio registrado: ${change.changeId}`)
    }

    // Verificar estadísticas finales
    console.log('\n📊 Estadísticas de la base de datos:')
    const stats = {
      users: await databaseService.users.countDocuments(),
      patients: await databaseService.patients.countDocuments(),
      files: await databaseService.files.countDocuments(),
      changeLogs: await databaseService.changeLogs.countDocuments(),
      syncConflicts: await databaseService.syncConflicts.countDocuments(),
      sessions: await databaseService.sessions.countDocuments(),
    }

    Object.entries(stats).forEach(([collection, count]) => {
      console.log(`  ${collection}: ${count} documentos`)
    })

    console.log('\n✅ MongoDB inicializado exitosamente!')
    console.log('🎯 Datos de prueba creados para usuarios, pacientes, archivos y cambios')

  } catch (error) {
    console.error('❌ Error inicializando MongoDB:', error)
    throw error
  } finally {
    await closeDatabaseConnection()
    console.log('🔌 Conexión cerrada')
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  initializeMongoDB().catch(console.error)
}

export { initializeMongoDB }