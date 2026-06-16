import { getAuthToken } from '../config/api';
import { ChatSession, Message } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

function mapSession(
  raw: ChatSession & { createdAt: string | Date; updatedAt: string | Date; messageCount?: number }
): ChatSession {
  const updatedAt = raw.updatedAt ? new Date(raw.updatedAt) : new Date();
  const messages = (raw.messages || []).map((msg) => ({
    ...msg,
    timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
  }));
  return {
    ...raw,
    messages,
    messageCount:
      messages.length > 0
        ? messages.length
        : typeof raw.messageCount === 'number' && Number.isFinite(raw.messageCount)
          ? raw.messageCount
          : undefined,
    createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
    updatedAt,
    serverUpdatedAt: updatedAt,
  };
}

export class ChatService {
  static async createSession(userId: string, title: string, selectedModel: string): Promise<{ session: ChatSession | null; error: string | null }> {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { session: null, error: 'Требуется авторизация' };
      }
      const response = await fetch(`${API_BASE_URL}/api/chat/sessions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, selectedModel }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { session: null, error: (data as { error?: string }).error || response.statusText };
      }
      const payload = data as { session?: ChatSession };
      if (!payload.session) {
        return { session: null, error: 'Invalid response from server' };
      }
      return { session: mapSession(payload.session as Parameters<typeof mapSession>[0]), error: null };
    } catch (error) {
      console.error('Error creating session:', error);
      return {
        session: null,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  }

  static async updateSession(
    session: Omit<ChatSession, 'serverUpdatedAt'>,
    ifMatchUpdatedAt: string | null
  ): Promise<{ error: string | null; conflict?: boolean; updatedAt?: Date }> {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { error: 'Требуется авторизация' };
      }

      const response = await fetch(`${API_BASE_URL}/api/chat/sessions/${session.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: session.id,
          title: session.title,
          selectedModel: session.selectedModel,
          messages: session.messages,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          ...(ifMatchUpdatedAt ? { ifMatchUpdatedAt } : {}),
        }),
      });

      if (response.status === 409) {
        return { error: 'Конфликт версии сессии', conflict: true };
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { error: (err as { error?: string }).error || response.statusText };
      }

      const data = (await response.json()) as {
        session?: ChatSession & { updatedAt?: string | Date; updated_at?: string };
      };
      const raw = data.session?.updatedAt ?? data.session?.updated_at;
      const u = raw !== undefined && raw !== null ? new Date(raw as string | Date) : undefined;
      return { error: null, updatedAt: u && !Number.isNaN(u.getTime()) ? u : undefined };
    } catch (error) {
      console.error('Error updating session:', error);
      return {
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  }

  static async deleteSession(sessionId: string): Promise<{ error: string | null }> {
    try {
      const token = await getAuthToken();
      if (!token) return { error: 'Требуется авторизация' };
      const response = await fetch(`${API_BASE_URL}/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { error: (err as { error?: string }).error || response.statusText };
      }
      return { error: null };
    } catch (error) {
      console.error('Error deleting session:', error);
      return {
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  }

  static async getUserSessions(): Promise<{ sessions: ChatSession[]; error: string | null }> {
    try {
      const token = await getAuthToken();
      if (!token) return { sessions: [], error: 'Требуется авторизация' };
      const response = await fetch(`${API_BASE_URL}/api/chat/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { sessions: [], error: (data as { error?: string }).error || response.statusText };
      }
      const payload = data as { sessions: Parameters<typeof mapSession>[0][] };
      const sessions = (payload.sessions || []).map(mapSession);
      return { sessions, error: null };
    } catch (error) {
      console.error('Error fetching sessions:', error);
      return {
        sessions: [],
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  }

  static async requestReply(
    sessionId: string,
    userMessage: Message,
    model: string,
    apiMessages: Array<{ role: string; content: unknown }>
  ): Promise<{
    session: ChatSession | null;
    error: string | null;
    inProgress?: boolean;
    code?: string;
  }> {
    try {
      const token = await getAuthToken();
      if (!token) return { session: null, error: 'Требуется авторизация' };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 130_000);

      const response = await fetch(`${API_BASE_URL}/api/chat/sessions/${sessionId}/reply`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userMessage, model, apiMessages }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      const data = await response.json().catch(() => ({}));
      const payload = data as {
        session?: Parameters<typeof mapSession>[0];
        error?: string;
        code?: string;
      };

      if (response.status === 409 && payload.code === 'REPLY_IN_PROGRESS' && payload.session) {
        return {
          session: mapSession(payload.session),
          error: null,
          inProgress: true,
          code: payload.code,
        };
      }

      if (!response.ok) {
        return {
          session: payload.session ? mapSession(payload.session) : null,
          error: payload.error || response.statusText,
          code: payload.code,
        };
      }

      if (!payload.session) {
        return { session: null, error: 'Invalid response from server' };
      }
      return { session: mapSession(payload.session), error: null };
    } catch (error) {
      console.error('Error requesting reply:', error);
      return {
        session: null,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  }

  static async getSession(sessionId: string): Promise<{ session: ChatSession | null; error: string | null }> {
    try {
      const token = await getAuthToken();
      if (!token) return { session: null, error: 'Требуется авторизация' };
      const response = await fetch(`${API_BASE_URL}/api/chat/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { session: null, error: (data as { error?: string }).error || response.statusText };
      }
      const payload = data as { session?: Parameters<typeof mapSession>[0] };
      if (!payload.session) return { session: null, error: 'Session not found' };
      return { session: mapSession(payload.session), error: null };
    } catch (error) {
      console.error('Error fetching session:', error);
      return {
        session: null,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  }
}
