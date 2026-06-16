-- ============================================================================
-- Полная схема БД для self-hosted Supabase / PostgreSQL (проект chat + админка + генерации)
-- Запуск: один раз в SQL Editor (пустая БД с уже созданной схемой auth через Supabase).
-- Повторный запуск: таблицы IF NOT EXISTS; политики — DROP IF EXISTS + CREATE.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- Общая функция для триггеров updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. Чаты
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  selected_model TEXT NOT NULL,
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON public.chat_sessions(updated_at DESC);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can view own chat sessions"
  ON public.chat_sessions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can insert own chat sessions"
  ON public.chat_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can update own chat sessions"
  ON public.chat_sessions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can delete own chat sessions"
  ON public.chat_sessions FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON public.chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 2. Планы и платежи
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_plans (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own plan" ON public.user_plans;
CREATE POLICY "Users can read own plan"
  ON public.user_plans FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('free', 'premium')),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RUB',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('card', 'sbp')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'refunded', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own transactions" ON public.transactions;
CREATE POLICY "Users can read own transactions"
  ON public.transactions FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE public.transactions IS 'История платежей; запись через service role';
COMMENT ON TABLE public.user_plans IS 'План подписки; обновление через service role';

-- ============================================================================
-- 3. Админка
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT,
  blocked_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.model_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN DEFAULT true,
  reason TEXT,
  disabled_by UUID REFERENCES auth.users(id),
  disabled_at TIMESTAMPTZ,
  enabled_by UUID REFERENCES auth.users(id),
  enabled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admins_user_id ON public.admins(user_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_user_id ON public.user_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_is_active ON public.user_blocks(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_blocks_unique_active
  ON public.user_blocks(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_model_settings_model_id ON public.model_settings(model_id);
CREATE INDEX IF NOT EXISTS idx_model_settings_is_enabled ON public.model_settings(is_enabled);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id ON public.user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_created_at ON public.user_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_action_type ON public.user_activity_log(action_type);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view admins" ON public.admins;
CREATE POLICY "Admins can view admins" ON public.admins FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Super admins can insert admins" ON public.admins;
CREATE POLICY "Super admins can insert admins" ON public.admins FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid() AND a.role = 'super_admin'));

DROP POLICY IF EXISTS "Super admins can update admins" ON public.admins;
CREATE POLICY "Super admins can update admins" ON public.admins FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid() AND a.role = 'super_admin'));

DROP POLICY IF EXISTS "Admins can view system settings" ON public.system_settings;
CREATE POLICY "Admins can view system settings" ON public.system_settings FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can update system settings" ON public.system_settings;
CREATE POLICY "Admins can update system settings" ON public.system_settings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can insert system settings" ON public.system_settings;
CREATE POLICY "Admins can insert system settings" ON public.system_settings FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can view user blocks" ON public.user_blocks;
CREATE POLICY "Admins can view user blocks" ON public.user_blocks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can block users" ON public.user_blocks;
CREATE POLICY "Admins can block users" ON public.user_blocks FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can update user blocks" ON public.user_blocks;
CREATE POLICY "Admins can update user blocks" ON public.user_blocks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Everyone can view model settings" ON public.model_settings;
CREATE POLICY "Everyone can view model settings" ON public.model_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update model settings" ON public.model_settings;
CREATE POLICY "Admins can update model settings" ON public.model_settings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can insert model settings" ON public.model_settings;
CREATE POLICY "Admins can insert model settings" ON public.model_settings FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can view activity logs" ON public.user_activity_log;
CREATE POLICY "Admins can view activity logs" ON public.user_activity_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "System can insert activity logs" ON public.user_activity_log;
CREATE POLICY "System can insert activity logs" ON public.user_activity_log FOR INSERT WITH CHECK (true);

DROP TRIGGER IF EXISTS update_admins_updated_at ON public.admins;
CREATE TRIGGER update_admins_updated_at
  BEFORE UPDATE ON public.admins FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_blocks_updated_at ON public.user_blocks;
CREATE TRIGGER update_user_blocks_updated_at
  BEFORE UPDATE ON public.user_blocks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_model_settings_updated_at ON public.model_settings;
CREATE TRIGGER update_model_settings_updated_at
  BEFORE UPDATE ON public.model_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.system_settings (key, value, description)
VALUES
  ('registration_enabled', 'true'::jsonb, 'Enable/disable user registration'),
  ('maintenance_mode', 'false'::jsonb, 'Enable/disable maintenance mode')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.admins WHERE user_id = user_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_user_blocked(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE user_id = user_uuid AND is_active = true
      AND (blocked_until IS NULL OR blocked_until > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_registration_enabled()
RETURNS BOOLEAN AS $$
DECLARE
  setting_value JSONB;
BEGIN
  SELECT value INTO setting_value FROM public.system_settings WHERE key = 'registration_enabled';
  RETURN COALESCE((setting_value)::boolean, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_model_enabled(model_id_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (SELECT is_enabled FROM public.model_settings WHERE model_id = model_id_param),
    true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. Генерации изображений и видео (с is_public)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.image_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  quality TEXT,
  size TEXT,
  output_format TEXT,
  num_images INTEGER DEFAULT 1,
  image_urls JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'completed',
  error_message TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.video_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  video_id TEXT,
  video_url TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  aspect_ratio TEXT,
  duration INTEGER,
  quality TEXT,
  motion_mode TEXT,
  style TEXT,
  camera_movement TEXT,
  seed INTEGER,
  water_mark BOOLEAN DEFAULT false,
  size TEXT,
  seconds INTEGER,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Старые инсталляции без is_public: колонки до индексов по ним
ALTER TABLE public.image_generations ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.video_generations ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_image_generations_user_id ON public.image_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_image_generations_created_at ON public.image_generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_generations_user_id ON public.video_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_video_generations_created_at ON public.video_generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_generations_video_id ON public.video_generations(video_id);
CREATE INDEX IF NOT EXISTS idx_image_generations_is_public ON public.image_generations(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_video_generations_is_public ON public.video_generations(is_public) WHERE is_public = true;

ALTER TABLE public.image_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own image generations" ON public.image_generations;
CREATE POLICY "Users can view own image generations" ON public.image_generations FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own image generations" ON public.image_generations;
CREATE POLICY "Users can insert own image generations" ON public.image_generations FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own image generations" ON public.image_generations;
CREATE POLICY "Users can update own image generations" ON public.image_generations FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own image generations" ON public.image_generations;
CREATE POLICY "Users can delete own image generations" ON public.image_generations FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own video generations" ON public.video_generations;
CREATE POLICY "Users can view own video generations" ON public.video_generations FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own video generations" ON public.video_generations;
CREATE POLICY "Users can insert own video generations" ON public.video_generations FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own video generations" ON public.video_generations;
CREATE POLICY "Users can update own video generations" ON public.video_generations FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own video generations" ON public.video_generations;
CREATE POLICY "Users can delete own video generations" ON public.video_generations FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_image_generations_updated_at ON public.image_generations;
CREATE TRIGGER update_image_generations_updated_at
  BEFORE UPDATE ON public.image_generations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_video_generations_updated_at ON public.video_generations;
CREATE TRIGGER update_video_generations_updated_at
  BEFORE UPDATE ON public.video_generations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 5. RPC: чаты (service role)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_chat_session(
  p_id UUID,
  p_user_id UUID,
  p_title TEXT,
  p_selected_model TEXT,
  p_messages JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  id UUID, user_id UUID, title TEXT, selected_model TEXT, messages JSONB,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.chat_sessions (id, user_id, title, selected_model, messages, created_at, updated_at)
  VALUES (p_id, p_user_id, p_title, p_selected_model, p_messages, NOW(), NOW());
  RETURN QUERY
  SELECT cs.id, cs.user_id, cs.title, cs.selected_model, cs.messages, cs.created_at, cs.updated_at
  FROM public.chat_sessions cs WHERE cs.id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_chat_session(
  p_id UUID,
  p_user_id UUID,
  p_title TEXT,
  p_selected_model TEXT,
  p_messages JSONB,
  p_expected_updated_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id UUID, user_id UUID, title TEXT, selected_model TEXT, messages JSONB,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rows_updated integer;
BEGIN
  IF p_expected_updated_at IS NULL THEN
    UPDATE public.chat_sessions SET
      title = p_title, selected_model = p_selected_model, messages = p_messages, updated_at = NOW()
    WHERE id = p_id AND user_id = p_user_id;
  ELSE
    UPDATE public.chat_sessions SET
      title = p_title, selected_model = p_selected_model, messages = p_messages, updated_at = NOW()
    WHERE id = p_id AND user_id = p_user_id
      AND date_trunc('milliseconds', updated_at)
        = date_trunc('milliseconds', p_expected_updated_at::timestamptz);
  END IF;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  IF p_expected_updated_at IS NOT NULL AND rows_updated = 0 THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT cs.id, cs.user_id, cs.title, cs.selected_model, cs.messages, cs.created_at, cs.updated_at
  FROM public.chat_sessions cs WHERE cs.id = p_id AND cs.user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_chat_sessions(p_user_id UUID)
RETURNS TABLE (
  id UUID, user_id UUID, title TEXT, selected_model TEXT, messages JSONB,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT cs.id, cs.user_id, cs.title, cs.selected_model, cs.messages, cs.created_at, cs.updated_at
  FROM public.chat_sessions cs WHERE cs.user_id = p_user_id ORDER BY cs.updated_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_chat_session(p_id UUID, p_user_id UUID)
RETURNS TABLE (
  id UUID, user_id UUID, title TEXT, selected_model TEXT, messages JSONB,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT cs.id, cs.user_id, cs.title, cs.selected_model, cs.messages, cs.created_at, cs.updated_at
  FROM public.chat_sessions cs WHERE cs.id = p_id AND cs.user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_chat_sessions_sidebar(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  selected_model TEXT,
  message_count INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cs.id,
    cs.user_id,
    cs.title,
    cs.selected_model,
    COALESCE(jsonb_array_length(COALESCE(cs.messages, '[]'::jsonb)), 0)::INTEGER AS message_count,
    cs.created_at,
    cs.updated_at
  FROM public.chat_sessions cs
  WHERE cs.user_id = p_user_id
  ORDER BY cs.updated_at DESC
  LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.delete_chat_session(p_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.chat_sessions WHERE id = p_id AND user_id = p_user_id;
  RETURN FOUND;
END;
$$;

-- ============================================================================
-- 6. RPC: генерации (service role), с is_public
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_image_generation(
  p_id UUID, p_user_id UUID, p_model TEXT, p_prompt TEXT,
  p_negative_prompt TEXT DEFAULT NULL, p_quality TEXT DEFAULT NULL, p_size TEXT DEFAULT NULL,
  p_output_format TEXT DEFAULT NULL, p_num_images INTEGER DEFAULT 1,
  p_image_urls JSONB DEFAULT '[]'::jsonb, p_status TEXT DEFAULT 'completed',
  p_error_message TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID, user_id UUID, model TEXT, prompt TEXT, negative_prompt TEXT, quality TEXT, size TEXT,
  output_format TEXT, num_images INTEGER, image_urls JSONB, status TEXT, error_message TEXT,
  is_public BOOLEAN, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.image_generations (
    id, user_id, model, prompt, negative_prompt, quality, size, output_format,
    num_images, image_urls, status, error_message, created_at, updated_at
  ) VALUES (
    p_id, p_user_id, p_model, p_prompt, p_negative_prompt, p_quality, p_size, p_output_format,
    p_num_images, p_image_urls, p_status, p_error_message, NOW(), NOW()
  );
  RETURN QUERY
  SELECT ig.id, ig.user_id, ig.model, ig.prompt, ig.negative_prompt, ig.quality, ig.size,
    ig.output_format, ig.num_images, ig.image_urls, ig.status, ig.error_message, ig.is_public,
    ig.created_at, ig.updated_at
  FROM public.image_generations ig WHERE ig.id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_image_generation(
  p_id UUID, p_user_id UUID,
  p_image_urls JSONB DEFAULT NULL, p_status TEXT DEFAULT NULL, p_error_message TEXT DEFAULT NULL,
  p_is_public BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
  id UUID, user_id UUID, model TEXT, prompt TEXT, negative_prompt TEXT, quality TEXT, size TEXT,
  output_format TEXT, num_images INTEGER, image_urls JSONB, status TEXT, error_message TEXT,
  is_public BOOLEAN, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.image_generations SET
    image_urls = COALESCE(p_image_urls, image_urls),
    status = COALESCE(p_status, status),
    error_message = COALESCE(p_error_message, error_message),
    is_public = COALESCE(p_is_public, is_public),
    updated_at = NOW()
  WHERE id = p_id AND user_id = p_user_id;
  RETURN QUERY
  SELECT ig.id, ig.user_id, ig.model, ig.prompt, ig.negative_prompt, ig.quality, ig.size,
    ig.output_format, ig.num_images, ig.image_urls, ig.status, ig.error_message, ig.is_public,
    ig.created_at, ig.updated_at
  FROM public.image_generations ig WHERE ig.id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_video_generation(
  p_id UUID, p_user_id UUID, p_model TEXT, p_prompt TEXT,
  p_negative_prompt TEXT DEFAULT NULL, p_video_id TEXT DEFAULT NULL, p_video_url TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'pending', p_error_message TEXT DEFAULT NULL,
  p_aspect_ratio TEXT DEFAULT NULL, p_duration INTEGER DEFAULT NULL, p_quality TEXT DEFAULT NULL,
  p_motion_mode TEXT DEFAULT NULL, p_style TEXT DEFAULT NULL, p_camera_movement TEXT DEFAULT NULL,
  p_seed INTEGER DEFAULT NULL, p_water_mark BOOLEAN DEFAULT false, p_size TEXT DEFAULT NULL,
  p_seconds INTEGER DEFAULT NULL
)
RETURNS TABLE (
  id UUID, user_id UUID, model TEXT, prompt TEXT, negative_prompt TEXT, video_id TEXT, video_url TEXT,
  status TEXT, error_message TEXT, aspect_ratio TEXT, duration INTEGER, quality TEXT, motion_mode TEXT,
  style TEXT, camera_movement TEXT, seed INTEGER, water_mark BOOLEAN, size TEXT, seconds INTEGER,
  is_public BOOLEAN, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.video_generations (
    id, user_id, model, prompt, negative_prompt, video_id, video_url, status, error_message,
    aspect_ratio, duration, quality, motion_mode, style, camera_movement, seed, water_mark, size, seconds,
    created_at, updated_at
  ) VALUES (
    p_id, p_user_id, p_model, p_prompt, p_negative_prompt, p_video_id, p_video_url, p_status, p_error_message,
    p_aspect_ratio, p_duration, p_quality, p_motion_mode, p_style, p_camera_movement, p_seed, p_water_mark, p_size, p_seconds,
    NOW(), NOW()
  );
  RETURN QUERY
  SELECT vg.id, vg.user_id, vg.model, vg.prompt, vg.negative_prompt, vg.video_id, vg.video_url,
    vg.status, vg.error_message, vg.aspect_ratio, vg.duration, vg.quality, vg.motion_mode, vg.style,
    vg.camera_movement, vg.seed, vg.water_mark, vg.size, vg.seconds, vg.is_public, vg.created_at, vg.updated_at
  FROM public.video_generations vg WHERE vg.id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_video_generation(
  p_id UUID, p_user_id UUID,
  p_video_id TEXT DEFAULT NULL, p_video_url TEXT DEFAULT NULL, p_status TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL, p_is_public BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
  id UUID, user_id UUID, model TEXT, prompt TEXT, negative_prompt TEXT, video_id TEXT, video_url TEXT,
  status TEXT, error_message TEXT, aspect_ratio TEXT, duration INTEGER, quality TEXT, motion_mode TEXT,
  style TEXT, camera_movement TEXT, seed INTEGER, water_mark BOOLEAN, size TEXT, seconds INTEGER,
  is_public BOOLEAN, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.video_generations SET
    video_id = COALESCE(p_video_id, video_id),
    video_url = COALESCE(p_video_url, video_url),
    status = COALESCE(p_status, status),
    error_message = COALESCE(p_error_message, error_message),
    is_public = COALESCE(p_is_public, is_public),
    updated_at = NOW()
  WHERE id = p_id AND user_id = p_user_id;

  RETURN QUERY
  SELECT vg.id, vg.user_id, vg.model, vg.prompt, vg.negative_prompt, vg.video_id, vg.video_url,
    vg.status, vg.error_message, vg.aspect_ratio, vg.duration, vg.quality, vg.motion_mode, vg.style,
    vg.camera_movement, vg.seed, vg.water_mark, vg.size, vg.seconds, vg.is_public, vg.created_at, vg.updated_at
  FROM public.video_generations vg WHERE vg.id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_image_generations(p_user_id UUID)
RETURNS TABLE (
  id UUID, user_id UUID, model TEXT, prompt TEXT, negative_prompt TEXT, quality TEXT, size TEXT,
  output_format TEXT, num_images INTEGER, image_urls JSONB, status TEXT, error_message TEXT,
  is_public BOOLEAN, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT ig.id, ig.user_id, ig.model, ig.prompt, ig.negative_prompt, ig.quality, ig.size,
    ig.output_format, ig.num_images, ig.image_urls, ig.status, ig.error_message, ig.is_public,
    ig.created_at, ig.updated_at
  FROM public.image_generations ig
  WHERE ig.user_id = p_user_id
  ORDER BY ig.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_video_generations(p_user_id UUID)
RETURNS TABLE (
  id UUID, user_id UUID, model TEXT, prompt TEXT, negative_prompt TEXT, video_id TEXT, video_url TEXT,
  status TEXT, error_message TEXT, aspect_ratio TEXT, duration INTEGER, quality TEXT, motion_mode TEXT,
  style TEXT, camera_movement TEXT, seed INTEGER, water_mark BOOLEAN, size TEXT, seconds INTEGER,
  is_public BOOLEAN, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT vg.id, vg.user_id, vg.model, vg.prompt, vg.negative_prompt, vg.video_id, vg.video_url,
    vg.status, vg.error_message, vg.aspect_ratio, vg.duration, vg.quality, vg.motion_mode, vg.style,
    vg.camera_movement, vg.seed, vg.water_mark, vg.size, vg.seconds, vg.is_public, vg.created_at, vg.updated_at
  FROM public.video_generations vg
  WHERE vg.user_id = p_user_id
  ORDER BY vg.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_image_generation(p_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.image_generations WHERE id = p_id AND user_id = p_user_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_video_generation(p_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.video_generations WHERE id = p_id AND user_id = p_user_id;
  RETURN FOUND;
END;
$$;

-- ============================================================================
-- 7. Удаление своего аккаунта (опционально; на части хостингов удаление из auth.users ограничено)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.chat_sessions WHERE user_id = auth.uid();
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;

-- ============================================================================
-- 8. Сиды model_settings (все model_id по умолчанию включены)
-- ============================================================================
INSERT INTO public.model_settings (model_id, is_enabled, updated_at)
VALUES
  ('openai/gpt-oss-120b', true, NOW()),
  ('Qwen/Qwen3-235B-A22B-Thinking-2507', true, NOW()),
  ('deepseek-ai/DeepSeek-R1-0528', true, NOW()),
  ('meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8', true, NOW()),
  ('openai/gpt-oss-20b', true, NOW()),
  ('Intel/Qwen3-Coder-480B-A35B-Instruct-int4-mixed-ar', true, NOW()),
  ('meta-llama/Llama-3.2-90B-Vision-Instruct', true, NOW()),
  ('mistralai/Mistral-Nemo-Instruct-2407', true, NOW()),
  ('Qwen/Qwen2.5-VL-32B-Instruct', true, NOW()),
  ('meta-llama/Llama-3.3-70B-Instruct', true, NOW()),
  ('mistralai/Devstral-Small-2505', true, NOW()),
  ('mistralai/Mistral-Large-Instruct-2411', true, NOW()),
  ('moonshotai/Kimi-K2-Thinking', true, NOW()),
  ('deepseek-ai/DeepSeek-V3.2', true, NOW()),
  ('zai-org/GLM-4.6', true, NOW()),
  ('moonshotai/Kimi-K2-Instruct-0905', true, NOW()),
  ('Qwen/Qwen3-Next-80B-A3B-Instruct', true, NOW()),
  ('claude-sonnet-4.6', true, NOW()),
  ('claude-fable-5', true, NOW()),
  ('claude-opus-4.8', true, NOW()),
  ('claude-opus-4.8-fast', true, NOW()),
  ('claude-opus-4.7', true, NOW()),
  ('claude-opus-4.6', true, NOW()),
  ('claude-opus-4.5', true, NOW()),
  ('claude-haiku-4.5', true, NOW()),
  ('claude-sonnet-4.5', true, NOW()),
  ('claude-opus-4.1', true, NOW()),
  ('claude-opus-4', true, NOW()),
  ('claude-sonnet-4', true, NOW()),
  ('claude-3.7-sonnet', true, NOW()),
  ('claude-3.5-haiku', true, NOW()),
  ('claude-3.5-sonnet', true, NOW()),
  ('grok-4', true, NOW()),
  ('grok-4.1-fast', true, NOW()),
  ('grok-4-fast', true, NOW()),
  ('grok-code-fast-1', true, NOW()),
  ('grok-4.20', true, NOW()),
  ('grok-4.20-multi-agent', true, NOW()),
  ('grok-4.3', true, NOW()),
  ('grok-build-0.1', true, NOW()),
  ('gemini-2.5-pro', true, NOW()),
  ('gemini-2.5-flash', true, NOW()),
  ('gemma-4-26b-a4b-it', true, NOW()),
  ('gemma-4-31b-it', true, NOW()),
  ('gemini-3.1-pro-preview', true, NOW()),
  ('gemini-3.1-pro-preview-customtools', true, NOW()),
  ('gemini-3-flash-preview', true, NOW()),
  ('gemini-3-pro-image-preview', true, NOW()),
  ('gemini-3.1-flash-image-preview', true, NOW()),
  ('gemini-3-pro-preview', true, NOW()),
  ('gemini-2.5-flash-image', true, NOW()),
  ('gemini-2.5-flash-lite-preview-09-2025', true, NOW()),
  ('gemini-2.5-flash-lite', true, NOW()),
  ('gemini-3.1-flash-lite', true, NOW()),
  ('gemini-3.5-flash', true, NOW()),
  ('sonar-pro-search', true, NOW()),
  ('sonar-reasoning-pro', true, NOW()),
  ('sonar-pro', true, NOW()),
  ('sonar-deep-research', true, NOW()),
  ('sonar', true, NOW()),
  ('sonar-reasoning', true, NOW()),
  ('gpt-5.2-chat', true, NOW()),
  ('gpt-5.2-pro', true, NOW()),
  ('gpt-5.2', true, NOW()),
  ('gpt-5.5', true, NOW()),
  ('gpt-5.5-pro', true, NOW()),
  ('gpt-5.2-codex', true, NOW()),
  ('gpt-5.1-codex-max', true, NOW()),
  ('gpt-5.1', true, NOW()),
  ('gpt-5.1-chat', true, NOW()),
  ('gpt-5.1-codex', true, NOW()),
  ('gpt-5.1-codex-mini', true, NOW()),
  ('gpt-5-image', true, NOW()),
  ('gpt-5-pro', true, NOW()),
  ('gpt-5-codex', true, NOW()),
  ('glm-5', true, NOW()),
  ('glm-5.1', true, NOW()),
  ('glm-4.7-flash', true, NOW()),
  ('glm-4.7', true, NOW()),
  ('glm-4.6v', true, NOW()),
  ('glm-4.6', true, NOW()),
  ('glm-4.5v', true, NOW()),
  ('glm-4.5', true, NOW()),
  ('glm-4.5-air', true, NOW()),
  ('glm-4-32b', true, NOW()),
  ('qwen3.6-27b', true, NOW()),
  ('qwen3.6-max-preview', true, NOW()),
  ('qwen3.7-max', true, NOW()),
  ('qwen3.6-35b-a3b', true, NOW()),
  ('qwen3.6-flash', true, NOW()),
  ('qwen3.5-plus-20260420', true, NOW()),
  ('kimi-k2.6', true, NOW()),
  ('kimi-k2.7-code', true, NOW()),
  ('minimax-m3', true, NOW()),
  ('mimo-v2.5', true, NOW()),
  ('mimo-v2.5-pro', true, NOW()),
  ('deepseek-v4-flash', true, NOW()),
  ('gpt-image-2', true, NOW()),
  ('gpt-image-1.5', true, NOW()),
  ('gpt-image-1', true, NOW()),
  ('gpt-image-1-mini', true, NOW()),
  ('dall-e-3', true, NOW()),
  ('dall-e-2', true, NOW()),
  ('flux-2-klein-4b', true, NOW()),
  ('flux-2-flex', true, NOW()),
  ('flux-2-max', true, NOW()),
  ('flux-2-pro', true, NOW()),
  ('qwen-image-edit', true, NOW()),
  ('seedream-4.5', true, NOW()),
  ('sora-2', true, NOW()),
  ('sora-2-pro', true, NOW()),
  ('seedance-2.0', true, NOW()),
  ('seedance-2.0-fast', true, NOW()),
  ('seedance-1-5-pro', true, NOW()),
  ('grok-imagine-video', true, NOW()),
  ('kling-v3.0-pro', true, NOW()),
  ('kling-v3.0-std', true, NOW()),
  ('kling-video-o1', true, NOW()),
  ('wan-2.7', true, NOW()),
  ('veo-3.1', true, NOW()),
  ('veo-3.1-fast', true, NOW()),
  ('veo-3.1-lite', true, NOW()),
  ('hailuo-2.3', true, NOW()),
  ('wan2.6', true, NOW())
ON CONFLICT (model_id) DO NOTHING;

-- Конец complete-setup.sql — после первого админа см. create-super-admin.sql в корне репозитория.