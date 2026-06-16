import React, { useState, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Zap, ArrowRight, Brain, Video, MessageSquare, Layers, FileText, Crown, CheckCircle2, Code, Eye, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AI_MODELS } from '../constants/models';
import { ModelCard } from '../components/ModelCard';
import PixelTrail from '../components/PixelTrail/PixelTrail';
import { useAuth } from '../contexts/AuthContext';
import { usePlanConfig } from '../hooks/usePlanConfig';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { disabledModelIds, loading: planConfigLoading } = usePlanConfig();
  const enabledChatModels = useMemo(() => {
    if (planConfigLoading) return AI_MODELS;
    const off = new Set(disabledModelIds);
    return AI_MODELS.filter((m) => !off.has(m.id));
  }, [planConfigLoading, disabledModelIds]);
  const carouselModels = useMemo(() => enabledChatModels.slice(0, 6), [enabledChatModels]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleSelectModel = (modelId: string) => {
    // Проверяем авторизацию перед переходом к чату
    if (!user) {
      navigate('/login?redirect=/chat?model=' + modelId + '&new=true');
      return;
    }
    navigate(`/chat?model=${modelId}&new=true`);
  };

  const handleNavigateToProtected = (path: string) => {
    if (!user) {
      navigate(`/login?redirect=${path}`);
      return;
    }
    navigate(path);
  };

  const scrollToSlide = (index: number) => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const cardWidth = container.offsetWidth / 3;
      container.scrollTo({
        left: cardWidth * index,
        behavior: 'smooth'
      });
      setCurrentSlide(index);
    }
  };

  const handlePrevSlide = () => {
    const newIndex = Math.max(0, currentSlide - 1);
    scrollToSlide(newIndex);
  };

  const handleNextSlide = () => {
    const maxIndex = Math.max(0, carouselModels.length - 3);
    const newIndex = Math.min(maxIndex, currentSlide + 1);
    scrollToSlide(newIndex);
  };

  const stats = [
    { icon: Brain, value: enabledChatModels.length, label: 'AI моделей в каталоге', color: 'from-blue-500 to-cyan-500' },
    { icon: Layers, value: '3', label: 'Режима: чат, изображения, видео', color: 'from-purple-500 to-pink-500' },
    { icon: FileText, value: 'PDF', label: 'Файлы и документы в диалогах', color: 'from-pink-500 to-rose-500' },
    { icon: Crown, value: '2', label: 'Тарифа: Free и Premium', color: 'from-primary-500 to-purple-600' },
  ];

  const features = [
    {
      icon: Code,
      title: 'Работа с кодом',
      description: 'Помощь в написании, отладке и оптимизации кода на любых языках программирования',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Brain,
      title: 'Сложные рассуждения',
      description: 'Глубокий анализ проблем, стратегическое планирование и решение комплексных задач',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: Eye,
      title: 'Анализ изображений',
      description: 'Распознавание и описание изображений, визуальный анализ контента',
      color: 'from-pink-500 to-rose-500'
    },
    {
      icon: Video,
      title: 'Генерация видео',
      description: 'Создание качественных видео из текстовых описаний с помощью AI',
      color: 'from-purple-500 via-pink-500 to-rose-500'
    },
    {
      icon: MessageSquare,
      title: 'Умные чаты',
      description: 'Интеллектуальные беседы с сохранением истории и контекста',
      color: 'from-primary-500 to-purple-600'
    },
    {
      icon: Zap,
      title: 'Быстрые ответы',
      description: 'Мгновенная обработка запросов и генерация решений',
      color: 'from-yellow-500 to-orange-500'
    },
  ];

  const useCases = [
    {
      title: 'Разработка',
      description: 'Помощь в написании кода, поиске ошибок и оптимизации',
      icon: Code,
      examples: ['Генерация функций', 'Отладка кода', 'Рефакторинг']
    },
    {
      title: 'Обучение',
      description: 'Объяснение сложных концепций и помощь в изучении',
      icon: Brain,
      examples: ['Объяснение тем', 'Решение задач', 'Подготовка к экзаменам']
    },
    {
      title: 'Контент',
      description: 'Создание текстов, статей и визуального контента',
      icon: Sparkles,
      examples: ['Написание статей', 'Генерация видео', 'Создание изображений']
    },
  ];

  // Animation variants
  const fadeInUp = {
    hidden: { opacity: 0, y: 60 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  };

  const fadeIn = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  };

  const scaleIn = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemAnimation = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  };

  return (
    <div className="relative flex-1 min-h-0 overflow-y-auto bg-background-darker">
      <div className="fixed inset-0 z-0 overflow-hidden">
        <PixelTrail
          gridSize={50}
          trailSize={0.1}
          maxAge={250}
          interpolate={5}
          color="#8b5cf6"
          gooeyFilter={{ id: 'custom-goo-filter', strength: 2 }}
          gooeyEnabled
          gooStrength={2}
        />
      </div>
      {/* Hero Section */}
      <section className="relative z-10 overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 py-20 sm:px-6 lg:px-8">
          <motion.div 
            className="text-center mb-16"
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
          >
            <motion.div className="mb-6 max-w-2xl mx-auto w-full" variants={fadeIn}>
              <button
                type="button"
                onClick={() => handleSelectModel('kimi-k2.7-code')}
                className="w-full text-left rounded-xl border border-pink-400/35 bg-gradient-to-r from-pink-500/15 via-violet-600/10 to-primary-500/15 px-5 py-4 shadow-lg shadow-pink-900/20 hover:border-pink-300/50 hover:from-pink-500/25 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="shrink-0 w-12 h-12 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center p-1.5">
                    <img
                      src="/logos/moonshot.png"
                      alt="Moonshot AI"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-semibold text-base sm:text-lg group-hover:text-pink-100 transition-colors">
                      Kimi K2.7 Code — новая модель от Moonshot AI
                    </p>
                    <p className="text-sm text-gray-400 mt-0.5">
                      Код, рассуждения и изображения в одном чате - нажмите, чтобы начать диалог.
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-pink-200/80 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            </motion.div>

            <motion.div 
              className="mb-6 flex justify-center"
              variants={fadeIn}
            >
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-primary-500/20 rounded-full animate-pulse">
                <Sparkles className="w-8 h-8 text-white" />
                <h1 className="text-4xl font-bold text-white">AI Assistant</h1>
              </div>
            </motion.div>

            <motion.h2 
              className="text-5xl sm:text-6xl font-extrabold text-white mb-6 leading-tight"
              variants={fadeInUp}
            >
              Ваш умный помощник
              <br />
              <span className="text-primary-400">
                для любых задач
              </span>
            </motion.h2>
            
            <motion.p 
              className="text-xl text-gray-400 text-white max-w-3xl mx-auto mb-12"
              variants={fadeInUp}
            >
              Мощная платформа с множеством AI моделей для решения любых задач. 
              От написания кода до генерации видео - все в одном месте.
            </motion.p>

            {/* Stats */}
            <motion.div 
              className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-12"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
            >
              {stats.map((stat, index) => (
                <motion.div
                  key={index}
                  className="bg-background-card backdrop-blur-sm border border-primary-900/30 rounded-xl p-4 hover:border-primary-600 transition-all"
                  variants={itemAnimation}
                >
                  <div className="w-12 h-12 bg-primary-500/20 rounded-lg flex items-center justify-center mb-3 mx-auto">
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
                  <div className="text-sm text-gray-500">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>

            {/* CTA Buttons */}
            <motion.div 
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
              variants={fadeInUp}
            >
              <button
                onClick={() => navigate('/models')}
                className="inline-flex items-center gap-2 px-8 py-4 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 transition-all text-lg"
              >
                <Brain className="w-5 h-5" />
                Выбрать модель
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleNavigateToProtected('/creative-lab')}
                className="inline-flex items-center gap-2 px-8 py-4 bg-background-card border border-primary-900/30 text-white rounded-xl font-semibold hover:bg-background-hover hover:border-primary-600 transition-all text-lg"
              >
                <Video className="w-5 h-5" />
                Создать видео
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
          >
            <h2 className="text-4xl font-bold text-white mb-4">Возможности платформы</h2>
            <p className="text-gray-400 text-white text-lg">Все инструменты для работы с AI в одном месте</p>
          </motion.div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className="bg-background-card border border-primary-900/30 rounded-xl p-6 hover:border-primary-600 transition-all group"
                variants={itemAnimation}
              >
                <div className="w-14 h-14 bg-primary-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary-400 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-400 text-sm">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="relative z-10 py-20 px-4 bg-background-card/30">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
          >
            <h2 className="text-4xl font-bold text-white mb-4">Примеры использования</h2>
            <p className="text-gray-400 text-white text-lg">Как можно использовать платформу</p>
          </motion.div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            {useCases.map((useCase, index) => (
              <motion.div
                key={index}
                className="bg-background-card border border-primary-900/30 rounded-xl p-6 hover:border-primary-600 transition-all"
                variants={scaleIn}
              >
                <div className="w-12 h-12 bg-primary-500/20 rounded-lg flex items-center justify-center mb-4">
                  <useCase.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{useCase.title}</h3>
                <p className="text-gray-400 text-sm mb-4">{useCase.description}</p>
                <ul className="space-y-2">
                  {useCase.examples.map((example, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-300 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary-400 flex-shrink-0" />
                      <span>{example}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative z-10 py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
          >
            <h2 className="text-4xl font-bold text-white mb-4">Как это работает</h2>
            <p className="text-gray-400 text-white text-lg">Простой процесс в несколько шагов</p>
          </motion.div>

          <motion.div 
            className="flex flex-col md:flex-row items-stretch justify-center gap-6"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
          >
            {[
              { step: '1', title: 'Выберите модель', description: 'Выберите подходящую AI модель из каталога', icon: Brain },
              { step: '2', title: 'Начните диалог', description: 'Создайте новый чат и начните общение', icon: MessageSquare },
              { step: '3', title: 'Получите ответ', description: 'AI обработает ваш запрос и даст ответ', icon: Sparkles },
              { step: '4', title: 'Используйте результат', description: 'Используйте полученную информацию для своих задач', icon: CheckCircle2 },
            ].map((item, index) => (
              <motion.div 
                key={index} 
                className="relative w-full md:w-auto md:flex-1 md:max-w-[280px]"
                variants={scaleIn}
              >
                <div className="bg-background-card border border-primary-900/30 rounded-xl p-6 text-center h-full flex flex-col">
                  <div className="w-16 h-16 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-white">{item.step}</span>
                  </div>
                  <div className="w-12 h-12 bg-gradient-primary/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-6 h-6 text-primary-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-gray-400 text-sm flex-grow">{item.description}</p>
                </div>
                
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Models Preview Section */}
      <section className="relative z-10 py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
          >
            <h2 className="text-4xl font-bold text-white mb-4">Популярные модели</h2>
            <p className="text-gray-400 text-white text-lg">Выберите модель для начала работы</p>
          </motion.div>

          <div className="relative">
            <button
              onClick={handlePrevSlide}
              disabled={currentSlide === 0}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-12 h-12 bg-background-card border border-primary-900/30 hover:bg-background-hover hover:border-primary-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-full flex items-center justify-center text-white shadow-xl transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <div ref={scrollContainerRef} className="overflow-hidden py-6 px-3">
              <motion.div 
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
              >
                {carouselModels.map((model, index) => (
                  <motion.div 
                    key={model.id}
                    variants={itemAnimation}
                  >
                    <ModelCard
                      model={model}
                      onSelect={handleSelectModel}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>

            <button
              onClick={handleNextSlide}
              disabled={currentSlide >= Math.max(0, carouselModels.length - 3)}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-12 h-12 bg-background-card border border-primary-900/30 hover:bg-background-hover hover:border-primary-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-full flex items-center justify-center text-white shadow-xl transition-all"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          <motion.div 
            className="flex justify-center mt-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={fadeInUp}
          >
            <button
              onClick={() => navigate('/models')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-background-card border border-primary-900/30 text-white rounded-lg font-medium hover:bg-background-hover hover:border-primary-600 transition-all"
            >
              Посмотреть все модели
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div 
            className="bg-white/[0.03] border border-white/10 rounded-2xl p-12 text-center backdrop-blur-sm"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={scaleIn}
          >
            <motion.div 
              className="w-20 h-20 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-6"
              variants={fadeIn}
              transition={{ delay: 0.2 }}
            >
              <Sparkles className="w-10 h-10 text-white" />
            </motion.div>
            <motion.h2 
              className="text-4xl font-bold text-white mb-4"
              variants={fadeInUp}
              transition={{ delay: 0.3 }}
            >
              Готовы начать?
            </motion.h2>
            <motion.p 
              className="text-xl text-gray-300 mb-8"
              variants={fadeInUp}
              transition={{ delay: 0.4 }}
            >
              Зарегистрируйтесь и попробуйте чат, генерацию изображений или видео — всё в одном аккаунте
            </motion.p>
            <motion.div 
              className="flex flex-col sm:flex-row gap-4 justify-center"
              variants={fadeInUp}
              transition={{ delay: 0.5 }}
            >
              <button
                onClick={() => navigate('/models')}
                className="inline-flex items-center gap-2 px-8 py-4 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 transition-all text-lg"
              >
                <Play className="w-5 h-5" />
                Начать сейчас
              </button>
              <button
                onClick={() => handleNavigateToProtected('/chat')}
                className="inline-flex items-center gap-2 px-8 py-4 bg-background-card border border-primary-900/30 text-white rounded-xl font-semibold hover:bg-background-hover hover:border-primary-600 transition-all text-lg"
              >
                <MessageSquare className="w-5 h-5" />
                Открыть чаты
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-12 px-4 border-t border-primary-900/30">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-500">
            © 2026 AI Assistant
          </p>
        </div>
      </footer>
    </div>
  );
};
