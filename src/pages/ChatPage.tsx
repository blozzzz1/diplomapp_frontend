import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ChatInterface } from '../components/ChatInterface';
import { ChatSidebar } from '../components/ChatSidebar';
import { ModelSelector } from '../components/ModelSelector';
import { useChat } from '../hooks/useChat';
import { useAuth } from '../contexts/AuthContext';
import { usePlan } from '../contexts/PlanContext';
import { AI_MODELS, getModelProviderName } from '../constants/models';
import { usePlanConfig } from '../hooks/usePlanConfig';
import { ChatPageSkeleton } from '../components/ChatPageSkeleton';
import { PulsingOrbsBackground } from '../components/PulsingOrbsBackground';

export const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { isPremium, loading: planLoading } = usePlan();
  const { freeChatModelIds, disabledModelIds, loading: planConfigLoading } = usePlanConfig();
  const freeIds = planConfigLoading ? [] : freeChatModelIds;
  const disabledSet = useMemo(() => new Set(disabledModelIds), [disabledModelIds]);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mobileChatDrawerOpen, setMobileChatDrawerOpen] = useState(false);
  const processedParamsRef = useRef<string | null>(null);
  const pendingCreationRef = useRef(false);

  const {
    messages,
    isLoading,
    attachmentUploadProgress,
    isSyncing,
    selectedModel,
    chatSessions,
    currentSessionId,
    sendMessage,
    clearCurrentChat,
    changeModel,
    createNewSession,
    deleteSession,
    switchToSession,
    speechState,
    startListening,
    stopListening,
    stopListeningAfterMessageSubmit,
    sendVoiceMessage,
    setSpeechTranscript,
    clearSpeechError
  } = useChat(user?.id);

  const selectedModelInfo = AI_MODELS.find(model => model.id === selectedModel);
  const selectedModelProvider = selectedModelInfo ? getModelProviderName(selectedModelInfo) : '';

  // Отключённые админом — сменить модель; для free — ещё и проверка списка бесплатных.
  // Важно: ждать planLoading — иначе до прихода /api/user/plan isPremium=false и премиум-модель
  // затирается первой бесплатной (например Gemma → Qwen после обновления страницы).
  useEffect(() => {
    if (planConfigLoading || planLoading || !selectedModel) return;
    if (disabledSet.has(selectedModel)) {
      const next = AI_MODELS.find((m) => !disabledSet.has(m.id))?.id;
      if (next) changeModel(next);
      return;
    }
    if (!isPremium && freeIds.length > 0 && !freeIds.includes(selectedModel)) {
      changeModel(freeIds[0]);
    }
  }, [planConfigLoading, planLoading, isPremium, selectedModel, freeIds, changeModel, disabledSet]);

  // Handle URL params for creating new chat with specific model
  useEffect(() => {
    // Only process when not syncing and not already processing
    if (pendingCreationRef.current || isSyncing) {
      return;
    }
    
    const modelId = searchParams.get('model');
    const shouldCreateNew = searchParams.get('new') === 'true';
    
    if (modelId && shouldCreateNew) {
      // Check if we already processed this exact request
      const currentRequest = `${modelId}-new`;
      if (processedParamsRef.current === currentRequest) {
        return; // Already processed
      }

      const resolvedModelId =
        disabledSet.has(modelId) ? AI_MODELS.find((m) => !disabledSet.has(m.id))?.id : modelId;
      if (disabledSet.has(modelId) && !resolvedModelId) {
        processedParamsRef.current = currentRequest;
        pendingCreationRef.current = false;
        setSearchParams({}, { replace: true });
        return;
      }

      // Mark this request as processed
      processedParamsRef.current = currentRequest;
      pendingCreationRef.current = true;

      // Clear URL params immediately to prevent re-processing
      setSearchParams({}, { replace: true });

      // Change model first (подмена, если модель отключена админом)
      changeModel(resolvedModelId ?? modelId);
      
      // Create session after sessions are loaded
      const timeoutId = setTimeout(async () => {
        try {
          // Always create a new session when coming from model catalog
          await createNewSession();
        } catch (error) {
          console.error('Error creating session:', error);
        } finally {
          pendingCreationRef.current = false;
        }
      }, 300);
      
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [searchParams, isSyncing, changeModel, createNewSession, setSearchParams, disabledSet]);

  const handleLogout = () => {
    navigate('/');
  };

  const handleModelSelect = (modelId: string) => {
    if (disabledSet.has(modelId)) return;
    if (!planLoading && !isPremium && !freeIds.includes(modelId)) {
      setShowModelSelector(false);
      navigate('/pricing');
      return;
    }
    changeModel(modelId);
    setShowModelSelector(false);
  };

  const handleChangeModel = () => {
    setShowModelSelector(true);
  };

  const handleNewSession = () => {
    createNewSession();
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const openMobileChatDrawer = () => {
    setIsSidebarCollapsed(false);
    setMobileChatDrawerOpen(true);
  };

  if (!showModelSelector && isSyncing && chatSessions.length === 0) {
    return <ChatPageSkeleton />;
  }

  if (showModelSelector) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background-darker p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => setShowModelSelector(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Назад к чату
            </button>
            
          </div>
          <ModelSelector
            selectedModel={selectedModel}
            onModelSelect={handleModelSelect}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background-darker">
      <PulsingOrbsBackground />
      {/* Бэкдроп внутри того же stacking context, что и сайдбар — иначе z-45 перекрывает весь блок z-10 и клики не доходят до меню */}
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1">
        {mobileChatDrawerOpen && (
          <div
            className="fixed inset-0 z-[40] bg-black/40 lg:hidden"
            aria-hidden
            onClick={() => setMobileChatDrawerOpen(false)}
          />
        )}
        <ChatSidebar
          sessions={chatSessions}
          currentSessionId={currentSessionId}
          onSessionSelect={switchToSession}
          onNewSession={handleNewSession}
          onDeleteSession={deleteSession}
          onChangeModel={handleChangeModel}
          selectedModelName={selectedModelInfo?.name || 'Неизвестная модель'}
          selectedModelProvider={selectedModelProvider}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          isSyncing={isSyncing}
          mobileDrawerOpen={mobileChatDrawerOpen}
          onCloseMobileDrawer={() => setMobileChatDrawerOpen(false)}
        />
        <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatInterface
          messages={messages}
          onSendMessage={sendMessage}
          onClearChat={clearCurrentChat}
          isLoading={isLoading}
          attachmentUploadProgress={attachmentUploadProgress}
          selectedModelName={selectedModelInfo?.name || 'Неизвестная модель'}
          selectedModelProvider={selectedModelProvider}
          selectedModelSupportsImages={selectedModelInfo?.supportsImages || false}
          selectedModelSupportsFiles={selectedModelInfo?.supportsPDF || false}
          selectedModelSupportsVideo={selectedModelInfo?.supportsVideo || false}
          selectedModelSupportsAudio={selectedModelInfo?.supportsAudio || false}
          speechState={speechState}
          onStartListening={startListening}
          onStopListening={stopListening}
          onStopListeningAfterMessageSubmit={stopListeningAfterMessageSubmit}
          onSendVoiceMessage={sendVoiceMessage}
          onSetSpeechTranscript={setSpeechTranscript}
          onClearSpeechError={clearSpeechError}
          onOpenSessionsDrawer={openMobileChatDrawer}
        />
        </div>
      </div>
    </div>
  );
};

