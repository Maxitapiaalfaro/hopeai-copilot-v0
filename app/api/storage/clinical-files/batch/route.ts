import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth/middleware';
import { userIdentityFromRequest } from '@/lib/auth/server-identity';
import { databaseService } from '@/lib/database';

export async function POST(request: NextRequest) {
  const authError = await authMiddleware(request);
  if (authError) return authError;

  const user = (request as any).user;
  const identity = await userIdentityFromRequest(request);
  const userId = identity?.userId || user?.id;
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  await databaseService.initialize();

  let payload: any;
  try {
    payload = await request.json();
  } catch (e) {
    return NextResponse.json({ success: false, message: 'Invalid JSON payload' }, { status: 400 });
  }

  const files: any[] = Array.isArray(payload?.files) ? payload.files : Array.isArray(payload) ? payload : [];
  if (!files.length) {
    return NextResponse.json({ success: false, message: 'No files provided' }, { status: 400 });
  }

  const now = new Date();
  let savedCount = 0;
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const file of files) {
    if (!file?.id) {
      results.push({ id: String(file?.id ?? ''), ok: false, error: 'Missing id' });
      continue;
    }

    const update: any = {
      fileName: file.name,
      originalName: file.name,
      mimeType: file.type,
      size: file.size ?? 0,
      sessionId: file.sessionId,
      metadata: {
        uploadDate: file.uploadDate ?? now,
        status: file.status,
        processingStatus: file.processingStatus,
        summary: file.summary,
        outline: file.outline,
        keywords: file.keywords ?? [],
        geminiFileId: file.geminiFileId,
        geminiFileUri: file.geminiFileUri,
      },
      updatedAt: now,
      isActive: true,
    };

    try {
      await databaseService.files.updateOne(
        { fileId: file.id, userId },
        {
          $set: update,
          $setOnInsert: {
            fileId: file.id,
            userId,
            checksum: file.checksum ?? '',
            createdAt: now,
            isActive: true,
          },
        },
        { upsert: true }
      );
      savedCount += 1;
      results.push({ id: file.id, ok: true });
    } catch (err: any) {
      results.push({ id: file.id, ok: false, error: err?.message ?? 'Failed to save' });
    }
  }

  return NextResponse.json({ success: true, data: { savedCount, results } });
}