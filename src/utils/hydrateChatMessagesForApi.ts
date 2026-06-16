import type { Message, AudioAttachment, VideoAttachment } from '../types';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/** Лимит тела запроса к прокси (~32 MiB JSON); data URL даёт накладные ~33% на base64 */
const MAX_VIDEO_HYDRATE_BYTES = 24 * 1024 * 1024;

function guessVideoMimeFromUrl(url: string): string {
  const u = url.split('?')[0]?.toLowerCase() ?? '';
  if (u.endsWith('.webm')) return 'video/webm';
  if (u.endsWith('.mov')) return 'video/quicktime';
  if (u.endsWith('.mpeg') || u.endsWith('.mpg')) return 'video/mpeg';
  return 'video/mp4';
}

/** Для Gemini и др. AITUNNEL сам тянет YouTube; не качаем в браузер. */
function isYouTubeStyleVideoUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.includes('youtube.com') || h === 'youtu.be';
  } catch {
    return false;
  }
}

async function hydrateAudioParts(audio: AudioAttachment[]): Promise<AudioAttachment[]> {
  return Promise.all(
    audio.map(async (a) => {
      if (a.data && a.format) return a;
      if (a.url && a.format && a.type === 'url') {
        const res = await fetch(a.url);
        if (!res.ok) {
          throw new Error(
            `Не удалось загрузить аудио для отправки в модель (${res.status}). Проверьте доступ к файлу в Storage.`
          );
        }
        const data = arrayBufferToBase64(await res.arrayBuffer());
        return { type: 'base64' as const, data, format: a.format, filename: a.filename };
      }
      return a;
    })
  );
}

/**
 * AITUNNEL подтягивает video_url сами; публичный URL вашего Supabase с их серверов часто даёт 404.
 * Скачиваем в браузере и подставляем data: — как в доке AITUNNEL по base64.
 */
async function hydrateVideoParts(video: VideoAttachment[]): Promise<VideoAttachment[]> {
  return Promise.all(
    video.map(async (v) => {
      if (!v.url) return v;
      if (v.url.startsWith('data:')) return v;
      if (v.url.startsWith('http://') || v.url.startsWith('https://')) {
        if (isYouTubeStyleVideoUrl(v.url)) return v;
        const res = await fetch(v.url);
        if (!res.ok) {
          throw new Error(
            `Не удалось загрузить видео для отправки в модель (${res.status}). Проверьте, что bucket в Storage публичный или откройте доступ на чтение.`
          );
        }
        const len = res.headers.get('content-length');
        if (len && Number(len) > MAX_VIDEO_HYDRATE_BYTES) {
          throw new Error(
            'Видео слишком большое для отправки одним запросом. Сожмите файл или укоротите ролик.'
          );
        }
        const buf = await res.arrayBuffer();
        if (buf.byteLength > MAX_VIDEO_HYDRATE_BYTES) {
          throw new Error(
            'Видео слишком большое для отправки одним запросом. Сожмите файл или укоротите ролик.'
          );
        }
        const base64 = arrayBufferToBase64(buf);
        const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || guessVideoMimeFromUrl(v.url);
        return { type: 'url' as const, url: `data:${mime};base64,${base64}` };
      }
      return v;
    })
  );
}

/** Сообщения из БД: аудио/видео по URL подгружаются здесь — в API уходят форматы, ожидаемые AITUNNEL. */
export async function hydrateMessagesForApi(messages: Message[]): Promise<Message[]> {
  return Promise.all(messages.map(hydrateMessageForApi));
}

async function hydrateMessageForApi(m: Message): Promise<Message> {
  let out: Message = { ...m };
  if (m.audio?.length) {
    out = { ...out, audio: await hydrateAudioParts(m.audio) };
  }
  if (m.video?.length) {
    out = { ...out, video: await hydrateVideoParts(m.video) };
  }
  return out;
}
