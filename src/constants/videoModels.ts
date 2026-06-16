import { VideoModel } from '../types';

export const VIDEO_MODELS: VideoModel[] = [
  {
    id: 'sora-2',
    name: 'Sora 2',
    description: 'Продвинутая модель от OpenAI для генерации реалистичных видео. Отличное качество и детализация.',
    provider: 'OpenAI',
    capabilities: [
      'Генерация реалистичных видео',
      'Высокое качество',
      'Поддержка различных размеров',
      'Быстрая генерация',
      'Референсное изображение (первый кадр)'
    ],
    supportedAspectRatios: ['9:16', '16:9'],
    supportedQualities: ['720x1280', '1280x720'],
    // По текущим ограничениям API: seconds ∈ {4, 8, 12}
    supportedDurations: [4, 8, 12],
    maxPromptLength: 2048,
    pricePerSecond: 19,
    supportsReferenceImage: true
  },
  {
    id: 'sora-2-pro',
    name: 'Sora 2 Pro',
    description: 'Профессиональная версия Sora 2 с улучшенным качеством и поддержкой больших разрешений.',
    provider: 'OpenAI',
    capabilities: [
      'Профессиональное качество',
      'Большие разрешения',
      'Улучшенная детализация',
      'Расширенные возможности'
    ],
    supportedAspectRatios: ['9:16', '16:9', '16:28', '28:16'],
    supportedQualities: ['720x1280', '1280x720', '1024x1792', '1792x1024'],
    // seconds ∈ {4, 8, 12}
    supportedDurations: [4, 8, 12],
    maxPromptLength: 2048,
    pricePerSecond: 57, // Base price for 720x1280/1280x720
    supportsReferenceImage: true,
    priceMap: {
      '720x1280': 57,
      '1280x720': 57,
      '1024x1792': 95,
      '1792x1024': 95
    }
  },
  {
    id: 'seedance-2.0',
    name: 'Seedance 2.0',
    description:
      'ByteDance: текст → видео, анимация изображения (I2V), референсы стиля. Разрешения 480p и 720p, длительность 4–15 с, поддержка аудиодорожки.',
    provider: 'ByteDance',
    capabilities: [
      'Text-to-Video',
      'Image-to-Video',
      'Reference-to-Video',
      'Аудиодорожка',
      '480p и 720p',
    ],
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedQualities: ['854x480', '480x854', '480x480', '1280x720', '720x1280', '720x720'],
    supportedDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    maxPromptLength: 2048,
    pricePerSecond: 5.1,
    priceMap: {
      '854x480': 5.1,
      '480x854': 5.1,
      '480x480': 5.1,
      '1280x720': 8.2,
      '720x1280': 8.2,
      '720x720': 8.2,
    },
    supportsReferenceImage: true,
  },
  {
    id: 'seedance-2.0-fast',
    name: 'Seedance 2.0 Fast',
    description:
      'Быстрая версия Seedance 2.0 от ByteDance: те же режимы (T2V, I2V, референс), 480p/720p, 4–15 секунд.',
    provider: 'ByteDance',
    capabilities: [
      'Text-to-Video',
      'Image-to-Video',
      'Reference-to-Video',
      'Аудиодорожка',
      'Быстрая генерация',
    ],
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedQualities: ['854x480', '480x854', '480x480', '1280x720', '720x1280', '720x720'],
    supportedDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    maxPromptLength: 2048,
    pricePerSecond: 4.1,
    priceMap: {
      '854x480': 4.1,
      '480x854': 4.1,
      '480x480': 4.1,
      '1280x720': 6.5,
      '720x1280': 6.5,
      '720x720': 6.5,
    },
    supportsReferenceImage: true,
  },
  {
    id: 'seedance-1-5-pro',
    name: 'Seedance 1.5 Pro',
    description:
      'ByteDance Seedance 1.5 Pro: T2V, I2V и референс стиля; разрешения до 1080p, длительность 4–12 с.',
    provider: 'ByteDance',
    capabilities: [
      'Text-to-Video',
      'Image-to-Video',
      'Reference-to-Video',
      'Аудиодорожка',
      'До 1080p',
    ],
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedQualities: [
      '854x480',
      '480x854',
      '480x480',
      '1280x720',
      '720x1280',
      '720x720',
      '1920x1080',
      '1080x1920',
      '1080x1080',
    ],
    supportedDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    maxPromptLength: 2048,
    pricePerSecond: 1.75,
    priceMap: {
      '854x480': 1.75,
      '480x854': 1.75,
      '480x480': 1.75,
      '1280x720': 3.5,
      '720x1280': 3.5,
      '720x720': 3.5,
      '1920x1080': 6.2,
      '1080x1920': 6.2,
      '1080x1080': 6.2,
    },
    supportsReferenceImage: true,
  },
  {
    id: 'wan2.6',
    name: 'Wan 2.6',
    description: 'Модель для генерации видео с длительностями 5, 10 и 15 секунд.',
    provider: 'Qwen',
    capabilities: [
      'Генерация видео',
      'Длительность 5, 10, 15 с',
      'Различные разрешения',
      'Референсное изображение (первый кадр)'
    ],
    supportedAspectRatios: ['16:9', '9:16'],
    supportedQualities: ['1280x720', '720x1280', '1920x1080', '1080x1920'],
    supportedDurations: [5, 10, 15],
    maxPromptLength: 2048,
    pricePerSecond: 3.84, // от 19.2 ₽ за видео (5 с)
    priceMap: {
      '1280x720': 3.84,
      '720x1280': 3.84,
      '1920x1080': 5.76,
      '1080x1920': 5.76
    },
    supportsReferenceImage: true
  },
  {
    id: 'wan-2.7',
    name: 'Wan 2.7',
    description: 'Новая модель Alibaba для генерации видео: text-to-video, image-to-video и референсы. Поддерживает 720p/1080p и длительность 2–10 секунд.',
    provider: 'Alibaba',
    capabilities: [
      'Text-to-Video',
      'Image-to-Video',
      'Reference-to-Video',
      '720p и 1080p',
      'Длительность 2–10 сек',
      'Референсное изображение (первый кадр)'
    ],
    supportedAspectRatios: ['16:9', '9:16'],
    supportedQualities: ['1280x720', '720x1280', '1920x1080', '1080x1920'],
    supportedDurations: [2, 3, 4, 5, 6, 7, 8, 9, 10],
    maxPromptLength: 2048,
    pricePerSecond: 14.4,
    priceMap: {
      '1280x720': 14.4,
      '720x1280': 14.4,
      '1920x1080': 21.6,
      '1080x1920': 21.6
    },
    supportsReferenceImage: true
  },
  {
    id: 'veo-3.1',
    name: 'Veo 3.1',
    description: 'Флагманская модель Google для text-to-video с поддержкой аудиодорожки. Разрешения 720p, 1080p, 4K; длительности 4, 6 и 8 секунд.',
    provider: 'Google',
    capabilities: [
      'Text-to-Video',
      'Высокая детализация',
      'Поддержка аудио',
      '720p, 1080p и 4K',
      'Длительность 4, 6, 8 сек'
    ],
    supportedAspectRatios: ['16:9', '9:16'],
    supportedQualities: ['1280x720', '720x1280', '1920x1080', '1080x1920', '3840x2160', '2160x3840'],
    supportedDurations: [4, 6, 8],
    maxPromptLength: 2048,
    pricePerSecond: 57.6,
    priceMap: {
      '1280x720': 57.6,
      '720x1280': 57.6,
      '1920x1080': 86.4,
      '1080x1920': 86.4,
      '3840x2160': 115.2,
      '2160x3840': 115.2
    },
    supportsReferenceImage: false
  },
  {
    id: 'grok-imagine-video',
    name: 'Grok Imagine Video',
    description: 'xAI Grok Imagine Video: text-to-video и image-to-video. Разрешения 480p/720p, длительность 1-15 секунд.',
    provider: 'xAI',
    capabilities: [
      'Text-to-Video',
      'Image-to-Video',
      '480p и 720p',
      'Длительность 1-15 сек'
    ],
    supportedAspectRatios: ['16:9'],
    supportedQualities: ['854x480', '1280x720'],
    supportedDurations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    maxPromptLength: 2048,
    pricePerSecond: 8.16,
    priceMap: {
      '854x480': 8.16,
      '1280x720': 11.42
    },
    supportsReferenceImage: true
  },
  {
    id: 'kling-v3.0-pro',
    name: 'Kling V3.0 Pro',
    description: 'Kling V3.0 Pro от Kwaivgi: text-to-video и image-to-video, 720p, длительность 3-15 секунд, поддержка аудио.',
    provider: 'Kwaivgi',
    capabilities: [
      'Text-to-Video',
      'Image-to-Video',
      '720p',
      'Аудиодорожка',
      'Длительность 3-15 сек'
    ],
    supportedAspectRatios: ['16:9'],
    supportedQualities: ['1280x720'],
    supportedDurations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    maxPromptLength: 2048,
    pricePerSecond: 18.28,
    supportsReferenceImage: true
  },
  {
    id: 'kling-v3.0-std',
    name: 'Kling V3.0 Std',
    description: 'Kling V3.0 Std от Kwaivgi: text-to-video и image-to-video, 720p, длительность 3-15 секунд, поддержка аудио.',
    provider: 'Kwaivgi',
    capabilities: [
      'Text-to-Video',
      'Image-to-Video',
      '720p',
      'Аудиодорожка',
      'Длительность 3-15 сек'
    ],
    supportedAspectRatios: ['16:9'],
    supportedQualities: ['1280x720'],
    supportedDurations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    maxPromptLength: 2048,
    pricePerSecond: 13.71,
    supportsReferenceImage: true
  },
  {
    id: 'kling-video-o1',
    name: 'Kling Video O1',
    description: 'Kling Video O1 от Kwaivgi: text-to-video и image-to-video, 720p, длительность 5 или 10 секунд, поддержка аудио.',
    provider: 'Kwaivgi',
    capabilities: [
      'Text-to-Video',
      'Image-to-Video',
      '720p',
      'Аудиодорожка',
      'Длительность 5/10 сек'
    ],
    supportedAspectRatios: ['16:9'],
    supportedQualities: ['1280x720'],
    supportedDurations: [5, 10],
    maxPromptLength: 2048,
    pricePerSecond: 18.28,
    supportsReferenceImage: true
  },
  {
    id: 'veo-3.1-fast',
    name: 'Veo 3.1 Fast',
    description: 'Быстрая версия Veo 3.1 от Google: text-to-video и image-to-video, 720p/1080p/4K, длительность 4, 6, 8 секунд.',
    provider: 'Google',
    capabilities: [
      'Text-to-Video',
      'Image-to-Video',
      '720p, 1080p и 4K',
      'Аудиодорожка',
      'Длительность 4, 6, 8 сек'
    ],
    supportedAspectRatios: ['16:9', '9:16'],
    supportedQualities: ['1280x720', '720x1280', '1920x1080', '1080x1920', '3840x2160', '2160x3840'],
    supportedDurations: [4, 6, 8],
    maxPromptLength: 2048,
    pricePerSecond: 13.06,
    priceMap: {
      '1280x720': 13.06,
      '720x1280': 13.06,
      '1920x1080': 24.48,
      '1080x1920': 24.48,
      '3840x2160': 48.96,
      '2160x3840': 48.96
    },
    supportsReferenceImage: true
  },
  {
    id: 'veo-3.1-lite',
    name: 'Veo 3.1 Lite',
    description: 'Экономичная версия Veo 3.1 от Google: text-to-video и image-to-video, 720p/1080p, длительность 4, 6, 8 секунд.',
    provider: 'Google',
    capabilities: [
      'Text-to-Video',
      'Image-to-Video',
      '720p и 1080p',
      'Аудиодорожка',
      'Длительность 4, 6, 8 сек'
    ],
    supportedAspectRatios: ['16:9', '9:16'],
    supportedQualities: ['1280x720', '720x1280', '1920x1080', '1080x1920'],
    supportedDurations: [4, 6, 8],
    maxPromptLength: 2048,
    pricePerSecond: 4.9,
    priceMap: {
      '1280x720': 4.9,
      '720x1280': 4.9,
      '1920x1080': 13.06,
      '1080x1920': 13.06
    },
    supportsReferenceImage: true
  },
  {
    id: 'hailuo-2.3',
    name: 'Hailuo 2.3',
    description: 'MiniMax Hailuo 2.3: text-to-video и image-to-video. Разрешение 1080p, длительность 6 или 10 секунд.',
    provider: 'MiniMax',
    capabilities: [
      'Text-to-Video',
      'Image-to-Video',
      '1080p',
      'Длительность 6/10 сек'
    ],
    supportedAspectRatios: ['16:9'],
    supportedQualities: ['1920x1080'],
    supportedDurations: [6, 10],
    maxPromptLength: 2048,
    pricePerSecond: 13.33,
    supportsReferenceImage: true
  }
];

