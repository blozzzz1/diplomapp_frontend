import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Search, Sparkles, X } from 'lucide-react';
import { AI_MODELS } from '../constants/models';
import {
  getModelFamilyId,
  groupModelsByFamily,
  getDefaultModelIdForFamily,
} from '../constants/modelFamilies';
import { DarkSelect } from './DarkSelect';
import { ModelLogo } from './ModelLogo';
import { ModelCardSkeleton } from './ModelCardSkeleton';
import { usePlan } from '../contexts/PlanContext';
import { usePlanConfig } from '../hooks/usePlanConfig';
import type { AIModel } from '../types';

const INPUT_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Любой ввод' },
  { value: 'text', label: 'Только текст' },
  { value: 'images', label: 'Изображения' },
  { value: 'files', label: 'Файлы (PDF)' },
  { value: 'video', label: 'Видео' },
];

interface ModelFamilyGridProps {
  selectedModel?: string;
  onModelSelect: (modelId: string) => void;
  /** Подсветка активной модели (экран выбора в чате) */
  highlightSelection?: boolean;
  title?: string;
  subtitle?: string;
}

function filterModelsList(
  models: AIModel[],
  opts: {
    searchQuery: string;
    filterFamily: string;
    filterInput: string;
    disabledSet: Set<string>;
    freeIds: string[];
  }
): AIModel[] {
  let list = models.filter((m) => !opts.disabledSet.has(m.id));

  if (opts.searchQuery.trim()) {
    const q = opts.searchQuery.trim().toLowerCase();
    list = list.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q)
    );
  }

  if (opts.filterFamily) {
    list = list.filter((m) => getModelFamilyId(m.id) === opts.filterFamily);
  }

  if (opts.filterInput) {
    if (opts.filterInput === 'text') {
      list = list.filter((m) => !m.supportsImages && !m.supportsPDF && !m.supportsVideo);
    } else if (opts.filterInput === 'images') {
      list = list.filter((m) => m.supportsImages);
    } else if (opts.filterInput === 'files') {
      list = list.filter((m) => m.supportsPDF);
    } else if (opts.filterInput === 'video') {
      list = list.filter((m) => m.supportsVideo);
    }
  }

  return list.sort((a, b) => {
    const aFree = opts.freeIds.includes(a.id);
    const bFree = opts.freeIds.includes(b.id);
    if (aFree && !bFree) return -1;
    if (!aFree && bFree) return 1;
    return 0;
  });
}

interface FamilyCardProps {
  familyLabel: string;
  logoProvider: string;
  models: AIModel[];
  selectedModel?: string;
  highlightSelection?: boolean;
  freeIds: string[];
  isPremium: boolean;
  onSelect: (modelId: string) => void;
}

const FamilyCard: React.FC<FamilyCardProps> = ({
  familyLabel,
  logoProvider,
  models,
  selectedModel,
  highlightSelection,
  freeIds,
  isPremium,
  onSelect,
}) => {
  const defaultId = getDefaultModelIdForFamily(models);
  const selectedInFamily = models.find((m) => m.id === selectedModel)?.id;
  const [pickedId, setPickedId] = useState(selectedInFamily ?? defaultId);

  // Синхронизация только когда родитель подтвердил выбор (selectedModel), не при локальной смене в списке
  useEffect(() => {
    if (selectedInFamily) {
      setPickedId(selectedInFamily);
    }
  }, [selectedInFamily]);

  useEffect(() => {
    if (!models.some((m) => m.id === pickedId)) {
      setPickedId(defaultId);
    }
  }, [models, defaultId, pickedId]);

  const picked = models.find((m) => m.id === pickedId) ?? models[0];
  const isActive = highlightSelection && Boolean(selectedInFamily);
  const isPremiumModel = picked && !freeIds.includes(picked.id);
  const showPremiumStyle = Boolean(isPremiumModel && !isPremium);

  const selectOptions = models.map((m) => ({
    value: m.id,
    label: m.name,
  }));

  return (
    <div
      className={`relative flex flex-col rounded-xl border-2 transition-all duration-200 ${
        showPremiumStyle
          ? 'border-amber-500/40 bg-amber-500/5'
          : isActive
            ? 'border-primary-500/60 bg-primary-500/10 ring-1 ring-primary-500/30'
            : 'border-white/10 bg-background-card hover:border-gray-600'
      }`}
    >
      {isActive && !showPremiumStyle && <div className="h-0.5 rounded-t-xl bg-primary-500/60" />}

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-white">{familyLabel}</h3>
            <p className="mt-0.5 text-sm text-gray-500">
              {models.length} {models.length === 1 ? 'модель' : models.length < 5 ? 'модели' : 'моделей'}
            </p>
          </div>
          <ModelLogo providerName={logoProvider} size="sm-lg" />
        </div>

        <div className="mb-3">
          <span className="mb-1.5 block text-xs font-medium text-gray-500">Конкретная модель</span>
          <DarkSelect
            value={pickedId}
            options={selectOptions}
            onChange={setPickedId}
            placeholder="Выберите модель"
            className="w-full"
          />
        </div>

        {picked && (
          <p className="mb-4 line-clamp-2 min-h-[2.5rem] text-sm text-gray-500">{picked.description}</p>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-3">
          {showPremiumStyle ? (
            <span className="rounded-md border border-amber-500/50 bg-amber-500/30 px-2 py-0.5 text-xs font-semibold text-amber-300">
              Премиум
            </span>
          ) : (
            <span className="text-xs text-gray-500">По умолчанию: {models[0]?.name}</span>
          )}
          <button
            type="button"
            onClick={() => onSelect(pickedId)}
            className="flex items-center gap-2 rounded-lg bg-primary-500/20 px-3 py-2 text-sm font-medium text-primary-300 transition-colors hover:bg-primary-500/30"
          >
            Выбрать
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const ModelFamilyGrid: React.FC<ModelFamilyGridProps> = ({
  selectedModel,
  onModelSelect,
  highlightSelection = false,
  title = 'Выберите модель',
  subtitle = 'Сначала семейство, затем конкретную версию',
}) => {
  const { isPremium } = usePlan();
  const { freeChatModelIds, disabledModelIds, loading: planConfigLoading } = usePlanConfig();
  const freeIds = planConfigLoading ? [] : freeChatModelIds;
  const disabledSet = useMemo(() => new Set(disabledModelIds), [disabledModelIds]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterFamily, setFilterFamily] = useState('');
  const [filterInput, setFilterInput] = useState('');

  const filteredModels = useMemo(
    () =>
      filterModelsList(AI_MODELS, {
        searchQuery,
        filterFamily,
        filterInput,
        disabledSet,
        freeIds,
      }),
    [searchQuery, filterFamily, filterInput, disabledSet, freeIds]
  );

  const familyGroups = useMemo(() => groupModelsByFamily(filteredModels), [filteredModels]);

  const familyFilterOptions = useMemo(() => {
    const allEnabled = filterModelsList(AI_MODELS, {
      searchQuery: '',
      filterFamily: '',
      filterInput: '',
      disabledSet,
      freeIds,
    });
    const allGroups = groupModelsByFamily(allEnabled);
    return [
      { value: '', label: 'Все семейства' },
      ...allGroups.map((g) => ({ value: g.family.id, label: g.family.label })),
    ];
  }, [disabledSet, freeIds]);

  const hasActiveFilters = Boolean(searchQuery.trim() || filterFamily || filterInput);

  const clearFilters = () => {
    setSearchQuery('');
    setFilterFamily('');
    setFilterInput('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-2xl font-bold text-white">{title}</h2>
        <p className="text-sm text-gray-400">{subtitle}</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск по названию или описанию..."
          className="w-full rounded-xl border border-primary-900/30 bg-background-card py-2.5 pl-10 pr-4 text-white placeholder-gray-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-500">Фильтры:</span>
        <DarkSelect
          value={filterFamily}
          options={familyFilterOptions}
          onChange={setFilterFamily}
          placeholder="Все семейства"
        />
        <DarkSelect
          value={filterInput}
          options={INPUT_FILTER_OPTIONS}
          onChange={setFilterInput}
          placeholder="Любой ввод"
        />
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-gray-400 hover:bg-background-hover hover:text-white"
          >
            <X className="h-4 w-4" />
            Сбросить
          </button>
        )}
      </div>

      {planConfigLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ModelCardSkeleton key={i} />
          ))}
        </div>
      ) : familyGroups.length > 0 ? (
        <>
          <p className="text-sm text-gray-500">
            Семейств: {familyGroups.length} · моделей: {filteredModels.length}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {familyGroups.map(({ family, models }) => (
              <FamilyCard
                key={family.id}
                familyLabel={family.label}
                logoProvider={family.logoProvider}
                models={models}
                selectedModel={selectedModel}
                highlightSelection={highlightSelection}
                freeIds={freeIds}
                isPremium={isPremium}
                onSelect={onModelSelect}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-primary-900/30 bg-background-card py-12 text-center">
          <p className="text-gray-400">Ни одной модели не найдено</p>
          <p className="mt-1 text-sm text-gray-500">Измените поиск или фильтры</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-4 rounded-lg bg-background-hover px-4 py-2 text-sm text-gray-300 hover:bg-background-darker"
          >
            Сбросить фильтры
          </button>
        </div>
      )}
    </div>
  );
};

/** Блок «О моделях» для страницы каталога */
export const ModelsInfoBlock: React.FC = () => (
  <div className="mt-16 rounded-xl border border-primary-900/30 bg-background-card p-6">
    <div className="flex items-start gap-4">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-500/20">
        <Sparkles className="h-5 w-5 text-primary-400" />
      </div>
      <div>
        <h3 className="mb-2 text-lg font-semibold text-white">О текстовых моделях</h3>
        <p className="text-sm leading-relaxed text-gray-400">
          Выберите семейство (Claude, ChatGPT, Grok и др.), затем конкретную версию в выпадающем списке.
          По умолчанию подставляется первая модель в семействе. Возможности Vision, PDF и видео указаны в описании
          каждой модели.
        </p>
      </div>
    </div>
  </div>
);
