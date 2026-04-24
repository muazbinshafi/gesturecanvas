
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by owner" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Profiles insertable by owner" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles updatable by owner" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- User settings table
CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'dark',
  gesture_mappings JSONB NOT NULL DEFAULT '{}'::jsonb,
  ui_layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  brush_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  smoothing JSONB NOT NULL DEFAULT '{}'::jsonb,
  smart_ink_mode TEXT NOT NULL DEFAULT 'auto',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings owner select" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Settings owner insert" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Settings owner update" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Settings owner delete" ON public.user_settings FOR DELETE USING (auth.uid() = user_id);

-- Whiteboards table
CREATE TABLE public.whiteboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled board',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumbnail_url TEXT,
  share_token UUID UNIQUE,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.whiteboards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Boards owner all" ON public.whiteboards FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public boards readable" ON public.whiteboards FOR SELECT USING (is_public = true);
CREATE INDEX idx_whiteboards_user ON public.whiteboards(user_id);
CREATE INDEX idx_whiteboards_share ON public.whiteboards(share_token) WHERE share_token IS NOT NULL;

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER settings_touch BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER boards_touch BEFORE UPDATE ON public.whiteboards FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile + settings on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.raw_user_meta_data->>'avatar_url');
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
