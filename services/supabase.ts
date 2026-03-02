
import { createClient } from '@supabase/supabase-js';
import { User, SessionResult, DetailedFeedback } from '../types';

const supabaseUrl = (process.env.SUPABASE_URL || 'https://ebjihooaxlqulzrlyoyc.supabase.co').trim();
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViamlob29heGxxdWx6cmx5b3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNTAxMDgsImV4cCI6MjA4MTcyNjEwOH0.qAvWao3bj2CpOpkI9HK558DuuG6_kGOMDMtuYsEAH-c').trim();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

export const getEmailByUsername = async (username: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('email')
    .eq('username', username.toLowerCase())
    .single();

  if (error) return null;
  return data?.email || null;
};

export const getUserProfile = async (userId: string): Promise<User | null> => {
  try {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profileData) return null;

    let email = profileData.email;
    if (!email) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id === userId && session.user.email) {
        email = session.user.email;
      }
    }

    return {
      id: profileData.id,
      username: profileData.username,
      email: email || undefined,
      name: profileData.name,
      surname: profileData.surname,
      rank: profileData.rank,
      points: Number(profileData.points || 0),
      sessionsCompleted: Number(profileData.sessions_completed || 0),
      joinedDate: profileData.joined_date,
      creditsRemaining: Number(profileData.credits_remaining || 0),
      creditsTotal: Number(profileData.credits_total || 0),
      customerIdAsaas: profileData.customer_id_asaas,
      subscription: profileData.subscription,
      subscriptionStatus: profileData.subscription_status,
      cpf: profileData.cpf,
      phone: profileData.phone,
      termsAcceptedAt: profileData.terms_accepted_at,
      qtdFeedbacks: Number(profileData.qtd_feedbacks || 0)
    } as User;
  } catch (err) {
    console.error('[Supabase] Erro ao carregar perfil:', err);
    return null;
  }
};

export const updateUserProfile = async (userId: string, data: { name: string, surname: string, phone?: string }) => {
  const { error } = await supabase
    .from('profiles')
    .update({
      name: data.name,
      surname: data.surname,
      phone: data.phone
    })
    .eq('id', userId);
  return !error;
};

export const saveSession = async (userId: string, session: SessionResult) => {
  const payload = {
    user_id: userId,
    avatar_name: session.avatarName,
    overall_score: Number(session.overallScore),
    vocabulary_score: Number(session.vocabularyScore),
    grammar_score: Number(session.grammarScore),
    pronunciation_score: Number(session.pronunciationScore),
    // coherence_score: Number(session.coherenceScore || 0), // Removido temporariamente (coluna inexistente)
    // confidence_score: Number(session.confidenceScore || 0), // Removido temporariamente (coluna inexistente)
    fluency_rating: session.fluencyRating,
    feedback: session.feedback,
    duration_seconds: Math.floor(session.durationSeconds || 0),
    transcript: session.transcript || "",
    date: session.date || new Date().toISOString()
  };

  const { error } = await supabase.from('sessions').insert([payload]);

  if (error) {
    console.error("ERRO CRÍTICO AO SALVAR SESSÃO:", error);
  }

  return !error;
};

export const updateUserStats = async (userId: string, updates: Partial<User>) => {
  const dbUpdates: any = {};
  if (updates.points !== undefined) dbUpdates.points = updates.points;
  if (updates.creditsRemaining !== undefined) dbUpdates.credits_remaining = updates.creditsRemaining;
  if (updates.creditsTotal !== undefined) dbUpdates.credits_total = updates.creditsTotal;
  if (updates.rank !== undefined) dbUpdates.rank = updates.rank;
  if (updates.sessionsCompleted !== undefined) dbUpdates.sessions_completed = updates.sessionsCompleted;
  if (updates.customerIdAsaas !== undefined) dbUpdates.customer_id_asaas = updates.customerIdAsaas;
  if (updates.subscription !== undefined) dbUpdates.subscription = updates.subscription;
  if (updates.subscriptionStatus !== undefined) dbUpdates.subscription_status = updates.subscriptionStatus;
  if (updates.cpf !== undefined) dbUpdates.cpf = updates.cpf;
  if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
  if (updates.termsAcceptedAt !== undefined) dbUpdates.terms_accepted_at = updates.termsAcceptedAt;
  if (updates.qtdFeedbacks !== undefined) dbUpdates.qtd_feedbacks = updates.qtdFeedbacks;
  if ((updates as any).name) dbUpdates.name = (updates as any).name;
  if ((updates as any).surname) dbUpdates.surname = (updates as any).surname;
  if ((updates as any).username) dbUpdates.username = (updates as any).username;

  const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', userId);
  return !error;
};

export const getUserHistory = async (userId: string): Promise<SessionResult[]> => {
  // Remove colunas que podem não existir ainda no banco para evitar erro 400
  const { data, error } = await supabase.from('sessions')
    .select('user_id, avatar_name, overall_score, vocabulary_score, grammar_score, pronunciation_score, fluency_rating, feedback, duration_seconds, transcript, date')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    console.error("Erro ao buscar histórico:", error);
    return [];
  }

  return (data || []).map(s => ({
    avatarName: s.avatar_name,
    overallScore: s.overall_score,
    vocabularyScore: s.vocabulary_score,
    grammarScore: s.grammar_score,
    pronunciationScore: s.pronunciation_score,
    coherenceScore: 0, // Default sem erro
    confidenceScore: 0, // Default sem erro
    fluencyRating: s.fluency_rating,
    feedback: s.feedback,
    durationSeconds: s.duration_seconds,
    transcript: s.transcript,
    date: s.date
  }));
};

export const getLastSessionContext = async (userId: string, avatarName: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('sessions')
    .select('transcript, date')
    .eq('user_id', userId)
    .eq('avatar_name', avatarName)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data || !data.transcript) return null;

  // Pega as últimas 15 linhas para dar contexto
  const lines = data.transcript.split('\n')
    .filter(line => line.trim() !== '')
    .filter(line => !line.trim().startsWith('(System:') && !line.trim().startsWith('[System:')); // Remove logs de sistema

  if (lines.length === 0) return null;

  const lastLines = lines.slice(-15).join('\n');
  const sessionDate = new Date(data.date).toLocaleString('pt-BR');

  return `[Conversa de ${sessionDate}]:\n${lastLines}`;
};

export const logPayment = async (
  userId: string,
  asaasId: string,
  amount: number,
  minutes: number,
  isSubscription: boolean = false,
  urlInvoice?: string,
  paymentType: 'ONE_TIME' | 'SUBSCRIPTION' = 'ONE_TIME'
) => {
  await supabase.from('payments').insert([{
    user_id: userId,
    asaas_id: asaasId,
    amount,
    minutes,
    status: 'PENDING',
    processed: false,
    subscription: isSubscription,
    url_invoice: urlInvoice,
    type: paymentType
  }]);
};

export const getPaymentStatusFromDB = async (asaasId: string): Promise<string | null> => {
  const { data, error } = await supabase.from('payments').select('status').eq('asaas_id', asaasId).single();
  if (error) return null;
  return data?.status || null;
};

export const getPaymentRecord = async (asaasId: string): Promise<any | null> => {
  const { data, error } = await supabase.from('payments').select('*').eq('asaas_id', asaasId).single();
  if (error) return null;
  return data;
};

export const markPaymentAsProcessed = async (asaasId: string): Promise<boolean> => {
  const { error } = await supabase.from('payments').update({ processed: true }).eq('asaas_id', asaasId);
  return !error;
};

export const getPendingSubscriptionPayment = async (userId: string): Promise<any | null> => {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'PENDING')
    .eq('subscription', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data;
};

export const getLatestSubscriptionPayment = async (userId: string): Promise<any | null> => {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .eq('subscription', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data;
};

export const cancelUserSubscription = async (userId: string) => {
  const { error } = await supabase.from('profiles').update({ subscription_status: 'CANCELLED' }).eq('id', userId);
  return !error;
};

/**
 * Funções para Feedback Detalhado (detailed_feedbacks)
 */
export const getStoredDetailedFeedback = async (userId: string): Promise<{ content: DetailedFeedback, lastDate: string } | null> => {
  const { data, error } = await supabase
    .from('detailed_feedbacks')
    .select('detailed_content, last_session_date')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    content: data.detailed_content as DetailedFeedback,
    lastDate: data.last_session_date
  };
};

export const upsertDetailedFeedback = async (userId: string, content: DetailedFeedback, lastDate: string) => {
  const { error } = await supabase
    .from('detailed_feedbacks')
    .upsert({
      user_id: userId,
      detailed_content: content,
      last_session_date: lastDate,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  return !error;
};

/**
 * Authentication Helper Functions
 */
export const resetPasswordForEmail = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  return { success: !error, error };
};

export const updateUserPassword = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });
  return { success: !error, error };
};
