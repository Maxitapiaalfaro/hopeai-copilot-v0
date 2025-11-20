import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth/middleware';
import { userIdentityFromRequest } from '@/lib/auth/server-identity';
import { databaseService } from '@/lib/database';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await authMiddleware(request);
  if (authError) return authError;

  const user = (request as any).user;
  const identity = await userIdentityFromRequest(request);
  const userId = identity?.userId || user?.id;
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const resolved = await params;
  const fileId = resolved?.id;
  if (!fileId) {
    return NextResponse.json({ success: false, message: 'Missing file id' }, { status: 400 });
  }

  await databaseService.initialize();

  try {
    const result = await databaseService.files.updateOne(
      { fileId, userId },
      { $set: { isActive: false, updatedAt: new Date() } }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json({ success: false, message: 'File not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'File deleted' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message ?? 'Failed to delete file' }, { status: 500 });
  }
}