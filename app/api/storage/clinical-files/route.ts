import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { authMiddleware } from '@/lib/auth/middleware';
import { userIdentityFromRequest } from '@/lib/auth/server-identity';
import { databaseService } from '@/lib/database';

// Helper: map DB File document to ClinicalFile shape expected by client
function mapDbFileToClinicalFile(doc: any) {
  return {
    id: doc.fileId,
    name: doc.fileName ?? doc.originalName,
    type: doc.mimeType,
    size: doc.size ?? 0,
    uploadDate: doc.metadata?.uploadDate ?? doc.createdAt,
    status: doc.metadata?.status,
    sessionId: doc.sessionId,
    processingStatus: doc.metadata?.processingStatus,
    summary: doc.metadata?.summary,
    outline: doc.metadata?.outline,
    keywords: doc.metadata?.keywords ?? [],
    geminiFileId: doc.metadata?.geminiFileId,
    geminiFileUri: doc.metadata?.geminiFileUri,
  };
}

export async function POST(request: NextRequest) {
  // Require authentication
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
  try {
    const hasId = !!payload?.id
    const hasFileId = !!payload?.fileId
    const hasNestedId = !!payload?.file?.id
    const size = typeof payload === 'object' ? Object.keys(payload || {}).length : 0
    console.info('Clinical-files POST payload shape', { hasId, hasFileId, hasNestedId, size })
  } catch {}

  // Expect a single ClinicalFile object in the payload
  let file = payload?.id ? payload : payload?.file ?? null;
  if (!file && payload?.fileId) {
    file = {
      id: payload.fileId,
      name: payload.fileName,
      type: payload.mimeType,
      size: payload.size,
      sessionId: payload.sessionId,
      status: payload?.metadata?.status,
      processingStatus: payload?.metadata?.processingStatus,
      summary: payload?.metadata?.summary,
      outline: payload?.metadata?.outline,
      keywords: payload?.metadata?.keywords,
      geminiFileId: payload?.metadata?.geminiFileId,
      geminiFileUri: payload?.metadata?.geminiFileUri,
    } as any
  }
  if (!file || !file.id) {
    const reason = !file ? 'no file payload' : 'missing id'
    return NextResponse.json({ success: false, message: `Invalid file payload: ${reason}` }, { status: 400 });
  }

  const now = new Date();
  const update: any = {
    fileName: file.name,
    originalName: file.name,
    mimeType: file.type,
    size: file.size ?? 0,
    sessionId: file.sessionId,
    // Optional fields stored under metadata to avoid schema mismatch
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
    const result = await databaseService.files.updateOne(
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

    // Return the upserted/updated file
    const saved = await databaseService.files.findOne({ fileId: file.id, userId });
    return NextResponse.json({ success: true, data: mapDbFileToClinicalFile(saved) });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message ?? 'Failed to save file' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const authError = await authMiddleware(request);
  if (authError) return authError;

  const user = (request as any).user;
  const identity = await userIdentityFromRequest(request);
  const userId = identity?.userId || user?.id;
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  await databaseService.initialize();

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId') ?? undefined;

  const query: any = { userId, isActive: true };
  if (sessionId) query.sessionId = sessionId;

  try {
    const cursor = databaseService.files.find(query).sort({ createdAt: -1 });
    const items = await cursor.toArray();
    const data = items.map(mapDbFileToClinicalFile);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message ?? 'Failed to fetch files' }, { status: 500 });
  }
}
