
export interface User {
  id?: string; // Supabase UID
  username: string;
  email?: string;
  name: string;
  surname: string;
  password?: string;
  rank: string;
  points: number;
  sessionsCompleted: number;
  joinedDate: string;
  creditsRemaining: number; // Saldo atual em minutos
  creditsTotal?: number; // Total histórico ou do plano atual
  customerIdAsaas?: string;
  subscription?: string; // ID da assinatura
  subscriptionStatus?: string; // Status: ACTIVE, PENDING, etc.
  cpf?: string;
  phone?: string;
  termsAcceptedAt?: string; // ISO Timestamp provided at registration
  qtdFeedbacks?: number; // Contador de feedbacks mensais (máx 5)
}

export interface MetricDetail {
  score: number;
  tendencia: 'evoluindo' | 'estavel' | 'regredindo';
}

export interface HistoricalDataPoint {
  data: string;
  score: number;
}

export interface DetailedFeedback {
  metricas_atuais: {
    fluencia: MetricDetail;
    vocabulario: MetricDetail;
    precisao_gramatical: MetricDetail;
    clareza_pronuncia: MetricDetail;
    coerencia: MetricDetail;
    confianca: MetricDetail;
  };
  feedbacks: {
    fluencia: string;
    vocabulario: string;
    precisao_gramatical: string;
    clareza_pronuncia: string;
    coerencia: string;
    confianca: string;
  };
  resumo_geral: string;
  dados_grafico_historico: {
    fluencia: HistoricalDataPoint[];
    vocabulario: HistoricalDataPoint[];
    precisao_gramatical: HistoricalDataPoint[];
    clareza_pronuncia: HistoricalDataPoint[];
    coerencia: HistoricalDataPoint[];
    confianca: HistoricalDataPoint[];
  };
}

export interface SessionResult {
  overallScore: number;
  vocabularyScore: number;
  grammarScore: number;
  pronunciationScore: number;
  coherenceScore: number;
  confidenceScore: number;
  fluencyRating: 'Beginner' | 'Intermediate' | 'Advanced' | 'Native';
  feedback: string;
  durationSeconds: number;
  transcript: string;
  date: string;
  avatarName: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export enum AvatarVoice {
  Puck = 'Puck',
  Charon = 'Charon',
  Kore = 'Kore',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr'
}

export interface AvatarConfig {
  name: string;
  accent: 'American' | 'British';
  voice: AvatarVoice;
  systemInstruction: string;
  description: string;
  color: string;
  avatarImage: string;
  videoUrl: string;
  imagePosition?: string;
}

export const RANKS = [
  { name: 'Novato', minPoints: 0 },
  { name: 'Aprendiz', minPoints: 500 },
  { name: 'Falante', minPoints: 2000 },
  { name: 'Orador', minPoints: 5000 },
  { name: 'Linguista', minPoints: 12000 },
  { name: 'Fluente', minPoints: 25000 },
  { name: 'Nativo', minPoints: 50000 },
];
