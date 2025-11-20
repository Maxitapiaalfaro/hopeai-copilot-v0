/**
 * Setup global para tests con Vitest
 * Proporciona mocks y configuración necesaria para el entorno de testing
 */

import { vi } from 'vitest'
import 'fake-indexeddb/auto' // Esto proporciona IndexedDB completo

// Asegurar que IndexedDB esté disponible globalmente
if (typeof global.indexedDB === 'undefined') {
  // Si por alguna razón no se cargó, usar el mock básico
  const fakeIndexedDB = require('fake-indexeddb')
  global.indexedDB = fakeIndexedDB
  global.IDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange')
  global.IDBTransaction = require('fake-indexeddb/lib/FDBTransaction')
  global.IDBObjectStore = require('fake-indexeddb/lib/FDBObjectStore')
  global.IDBIndex = require('fake-indexeddb/lib/FDBIndex')
  global.IDBCursor = require('fake-indexeddb/lib/FDBCursor')
  global.IDBDatabase = require('fake-indexeddb/lib/FDBDatabase')
  global.IDBRequest = require('fake-indexeddb/lib/FDBRequest')
  global.IDBOpenDBRequest = require('fake-indexeddb/lib/FDBOpenDBRequest')
  global.IDBVersionChangeEvent = require('fake-indexeddb/lib/FDBVersionChangeEvent')
}

// Mock de localStorage si no está disponible
if (typeof localStorage === 'undefined') {
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn()
  }
  global.localStorage = localStorageMock as any
}

// Mock de sessionStorage si no está disponible
if (typeof sessionStorage === 'undefined') {
  const sessionStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn()
  }
  global.sessionStorage = sessionStorageMock as any
}

// Mock de window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock de IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any

// Mock de ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any

console.log('✅ Setup de tests inicializado - Mocks globales configurados')