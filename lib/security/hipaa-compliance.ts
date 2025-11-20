import { Patient, SessionRecord, File as FileModel } from "@/lib/database/models";

type Entity = "patient" | "session" | "file";

function stripSystemFields<T extends Record<string, any>>(obj: T): T {
  const cleaned = { ...obj };
  delete (cleaned as any)._id;
  delete (cleaned as any).id;
  delete (cleaned as any).userId; // ownership is server-controlled
  delete (cleaned as any).deviceId; // provenance is server-controlled
  delete (cleaned as any).createdAt;
  delete (cleaned as any).updatedAt;
  return cleaned;
}

function pick<T extends Record<string, any>>(obj: T, allowed: string[]): T {
  const out: Record<string, any> = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) out[key] = (obj as any)[key];
  }
  return out as T;
}

function trimStrings<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") out[k] = v.trim();
    else if (Array.isArray(v)) out[k] = v.map((x) => (typeof x === "string" ? x.trim() : x));
    else if (v && typeof v === "object") out[k] = trimStrings(v as any);
    else out[k] = v;
  }
  return out as T;
}

export class HIPAAComplianceService {
  // Restrict writable fields per entity, trim strings, remove system fields
  sanitizeForStorage(entity: Entity, changes: any): any {
    const cleaned = trimStrings(stripSystemFields(changes || {}));

    if (entity === "patient") {
      return pick(cleaned, [
        "basicInfo",
        "clinicalInfo",
        "sessions",
        "files",
        "metadata",
        "isActive",
        "lastSessionAt",
      ]);
    }

    if (entity === "session") {
      return pick(cleaned, [
        "patientId",
        "date",
        "duration",
        "type",
        "notes",
        "nextAppointment",
        "billingCode",
      ]);
    }

    if (entity === "file") {
      return pick(cleaned, [
        "fileName",
        "originalName",
        "mimeType",
        "size",
        "checksum",
        "encryptionMetadata",
        "metadata",
        "isActive",
      ]);
    }

    return cleaned;
  }
}

export const hipaaComplianceService = new HIPAAComplianceService();