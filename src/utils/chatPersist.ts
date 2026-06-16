import type {
  AudioAttachment,
  ChatSession,
  FileAttachment,
  ImageAttachment,
  Message,
  VideoAttachment,
} from '../types';

/** Безопасный If-Match для optimistic lock; при null бэкенд обновляет без проверки версии. */
export function getChatIfMatchIso(session: ChatSession): string | null {
  const raw = session.serverUpdatedAt ?? session.updatedAt;
  if (raw == null) return null;
  const d = raw instanceof Date ? raw : new Date(raw as string | number);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Убрать base64 из вложений перед записью в БД (остаются только URL). */
export function stripSessionForRemote(session: ChatSession): Omit<ChatSession, 'serverUpdatedAt'> {
  const { serverUpdatedAt: _ignored, ...rest } = session;
  return {
    ...rest,
    messages: session.messages.map(stripMessageForRemote),
  };
}

function stripMessageForRemote(m: Message): Message {
  const { uploadingAttachments: _u, ...rest } = m;
  const out: Message = { ...rest };
  if (out.images?.length) {
    out.images = out.images.map(stripImage);
  }
  if (out.files?.length) {
    out.files = out.files.map(stripFile);
  }
  if (out.video?.length) {
    out.video = out.video.map(stripVideo);
  }
  if (out.audio?.length) {
    out.audio = out.audio.map(stripAudio).filter((a): a is AudioAttachment => a !== null);
  }
  if (out.audio?.length === 0) {
    const { audio: _a, ...rest } = out;
    return rest;
  }
  return out;
}

function stripImage(img: ImageAttachment): ImageAttachment {
  if (img.url) {
    return { type: 'url', url: img.url, mimeType: img.mimeType };
  }
  return { type: 'url', url: '', mimeType: img.mimeType };
}

function stripFile(f: FileAttachment): FileAttachment {
  if (f.url) {
    return {
      type: 'url',
      url: f.url,
      mimeType: f.mimeType,
      filename: f.filename,
      size: f.size,
    };
  }
  return {
    type: 'url',
    url: '',
    mimeType: f.mimeType,
    filename: f.filename,
    size: f.size,
  };
}

function stripVideo(v: VideoAttachment): VideoAttachment {
  if (v.url.startsWith('http')) {
    return { type: 'url', url: v.url };
  }
  return { type: 'url', url: v.url };
}

function stripAudio(a: AudioAttachment): AudioAttachment | null {
  if (a.url) {
    return { type: 'url', url: a.url, format: a.format, filename: a.filename };
  }
  return null;
}
