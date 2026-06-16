import type { AIModel } from '../types';

export interface ModelFamilyDef {
  id: string;
  label: string;
  /** Имя провайдера для ModelLogo */
  logoProvider: string;
  matchModelId: (id: string) => boolean;
}

/** Основные семейства моделей (порядок = порядок на экране). */
export const MODEL_FAMILIES: ModelFamilyDef[] = [
  {
    id: 'claude',
    label: 'Claude',
    logoProvider: 'Anthropic',
    matchModelId: (id) => id.startsWith('claude'),
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    logoProvider: 'OpenAI',
    matchModelId: (id) =>
      id.startsWith('openai/') ||
      id.startsWith('gpt-') ||
      id.startsWith('o1') ||
      id.startsWith('o3') ||
      id.startsWith('o4'),
  },
  {
    id: 'grok',
    label: 'Grok',
    logoProvider: 'xAI',
    matchModelId: (id) => id.startsWith('grok'),
  },
  {
    id: 'gemini',
    label: 'Gemini',
    logoProvider: 'Google',
    matchModelId: (id) => id.startsWith('gemini') || id.startsWith('gemma'),
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    logoProvider: 'DeepSeek',
    matchModelId: (id) => id.startsWith('deepseek'),
  },
  {
    id: 'qwen',
    label: 'Qwen',
    logoProvider: 'Qwen',
    matchModelId: (id) => id.startsWith('qwen'),
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    logoProvider: 'Perplexity',
    matchModelId: (id) => id.startsWith('sonar'),
  },
  {
    id: 'mistral',
    label: 'Mistral',
    logoProvider: 'Mistral AI',
    matchModelId: (id) => id.startsWith('mistral') || id.startsWith('codestral'),
  },
  {
    id: 'glm',
    label: 'GLM',
    logoProvider: 'Z AI',
    matchModelId: (id) => id.startsWith('glm') || id.startsWith('zai-org'),
  },
  {
    id: 'kimi',
    label: 'Kimi',
    logoProvider: 'Moonshot AI',
    matchModelId: (id) => id.startsWith('kimi') || id.startsWith('moonshotai'),
  },
  {
    id: 'llama',
    label: 'Llama',
    logoProvider: 'Meta',
    matchModelId: (id) => id.includes('llama') || id.startsWith('meta-llama'),
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    logoProvider: 'MiniMax',
    matchModelId: (id) => id.startsWith('minimax'),
  },
  {
    id: 'gigachat',
    label: 'GigaChat',
    logoProvider: 'Sber',
    matchModelId: (id) => id.startsWith('gigachat'),
  },
  {
    id: 'mimo',
    label: 'MiMo',
    logoProvider: 'Xiaomi',
    matchModelId: (id) => id.startsWith('mimo'),
  },
  {
    id: 'other',
    label: 'Другие',
    logoProvider: 'Intelligence.io',
    matchModelId: () => true,
  },
];

export function getModelFamilyId(modelId: string): string {
  const id = modelId.toLowerCase();
  for (const family of MODEL_FAMILIES) {
    if (family.id === 'other') continue;
    if (family.matchModelId(id)) return family.id;
  }
  return 'other';
}

export function getModelFamily(modelId: string): ModelFamilyDef {
  const fid = getModelFamilyId(modelId);
  return MODEL_FAMILIES.find((f) => f.id === fid) ?? MODEL_FAMILIES[MODEL_FAMILIES.length - 1];
}

export interface ModelFamilyGroup {
  family: ModelFamilyDef;
  models: AIModel[];
}

/** Группирует модели по семействам; порядок моделей внутри семейства = порядок в каталоге. */
export function groupModelsByFamily(models: AIModel[]): ModelFamilyGroup[] {
  const buckets = new Map<string, AIModel[]>();
  for (const model of models) {
    const fid = getModelFamilyId(model.id);
    const list = buckets.get(fid) ?? [];
    list.push(model);
    buckets.set(fid, list);
  }
  return MODEL_FAMILIES.filter((f) => buckets.has(f.id) && buckets.get(f.id)!.length > 0).map(
    (family) => ({
      family,
      models: buckets.get(family.id)!,
    })
  );
}

/** Первая модель в семействе (по умолчанию). */
export function getDefaultModelIdForFamily(models: AIModel[]): string {
  return models[0]?.id ?? '';
}
