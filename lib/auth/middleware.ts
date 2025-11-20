import { NextRequest, NextResponse } from 'next/server';
import { userIdentityFromRequest } from '@/lib/auth/server-identity';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    role: string;
    deviceId?: string;
  };
}

export async function authMiddleware(request: NextRequest) {
  const identity = await userIdentityFromRequest(request);
  if (!identity) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Add user info to request (includes deviceId when available)
  (request as any).user = {
    id: identity.userId,
    email: identity.email || '',
    role: identity.role || 'user',
    deviceId: identity.deviceId,
  };

  return null; // Continue to next middleware
}

export function requireRole(allowedRoles: string[]) {
  return async (request: NextRequest) => {
    const user = (request as any).user;
    
    if (!user || !allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }
    
    return null;
  };
}