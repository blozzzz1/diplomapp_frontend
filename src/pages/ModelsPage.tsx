import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModelFamilyGrid, ModelsInfoBlock } from '../components/ModelFamilyGrid';
import { PulsingOrbsBackground } from '../components/PulsingOrbsBackground';
import { useAuth } from '../contexts/AuthContext';
import { usePlan } from '../contexts/PlanContext';
import { usePlanConfig } from '../hooks/usePlanConfig';

export const ModelsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPremium } = usePlan();
  const { freeChatModelIds, disabledModelIds, loading: planConfigLoading } = usePlanConfig();
  const freeIds = planConfigLoading ? [] : freeChatModelIds;
  const disabledSet = useMemo(() => new Set(disabledModelIds), [disabledModelIds]);

  const handleSelectModel = (modelId: string) => {
    if (disabledSet.has(modelId)) return;
    if (!user) {
      navigate('/login?redirect=/chat?model=' + modelId + '&new=true');
      return;
    }
    if (!isPremium && !freeIds.includes(modelId)) {
      navigate('/pricing');
      return;
    }
    navigate(`/chat?model=${modelId}&new=true`);
  };

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto bg-background-darker">
      <PulsingOrbsBackground />
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <ModelFamilyGrid
          onModelSelect={handleSelectModel}
          title="Текстовые модели"
          subtitle="Выберите семейство и конкретную модель для чата"
        />
        <ModelsInfoBlock />
      </div>
    </div>
  );
};
