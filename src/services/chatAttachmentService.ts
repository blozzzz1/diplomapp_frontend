import { getAuthToken } from '../config/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export async function uploadChatAttachmentBase64(
  sessionId: string,
  mimeType: string,
  base64: string,
  filename?: string
): Promise<{ url: string; mimeType: string }> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Требуется авторизация для вложений');
  }

  const response = await fetch(`${API_BASE_URL}/api/chat/attachments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId, mimeType, base64, filename }),
  });

  const text = await response.text().catch(() => '');
  if (!response.ok) {
    let msg = text || `HTTP ${response.status}`;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* use msg */
    }
    throw new Error(msg);
  }

  const data = JSON.parse(text) as { url: string; mimeType?: string };
  if (!data.url) {
    throw new Error('Сервер не вернул URL вложения');
  }
  return { url: data.url, mimeType: data.mimeType || mimeType };
}
