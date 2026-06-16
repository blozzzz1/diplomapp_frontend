import { Message } from '../types';
import { modelSupportsImages, modelSupportsVideo, modelSupportsAudio, modelSupportsPDF } from '../constants/models';
import { getAuthToken } from '../config/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// Модели, которые используют AITUNNEL API (каталог aitunnel.ru/models)
const AITUNNEL_MODELS = [
  'claude-sonnet-4.6', 'claude-fable-5', 'claude-opus-4.8', 'claude-opus-4.8-fast', 'claude-opus-4.7', 'claude-opus-4.6', 'claude-opus-4.5', 'claude-haiku-4.5', 'claude-sonnet-4.5',
  'claude-opus-4.1', 'claude-opus-4', 'claude-sonnet-4', 'claude-3.7-sonnet', 'claude-3.5-haiku', 'claude-3.5-sonnet',
  'grok-4', 'grok-4.1-fast', 'grok-4-fast', 'grok-code-fast-1', 'grok-4.20', 'grok-4.20-multi-agent', 'grok-build-0.1',
  'gemini-2.5-pro', 'gemini-2.5-flash', 'gemma-4-26b-a4b-it', 'gemma-4-31b-it', 'gemini-3.1-pro-preview',
  'gemini-3.1-pro-preview-customtools', 'gemini-3-flash-preview', 'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image-preview',
  'gemini-3-pro-preview', 'gemini-2.5-flash-image', 'gemini-2.5-flash-lite-preview-09-2025', 'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite', 'gemini-3.5-flash',
  'gemini-2.0-flash-lite-001', 'gemini-2.0-flash-001',
  'sonar-pro-search', 'sonar-reasoning-pro', 'sonar-pro', 'sonar-deep-research', 'sonar', 'sonar-reasoning',
  'gpt-5.3-codex', 'gpt-5.2-chat', 'gpt-5.2-pro', 'gpt-5.2', 'gpt-5.2-codex', 'gpt-5.1-codex-max', 'gpt-5.1', 'gpt-5.1-chat',
  'gpt-5.1-codex', 'gpt-5.1-codex-mini', 'gpt-5-image', 'gpt-5-pro', 'gpt-5-codex', 'gpt-5-mini-2025-08-07',
  'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o-audio-preview', 'gpt-4o-mini-search-preview', 'gpt-4o-search-preview',
  'gpt-4o-2024-11-20', 'gpt-4o-2024-08-06', 'gpt-4o-mini-2024-07-18', 'gpt-4o-mini-audio-preview',
  'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'gpt-audio', 'gpt-audio-mini',
  'o3-pro', 'o3', 'o3-mini', 'o4-mini', 'o1-pro', 'o1', 'o1-mini',
  'glm-5', 'glm-5.1', 'glm-4.7-flash', 'glm-4.7', 'glm-4.6v', 'glm-4.5v', 'glm-4.5', 'glm-4.5-air', 'glm-4-32b',
  'qwen3.5-plus-02-15', 'qwen3.5-397b-a17b', 'qwen3-max-thinking', 'qwen3-coder-next', 'qwen3-max',
  'qwen3-coder-30b-a3b-instruct', 'qwen3-235b-a22b-2507', 'qwen3-30b-a3b',
  'minimax-m3', 'minimax-m2.5', 'minimax-m2-her', 'minimax-m2.1', 'minimax-m2', 'minimax-m1', 'minimax-01',
  'deepseek-v3.2-speciale', 'deepseek-v3.2-exp', 'deepseek-v3.1-terminus',
  'deepseek-chat-v3.1', 'deepseek-chat-v3-0324', 'deepseek-chat',
  'mistral-large-2512', 'mistral-medium-3.1', 'mistral-small-3.2-24b-instruct', 'codestral-2508',
  'kimi-k2.5', 'kimi-k2.6', 'kimi-k2.7-code',
  'mimo-v2.5', 'mimo-v2.5-pro',
  'gpt-5.5', 'gpt-5.5-pro',
  'qwen3.6-27b', 'qwen3.6-max-preview', 'qwen3.7-max', 'qwen3.6-35b-a3b', 'qwen3.6-flash', 'qwen3.5-plus-20260420',
  'grok-4.3',
  'deepseek-v4-flash',
  'llama-3.2-1b-instruct', 'llama-3.2-3b-instruct', 'llama-3.2-11b-vision-instruct',
  'gigachat-2', 'gigachat-2-pro', 'gigachat-2-max',
];

export class AIService {
  constructor(_intelligenceApiKey?: string, _aitunnelApiKey?: string) {
    // Keys are used on backend only; constructor kept for compatibility
  }

  private isAITunnelModel(model: string): boolean {
    return AITUNNEL_MODELS.includes(model);
  }

  /** Claude Fable 5 не принимает temperature/top_p — иначе 400 от AITUNNEL/Anthropic. */
  private isClaudeFableModel(model: string): boolean {
    const id = model.toLowerCase();
    return id === 'claude-fable-5' || id.startsWith('claude-fable');
  }

  /** Лимит ответа для Claude: без max_tokens AITUNNEL резервирует 128K токенов и отклоняет запрос по балансу. */
  private getClaudeMaxTokensCap(model: string): number | null {
    const id = model.toLowerCase();
    if (!id.startsWith('claude-')) return null;
    if (id.startsWith('claude-fable') || id.startsWith('claude-opus')) return 4096;
    return 8192;
  }

  private extractApiErrorMessage(errorData: unknown, fallback: string): string {
    if (!errorData || typeof errorData !== 'object') return fallback;
    const payload = errorData as Record<string, unknown>;
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message;
    }
    const err = payload.error;
    if (typeof err === 'string' && err.trim()) return err;
    if (err && typeof err === 'object') {
      const nested = err as Record<string, unknown>;
      if (typeof nested.message === 'string' && nested.message.trim()) {
        return nested.message;
      }
    }
    return fallback;
  }

  private formatMessageContent(message: Message, model?: string): any {
    const isAITunnel = model && this.isAITunnelModel(model);
    const contentArray: any[] = [];

    // AITUNNEL: файлы/PDF только для моделей, которые явно это поддерживают в каталоге
    const supportsPdf = Boolean(isAITunnel && model && modelSupportsPDF(model));
    const hasFiles = supportsPdf && message.files && message.files.length > 0;
    // Изображения добавляем только если текущая модель их поддерживает (при смене модели в чате не слать картинки текстовой модели)
    const hasImages = model && modelSupportsImages(model) && message.images && message.images.length > 0;
    const hasVideo = isAITunnel && model && modelSupportsVideo(model) && message.video && message.video.length > 0;
    const hasAudio = isAITunnel && model && modelSupportsAudio(model) && message.audio && message.audio.length > 0;
    const textContent = (message.content || '').trim();
    const needPlaceholder = (hasFiles || hasImages || hasVideo || hasAudio) && !textContent;

    if (textContent) {
      contentArray.push({ type: 'text', text: textContent });
    } else if (needPlaceholder) {
      let placeholderText = 'Опиши этот документ.';
      if (hasImages && !hasFiles && !hasVideo && !hasAudio) placeholderText = 'Что изображено на этом изображении? Опиши подробно.';
      else if (hasVideo && !hasFiles && !hasImages && !hasAudio) placeholderText = 'Опиши, что происходит в этом видео.';
      else if (hasAudio && !hasFiles && !hasImages && !hasVideo) placeholderText = 'Расшифруй или опиши это аудио.';
      contentArray.push({ type: 'text', text: placeholderText });
    }

    // Изображения после текста
    // Универсальный формат OpenAI: image_url с url (https или data:.../base64,...). Работает с AITUNNEL и vision-моделями Intelligence (Qwen2.5-VL и др.)
    if (hasImages && message.images) {
      message.images.forEach(image => {
        if (image.type === 'url' && image.url) {
          contentArray.push({
            type: 'image_url',
            image_url: { url: image.url }
          });
        } else if (image.type === 'base64' && image.data && image.mimeType) {
          const dataUrl = `data:${image.mimeType};base64,${image.data}`;
          contentArray.push({
            type: 'image_url',
            image_url: { url: dataUrl }
          });
        }
      });
    }

    // Видео — AITUNNEL: type "video_url", video_url: { url } (URL или data URL)
    if (hasVideo && message.video) {
      message.video.forEach((v) => {
        if (v.url) {
          contentArray.push({
            type: 'video_url',
            video_url: { url: v.url }
          });
        }
      });
    }

    // Аудио — AITUNNEL: type "input_audio", input_audio: { data (base64), format: "wav"|"mp3" }
    if (hasAudio && message.audio) {
      message.audio.forEach((a) => {
        if (a.data && a.format) {
          contentArray.push({
            type: 'input_audio',
            input_audio: { data: a.data, format: a.format }
          });
        }
      });
    }

    // Файлы (PDF, DOCX) после текста — формат AITUNNEL: type "file", file: { filename, file_data }
    if (hasFiles && message.files) {
      message.files.forEach(file => {
        if (file.type === 'url' && file.url) {
          contentArray.push({
            type: 'file',
            file: {
              filename: file.filename,
              file_data: file.url
            }
          });
        } else if (file.type === 'base64' && file.data && file.mimeType) {
          const dataUrl = `data:${file.mimeType};base64,${file.data}`;
          contentArray.push({
            type: 'file',
            file: {
              filename: file.filename,
              file_data: dataUrl
            }
          });
        }
      });
    }

    if (contentArray.length === 0) {
      return '';
    }
    if (contentArray.length === 1 && contentArray[0].type === 'text') {
      return contentArray[0].text;
    }
    return contentArray;
  }

  /** Формат сообщений для API провайдера (используется и в server-side reply). */
  buildApiMessages(messages: Message[], model: string): Array<{ role: string; content: unknown }> {
    return messages.map((msg) => ({
      role: msg.role,
      content: this.formatMessageContent(msg, model),
    }));
  }

  async sendMessage(messages: Message[], model: string): Promise<string> {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Требуется авторизация для запросов к AI');
      }

      const messagesPayload = this.buildApiMessages(messages, model).map((m) => ({
        ...m,
        content: m.content === '' ? ' ' : m.content,
      }));

      const data: Record<string, unknown> = {
        model,
        messages: messagesPayload,
      };
      if (!this.isClaudeFableModel(model)) {
        data.temperature = 0.7;
      }
      if (this.isAITunnelModel(model) && model.startsWith('sonar')) {
        data.web_search_options = {};
      }
      const claudeCap = this.getClaudeMaxTokensCap(model);
      if (claudeCap != null) {
        data.max_tokens = claudeCap;
      } else if (model?.startsWith('minimax')) {
        // MiniMax (в т.ч. MiniMax-Text-01) не поддерживает max_tokens > 40000
        data.max_tokens = 40000;
      }

      const response = await fetch(`${API_BASE_URL}/api/ai/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      const responseText = await response.text().catch(() => '');
      if (!response.ok) {
        let errorMessage = `Ошибка API (${response.status})`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = this.extractApiErrorMessage(errorData, errorMessage);
        } catch {
          if (responseText.trim()) {
            errorMessage = responseText.slice(0, 500);
          }
        }
        if (response.status === 402 && !errorMessage.includes('Недостаточно средств')) {
          errorMessage =
            'Недостаточно средств на балансе AITUNNEL для этой модели. Пополните баланс на aitunnel.ru или выберите более дешёвую модель.';
        }
        throw new Error(errorMessage);
      }

      const result = responseText ? JSON.parse(responseText) : {};

      if (result.error) {
        const errMsg = result.error.message || result.error.error?.message || (typeof result.error === 'string' ? result.error : 'API returned an error');
        throw new Error(errMsg);
      }

      const content = result.choices?.[0]?.message?.content;
      if (content === undefined || content === null) {
        throw new Error('Пустой ответ от модели');
      }
      return content;
    } catch (error) {
      console.error('AI Service Error:', error);
      throw error instanceof Error 
        ? error 
        : new Error('Failed to get response from AI model. Please try again.');
    }
  }
}