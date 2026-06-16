import type {
  AudioAttachment,
  FileAttachment,
  ImageAttachment,
  VideoAttachment,
} from '../types';
import { uploadChatAttachmentBase64 } from '../services/chatAttachmentService';

function parseDataUrl(dataUrl: string): { mime: string; base64: string } {
  const m = dataUrl.match(/^data:([^;,]+)[^,]*;base64,(.+)$/);
  if (!m) {
    throw new Error('Некорректный data URL вложения');
  }
  return { mime: m[1] || 'application/octet-stream', base64: m[2] || '' };
}

/** Сколько вложений уйдёт в Storage при нормализации (для прогресса UI). */
export function countCloudAttachmentUploads(
  userId: string | undefined,
  images?: ImageAttachment[],
  files?: FileAttachment[],
  video?: VideoAttachment[],
  audio?: AudioAttachment[]
): number {
  if (!userId) return 0;
  let n = 0;
  if (images) {
    for (const img of images) {
      if (img.type === 'base64' && img.data && img.mimeType) n++;
    }
  }
  if (files) {
    for (const f of files) {
      if (f.type === 'base64' && f.data && f.mimeType) n++;
    }
  }
  if (video) {
    for (const v of video) {
      if (!v.url.startsWith('http://') && !v.url.startsWith('https://')) n++;
    }
  }
  if (audio) {
    for (const a of audio) {
      if (a.data && a.format) n++;
    }
  }
  return n;
}

export type AttachmentUploadProgress = { completed: number; total: number };

/**
 * Загружает base64-вложения в Storage и возвращает те же структуры с type: url.
 * Локальный режим (!userId) оставляет base64 как есть.
 */
export async function normalizeAttachmentsForCloud(
  userId: string | undefined,
  sessionId: string,
  images?: ImageAttachment[],
  files?: FileAttachment[],
  video?: VideoAttachment[],
  audio?: AudioAttachment[],
  onProgress?: (completed: number, total: number) => void
): Promise<{
  images?: ImageAttachment[];
  files?: FileAttachment[];
  video?: VideoAttachment[];
  audio?: AudioAttachment[];
}> {
  if (!userId) {
    return { images, files, video, audio };
  }

  const total = countCloudAttachmentUploads(userId, images, files, video, audio);
  let completed = 0;
  const bump = () => {
    completed++;
    if (total > 0) onProgress?.(completed, total);
  };

  const outImages = images?.length
    ? await Promise.all(
        images.map(async (img) => {
          if (img.type === 'url' && img.url) return img;
          if (img.type === 'base64' && img.data && img.mimeType) {
            const { url, mimeType } = await uploadChatAttachmentBase64(
              sessionId,
              img.mimeType,
              img.data
            );
            bump();
            return { type: 'url' as const, url, mimeType };
          }
          return img;
        })
      )
    : undefined;

  const outFiles = files?.length
    ? await Promise.all(
        files.map(async (f) => {
          if (f.type === 'url' && f.url) return f;
          if (f.type === 'base64' && f.data && f.mimeType) {
            const { url } = await uploadChatAttachmentBase64(sessionId, f.mimeType, f.data, f.filename);
            bump();
            return {
              type: 'url' as const,
              url,
              mimeType: f.mimeType,
              filename: f.filename,
              size: f.size,
            };
          }
          return f;
        })
      )
    : undefined;

  const outVideo = video?.length
    ? await Promise.all(
        video.map(async (v) => {
          if (v.url.startsWith('http://') || v.url.startsWith('https://')) return v;
          if (v.url.startsWith('data:')) {
            const { mime, base64 } = parseDataUrl(v.url);
            const { url } = await uploadChatAttachmentBase64(sessionId, mime, base64, 'video.bin');
            bump();
            return { type: 'url' as const, url };
          }
          return v;
        })
      )
    : undefined;

  const outAudio = audio?.length
    ? await Promise.all(
        audio.map(async (a) => {
          if (a.data && a.format) {
            const mime = a.format === 'wav' ? 'audio/wav' : 'audio/mpeg';
            const { url } = await uploadChatAttachmentBase64(sessionId, mime, a.data, a.filename);
            bump();
            return { type: 'url' as const, url, format: a.format, filename: a.filename };
          }
          if (a.url) return a;
          return a;
        })
      )
    : undefined;

  return {
    images: outImages,
    files: outFiles,
    video: outVideo,
    audio: outAudio,
  };
}
