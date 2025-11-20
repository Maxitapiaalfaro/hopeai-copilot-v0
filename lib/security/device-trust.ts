import { DatabaseService } from "@/lib/database/database-service";
import { auditLog } from "@/lib/security/audit-logger";

export interface DeviceTrust {
  trusted: boolean;
  trustScore: number; // simplistic score for now
  reason?: string;
}

export class DeviceTrustService {
  private static db: DatabaseService | null = null;

  private static async getDb(): Promise<DatabaseService> {
    if (!this.db) {
      this.db = new DatabaseService();
      await this.db.initialize();
    }
    return this.db;
  }

  static async ensureDeviceRegistered(
    userId: string,
    deviceId: string,
    deviceName?: string,
    deviceType?: string
  ) {
    if (!userId || !deviceId) return;
    const db = await this.getDb();

    const user = await db.users.findOne({ userId });
    if (!user) return;

    const existing = (user.devices || []).find((d: any) => d.deviceId === deviceId);
    if (!existing) {
      const normalizedDeviceType: 'desktop' | 'mobile' | 'tablet' =
        deviceType && (deviceType === 'desktop' || deviceType === 'mobile' || deviceType === 'tablet')
          ? (deviceType as 'desktop' | 'mobile' | 'tablet')
          : 'desktop';
      await db.users.updateOne(
        { userId },
        {
          $addToSet: {
            devices: {
              deviceId,
              deviceName: deviceName || "unknown",
              deviceType: normalizedDeviceType,
              lastSeenAt: new Date(),
              isActive: true,
              metadata: {},
            },
          },
        }
      );
      auditLog.userAction(userId, 'device_register', 'success', { deviceId });
    } else {
      await db.users.updateOne(
        { userId, "devices.deviceId": deviceId },
        { $set: { "devices.$.lastSeenAt": new Date(), updatedAt: new Date() } }
      );
      auditLog.userAction(userId, 'device_seen', 'success', { deviceId });
    }
  }

  static async getTrustLevel(userId: string, deviceId: string): Promise<DeviceTrust> {
    const db = await this.getDb();
    const user = await db.users.findOne({ userId });
    if (!user) return { trusted: false, trustScore: 0, reason: "user_not_found" };
    const device = (user.devices || []).find((d: any) => d.deviceId === deviceId);
    if (!device) return { trusted: false, trustScore: 10, reason: "device_unregistered" };
    if (device.isActive === false) return { trusted: false, trustScore: 20, reason: "device_revoked" };
    return { trusted: true, trustScore: 90 };
  }
}

export const deviceTrustService = DeviceTrustService;