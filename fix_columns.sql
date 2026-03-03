-- Copie este código e execute no SQL Editor do seu projeto Supabase

-- Primeiro, vamos adicionar as novas colunas na tabela de history (sessions)
-- O Supabase não reclamará se adicionarmos e já existirem, desde que usemos IF NOT EXISTS se fosse criação,
-- mas como é alteração de tabela que já existe e pode estar com nomes antigos:

DO $$ 
BEGIN
    BEGIN
        ALTER TABLE public.sessions ADD COLUMN confidence_score numeric;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;

    BEGIN
        ALTER TABLE public.sessions ADD COLUMN clarity_score numeric;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;

    BEGIN
        ALTER TABLE public.sessions ADD COLUMN persuasion_score numeric;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;

    BEGIN
        ALTER TABLE public.sessions ADD COLUMN posture_score numeric;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;
END $$;
