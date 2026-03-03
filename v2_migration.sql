-- Migration para V2 Arquitetura Pedagógica (Oratória IA)
-- 1. Criação da Tabela para controle de Prática Livre (Modo 4)
CREATE TABLE IF NOT EXISTS public.conversation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    max_minutes INTEGER DEFAULT 20,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Users can view own sessions"
    ON public.conversation_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
    ON public.conversation_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 2. Adição da Coluna de Áudio Pre-gerado
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- 3. Criação do Bucket de Áudio (se já existir isso retorna erro ignorável ou precisa ser feito via interface web do Supabase, o SQL tenta criar caso exista o plugin storage ativo)
INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson_audio', 'lesson_audio', true)
ON CONFLICT (id) DO NOTHING;

-- Lembre-se de configurar as permissões (policies) de leitura pública no bucket 'lesson_audio' pelo painel do Supabase.

-- ==========================================
-- 4. SISTEMA DE RECARGA MENSAL DE PRÁTICA LIVRE (20 MINUTOS)
-- ==========================================

-- Adiciona a coluna last_credit_reset se não existir para rastrear quando foi a última recarga
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_credit_reset TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Garante que o usuário já inicie com 20 minutos (se não foi passado um valor na criação)
CREATE OR REPLACE FUNCTION public.set_initial_practice_credits()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.credits_remaining IS NULL THEN
        NEW.credits_remaining := 20;
    END IF;
    NEW.last_credit_reset := timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para definir os créditos iniciais ao criar o profile
DROP TRIGGER IF EXISTS on_profile_created_set_credits ON public.profiles;
CREATE TRIGGER on_profile_created_set_credits
    BEFORE INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_initial_practice_credits();

-- Ativação da extensão pg_cron para agendar a renovação mensal (Exige privilégios de superuser no Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agenda uma rotina diária (à meia-noite) para resetar para 20 minutos aqueles que completaram 30 dias desde a última recarga.
-- NOTA: O reset NÃO ACUMULA saldo. O saldo volta para exatamente 20.
SELECT cron.schedule(
    'monthly_practice_reset',
    '0 0 * * *', -- Roda todo dia à meia noite
    $$
    UPDATE public.profiles
    SET 
        credits_remaining = 20,
        last_credit_reset = timezone('utc'::text, now())
    WHERE last_credit_reset <= timezone('utc'::text, now()) - interval '30 days';
    $$
);
