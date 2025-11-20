import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { JWTManager } from '@/lib/auth/jwt-manager';

export type IdentitySource = 'bearer' | 'nextauth';

export interface ServerIdentity {
  userId: string;
  deviceId?: string;
  email?: string;
  role?: string;
  source: IdentitySource;
}

/**
 * Derives server-side identity from the request.
 * Priority:
 * 1) Authorization: Bearer token verified via JWTManager (device-bound)
 * 2) NextAuth getToken() for authenticated web flows
 */
export async function userIdentityFromRequest(req: NextRequest): Promise<ServerIdentity | null> {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring('Bearer '.length).trim();
      if (token) {
        const jwt = JWTManager.getInstance();
        try {
          const payload = await jwt.verifyAccessToken(token);
          return {
            userId: payload.userId,
            deviceId: payload.deviceId,
            source: 'bearer',
          };
        } catch {
          // fall through to NextAuth
        }
      }
    }

    // Fallback to NextAuth token (JWT strategy)
    const nextAuthToken = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET || 'your-secret-key',
    });
    if (nextAuthToken && nextAuthToken.id) {
      return {
        userId: nextAuthToken.id as string,
        deviceId: (nextAuthToken as any).deviceId as string | undefined,
        email: nextAuthToken.email as string | undefined,
        role: nextAuthToken.role as string | undefined,
        source: 'nextauth',
      };
    }

    return null;
  } catch (err) {
    return null;
  }
}