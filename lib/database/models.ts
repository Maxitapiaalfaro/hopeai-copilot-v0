export interface User {
  _id?: string;
  userId: string;
  email: string;
  name: string;
  role: 'psychologist' | 'admin';
  isActive: boolean;
  devices: Device[];
  encryptionKey?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  preferences?: UserPreferences;
  // OAuth fields
  oauthProvider?: 'google' | 'github' | 'auth0';
  oauthId?: string;
  avatar?: string;
}

export interface Device {
  deviceId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  lastSeenAt: Date;
  isActive: boolean;
  pushToken?: string;
  metadata?: Record<string, any>;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    push: boolean;
    clinicalAlerts: boolean;
  };
  clinical: {
    defaultSessionDuration: number;
    autoSaveInterval: number;
    backupFrequency: 'daily' | 'weekly' | 'monthly';
  };
}

export interface Session {
  _id?: string;
  sessionId: string;
  userId: string;
  deviceId: string;
  token: string;
  refreshToken: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
  isActive: boolean;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  lastActivityAt: Date;
}

export interface Patient {
  _id?: string;
  patientId: string;
  userId: string;
  deviceId: string;
  basicInfo: {
    name: string;
    dateOfBirth?: Date;
    gender?: 'male' | 'female' | 'other';
    phone?: string;
    email?: string;
    address?: string;
    emergencyContact?: {
      name: string;
      phone: string;
      relationship: string;
    };
  };
  clinicalInfo: {
    diagnosis?: string[];
    treatmentPlan?: string;
    medications?: string[];
    allergies?: string[];
    medicalHistory?: string[];
  };
  sessions: SessionRecord[];
  files: string[]; // Array of fileIds
  metadata?: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastSessionAt?: Date;
}

export interface SessionRecord {
  sessionId: string;
  date: Date;
  duration: number;
  type: 'individual' | 'group' | 'couple' | 'family';
  notes?: string;
  nextAppointment?: Date;
  billingCode?: string;
}

export interface File {
  _id?: string;
  fileId: string;
  userId: string;
  patientId?: string;
  sessionId?: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  checksum: string;
  encryptionMetadata?: {
    algorithm: string;
    keyId: string;
    iv: string;
  };
  metadata?: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChangeLog {
  _id?: string;
  changeId: string;
  userId: string;
  deviceId: string;
  entityType: 'patient' | 'session' | 'file' | 'user';
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  changes: Record<string, any>;
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
  timestamp: Date;
  syncStatus: 'pending' | 'synced' | 'failed';
  retryCount: number;
  lastError?: string;
}

export interface SyncConflict {
  _id?: string;
  conflictId: string;
  userId: string;
  entityType: 'patient' | 'session' | 'file';
  entityId: string;
  localChange: ChangeLog;
  serverChange: ChangeLog;
  conflictType: 'timestamp' | 'field_merge' | 'clinical_priority' | 'user_intent';
  resolutionStrategy?: string;
  resolvedValue?: Record<string, any>;
  isResolved: boolean;
  resolvedBy?: 'system' | 'user';
  resolutionNotes?: string;
  timestamp: Date;
  resolvedAt?: Date;
}

// Chat session document stored in MongoDB (encrypted)
export interface ChatSessionDoc {
  _id?: string;
  sessionId: string;
  userId: string;
  patientId?: string;
  encryptedData: Buffer; // AES-256-GCM encrypted ChatState JSON
  checksum: string;      // SHA256 checksum of decrypted ChatState
  messageCount: number;
  totalTokens: number;
  createdAt: Date;
  lastUpdated: Date;
  mode: string;         // ClinicalMode
  activeAgent: string;  // AgentType
}

// Failed write log for recovery attempts
export interface FailedChatSessionDoc {
  _id?: string;
  sessionId: string;
  userId: string;
  reason: string;       // e.g., 'checksum_mismatch', 'decrypt_or_parse_error'
  lastError?: string;
  createdAt: Date;
  retryCount?: number;
  lastAttemptAt?: Date;
}