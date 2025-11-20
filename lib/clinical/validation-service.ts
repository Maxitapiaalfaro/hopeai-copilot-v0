import { SessionRecord, Patient, File as FileModel } from "@/lib/database/models";

type ChangeEntityType = "patient" | "session" | "file";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface ChangeEnvelope {
  entityType: ChangeEntityType;
  operation: "create" | "update" | "delete";
  changes: any;
}

const MAX_NOTES_LENGTH = 10000; // Soft safeguard for clinical notes
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
const ALLOWED_SESSION_TYPES = [
  "individual",
  "couples",
  "family",
  "group",
  "assessment",
  "follow_up",
];

function isString(value: any): value is string {
  return typeof value === "string";
}

function safeString(input: any, maxLength: number): { valid: boolean; value?: string; error?: string } {
  if (!isString(input)) {
    return { valid: false, error: "Expected a string" };
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "String cannot be empty" };
  }
  if (trimmed.length > maxLength) {
    return { valid: false, error: `String exceeds maximum length of ${maxLength}` };
  }
  return { valid: true, value: trimmed };
}

function validatePatient(change: ChangeEnvelope): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const data: Partial<Patient> = change.changes || {};

  if (change.operation !== "delete") {
    const nameCheck = safeString((data as any)?.basicInfo?.name, 512);
    if (!nameCheck.valid) errors.push(`basicInfo.name: ${nameCheck.error}`);

    // Optional identifiers
    if ((data as any)?.basicInfo?.identifiers) {
      const identifiers = (data as any).basicInfo.identifiers;
      if (!Array.isArray(identifiers)) {
        errors.push("basicInfo.identifiers must be an array");
      } else if (identifiers.length > 20) {
        warnings.push("Too many identifiers (>20) may be excessive");
      }
    }

    // Clinical info sanity
    if ((data as any)?.clinicalInfo?.diagnosis) {
      const dx = (data as any).clinicalInfo.diagnosis;
      if (!Array.isArray(dx)) {
        errors.push("clinicalInfo.diagnosis must be an array");
      } else if (dx.length > 10) {
        warnings.push("clinicalInfo.diagnosis has >10 entries; review necessity");
      }
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}

function validateSession(change: ChangeEnvelope): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const data: Partial<SessionRecord> = change.changes || {};

  if (change.operation !== "delete") {
    if (!data.date || isNaN(new Date(data.date).getTime())) {
      errors.push("date must be a valid ISO date string");
    }

    const duration = Number((data as any)?.duration ?? 0);
    if (!Number.isFinite(duration) || duration <= 0) {
      errors.push("duration must be a positive number of minutes");
    } else if (duration > 480) {
      warnings.push("duration > 480 minutes; verify correctness");
    }

    const type = (data as any)?.type;
    if (!ALLOWED_SESSION_TYPES.includes(String(type))) {
      errors.push(`type must be one of: ${ALLOWED_SESSION_TYPES.join(", ")}`);
    }

    if ((data as any)?.notes) {
      const noteCheck = safeString((data as any).notes, MAX_NOTES_LENGTH);
      if (!noteCheck.valid) errors.push(`notes: ${noteCheck.error}`);
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}

function validateFile(change: ChangeEnvelope): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const data: Partial<FileModel> = change.changes || {};

  if (change.operation !== "delete") {
    const size = Number((data as any)?.size ?? 0);
    if (!Number.isFinite(size) || size <= 0) {
      errors.push("size must be a positive number");
    } else if (size > MAX_FILE_SIZE_BYTES) {
      errors.push(`size must be <= ${MAX_FILE_SIZE_BYTES} bytes`);
    }

    const originalNameCheck = safeString((data as any)?.originalName, 512);
    if (!originalNameCheck.valid) errors.push(`originalName: ${originalNameCheck.error}`);

    const mimeTypeCheck = safeString((data as any)?.mimeType, 128);
    if (!mimeTypeCheck.valid) errors.push(`mimeType: ${mimeTypeCheck.error}`);
    else {
      const mime = mimeTypeCheck.value!;
      const allowedPrefixes = ["image/", "application/pdf", "audio/", "text/"];
      if (!allowedPrefixes.some((p) => mime.startsWith(p))) {
        warnings.push("Uncommon mimeType; ensure appropriate handling");
      }
    }

    if (change.operation === "create" && !(data as any)?.checksum) {
      errors.push("checksum is required for file creation");
    }

    const fileName = (data as any)?.fileName;
    if (isString(fileName)) {
      if (fileName.includes("..") || fileName.includes("\\") || fileName.includes("/")) {
        errors.push("fileName contains invalid path characters");
      }
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}

export class ClinicalValidationService {
  validateChange(change: ChangeEnvelope): ValidationResult {
    switch (change.entityType) {
      case "patient":
        return validatePatient(change);
      case "session":
        return validateSession(change);
      case "file":
        return validateFile(change);
      default:
        return { isValid: false, errors: ["Unknown entityType"] };
    }
  }

  validatePatientData(data: Partial<Patient>): ValidationResult {
    return validatePatient({ entityType: "patient", operation: "update", changes: data });
  }

  validateSessionRecord(data: Partial<SessionRecord>): ValidationResult {
    return validateSession({ entityType: "session", operation: "update", changes: data });
  }

  validateFileData(data: Partial<FileModel>): ValidationResult {
    return validateFile({ entityType: "file", operation: "update", changes: data });
  }
}

export const clinicalValidationService = new ClinicalValidationService();