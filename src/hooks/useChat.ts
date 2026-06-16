import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { Message, ChatSession, ImageAttachment, FileAttachment, VideoAttachment, AudioAttachment } from '../types';
import { AIService } from '../services/aiService';
import { ChatService } from '../services/chatService';
import { StorageService } from '../utils/storage';
import { getChatIfMatchIso, stripSessionForRemote } from '../utils/chatPersist';
import {
  normalizeAttachmentsForCloud,
  countCloudAttachmentUploads,
  type AttachmentUploadProgress,
} from '../utils/chatMediaUpload';
import { hydrateMessagesForApi } from '../utils/hydrateChatMessagesForApi';

interface SpeechRecognitionState {
  isListening: boolean;
  transcript: string;
  isSupported: boolean;
  error: string | null;
}

export const useChat = (userId?: string) => {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [attachmentUploadProgress, setAttachmentUploadProgress] = useState<AttachmentUploadProgress | null>(null);
  const [selectedModel, setSelectedModel] = useState(() => {
    const savedModel = StorageService.getSelectedModel();
    return savedModel || 'openai/gpt-oss-120b';
  });

  const [speechState, setSpeechState] = useState<SpeechRecognitionState>({
    isListening: false,
    transcript: '',
    isSupported: false,
    error: null
  });
  
  const recognitionRef = useRef<any>(null);
  const aiService = new AIService(); // API ключ берется из .env
  /** Пользователь явно остановил запись / отправил текст — не мержить interim и не перезапускать распознавание в onend */
  const manuallyStoppedRef = useRef(false);
  /** После отправки сообщения во время записи — в onend обязательно обнулить transcript (иначе перебивает асинхронный onend) */
  const clearTranscriptWhenSpeechEndsRef = useRef(false);
  const interimBufferRef = useRef('');
  const isSpeechSupportedRef = useRef(false);
  const replyPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevSessionIdForModelRef = useRef<string | null>(null);

  function sessionHasPendingReply(session: ChatSession | undefined): boolean {
    const last = session?.messages[session.messages.length - 1];
    return last?.role === 'assistant' && last?.pending === true;
  }

  const pendingReplySessionId = useMemo(() => {
    if (!currentSessionId) return null;
    const session = chatSessions.find((s) => s.id === currentSessionId);
    return sessionHasPendingReply(session) ? currentSessionId : null;
  }, [chatSessions, currentSessionId]);

  // Poll сессии, пока на сервере генерируется ответ (после обновления страницы)
  useEffect(() => {
    if (!userId || !pendingReplySessionId) {
      if (replyPollRef.current) {
        clearInterval(replyPollRef.current);
        replyPollRef.current = null;
      }
      return;
    }

    setIsLoading(true);
    const sessionId = pendingReplySessionId;

    const poll = async () => {
      const { session: fresh, error } = await ChatService.getSession(sessionId);
      if (error || !fresh) return;
      setChatSessions((prev) => prev.map((s) => (s.id === sessionId ? fresh : s)));
      const last = fresh.messages[fresh.messages.length - 1];
      if (!last?.pending) {
        setIsLoading(false);
        if (replyPollRef.current) {
          clearInterval(replyPollRef.current);
          replyPollRef.current = null;
        }
      }
    };

    if (!replyPollRef.current) {
      poll();
      replyPollRef.current = setInterval(poll, 2500);
    }

    return () => {
      if (replyPollRef.current) {
        clearInterval(replyPollRef.current);
        replyPollRef.current = null;
      }
    };
  }, [userId, pendingReplySessionId]);

  // Инициализация Web Speech API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      const recognition = recognitionRef.current;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ru-RU';

      recognition.onstart = () => {
        setSpeechState(prev => ({ 
          ...prev, 
          isListening: true,
          error: null 
        }));
      };

      recognition.onresult = (event: any) => {
        if (manuallyStoppedRef.current) {
          return;
        }

        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        interimBufferRef.current = interimTranscript;

        setSpeechState(prev => ({
          ...prev,
          transcript: finalTranscript || interimTranscript,
          error: null
        }));
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);

        if (event.error === 'network') {
          if (!manuallyStoppedRef.current) {
            recognition.stop(); 
          }
          return;
        }
        
        let errorMessage = 'Unknown error';
        
        switch (event.error) {
          case 'not-allowed':
          case 'permission-denied':
            errorMessage = 'Microphone access denied. Please allow microphone access in your browser settings.';
            break;
          case 'network':
            errorMessage = 'Network error occurred during speech recognition';
            break;
          case 'audio-capture':
            errorMessage = 'No microphone found or microphone not accessible';
            break;
          default:
            errorMessage = `Speech recognition error: ${event.error}`;
        }
        
        setSpeechState(prev => ({
          ...prev,
          isListening: false,
          error: errorMessage
        }));
      };

      recognition.onend = () => {
        let interimTail: string | null = null;
        if (!manuallyStoppedRef.current && interimBufferRef.current) {
          interimTail = interimBufferRef.current;
        }
        interimBufferRef.current = '';

        const shouldClearTranscript = clearTranscriptWhenSpeechEndsRef.current;
        if (shouldClearTranscript) {
          clearTranscriptWhenSpeechEndsRef.current = false;
        }

        setSpeechState((prev) => {
          let transcript = prev.transcript;
          if (shouldClearTranscript) {
            transcript = '';
          } else if (interimTail !== null) {
            transcript = (prev.transcript + ' ' + interimTail).trim();
          }
          return {
            ...prev,
            isListening: false,
            transcript,
          };
        });

        if (!manuallyStoppedRef.current && isSpeechSupportedRef.current) {
          setTimeout(() => {
            try {
              recognition.start();
            } catch (e) {
              console.warn('Failed to restart recognition:', e);
            }
          }, 250);
        }
      };

      isSpeechSupportedRef.current = true;
      setSpeechState(prev => ({ ...prev, isSupported: true }));
    } else {
      isSpeechSupportedRef.current = false;
      console.warn('Web Speech API не поддерживается в этом браузере');
      setSpeechState(prev => ({ 
        ...prev, 
        isSupported: false,
        error: 'Web Speech API is not supported in your browser'
      }));
    }

    return () => {
      manuallyStoppedRef.current = true;
      interimBufferRef.current = '';
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Load data from Supabase or localStorage on mount
  useEffect(() => {
    const loadSessions = async () => {
      if (userId) {
        // Load from Supabase
        setIsSyncing(true);
        try {
          const { sessions, error } = await ChatService.getUserSessions();
          
          if (!error && sessions) {
            setChatSessions(sessions);
            
            if (sessions.length > 0) {
              const mostRecent = sessions[0]; // Already sorted by updated_at
              setCurrentSessionId(mostRecent.id);
            }
            // Don't create session automatically - let the UI handle it
          } else {
            console.error('Error loading sessions:', error);
            // Fallback to empty array on error
            setChatSessions([]);
          }
        } catch (err) {
          console.error('Exception loading sessions:', err);
          setChatSessions([]);
        } finally {
          setIsSyncing(false);
        }
      } else {
        // Fallback to localStorage
        const savedSessions = StorageService.getChatSessions();
        const savedCurrentSession = StorageService.getCurrentSession();

        setChatSessions(savedSessions);

        if (savedCurrentSession && savedSessions.find(s => s.id === savedCurrentSession)) {
          setCurrentSessionId(savedCurrentSession);
        } else if (savedSessions.length > 0) {
          const mostRecent = savedSessions.sort((a, b) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )[0];
          setCurrentSessionId(mostRecent.id);
        }
        // Don't create session automatically - let the UI handle it
      }
    };
    
    loadSessions();
  }, [userId]);

  // Подгрузка сообщений только для пустого списка messages (без chatSessions в deps — иначе лишние запросы и гонки)
  useEffect(() => {
    if (!userId || !currentSessionId) return;
    const session = chatSessions.find((s) => s.id === currentSessionId);
    if (!session || session.messages.length > 0) return;
    let cancelled = false;
    ChatService.getSession(currentSessionId).then(({ session: full, error }) => {
      if (cancelled || error || !full) return;
      setChatSessions((prev) =>
        prev.map((s) => {
          if (s.id !== currentSessionId) return s;
          if (s.messages.length > 0) return s;
          return full;
        })
      );
    });
    return () => {
      cancelled = true;
    };
  }, [userId, currentSessionId, chatSessions]);

  // Модель из сессии — только при смене чата (не при poll/refresh, иначе затирает changeModel)
  useEffect(() => {
    const switched = prevSessionIdForModelRef.current !== currentSessionId;
    prevSessionIdForModelRef.current = currentSessionId;

    if (!currentSessionId) return;
    const session = chatSessions.find((s) => s.id === currentSessionId);
    const fromSession = session?.selectedModel?.trim();
    if (!fromSession) return;

    if (switched) {
      setSelectedModel(fromSession);
    }
  }, [currentSessionId, chatSessions]);

  // Save sessions to Supabase or localStorage
  const saveSession = useCallback(async (session: ChatSession) => {
    if (userId) {
      try {
        const persisted = stripSessionForRemote(session);
        const ifMatch = getChatIfMatchIso(session);
        const result = await ChatService.updateSession(persisted, ifMatch);
        if (result.conflict) {
          const { session: fresh } = await ChatService.getSession(session.id);
          if (!fresh) return;
          if (session.messages.length > fresh.messages.length) {
            const tag = getChatIfMatchIso(fresh);
            const retry = await ChatService.updateSession(
              stripSessionForRemote(session),
              tag ?? null
            );
            if (retry.error || retry.conflict) {
              console.warn('saveSession: conflict retry failed', retry);
              setChatSessions((prev) => prev.map((s) => (s.id === fresh.id ? fresh : s)));
              return;
            }
            if (retry.updatedAt) {
              setChatSessions((prev) =>
                prev.map((s) =>
                  s.id === session.id
                    ? { ...session, updatedAt: retry.updatedAt!, serverUpdatedAt: retry.updatedAt! }
                    : s
                )
              );
            }
          } else {
            setChatSessions((prev) => prev.map((s) => (s.id === fresh.id ? fresh : s)));
          }
          return;
        }
        if (result.error) {
          console.error('Error saving session:', result.error);
          return;
        }
        if (result.updatedAt) {
          setChatSessions((prev) =>
            prev.map((s) =>
              s.id === session.id
                ? { ...s, updatedAt: result.updatedAt!, serverUpdatedAt: result.updatedAt! }
                : s
            )
          );
        }
      } catch (err) {
        console.error('Exception saving session:', err);
      }
    } else {
      // Fallback to localStorage - update state and save
      setChatSessions(prev => {
        const updated = prev.map(s => s.id === session.id ? session : s);
        // Save to localStorage without triggering re-render
        try {
          StorageService.saveChatSessions(updated);
        } catch (err) {
          console.error('Error saving to localStorage:', err);
        }
        return updated;
      });
    }
  }, [userId]);

  // Save selected model when it changes
  useEffect(() => {
    StorageService.saveSelectedModel(selectedModel);
  }, [selectedModel]);

  const startListening = useCallback(async () => {
    if (!speechState.isSupported) {
      setSpeechState(prev => ({
        ...prev,
        error: 'Speech recognition is not supported in your browser'
      }));
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      manuallyStoppedRef.current = false;
      clearTranscriptWhenSpeechEndsRef.current = false;
      interimBufferRef.current = '';

      setSpeechState(prev => ({ 
        ...prev, 
        transcript: '',
        error: null 
      }));
      
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setSpeechState(prev => ({
          ...prev,
          error: 'Failed to start speech recognition'
        }));
      }
    } catch (error) {
      console.error('Microphone permission denied:', error);
      setSpeechState(prev => ({
        ...prev,
        error: 'Microphone access denied. Please allow microphone access in your browser settings.'
      }));
    }
  }, [speechState.isSupported]);

  const stopListening = useCallback(() => {
    manuallyStoppedRef.current = true;
    interimBufferRef.current = '';
    if (recognitionRef.current && speechState.isSupported) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }
  }, [speechState.isSupported]);

  /** Остановка микрофона после отправки сообщения — гарантированно убирает панель «Голосовое распознано» */
  const stopListeningAfterMessageSubmit = useCallback(() => {
    clearTranscriptWhenSpeechEndsRef.current = true;
    manuallyStoppedRef.current = true;
    interimBufferRef.current = '';
    if (recognitionRef.current && speechState.isSupported) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }
  }, [speechState.isSupported]);

  const clearSpeechError = useCallback(() => {
    setSpeechState(prev => ({ 
      ...prev, 
      error: null 
    }));
  }, []);

  const createNewSession = useCallback(async () => {
    // Prevent creating multiple sessions at once
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: 'Новый чат',
      messages: [],
      selectedModel,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId
    };

    if (userId) {
      // Create in Supabase
      try {
        const { session, error } = await ChatService.createSession(userId, newSession.title, selectedModel);
        if (session && !error) {
          setChatSessions(prev => {
            // Check if session already exists (prevent duplicates)
            if (prev.some(s => s.id === session.id)) {
              return prev;
            }
            return [session, ...prev];
          });
          setCurrentSessionId(session.id);
          return session.id;
        } else {
          console.error('Error creating session:', error);
          // Fallback to local on error
          setChatSessions(prev => {
            if (prev.some(s => s.id === newSession.id)) {
              return prev;
            }
            return [newSession, ...prev];
          });
          setCurrentSessionId(newSession.id);
          return newSession.id;
        }
      } catch (err) {
        console.error('Exception creating session:', err);
        // Fallback to local on exception
        setChatSessions(prev => {
          if (prev.some(s => s.id === newSession.id)) {
            return prev;
          }
          return [newSession, ...prev];
        });
        setCurrentSessionId(newSession.id);
        return newSession.id;
      }
    }
    
    // Fallback to local
    setChatSessions(prev => {
      // Check if session already exists (prevent duplicates)
      if (prev.some(s => s.id === newSession.id)) {
        return prev;
      }
      return [newSession, ...prev];
    });
    setCurrentSessionId(newSession.id);
    return newSession.id;
  }, [selectedModel, userId]);

  const getCurrentSession = useCallback(() => {
    return chatSessions.find(session => session.id === currentSessionId);
  }, [chatSessions, currentSessionId]);

  const sendMessage = useCallback(async (
    content: string,
    images?: ImageAttachment[],
    files?: FileAttachment[],
    video?: VideoAttachment[],
    audio?: AudioAttachment[]
  ) => {
    const isError = content.includes('Ошибка распознавания:') || 
                   content.includes('Speech recognition error:') ||
                   content.includes('Microphone access denied');
    
    if (isError) {
      console.warn('Attempted to send error message, skipping');
      return;
    }

    let sessionId = currentSessionId;

    if (!sessionId) {
      sessionId = await createNewSession();
    }

    const uploadTotal = countCloudAttachmentUploads(userId, images, files, video, audio);
    const showUploadUi = uploadTotal > 0;
    let pendingMessageId: string | null = null;
    let currentMessages: Message[] = [];

    if (showUploadUi) {
      pendingMessageId = crypto.randomUUID();
      setAttachmentUploadProgress({ completed: 0, total: uploadTotal });
      const pendingMessage: Message = {
        id: pendingMessageId,
        role: 'user',
        content,
        timestamp: new Date(),
        model: selectedModel,
        images,
        files,
        video,
        audio,
        uploadingAttachments: true,
      };
      flushSync(() => {
        setChatSessions((prev) => {
          const currentSession = prev.find((s) => s.id === sessionId);
          if (!currentSession) return prev;
          currentMessages = currentSession.messages;
          const updatedMessages = [...currentSession.messages, pendingMessage];
          const isFirstMessage = currentSession.messages.filter((m) => m.role === 'user').length === 0;
          const updatedSession: ChatSession = {
            ...currentSession,
            messages: updatedMessages,
            title: isFirstMessage ? (content.length > 50 ? content.substring(0, 50) + '...' : content) : currentSession.title,
            selectedModel,
            updatedAt: new Date(),
          };
          return prev.map((s) => (s.id === sessionId ? updatedSession : s));
        });
      });
    }

    let media: Awaited<ReturnType<typeof normalizeAttachmentsForCloud>>;
    try {
      media = await normalizeAttachmentsForCloud(
        userId,
        sessionId,
        images,
        files,
        video,
        audio,
        (completed, total) => setAttachmentUploadProgress({ completed, total })
      );
    } catch (uploadErr) {
      console.error('Не удалось загрузить вложения:', uploadErr);
      setAttachmentUploadProgress(null);
      if (pendingMessageId) {
        flushSync(() => {
          setChatSessions((prev) =>
            prev.map((s) => {
              if (s.id !== sessionId) return s;
              return {
                ...s,
                messages: s.messages.filter((m) => m.id !== pendingMessageId),
              };
            })
          );
        });
      }
      return;
    }

    setAttachmentUploadProgress(null);

    const userMessage: Message = {
      id: pendingMessageId ?? crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
      model: selectedModel,
      images: media.images && media.images.length > 0 ? media.images : undefined,
      files: media.files && media.files.length > 0 ? media.files : undefined,
      video: media.video && media.video.length > 0 ? media.video : undefined,
      audio: media.audio && media.audio.length > 0 ? media.audio : undefined,
    };

    let sessionAfterUser: ChatSession | null = null;

    if (showUploadUi) {
      flushSync(() => {
        setChatSessions((prev) => {
          const currentSession = prev.find((s) => s.id === sessionId);
          if (!currentSession) return prev;
          const updatedMessages = currentSession.messages.map((m) =>
            m.id === pendingMessageId ? userMessage : m
          );
          const updatedSession: ChatSession = {
            ...currentSession,
            messages: updatedMessages,
            updatedAt: new Date(),
          };
          sessionAfterUser = updatedSession;
          return prev.map((s) => (s.id === sessionId ? updatedSession : s));
        });
      });
    } else {
      flushSync(() => {
        setChatSessions((prev) => {
          const currentSession = prev.find((s) => s.id === sessionId);
          if (!currentSession) return prev;
          currentMessages = currentSession.messages;
          const updatedMessages = [...currentSession.messages, userMessage];
          const isFirstMessage = currentSession.messages.filter((m) => m.role === 'user').length === 0;
          const updatedSession: ChatSession = {
            ...currentSession,
            messages: updatedMessages,
            title: isFirstMessage ? (content.length > 50 ? content.substring(0, 50) + '...' : content) : currentSession.title,
            selectedModel,
            updatedAt: new Date(),
          };
          sessionAfterUser = updatedSession;
          return prev.map((s) => (s.id === sessionId ? updatedSession : s));
        });
      });
    }

    const systemMessage: Message = {
      id: 'system',
      role: 'system',
      content: 'You are a helpful AI assistant, answer only russian',
      timestamp: new Date(),
    };

    const messagesForAPI = [...currentMessages, userMessage];
    const messagesHydrated = await hydrateMessagesForApi(messagesForAPI);
    const apiMessages = aiService.buildApiMessages(
      [systemMessage, ...messagesHydrated],
      selectedModel
    );

    if (userId) {
      const persistedUser = stripSessionForRemote({
        ...(sessionAfterUser || { id: sessionId, title: '', messages: [], selectedModel, createdAt: new Date(), updatedAt: new Date() }),
        messages: [userMessage],
      }).messages[0];

      setIsLoading(true);
      let replySession: ChatSession | null = null;
      let replyInProgress = false;
      try {
        const { session, error, inProgress } = await ChatService.requestReply(
          sessionId,
          persistedUser,
          selectedModel,
          apiMessages
        );
        replySession = session;
        replyInProgress = Boolean(inProgress);

        if (session) {
          setChatSessions((prev) => prev.map((s) => (s.id === sessionId ? session : s)));
        }

        if (inProgress) {
          return;
        }

        if (error && !session) {
          throw new Error(error);
        }
      } catch (error) {
        const { session: maybeUpdated } = await ChatService.getSession(sessionId);
        if (maybeUpdated && sessionHasPendingReply(maybeUpdated)) {
          setChatSessions((prev) => prev.map((s) => (s.id === sessionId ? maybeUpdated : s)));
          return;
        }
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Извините, произошла ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
          timestamp: new Date(),
          model: selectedModel,
        };
        flushSync(() => {
          setChatSessions((prev) =>
            prev.map((session) => {
              if (session.id !== sessionId) return session;
              return {
                ...session,
                messages: [...session.messages, errorMessage],
                updatedAt: new Date(),
              };
            })
          );
        });
        await saveSession(
          stripSessionForRemote({
            ...(maybeUpdated || sessionAfterUser)!,
            messages: [...(maybeUpdated?.messages || messagesForAPI), errorMessage],
          }) as ChatSession
        );
      } finally {
        if (!replyInProgress && !sessionHasPendingReply(replySession ?? undefined)) {
          setIsLoading(false);
        }
      }
      return;
    }

    if (sessionAfterUser) {
      await saveSession(sessionAfterUser);
    }

    setIsLoading(true);
    try {
      const response = await aiService.sendMessage([systemMessage, ...messagesHydrated], selectedModel);
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        model: selectedModel,
      };

      let sessionAfterAssistant: ChatSession | null = null;
      flushSync(() => {
        setChatSessions((prev) =>
          prev.map((session) => {
            if (session.id !== sessionId) return session;
            const updatedSession: ChatSession = {
              ...session,
              messages: [...session.messages, assistantMessage],
              updatedAt: new Date(),
            };
            sessionAfterAssistant = updatedSession;
            return updatedSession;
          })
        );
      });
      if (sessionAfterAssistant) {
        await saveSession(sessionAfterAssistant);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Извините, произошла ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
        timestamp: new Date(),
        model: selectedModel,
      };

      let sessionAfterErr: ChatSession | null = null;
      flushSync(() => {
        setChatSessions((prev) =>
          prev.map((session) => {
            if (session.id !== sessionId) return session;
            const updatedSession: ChatSession = {
              ...session,
              messages: [...session.messages, errorMessage],
              updatedAt: new Date(),
            };
            sessionAfterErr = updatedSession;
            return updatedSession;
          })
        );
      });
      if (sessionAfterErr) {
        await saveSession(sessionAfterErr);
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentSessionId, selectedModel, userId, aiService, createNewSession, saveSession]);

  const clearCurrentChat = useCallback(async () => {
    if (currentSessionId) {
      setChatSessions(prev => prev.map(session => {
        if (session.id === currentSessionId) {
          const updatedSession: ChatSession = {
            ...session,
            messages: [],
            title: 'Новый чат',
            updatedAt: new Date(),
          };
          
          saveSession(updatedSession);
          
          return updatedSession;
        }
        return session;
      }));
    }
  }, [currentSessionId, userId]);

  const deleteSession = useCallback(async (sessionId: string) => {
    if (userId) {
      // Delete from Supabase
      const { error } = await ChatService.deleteSession(sessionId);
      if (error) {
        console.error('Error deleting session:', error);
        return;
      }
    }
    
    setChatSessions(prev => {
      const filtered = prev.filter(session => session.id !== sessionId);
      
      if (sessionId === currentSessionId) {
        if (filtered.length > 0) {
          const mostRecent = filtered.sort((a, b) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )[0];
          setCurrentSessionId(mostRecent.id);
        } else {
          setCurrentSessionId(null);
        }
      }
      
      return filtered;
    });
  }, [currentSessionId, userId]);

  const switchToSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
  }, []);

  const changeModel = useCallback(
    async (modelId: string) => {
      setSelectedModel(modelId);

      if (!currentSessionId) return;

      let updatedSession: ChatSession | null = null;
      setChatSessions((prev) =>
        prev.map((session) => {
          if (session.id !== currentSessionId) return session;
          updatedSession = {
            ...session,
            selectedModel: modelId,
            updatedAt: new Date(),
          };
          return updatedSession;
        })
      );

      if (updatedSession) {
        await saveSession(updatedSession);
      }
    },
    [currentSessionId, saveSession]
  );

  const sendVoiceMessage = useCallback(() => {
    const text = speechState.transcript.trim();
    if (!text || speechState.error) return;
    stopListeningAfterMessageSubmit();
    sendMessage(text);
  }, [speechState.transcript, speechState.error, sendMessage, stopListeningAfterMessageSubmit]);

  const setSpeechTranscript = useCallback((transcript: string) => {
    if (transcript === '') {
      interimBufferRef.current = '';
    }
    setSpeechState(prev => ({ 
      ...prev, 
      transcript,
      error: null 
    }));
  }, []);

  const currentSession = getCurrentSession();
  const messages = currentSession?.messages || [];

  return {
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
    // Голосовой ввод
    speechState,
    startListening,
    stopListening,
    stopListeningAfterMessageSubmit,
    sendVoiceMessage,
    setSpeechTranscript,
    clearSpeechError
  };
};
