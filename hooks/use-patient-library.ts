"use client"

import { useState, useEffect, useCallback } from "react"
import type { PatientRecord } from "@/types/clinical-types"
import { getPatientPersistence } from "@/lib/patient-persistence"
import { PatientSummaryBuilder } from "@/lib/patient-summary-builder"

export interface UsePatientLibraryReturn {
  // State
  patients: PatientRecord[]
  isLoading: boolean
  error: string | null
  searchQuery: string
  filteredPatients: PatientRecord[]
  selectedPatient: PatientRecord | null
  
  // Actions
  loadPatients: () => Promise<void>
  createPatient: (patient: Omit<PatientRecord, "id" | "createdAt" | "updatedAt">) => Promise<PatientRecord>
  updatePatient: (patient: PatientRecord) => Promise<void>
  deletePatient: (patientId: string) => Promise<void>
  searchPatients: (query: string) => void
  selectPatient: (patient: PatientRecord | null) => void
  refreshPatientSummary: (patientId: string) => Promise<void>
  
  // Utilities
  getPatientCount: () => number
  clearError: () => void
}

/**
 * Hook for managing patient library operations
 * Provides CRUD operations and search functionality for patient records
 */
export function usePatientLibrary(): UsePatientLibraryReturn {
  const [patients, setPatients] = useState<PatientRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null)
  
  const persistence = getPatientPersistence()

  // Initialize persistence on mount
  useEffect(() => {
    const initializePersistence = async () => {
      try {
        await persistence.initialize()
        await loadPatients()
      } catch (err) {
        console.error("Failed to initialize patient persistence:", err)
        setError("Failed to initialize patient library")
      }
    }

    initializePersistence()
  }, [])

  /**
   * Load all patients from storage
   */
  const loadPatients = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const loadedPatients = await persistence.getAllPatients()
      setPatients(loadedPatients)
    } catch (err) {
      console.error("Failed to load patients:", err)
      setError("Failed to load patients")
    } finally {
      setIsLoading(false)
    }
  }, [persistence])

  /**
   * Create a new patient record
   */
  const createPatient = useCallback(async (
    patientData: Omit<PatientRecord, "id" | "createdAt" | "updatedAt">
  ): Promise<PatientRecord> => {
    setError(null)
    
    try {
      const now = new Date()
      const newPatient: PatientRecord = {
        ...patientData,
        id: generatePatientId(),
        createdAt: now,
        updatedAt: now
      }

      // Generate initial summary cache
      if (!newPatient.summaryCache) {
        newPatient.summaryCache = PatientSummaryBuilder.buildAndCache(newPatient)
      }

      await persistence.savePatientRecord(newPatient)
      await loadPatients() // Refresh the list
      
      return newPatient
    } catch (err) {
      console.error("Failed to create patient:", err)
      setError("Failed to create patient")
      throw err
    }
  }, [persistence, loadPatients])

  /**
   * Update an existing patient record
   */
  const updatePatient = useCallback(async (patient: PatientRecord) => {
    setError(null)
    
    try {
      const updatedPatient = {
        ...patient,
        updatedAt: new Date()
      }

      // Regenerate summary cache if needed
      if (!PatientSummaryBuilder.isCacheValid(updatedPatient)) {
        updatedPatient.summaryCache = PatientSummaryBuilder.buildAndCache(updatedPatient)
      }

      await persistence.savePatientRecord(updatedPatient)
      await loadPatients() // Refresh the list
      
      // Update selected patient if it's the one being updated
      if (selectedPatient?.id === patient.id) {
        setSelectedPatient(updatedPatient)
      }
    } catch (err) {
      console.error("Failed to update patient:", err)
      setError("Failed to update patient")
      throw err
    }
  }, [persistence, loadPatients, selectedPatient])

  /**
   * Delete a patient record
   */
  const deletePatient = useCallback(async (patientId: string) => {
    setError(null)
    
    try {
      await persistence.deletePatientRecord(patientId)
      await loadPatients() // Refresh the list
      
      // Clear selection if deleted patient was selected
      if (selectedPatient?.id === patientId) {
        setSelectedPatient(null)
      }
    } catch (err) {
      console.error("Failed to delete patient:", err)
      setError("Failed to delete patient")
      throw err
    }
  }, [persistence, loadPatients, selectedPatient])

  /**
   * Search patients by query
   */
  const searchPatients = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  /**
   * Select a patient for detailed view or operations
   */
  const selectPatient = useCallback((patient: PatientRecord | null) => {
    setSelectedPatient(patient)
  }, [])

  /**
   * Refresh patient summary cache
   */
  const refreshPatientSummary = useCallback(async (patientId: string) => {
    setError(null)
    
    try {
      const patient = await persistence.loadPatientRecord(patientId)
      if (!patient) {
        throw new Error("Patient not found")
      }

      const newSummaryCache = PatientSummaryBuilder.buildAndCache(patient)
      await persistence.updatePatientSummaryCache(patientId, newSummaryCache)
      await loadPatients() // Refresh the list
    } catch (err) {
      console.error("Failed to refresh patient summary:", err)
      setError("Failed to refresh patient summary")
      throw err
    }
  }, [persistence, loadPatients])

  /**
   * Get patient count
   */
  const getPatientCount = useCallback(() => {
    return patients.length
  }, [patients])

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Filter patients based on search query
  const filteredPatients = searchQuery.trim() 
    ? patients.filter(patient => {
        const query = searchQuery.toLowerCase()
        return (
          patient.displayName.toLowerCase().includes(query) ||
          patient.tags?.some(tag => tag.toLowerCase().includes(query)) ||
          patient.notes?.toLowerCase().includes(query)
        )
      })
    : patients

  return {
    // State
    patients,
    isLoading,
    error,
    searchQuery,
    filteredPatients,
    selectedPatient,
    
    // Actions
    loadPatients,
    createPatient,
    updatePatient,
    deletePatient,
    searchPatients,
    selectPatient,
    refreshPatientSummary,
    
    // Utilities
    getPatientCount,
    clearError
  }
}

/**
 * Generate a unique patient ID
 */
function generatePatientId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 8)
  return `patient_${timestamp}_${randomPart}`
}

/**
 * Hook for managing a single patient record
 */
export function usePatientRecord(patientId: string | null) {
  const [patient, setPatient] = useState<PatientRecord | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const persistence = getPatientPersistence()

  useEffect(() => {
    if (!patientId) {
      setPatient(null)
      return
    }

    const loadPatient = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        await persistence.initialize()
        const loadedPatient = await persistence.loadPatientRecord(patientId)
        setPatient(loadedPatient)
      } catch (err) {
        console.error("Failed to load patient:", err)
        setError("Failed to load patient")
      } finally {
        setIsLoading(false)
      }
    }

    loadPatient()
  }, [patientId, persistence])

  return {
    patient,
    isLoading,
    error,
    clearError: () => setError(null)
  }
}