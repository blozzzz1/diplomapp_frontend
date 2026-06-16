# AI Assistant Platform

<div align="center">

![AI Assistant](https://img.shields.io/badge/AI-Assistant-blue?style=for-the-badge)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase)

**Мощная платформа для работы с AI моделями: чаты, генерация изображений и видео**

[Документация](#-документация) • [Установка](#-быстрый-старт) • [Возможности](#-основные-возможности)

</div>

---

## 📋 Оглавление

- [Описание](#-описание)
- [Основные возможности](#-основные-возможности)
- [Технологии](#-технологии)
- [Быстрый старт](#-быстрый-старт)
- [Структура проекта](#-структура-проекта)
- [Настройка](#-настройка)
- [Документация](#-документация)
- [Скриншоты](#-скриншоты)
- [Разработка](#-разработка)
- [Безопасность](#-безопасность)
- [Лицензия](#-лицензия)

---

## 🎯 Описание

AI Assistant Platform — это полнофункциональное веб-приложение для работы с различными AI моделями. Платформа предоставляет единый интерфейс для общения с AI, генерации изображений и видео, а также включает административную панель для управления системой.

### Ключевые особенности:

- 🤖 **Множество AI моделей** — поддержка различных моделей (GPT, Claude, Gemini и др.)
- 💬 **Умные чаты** — сохранение истории, контекста и выбранной модели
- 🎨 **Генерация изображений** — создание изображений из текстовых описаний
- 🎬 **Генерация видео** — создание видео с помощью PixVerse и AITunnel
- 👥 **Управление пользователями** — административная панель с полным контролем
- 🔒 **Безопасность** — защита данных через Row Level Security (RLS)
- 📱 **Адаптивный дизайн** — работает на всех устройствах
- ✨ **Современный UI** — красивые анимации и интуитивный интерфейс

---

## ✨ Основные возможности

### Для пользователей:

- ✅ **Регистрация и авторизация** через Supabase Auth
- ✅ **Чат с AI моделями** с сохранением истории
- ✅ **Генерация изображений** из текстовых описаний
- ✅ **Генерация видео** из текстовых описаний
- ✅ **История генераций** — просмотр всех созданных изображений и видео
- ✅ **Управление аккаунтом** — настройки профиля
- ✅ **Публичный доступ** — просмотр моделей и главной страницы без регистрации

### Для администраторов:

- ✅ **Управление пользователями** — просмотр, блокировка, разблокировка
- ✅ **Системные настройки** — управление регистрацией и другими параметрами
- ✅ **Управление моделями** — включение/выключение моделей
- ✅ **Логи активности** — отслеживание действий пользователей
- ✅ **Управление администраторами** — добавление/удаление админов (только для супер-админов)

---

## 🛠 Технологии

### Frontend:

- **React 18.3** — UI библиотека
- **TypeScript 5.5** — типизация
- **Vite 5.4** — сборщик и dev-сервер
- **React Router DOM 7.11** — маршрутизация
- **Tailwind CSS 3.4** — стилизация
- **Framer Motion 12.0** — анимации
- **Lucide React** — иконки
- **React Markdown** — рендеринг markdown
- **Supabase JS 2.89** — клиент для Supabase

### Backend:

- **Express.js 4.18** — веб-фреймворк
- **TypeScript 5.5** — типизация
- **Supabase JS 2.89** — работа с БД
- **CORS 2.8** — настройка CORS
- **dotenv 16.4** — переменные окружения

### База данных и инфраструктура:

- **Supabase** — PostgreSQL база данных
- **Supabase Auth** — аутентификация
- **Supabase Storage** — хранение видео
- **Row Level Security (RLS)** — безопасность данных

---

## 🚀 Быстрый старт

### Предварительные требования

- Node.js 18+ и npm
- Аккаунт Supabase ([supabase.com](https://supabase.com))
- API ключи (опционально):
  - Intelligence.io (для AI чатов)
  - AITunnel (для моделей Sora, Wan)

### Установка

1. **Клонируйте репозиторий:**
```bash
git clone <repository-url>
cd "final3 feature back"
```

2. **Установите зависимости фронтенда:**
```bash
npm install
```

3. **Установите зависимости бэкенда:**
```bash
cd backend
npm install
cd ..
```

4. **Настройте Supabase:**
   - Создайте проект на [supabase.com](https://supabase.com)
   - Отключите подтверждение email (Authentication → Providers → Email → Confirm email: OFF)
   - Выполните SQL скрипты в Supabase SQL Editor:
     - `supabase-setup.sql` — основная настройка
     - `generations-setup.sql` — таблицы для генераций
     - `admin-setup.sql` — административная панель
     - `backend-sql-functions.sql` — функции для бэкенда
     - `generations-sql-functions.sql` — функции для генераций

5. **Настройте переменные окружения:**

   **Backend** (создайте `backend/.env`):
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   PORT=3001
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173
   ```

   **Frontend** (создайте `.env` в корне проекта):
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key
   VITE_AI_API_KEY=your_intelligence_io_key
   VITE_AITUNNEL_API_KEY=your_aitunnel_key
   VITE_API_BASE_URL=http://localhost:3001
   ```

6. **Запустите приложение:**

   **Терминал 1 — Backend:**
   ```bash
   cd backend
   npm run dev
   ```

   **Терминал 2 — Frontend:**
   ```bash
   npm run dev
   ```

7. **Откройте браузер:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

---

## 📁 Структура проекта

```
├── src/                        
│   ├── components/            # React компоненты
│   │   ├── Header.tsx
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── ChatInterface.tsx
│   │   ├── ModelCard.tsx
│   │   ├── ProtectedRoute.tsx
│   │   ├── AdminRoute.tsx
│   │   └── ...
│   ├── pages/                 # Страницы
│   │   ├── HomePage.tsx       # Главная страница
│   │   ├── ChatPage.tsx       # Страница чата
│   │   ├── ModelsPage.tsx     # Каталог моделей
│   │   ├── VideoPage.tsx      # Генерация видео
│   │   ├── ImagePage.tsx      # Генерация изображений
│   │   ├── ToolsPage.tsx      # Инструменты
│   │   ├── AccountPage.tsx    # Личный кабинет
│   │   ├── AdminPage.tsx      # Админ-панель
│   │   └── NotFoundPage.tsx
│   ├── services/              # API сервисы
│   │   ├── authService.ts
│   │   ├── chatService.ts
│   │   ├── aiService.ts
│   │   ├── videoService.ts
│   │   ├── imageService.ts
│   │   ├── adminService.ts
│   │   └── generationService.ts
│   ├── contexts/              # React контексты
│   │   ├── AuthContext.tsx
│   │   └── ThemeContext.tsx
│   ├── constants/             # Константы
│   │   ├── models.ts          # AI модели
│   │   ├── videoModels.ts     # Модели для видео
│   │   ├── imageModels.ts     # Модели для изображений
│   │   └── tools.ts           # Инструменты
│   ├── hooks/                 # Кастомные хуки
│   │   └── useChat.ts
│   ├── config/                # Конфигурация
│   │   ├── supabase.ts
│   │   └── api.ts
│   ├── types/                 # TypeScript типы
│   ├── utils/                 # Утилиты
│   ├── App.tsx                # Главный компонент
│   ├── main.tsx               # Точка входа
│   └── index.css              # Глобальные стили
│
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

