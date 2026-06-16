import { getAuthToken } from '../config/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export interface VideoGenerationRequest {
  model?: string; // e.g. 'sora-2', 'sora-2-pro', 'wan2.6', 'wan-2.7', 'veo-3.1'
  negative_prompt?: string;
  prompt: string;
  // AITunnel specific
  size?: string; // e.g., '720x1280', '1280x720'
  seconds?: string | number; // Duration in seconds
  input_reference?: File | string; // Reference image
}

export interface VideoGenerationResponse {
  // AITunnel format (OpenAI compatible)
  id?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'queued';
  progress?: number;
  error?: string;
  // AITunnel specific fields
  object?: string;
  created_at?: number;
  model?: string;
  seconds?: string;
  size?: string;
}

export interface VideoStatusResponse {
  // AITunnel format
  id?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  url?: string;
  download_url?: string;
  error?: string;
}

export class VideoService {
  constructor(_apiKey?: string) {
    // API key is used on backend only; constructor kept for compatibility
  }

  private isUuidLike(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  private isWanVideoModel(model: string | undefined): boolean {
    const m = (model || '').trim().toLowerCase();
    return m === 'wan2.6' || m === 'wan-2.7';
  }

  private isWanLegacyPProfileModel(model: string | undefined): boolean {
    const m = (model || '').trim().toLowerCase();
    return m === 'wan2.6';
  }

  /** В документации AITUNNEL для ряда моделей ожидается поле duration (сек.), не seconds */
  private usesDurationField(model: string | undefined): boolean {
    const m = (model || '').trim().toLowerCase();
    return (
      m.startsWith('seedance-') ||
      m === 'wan-2.7' ||
      m === 'veo-3.1' ||
      m === 'grok-imagine-video' ||
      m === 'kling-v3.0-pro' ||
      m === 'kling-v3.0-std' ||
      m === 'kling-video-o1' ||
      m === 'veo-3.1-fast' ||
      m === 'veo-3.1-lite' ||
      m === 'hailuo-2.3'
    );
  }

  private async fileToDataUrl(file: File): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string' && result.startsWith('data:')) {
          resolve(result);
          return;
        }
        reject(new Error('Не удалось прочитать референсное изображение'));
      };
      reader.onerror = () => reject(new Error('Не удалось прочитать референсное изображение'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * WAN модели в AITunnel:
   * - wan2.6: исторически может требовать p-профили с референсом (legacy-поведение).
   * - wan-2.7: принимает только конкретные размеры WxH.
   */
  private normalizeWanVideoSize(
    model: string | undefined,
    size: string | undefined,
    hasReferenceImage: boolean
  ): string | undefined {
    if (!size) return size;
    if (!this.isWanVideoModel(model)) return size;
    const legacyPProfile = this.isWanLegacyPProfileModel(model);
    let s = size.replace(/\s/g, '').toLowerCase();
    if (hasReferenceImage) {
      if (!legacyPProfile) {
        // wan-2.7: только WxH. Если пришёл p-профиль, приводим к валидному WxH.
        if (s === '480p') return '854x480';
        if (s === '720p') return '1280x720';
        if (s === '1080p') return '1920x1080';
        return s;
      }
      // wan2.6 legacy: при референсе допускаем p-профили.
      if (s === '480p' || s === '720p' || s === '1080p') return s;
      const m = s.match(/^(\d+)x(\d+)$/);
      if (m) {
        const w = Number(m[1]);
        const h = Number(m[2]);
        const maxSide = Math.max(w, h);
        if (maxSide >= 1600) return '1080p';
        if (maxSide >= 1000) return '720p';
        return '480p';
      }
      // Безопасный дефолт для reference-режима
      return '720p';
    }
    // Без референса и для новых моделей используем WxH.
    if (s === '480p') s = '832x480';
    if (s === '720p') s = '1280x720';
    if (s === '1080p') s = '1920x1080';
    return s;
  }

  /**
   * Normalizes AITunnel video ID for API requests.
   * According to AITunnel API docs, IDs should have 'video_' prefix.
   * IMPORTANT: We should use the ID exactly as returned by API.
   * If ID already has prefix, use it as-is.
   */
  private normalizeAITunnelVideoId(videoId: string): string {
    // По текущим требованиям API AITunnel: video_id должен начинаться с 'video_'.
    // UUID или произвольная строка без префикса приводит к 400 invalid_value.
    if (videoId.startsWith('video_')) return videoId;
    if (this.isUuidLike(videoId)) {
      throw new Error(
        `Некорректный videoId (${videoId}): похоже на UUID. ` +
          `AITunnel ожидает id вида 'video_...'.`
      );
    }
    throw new Error(
      `Некорректный videoId (${videoId}): AITunnel ожидает id вида 'video_...'.`
    );
  }

  async generateVideo(params: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    try {
      return await this.generateVideoAITunnel(params);
    } catch (error) {
      console.error('Video Service Error:', error);
      throw error instanceof Error 
        ? error 
        : new Error('Failed to generate video. Please check your API key and try again.');
    }
  }

  private async generateVideoAITunnel(params: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Требуется авторизация для генерации видео');
    }

    const requestBody: Record<string, unknown> = {
      model: params.model || 'sora-2',
      prompt: params.prompt,
    };

    if (params.negative_prompt && params.negative_prompt.trim()) {
      requestBody.negative_prompt = params.negative_prompt.trim();
    }

    if (params.size) {
      const sizeToSend =
        this.normalizeWanVideoSize(params.model, params.size, Boolean(params.input_reference)) ?? params.size;
      requestBody.size = sizeToSend;
    }

    if (params.seconds !== undefined) {
      if (this.usesDurationField(params.model)) {
        requestBody.duration = Number(params.seconds);
      } else {
        requestBody.seconds = Number(params.seconds);
      }
    }

    if (params.input_reference) {
      let referenceUrl: string | null = null;
      if (params.input_reference instanceof File) {
        referenceUrl = await this.fileToDataUrl(params.input_reference);
      } else if (typeof params.input_reference === 'string') {
        const ref = params.input_reference.trim();
        if (ref) referenceUrl = ref;
      }

      if (referenceUrl) {
        requestBody.input_references = [
          {
            type: 'image_url',
            image_url: { url: referenceUrl },
          },
        ];
      }
    }

    const response = await fetch(`${API_BASE_URL}/api/ai/videos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // Check response status
    const responseText = await response.text();
    let result: any;
    
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse response:', responseText);
      throw new Error(`Invalid response from API: ${response.status} ${response.statusText}`);
    }

    // Handle errors according to AITunnel documentation
    if (!response.ok || result.error) {
      const error = result.error || {};
      const errorCode = error.code;
      const errorMessage = error.message || error.code 
        ? `Error ${error.code}: ${error.message || 'Unknown error'}`
        : `API request failed: ${response.status} ${response.statusText}`;
      
      // Log detailed error information
      console.error('AITunnel API Error:', {
        status: response.status,
        error: error,
        metadata: error.metadata,
        response: result
      });

      // Provide more specific error messages
      if (errorCode === 'AllocationQuota.FreeTierOnly') {
        throw new Error(
          'Бесплатный лимит этой модели исчерпан при включённом режиме «use free tier only». ' +
          'Отключите этот режим в кабинете AITunnel или пополните баланс.'
        );
      } else if (error.code === 402) {
        throw new Error('Недостаточно баланса на аккаунте. Пожалуйста, пополните баланс.');
      } else if (error.code === 403) {
        const metadata = error.metadata as any;
        const reasons = metadata?.reasons || [];
        throw new Error(`Модерация не пройдена. Причины: ${reasons.join(', ')}`);
      } else if (error.code === 429) {
        throw new Error('Превышен лимит запросов. Пожалуйста, попробуйте позже.');
      } else if (error.code === 502) {
        throw new Error('Модель временно недоступна. Пожалуйста, попробуйте позже.');
      }
      
      throw new Error(errorMessage);
    }

    const videoId = result.id;
    const mappedResult: VideoGenerationResponse = {
      id: videoId,
      status: this.mapAITunnelStatus(result.status),
      progress: result.progress || 0,
    };
    return mappedResult;
  }

  private mapAITunnelStatus(status: string): 'pending' | 'processing' | 'completed' | 'failed' {
    // AITunnel uses: queued, processing, completed, failed
    // We map to our format
    switch (status?.toLowerCase()) {
      case 'queued':
        return 'pending';
      case 'processing':
        return 'processing';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      default:
        return 'pending';
    }
  }

  async getVideoStatus(videoId: string | number): Promise<VideoStatusResponse> {
    try {
      return await this.getVideoStatusAITunnel(String(videoId));
    } catch (error) {
      console.error('Video Status Service Error:', error);
      throw error instanceof Error 
        ? error 
        : new Error('Failed to get video status. Please try again.');
    }
  }

  private async getVideoStatusAITunnel(videoId: string): Promise<VideoStatusResponse> {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Требуется авторизация для проверки статуса видео');
    }

    const apiVideoId = this.normalizeAITunnelVideoId(videoId);
    const url = `${API_BASE_URL}/api/ai/videos/${apiVideoId}`;

    let response = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    let responseText = await response.text();
    let result: any;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse status response:', responseText);
      throw new Error(`Invalid response from API: ${response.status} ${response.statusText}`);
    }

    if (!response.ok || result.error) {
      const error = result.error || {};
      if (error.code === 'AllocationQuota.FreeTierOnly') {
        throw new Error(
          'Бесплатный лимит этой модели исчерпан при включённом режиме «use free tier only». ' +
          'Отключите этот режим в кабинете AITunnel или пополните баланс.'
        );
      }
      // Модерация и подобные терминальные ошибки — возвращаем failed, чтобы опрос прекратился и запись обновилась
      const code = (error.code as string) || '';
      const msg = (error.message as string) || '';
      const isModeration = code === 'moderation_blocked' || /moderation|content_policy|blocked/i.test(msg);
      if (isModeration) {
        const errorMessage = msg || (code ? `Error ${code}` : 'Запрос заблокирован модерацией');
        return {
          id: videoId,
          status: 'failed' as const,
          progress: 0,
          error: errorMessage,
        };
      }
      const errorMessage = msg || (code ? `Error ${code}: ${msg || 'Unknown error'}` : `API request failed: ${response.status} ${response.statusText}`);
      throw new Error(errorMessage);
    }

    const mappedResult: VideoStatusResponse = {
      id: result.id,
      status: this.mapAITunnelStatus(result.status),
      progress: result.progress || 0,
      url: result.status === 'completed' ? `${API_BASE_URL}/api/ai/videos/${result.id}/content` : undefined,
      download_url: result.status === 'completed' ? `${API_BASE_URL}/api/ai/videos/${result.id}/content` : undefined,
    };
    return mappedResult;
  }

  async downloadVideo(videoId: string): Promise<Blob> {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Требуется авторизация для скачивания видео');
    }

    const apiVideoId = this.normalizeAITunnelVideoId(videoId);
    const url = `${API_BASE_URL}/api/ai/videos/${apiVideoId}/content`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorMessage = `Failed to download video: ${response.status} ${response.statusText}`;
      if (contentType && contentType.includes('application/json')) {
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorMessage;
        } catch {
          // use default
        }
      }
      throw new Error(errorMessage);
    }

    return await response.blob();
  }
}

