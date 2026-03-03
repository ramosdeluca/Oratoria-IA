
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
  creditsRemaining: number;
  creditsTotal?: number;
  customerIdAsaas?: string;
  subscription?: string;
  subscriptionStatus?: string;
  cpf?: string;
  phone?: string;
  termsAcceptedAt?: string;
  qtdFeedbacks?: number;
  avatarId?: string; // ID do avatar escolhido
}

export interface Course {
  id: string;
  title: string;
  description: string;
  created_at: string;
}

export interface CourseModule {
  id: string;
  course_id: string;
  title: string;
  position: number;
}

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  content: string;
  position: number;
  audio_url?: string;
}

export interface Exercise {
  id: string;
  lesson_id: string;
  instruction: string;
  type: string;
  audio_url?: string;
}

export interface StudentProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  completed: boolean;
  score: number | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationSession {
  id: string;
  user_id: string;
  lesson_id?: string;
  started_at: string;
  expires_at: string;
  max_minutes: number;
  created_at: string;
}

export interface LessonChunk {
  id: number;
  lesson_id: string;
  content: string;
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
    confianca: MetricDetail;
    clareza: MetricDetail;
    persuasao: MetricDetail;
    postura: MetricDetail;
    coerencia: MetricDetail;
  };
  feedbacks: {
    fluencia: string;
    confianca: string;
    clareza: string;
    persuasao: string;
    postura: string;
    coerencia: string;
  };
  resumo_geral: string;
  dados_grafico_historico: {
    fluencia: HistoricalDataPoint[];
    confianca: HistoricalDataPoint[];
    clareza: HistoricalDataPoint[];
    persuasao: HistoricalDataPoint[];
    postura: HistoricalDataPoint[];
    coerencia: HistoricalDataPoint[];
  };
}

export interface SessionResult {
  overallScore: number;
  confidenceScore: number;
  clarityScore: number;
  persuasionScore: number;
  postureScore: number;
  feedback: string;
  durationSeconds: number;
  transcript: string;
  date: string;
  avatarName: string;
  lessonId?: string | null;
  isCompleted?: boolean;
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
