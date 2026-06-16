import React from 'react';
import { ModelFamilyGrid } from './ModelFamilyGrid';

interface ModelSelectorProps {
  selectedModel: string;
  onModelSelect: (modelId: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModel, onModelSelect }) => (
  <ModelFamilyGrid
    selectedModel={selectedModel}
    onModelSelect={onModelSelect}
    highlightSelection
    title="Выберите модель"
    subtitle="Семейство → конкретная версия в списке"
  />
);
