
import React, { useState, useEffect, useMemo } from 'react';
import { User, RANKS, AvatarConfig, AvatarVoice, SessionResult, DetailedFeedback, MetricDetail, Course, CourseModule, Lesson, Exercise } from '../types';
import {
  cancelUserSubscription,
  getPendingSubscriptionPayment,
  getLatestSubscriptionPayment,
  updateUserStats,
  getStoredDetailedFeedback,
  upsertDetailedFeedback
} from '../services/supabase';
import { cancelSubscription } from '../services/asaas';
import { generateDetailedFeedback } from '../services/gemini';
import { getStudentProgress, getNextLessonForUser } from '../services/progressService';
import { getFirstCourse, getCourseModules, getModuleLessons } from '../services/courseService';
import { AVATARS } from './AvatarChoice';
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface DashboardProps {
  user: User;
  history: SessionResult[];
  onStartSession: (avatar: AvatarConfig) => void;
  onLogout: () => void;
  onAddCredits: () => void;
  onSubscribe: () => void;
  onUpdateProfile: (data: { name: string, surname: string, phone?: string }) => Promise<boolean>;
  onPartialUpdate?: (updates: Partial<User>) => void;
  onChangeAvatar?: () => void;
  onStartLivePractice?: (avatar: AvatarConfig) => void;
}

// Importing AVATARS from AvatarChoice

const SimpleLineChart: React.FC<{ data: { data: string, score: number }[], color: string }> = ({ data, color }) => {
  if (!data || !Array.isArray(data) || data.length < 2) {
    return <div className="h-16 flex items-center justify-center text-[10px] text-gray-500 italic">Dados insuficientes para gráfico</div>;
  }

  const width = 200;
  const height = 40;
  const padding = 5;
  const minScore = 0;
  const maxScore = 100;

  const points = data
    .filter(d => d && (typeof d.score === 'number' || !isNaN(Number(d.score))))
    .map((d, i) => {
      const score = Number(d.score || 50);
      const validScore = isNaN(score) ? 50 : Math.max(0, Math.min(100, score));

      const x = (i / (data.length - 1)) * (width - 2 * padding) + padding;
      const y = height - ((validScore - minScore) / (maxScore - minScore)) * (height - 2 * padding) - padding;

      const safeX = isNaN(x) ? padding : x;
      const safeY = isNaN(y) ? height / 2 : y;
      return `${safeX},${safeY}`;
    }).join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="mt-2 overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points} className="drop-shadow-sm transition-all duration-500" />
    </svg>
  );
};

const SimpleRadarChart: React.FC<{ metrics: { label: string, score: number }[] }> = ({ metrics }) => {
  const size = 300;
  const center = size / 2;
  const radius = center - 40;
  const angleStep = (Math.PI * 2) / metrics.length;

  const getPoint = (score: number, index: number, maxRadius: number) => {
    const r = (score / 100) * maxRadius;
    const angle = angleStep * index - Math.PI / 2;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
    };
  };

  const polyPoints = metrics
    .filter(m => m && typeof m.score === 'number' || !isNaN(Number(m.score)))
    .map((m, i) => {
      const score = Math.max(5, Math.min(100, Number(m.score || 50)));
      const p = getPoint(score, i, radius);
      return `${p.x},${p.y}`;
    }).join(' ');

  const gridLevels = [25, 50, 75, 100];

  return (
    <div className="flex justify-center items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="filter drop-shadow-lg">
        {gridLevels.map(level => (
          <polygon
            key={level}
            points={metrics.map((_, i) => {
              const p = getPoint(level, i, radius);
              return `${p.x},${p.y}`;
            }).join(' ')}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
        ))}
        {metrics.map((_, i) => {
          const p = getPoint(100, i, radius);
          return (
            <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          );
        })}
        <polygon points={polyPoints} fill="rgba(59, 130, 246, 0.3)" stroke="#3b82f6" strokeWidth="3" strokeLinejoin="round" />
        {metrics.map((m, i) => {
          const p = getPoint(m.score, i, radius);
          return <circle key={i} cx={p.x} cy={p.y} r="4" fill="#60a5fa" />;
        })}
        {metrics.map((m, i) => {
          const p = getPoint(115, i, radius);
          return (
            <text
              key={i}
              x={p.x}
              y={p.y}
              fill="rgba(255,255,255,0.6)"
              fontSize="10"
              fontWeight="bold"
              textAnchor="middle"
              className="uppercase tracking-tighter"
            >
              {m.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ user, history, onStartSession, onLogout, onAddCredits, onSubscribe, onUpdateProfile, onPartialUpdate, onChangeAvatar, onStartLivePractice }) => {
  const [activeTab, setActiveTab] = useState<'practice' | 'history' | 'profile' | 'feedback'>('practice');
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);
  const [showRankList, setShowRankList] = useState(false); // Default hidden

  // Filtros de Histórico
  const [filterAvatar, setFilterAvatar] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');

  // Lógica de Filtragem - Corrigida para considerar fuso horário local
  const filteredHistory = useMemo(() => {
    return history.filter(session => {
      const matchesAvatar = filterAvatar === 'all' || session.avatarName === filterAvatar;

      // Converte a data ISO para o formato YYYY-MM-DD local para comparar com o input date
      const sessionLocalDate = new Date(session.date).toLocaleDateString('en-CA'); // en-CA retorna YYYY-MM-DD
      const matchesDate = !filterDate || sessionLocalDate === filterDate;

      return matchesAvatar && matchesDate;
    });
  }, [history, filterAvatar, filterDate]);

  // Paginação Baseada em Dados Filtrados
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);

  const paginatedHistory = useMemo(() => {
    return filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredHistory, currentPage]);

  // Resetar página ao mudar filtros
  useEffect(() => {
    setCurrentPage(1);
    setExpandedHistoryId(null);
  }, [filterAvatar, filterDate]);

  const [profileForm, setProfileForm] = useState({
    name: user.name || '',
    surname: user.surname || '',
    phone: user.phone || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelCpf, setCancelCpf] = useState(user.cpf || '');
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [pendingInvoiceUrl, setPendingInvoiceUrl] = useState<string | null>(null);
  const [subscriptionErrorStatus, setSubscriptionErrorStatus] = useState<string | null>(null);

  // Feedback detalhado
  const [detailedFeedback, setDetailedFeedback] = useState<DetailedFeedback | null>(null);
  const [lastEvaluatedSessionDate, setLastEvaluatedSessionDate] = useState<string | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);

  // Pedagogical Progress States
  const [totalModules, setTotalModules] = useState(0);
  const [completedModules, setCompletedModules] = useState(0);
  const [totalLessons, setTotalLessons] = useState(0);
  const [completedLessons, setCompletedLessons] = useState(0);
  const [courseProgress, setCourseProgress] = useState(0);

  const [nextLessonData, setNextLessonData] = useState<{
    course: Course,
    module: CourseModule,
    lesson: Lesson,
    exercise: Exercise | null
  } | null>(null);

  const [modulesList, setModulesList] = useState<CourseModule[]>([]);
  const [lessonsByModule, setLessonsByModule] = useState<Record<string, Lesson[]>>({});
  const [completedLessonIdsList, setCompletedLessonIdsList] = useState<Set<string>>(new Set());
  const [isLoadingCurriculum, setIsLoadingCurriculum] = useState(true);

  useEffect(() => {
    if (user.id) {
      (async () => {
        try {
          const progress = await getStudentProgress(user.id);
          const c = await getFirstCourse();
          if (c) {
            const modules = await getCourseModules(c.id);
            setTotalModules(modules.length);
            setModulesList(modules);
            let lessonsCount = 0;
            let cModulesCount = 0;
            const completedIds = new Set(progress.filter(p => p.completed).map(p => p.lesson_id));
            setCompletedLessonIdsList(completedIds);
            const lessonsMap: Record<string, Lesson[]> = {};

            for (const mod of modules) {
              const lessons = await getModuleLessons(mod.id);
              lessonsMap[mod.id] = lessons;
              lessonsCount += lessons.length;
              const allLessonsCompleted = lessons.length > 0 && lessons.every(l => completedIds.has(l.id));
              if (allLessonsCompleted) cModulesCount++;
            }
            setLessonsByModule(lessonsMap);
            setTotalLessons(lessonsCount);
            setCompletedModules(cModulesCount);
            setCompletedLessons(completedIds.size);
            setCourseProgress(lessonsCount > 0 ? Math.round((completedIds.size / lessonsCount) * 100) : 0);
          }

          const nextData = await getNextLessonForUser(user.id);
          setNextLessonData(nextData);

        } catch (err) {
          console.error("[Dashboard] Error fetching pedagogical stats:", err);
        } finally {
          setIsLoadingCurriculum(false);
        }
      })();
    }
  }, [user.id]);

  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (user.id && user.subscription && user.subscription !== 'free' && user.subscription !== 'CANCELLED') {
        const latestPayment = await getLatestSubscriptionPayment(user.id);
        if (latestPayment) {
          if (latestPayment.status === 'PENDING' && latestPayment.url_invoice) {
            setPendingInvoiceUrl(latestPayment.url_invoice);
            setSubscriptionErrorStatus(null);
          } else if (latestPayment.status === 'SUSPENDED') {
            setSubscriptionErrorStatus(latestPayment.status);
            setPendingInvoiceUrl(null);
          } else {
            setPendingInvoiceUrl(null);
            setSubscriptionErrorStatus(null);
          }
        }
      } else {
        setPendingInvoiceUrl(null);
        setSubscriptionErrorStatus(null);
      }
    };
    checkSubscriptionStatus();
  }, [user.id, user.subscription]);

  const isValidFeedback = (f: any): f is DetailedFeedback => {
    // Softened validation: check for top-level keys but don't crash if nested metrics are missing
    const hasMetricas = !!(f && f.metricas_atuais);
    console.log("[Dashboard] Validando feedback. Possui metricas_atuais?", hasMetricas);
    return hasMetricas;
  };

  const loadFeedback = async () => {
    if (!user.id) return;

    setIsLoadingFeedback(true);
    try {
      const stored = await getStoredDetailedFeedback(user.id);
      if (stored && isValidFeedback(stored.content)) {
        setDetailedFeedback(stored.content);
        setLastEvaluatedSessionDate(stored.lastDate);
      } else {
        setDetailedFeedback(null);
      }
    } catch (err) {
      console.error("[Dashboard] Error loading feedback:", err);
      setDetailedFeedback(null);
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  const handleGenerateFeedback = async () => {
    if (history.length === 0 || !user.id) return;

    const latestSession = history[0];
    const isFreeUser = !user.subscription || user.subscription === 'free' || user.subscription === 'FREE';
    const feedbackLimit = isFreeUser ? 1 : 5;
    const currentFeedbackCount = user.qtdFeedbacks || 0;
    const hasReachedLimit = currentFeedbackCount >= feedbackLimit;

    // Double check limit before generating
    if (hasReachedLimit) return;

    setIsLoadingFeedback(true);
    try {
      console.log("[Dashboard] Gerando novo feedback detalhado...");
      const feedback = await generateDetailedFeedback(latestSession.transcript, history);
      if (feedback && isValidFeedback(feedback)) {
        setDetailedFeedback(feedback);
        setLastEvaluatedSessionDate(latestSession.date);
        await upsertDetailedFeedback(user.id, feedback, latestSession.date);

        const newCount = currentFeedbackCount + 1;
        await updateUserStats(user.id, { qtdFeedbacks: newCount });
        if (onPartialUpdate) onPartialUpdate({ qtdFeedbacks: newCount });
      }
    } catch (err) {
      console.error("[Dashboard] Error generating feedback:", err);
      alert("Erro ao gerar feedback. Tente novamente.");
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'feedback') {
      loadFeedback();
    }
    // Reset da página ao trocar de aba (limpa filtros se desejar, ou apenas página)
    if (activeTab !== 'history') {
      setCurrentPage(1);
      setExpandedHistoryId(null);
    }
  }, [activeTab]);

  const isSubscribed = !!user.subscription && user.subscription !== 'free' && user.subscription !== 'CANCELLED';
  const isPending = user.subscriptionStatus === 'PENDING';
  const isCancelled = user.subscription === 'CANCELLED' || user.subscriptionStatus === 'CANCELLED';
  const creditsInMinutes = Math.floor(Number(user.creditsRemaining || 0));
  const hasNoCredits = creditsInMinutes <= 0;
  const isFree = !user.subscription || user.subscription === 'free';

  const currentPoints = user.points || 0;
  const currentRankIndex = RANKS.findIndex((r, idx) => {
    const nextRank = RANKS[idx + 1];
    return currentPoints >= r.minPoints && (!nextRank || currentPoints < nextRank.minPoints);
  });
  const currentRank = RANKS[currentRankIndex] || RANKS[0];
  const nextRank = RANKS[currentRankIndex + 1];

  let progressPercentage = 100;
  let pointsToNext = 0;
  let levelRange = 0;

  if (nextRank) {
    levelRange = nextRank.minPoints - currentRank.minPoints;
    const pointsInCurrentLevel = currentPoints - currentRank.minPoints;
    progressPercentage = Math.min(100, Math.max(0, (pointsInCurrentLevel / levelRange) * 100));
    pointsToNext = nextRank.minPoints - currentPoints;
  }

  const handleAvatarClick = (avatar: AvatarConfig) => {
    if (isCancelled) {
      onSubscribe();
      return;
    }
    if (subscriptionErrorStatus) {
      alert(`Acesso bloqueado: O pagamento da sua mensalidade está com problemas. Acesse seu Perfil para regularizar.`);
      setActiveTab('profile');
      return;
    }
    if (isPending) {
      alert("Acesso bloqueado: O seu pagamento ainda não foi processado pela operadora do cartão.");
      return;
    }
    onStartSession(avatar);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const success = await onUpdateProfile(profileForm);
    setSaveMessage(success ? { type: 'success', text: 'Perfil atualizado!' } : { type: 'error', text: 'Erro ao salvar.' });
    setIsSaving(false);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const executeCancellation = async () => {
    const cleanCpf = cancelCpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      alert("Por favor, informe um CPF válido para prosseguir.");
      return;
    }
    setIsCanceling(true);
    try {
      const cancelData = {
        nome: `${user.name} ${user.surname}`,
        email: user.email || '',
        cpf: cleanCpf,
        custumer_id_asaas: user.customerIdAsaas || '',
        subscription: user.subscription || ''
      };
      const webhookSuccess = await cancelSubscription(cancelData);
      if (webhookSuccess) {
        const dbSuccess = await cancelUserSubscription(user.id!);
        if (dbSuccess) {
          if (onPartialUpdate) onPartialUpdate({ subscription: 'CANCELLED', cpf: cleanCpf, subscriptionStatus: 'CANCELLED' });
          alert("Assinatura cancelada com sucesso!");
          setShowCancelConfirm(false);
          setSubscriptionErrorStatus(null);
          setPendingInvoiceUrl(null);
          setActiveTab('practice');
        }
      }
    } catch (err: any) {
      alert(`Falha no cancelamento: ${err.message || 'Erro de rede'}`);
    } finally {
      setIsCanceling(false);
    }
  };

  const handleBannerAction = () => {
    if (isPending && pendingInvoiceUrl) {
      window.open(pendingInvoiceUrl, '_blank');
    } else {
      setActiveTab('profile');
    }
  };


  const TrendIcon = ({ tendencia }: { tendencia: string }) => {
    if (tendencia === 'evoluindo') return <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>;
    if (tendencia === 'regredindo') return <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6"></path></svg>;
    return <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 12h14"></path></svg>;
  };

  const radarMetrics = useMemo(() => {
    if (!detailedFeedback) return null;
    const m = detailedFeedback.metricas_atuais;
    return [
      { label: 'Confiança', score: m.confianca?.score || 0 },
      { label: 'Clareza', score: m.clareza?.score || 0 },
      { label: 'Persuasão', score: m.persuasao?.score || 0 },
      { label: 'Postura', score: m.postura?.score || 0 },
      { label: 'Coerência', score: m.coerencia?.score || 0 },
      { label: 'Fluência', score: m.fluencia?.score || 0 },
    ];
  }, [detailedFeedback]);

  interface HistoricalDataPoint {
    data: string;
    score: number;
  }

  const MetricLineChart: React.FC<{
    title: string;
    data: HistoricalDataPoint[] | undefined;
    color: string;
  }> = ({ title, data, color }) => {
    if (!data || !Array.isArray(data) || data.length < 2) return null;
    const formattedData = [...data].reverse().map(d => ({
      ...d,
      data: new Date(d.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    }));

    return (
      <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700/50">
        <h4 className="text-white font-bold mb-4">{title}</h4>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <Line type="monotone" dataKey="score" stroke={color} strokeWidth={3} dot={{ r: 4, fill: color }} />
              <CartesianGrid stroke="#374151" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="data" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.5rem', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-gray-800 border border-red-500/30 rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mx-auto">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Cancelar Assinatura?</h3>
              <p className="text-xs text-red-400 font-medium mt-2">⚠️ Ao cancelar, seu acesso as sessões serão encerradas imediatamente e créditos não utilizados serão perdidos.</p>
            </div>
            <div className="text-left space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Confirme seu CPF</label>
              <input type="text" value={cancelCpf} onChange={(e) => setCancelCpf(e.target.value)} placeholder="000.000.000-00" className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all" />
            </div>
            <div className="flex flex-col gap-3 pt-2">
              <button onClick={executeCancellation} disabled={isCanceling} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">{isCanceling ? "Cancelando..." : "Confirmar Cancelamento"}</button>
              <button onClick={() => setShowCancelConfirm(false)} className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-3 rounded-xl transition-all">Voltar</button>
            </div>
          </div>
        </div>
      )}

      <header className="flex flex-col md:flex-row justify-between items-center mb-8 max-w-6xl mx-auto gap-4">
        <div className="flex flex-col items-center md:items-start">
          <h1 className="text-2xl font-bold text-blue-400">OratoriaIA</h1>
          <p className="text-xs text-gray-400">Olá, <span className="text-white font-bold">{user.name}</span>! Boas-vindas à sua prática.</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center bg-gray-800 rounded-lg px-4 py-2 border border-gray-700 gap-4 shadow-lg">
            <div className="text-right">
              <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Prática Livre</p>
              <p className="font-mono font-black text-green-400 text-lg leading-none">{creditsInMinutes} min</p>
            </div>
          </div>
          <button onClick={onLogout} className="text-sm px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors">Sair</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto space-y-8">

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 hover:border-blue-500/50 transition-colors">
            <h3 className="text-gray-400 text-xs uppercase mb-1">Módulos Concluídos</h3>
            <p className="text-2xl sm:text-4xl font-extrabold text-blue-400">{completedModules} <span className="text-sm sm:text-lg text-gray-500">/ {totalModules}</span></p>
          </div>
          <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 hover:border-green-500/50 transition-colors">
            <h3 className="text-gray-400 text-xs uppercase mb-1">Aulas / Exercícios</h3>
            <p className="text-2xl sm:text-4xl font-extrabold text-green-400">{completedLessons} <span className="text-sm sm:text-lg text-gray-500">/ {totalLessons}</span></p>
          </div>
          <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 hover:border-purple-500/50 transition-colors">
            <h3 className="text-gray-400 text-xs uppercase mb-1">Progresso Geral</h3>
            <p className="text-2xl sm:text-4xl font-extrabold text-purple-400">{courseProgress}%</p>
          </div>
        </section>

        <div className="flex flex-wrap gap-4 border-b border-gray-700 pb-2">
          <button onClick={() => setActiveTab('practice')} className={`pb-2 text-lg font-medium transition-all ${activeTab === 'practice' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'}`}>Praticar</button>
          <button onClick={() => setActiveTab('history')} className={`pb-2 text-lg font-medium transition-all ${activeTab === 'history' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'}`}>Histórico</button>
          <button onClick={() => setActiveTab('feedback')} className={`pb-2 text-lg font-medium transition-all ${activeTab === 'feedback' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'}`}>Feedback</button>
          <button onClick={() => setActiveTab('profile')} className={`pb-2 text-lg font-medium transition-all ${activeTab === 'profile' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'}`}>Perfil</button>
        </div>

        {activeTab === 'practice' && (() => {
          const selectedAvatar = AVATARS.find(a => a.id === user.avatarId) || AVATARS[0];
          // hasNoCredits shouldn't block normal lessons, only practice
          const isAppDisabled = subscriptionErrorStatus || isCancelled || isPending;
          const isPracticeDisabled = isAppDisabled || hasNoCredits;

          return (
            <div className="animate-fade-in mt-4 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Mentoring Card (Left) */}
              <div className="lg:col-span-7 flex flex-col items-center justify-center w-full">
                <div className="bg-gray-800/80 backdrop-blur-md rounded-[2rem] overflow-hidden border border-gray-700/50 shadow-2xl relative w-full">
                  <div className="absolute inset-0 bg-gradient-to-tl from-blue-600/10 to-transparent pointer-events-none"></div>
                  <div className="p-8 sm:p-12 flex flex-col md:flex-row items-center gap-10">
                    <div className="w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden border-8 border-gray-900 shadow-[0_0_30px_rgba(59,130,246,0.2)] flex-shrink-0 relative">
                      <img src={selectedAvatar.avatarImage} alt={selectedAvatar.name} className={`w-full h-full object-cover relative z-10 ${selectedAvatar.imagePosition || 'object-center'}`} />
                    </div>
                    <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left z-10">
                      <span className="text-xs font-black uppercase tracking-widest text-blue-400 mb-2">Seu Professor Mentor</span>
                      <h2 className="text-4xl sm:text-5xl font-extrabold mb-4">{selectedAvatar.name}</h2>
                      <p className="text-gray-400 mb-8 leading-relaxed max-w-md">
                        {selectedAvatar.description}
                      </p>
                      <div className="w-full md:w-auto flex flex-col gap-3 mt-4">
                        <button
                          onClick={() => handleAvatarClick(selectedAvatar)}
                          className={`w-full md:w-auto px-10 py-4 rounded-2xl font-black text-lg shadow-xl outline-none transition-all active:scale-95 flex items-center justify-center gap-3 ${isAppDisabled ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white hover:shadow-blue-500/25'}`}
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                          {isCancelled ? 'Assinar para Praticar' : isPending ? 'Processando...' : 'Continuar Aula'}
                        </button>

                        {onStartLivePractice && !isAppDisabled && (
                          <button
                            onClick={() => onStartLivePractice(selectedAvatar)}
                            className={`w-full md:w-auto px-6 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 border ${isPracticeDisabled ? 'bg-gray-600 text-gray-400 border-gray-500 cursor-not-allowed' : 'bg-purple-600/20 text-purple-400 hover:bg-purple-600/40 hover:text-white border-purple-500/30'}`}
                            title="20 minutos de conversa livre por mês"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                            {hasNoCredits ? 'Esgotado (0 min)' : 'Prática Livre (Live)'}
                          </button>
                        )}
                        {onChangeAvatar && !isAppDisabled && (
                          <button
                            onClick={onChangeAvatar}
                            className="w-full md:w-auto px-6 py-3 rounded-2xl font-bold text-sm border-2 border-gray-600 text-gray-300 hover:border-gray-500 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                            Trocar de Professor
                          </button>
                        )}
                      </div>
                      {isAppDisabled && (
                        <p className="text-xs font-medium text-red-400 mt-4 uppercase tracking-widest text-center w-full md:text-left">
                          Acesso temporariamente bloqueado
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Curriculum List (Right) */}
              <div className="lg:col-span-5 bg-gray-800/40 backdrop-blur-md border border-gray-700/50 rounded-3xl p-6 lg:p-8 flex flex-col h-[70vh] sticky top-8">
                <h2 className="text-2xl font-black mb-1">Trilha de Aprendizagem</h2>
                <p className="text-sm text-gray-400 mb-6">Acompanhe sua evolução no curso</p>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                  {isLoadingCurriculum ? (
                    <div className="flex items-center justify-center py-12 text-gray-500">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Carregando currículo...
                    </div>
                  ) : modulesList.length === 0 ? (
                    <p className="text-gray-500 text-center py-10">Nenhum módulo encontrado.</p>
                  ) : (
                    modulesList.map((mod) => (
                      <div key={mod.id} className="bg-gray-900/50 rounded-2xl border border-gray-700 overflow-hidden">
                        <div className="p-4 border-b border-gray-800 bg-gray-800/20">
                          <h3 className="font-bold text-sm uppercase tracking-wider text-blue-400">
                            Módulo {mod.position + 1}
                          </h3>
                          <p className="font-bold text-white mt-1">{mod.title}</p>
                        </div>
                        <div className="bg-gray-900/40 divide-y divide-gray-800">
                          {(lessonsByModule[mod.id] || []).map((lesson) => {
                            const isCompleted = completedLessonIdsList.has(lesson.id);
                            return (
                              <div key={lesson.id} className="p-4 flex gap-4 items-start hover:bg-gray-800/30 transition-colors">
                                <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${isCompleted ? 'bg-green-500/20 border-green-500 text-green-400' : 'border-gray-600 text-gray-600 bg-gray-800/50'}`}>
                                  {isCompleted ? (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                  ) : (
                                    <span className="text-[10px] font-bold">{lesson.position + 1}</span>
                                  )}
                                </div>
                                <div>
                                  <h4 className={`text-sm font-bold ${isCompleted ? 'text-gray-300' : 'text-gray-400'}`}>{lesson.title}</h4>
                                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{lesson.content}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {activeTab === 'history' && (
          <div className="space-y-6 animate-fade-in">
            {/* Toolbar de Filtros */}
            <div className="flex flex-col md:flex-row gap-4 bg-gray-800/50 p-4 rounded-2xl border border-gray-700 mb-2">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-1">Avatar</label>
                <select
                  value={filterAvatar}
                  onChange={(e) => setFilterAvatar(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  <option value="all">Todos os Avatares</option>
                  {AVATARS.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                </select>
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-1">Data</label>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
              {(filterAvatar !== 'all' || filterDate !== '') && (
                <div className="flex items-end">
                  <button
                    onClick={() => { setFilterAvatar('all'); setFilterDate(''); }}
                    className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-bold rounded-xl transition-all h-[42px] whitespace-nowrap"
                  >
                    Limpar Filtros
                  </button>
                </div>
              )}
            </div>

            {filteredHistory.length === 0 ? (
              <div className="bg-gray-800 p-12 rounded-3xl border border-gray-700 text-center">
                <p className="text-gray-500">
                  {history.length === 0
                    ? "Você ainda não realizou nenhuma sessão."
                    : "Nenhum resultado encontrado para os filtros selecionados."}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {paginatedHistory.map((session, idx) => {
                    // Ajuste do índice para expansão correta em dados filtrados
                    const actualIdx = (currentPage - 1) * itemsPerPage + idx;
                    return (
                      <div key={`${session.date}-${idx}`} className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden transition-all">
                        <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400 font-bold">
                              {session.overallScore}
                            </div>
                            <div>
                              <h4 className="font-bold notranslate" translate="no">Conversa com {session.avatarName}</h4>
                              <p className="text-xs text-gray-500">
                                {new Date(session.date).toLocaleDateString('pt-BR')} às {new Date(session.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • Duração: {Math.floor(session.durationSeconds / 60)}min {Math.floor(session.durationSeconds % 60).toString().padStart(2, '0')}seg
                              </p>
                            </div>
                          </div>
                          <button onClick={() => setExpandedHistoryId(expandedHistoryId === actualIdx ? null : actualIdx)} className={`p-2 hover:bg-gray-700 rounded-lg transition-colors ${expandedHistoryId === actualIdx ? 'rotate-180' : ''}`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                          </button>
                        </div>
                        {
                          expandedHistoryId === actualIdx && (
                            <div className="px-6 pb-6 pt-2 border-t border-gray-700 bg-gray-900/30 animate-fade-in space-y-6">
                              <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                                <h5 className="text-[10px] uppercase text-gray-500 font-bold mb-2 tracking-widest">Feedback da Sessão</h5>
                                <p className="text-sm text-gray-300 italic">"{session.feedback}"</p>
                              </div>

                              <div className="grid grid-cols-3 gap-2">
                                <div className="text-center bg-gray-800 p-2 rounded-lg"><p className="text-[9px] uppercase text-gray-500">Confiança</p><p className="font-bold text-xs">{session.confidenceScore}%</p></div>
                                <div className="text-center bg-gray-800 p-2 rounded-lg"><p className="text-[9px] uppercase text-gray-500">Clareza</p><p className="font-bold text-xs">{session.clarityScore}%</p></div>
                                <div className="text-center bg-gray-800 p-2 rounded-lg"><p className="text-[9px] uppercase text-gray-500">Persuasão</p><p className="font-bold text-xs">{session.persuasionScore}%</p></div>
                              </div>

                              <div className="border-t border-gray-700 pt-4">
                                <h5 className="text-[10px] uppercase text-gray-500 font-bold mb-3 tracking-widest">Transcrição Completa</h5>
                                <div className="bg-gray-900/80 rounded-xl p-4 max-h-[400px] overflow-y-auto custom-scrollbar space-y-4 shadow-inner">
                                  {session.transcript ? (
                                    session.transcript.split('\n').filter(line => line.trim()).map((line, lIdx) => {
                                      const isUser = line.toLowerCase().startsWith('user:');
                                      const isAvatar = line.toLowerCase().startsWith('avatar:');
                                      const text = line.replace(/^(User|Avatar): /i, '');

                                      if (!isUser && !isAvatar) return <p key={lIdx} className="text-[11px] text-gray-500 text-center py-1">{line}</p>;

                                      return (
                                        <div key={lIdx} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                                          <span className="text-[8px] text-gray-600 mb-0.5 uppercase font-black tracking-tighter notranslate" translate="no">
                                            {isUser ? 'Você' : session.avatarName}
                                          </span>
                                          <div className={`text-xs px-4 py-2.5 rounded-2xl max-w-[90%] leading-relaxed ${isUser ? 'bg-blue-600/20 text-blue-100 border border-blue-500/20 rounded-tr-none' : 'bg-gray-800 text-gray-300 border border-gray-700 rounded-tl-none'}`}>
                                            {text}
                                          </div>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <p className="text-gray-600 text-[10px] text-center italic">Transcrição indisponível para esta sessão.</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        }
                      </div>
                    );
                  })}
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 py-4">
                    <button
                      onClick={() => { setCurrentPage(prev => Math.max(1, prev - 1)); setExpandedHistoryId(null); }}
                      disabled={currentPage === 1}
                      className="p-2 bg-gray-800 rounded-xl border border-gray-700 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase text-gray-500 tracking-widest">Página</span>
                      <span className="bg-blue-600 px-3 py-1 rounded-lg text-xs font-bold">{currentPage}</span>
                      <span className="text-xs font-black uppercase text-gray-500 tracking-widest">de {totalPages}</span>
                    </div>
                    <button
                      onClick={() => { setCurrentPage(prev => Math.min(totalPages, prev + 1)); setExpandedHistoryId(null); }}
                      disabled={currentPage === totalPages}
                      className="p-2 bg-gray-800 rounded-xl border border-gray-700 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )
        }

        {
          activeTab === 'feedback' && (() => {
            const isFreeUser = !user.subscription || user.subscription === 'free' || user.subscription === 'FREE';
            const feedbackLimit = isFreeUser ? 1 : 5;
            const currentCount = user.qtdFeedbacks || 0;
            const hasReachedLimit = currentCount >= feedbackLimit;

            return (
              <div className="space-y-8 animate-fade-in">
                <div className={`p-4 rounded-2xl flex items-center justify-between ${isFreeUser ? 'bg-purple-900/20 border border-purple-500/30' : 'bg-blue-900/20 border border-blue-500/30'}`}>
                  <div className="flex items-center gap-3">
                    <svg className={`w-5 h-5 ${isFreeUser ? 'text-purple-400' : 'text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <div>
                      <p className={`text-sm font-bold ${isFreeUser ? 'text-purple-100' : 'text-blue-100'}`}>
                        {isFreeUser ? 'Plano Gratuito' : 'Feedbacks Mensais'}
                      </p>
                      <p className={`text-xs ${isFreeUser ? 'text-purple-300/70' : 'text-blue-300/70'} mb-2`}>
                        {isFreeUser ? 'Assine para ter 5 feedbacks por mês' : 'Limitado a 5 feedbacks mensais. Habilitado apenas para novas conversas.'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={handleGenerateFeedback}
                          disabled={isLoadingFeedback || hasReachedLimit || history.length === 0 || (!!detailedFeedback && lastEvaluatedSessionDate === history[0].date)}
                          className={`
                            px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2
                            ${isFreeUser
                              ? 'bg-purple-600 hover:bg-purple-500 text-white disabled:bg-purple-900/50 disabled:text-purple-400/50 disabled:cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-500 text-white disabled:bg-blue-900/50 disabled:text-blue-400/50 disabled:cursor-not-allowed'}
                          `}
                        >
                          {isLoadingFeedback ? (
                            <>
                              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              Gerando...
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                              Gerar novo feedback
                            </>
                          )}
                        </button>
                        {hasReachedLimit && <span className="text-[10px] text-red-400 font-medium">Limite atingido</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-black ${isFreeUser ? 'text-purple-400' : 'text-blue-400'}`}>{currentCount}/{feedbackLimit}</p>
                    <p className={`text-[10px] uppercase font-bold ${isFreeUser ? 'text-purple-300/50' : 'text-blue-300/50'}`}>Utilizados</p>
                  </div>
                </div>

                {history.length === 0 ? (
                  <div className="bg-gray-800 p-12 rounded-3xl border border-gray-700 text-center">
                    <p className="text-gray-500">Realize sua primeira sessão para receber feedback detalhado.</p>
                  </div>
                ) : hasReachedLimit && !isFreeUser ? (
                  <div className="bg-red-900/20 border border-red-500/30 p-12 rounded-3xl text-center space-y-4">
                    <svg className="w-16 h-16 mx-auto text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    <h3 className="text-xl font-black text-red-400">Limite Mensal Atingido</h3>
                    <p className="text-gray-300 max-w-md mx-auto">
                      Você utilizou seus <span className="font-bold text-red-400">5 feedbacks detalhados</span> deste mês.
                      O contador será zerado automaticamente no próximo ciclo de renovação.
                    </p>
                    <p className="text-xs text-gray-500">Continue praticando! Você ainda pode ver o histórico de suas sessões anteriores.</p>
                  </div>
                ) : isLoadingFeedback ? (
                  <div className="bg-gray-800 p-20 rounded-3xl border border-gray-700 flex flex-col items-center justify-center space-y-4">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-400 font-medium">O Agente de Avaliação está analisando seu progresso...</p>
                  </div>
                ) : detailedFeedback ? (
                  <div className="space-y-6">
                    {/* Banner de Upgrade para usuários FREE que atingiram o limite */}
                    {isFreeUser && hasReachedLimit && (
                      <div className="bg-purple-900/20 border border-purple-500/30 p-6 rounded-2xl flex items-start gap-4">
                        <svg className="w-6 h-6 text-purple-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-purple-100 mb-1">Limite do Plano Gratuito Atingido</h4>
                          <p className="text-xs text-purple-300/80 mb-3">
                            Você utilizou seu <span className="font-bold">1 feedback gratuito</span>. Assine o PratiquePRO para ter direito a <span className="font-bold">5 feedbacks detalhados por mês</span>!
                          </p>
                          <button
                            onClick={() => setActiveTab('profile')}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-4 py-2 rounded-lg font-bold transition-all"
                          >
                            Ver Planos de Assinatura
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Métricas Atuais */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {detailedFeedback.metricas_atuais && Object.entries(detailedFeedback.metricas_atuais).map(([key, val]) => {
                        const metric = val as MetricDetail;
                        const label = key.replace(/_/g, ' ');
                        let score = Number(metric?.score);
                        if (isNaN(score) || score === 0) score = 50;

                        const rawTendencia = String(metric?.tendencia || 'estavel').toLowerCase();
                        const tendencia = rawTendencia.includes('evolu') || rawTendencia.includes('melhora') ? 'evoluindo' :
                          rawTendencia.includes('regred') || rawTendencia.includes('queda') ? 'regredindo' : 'estavel';

                        const color = score > 70 ? 'text-green-400' : score > 40 ? 'text-yellow-400' : 'text-red-400';
                        const chartColor = score > 70 ? '#4ade80' : score > 40 ? '#facc15' : '#f87171';

                        return (
                          <div key={key} className="bg-gray-800 p-6 rounded-2xl border border-gray-700 transition-all hover:border-gray-600 group">
                            <div className="flex justify-between items-start mb-4">
                              <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider group-hover:text-white transition-colors">{label}</h4>
                              <div className="flex items-center gap-1">
                                <span className={`text-[10px] font-bold uppercase ${tendencia === 'evoluindo' ? 'text-green-400' : tendencia === 'regredindo' ? 'text-red-400' : 'text-gray-400'}`}>{tendencia}</span>
                                <TrendIcon tendencia={tendencia} />
                              </div>
                            </div>
                            <div className="flex items-end gap-2 mb-4">
                              <span className={`text-4xl font-black ${color}`}>{score}</span>
                              <span className="text-gray-600 text-xs mb-1">/ 100</span>
                            </div>
                            <p className="text-xs text-gray-400 leading-relaxed">{(detailedFeedback.feedbacks || {} as any)[key] || "Feedback indisponível."}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-500/30 p-8 rounded-3xl shadow-xl flex flex-col justify-center">
                        <h3 className="text-xl font-black mb-4 flex items-center gap-2">
                          <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                          Resumo do seu Aprendizado
                        </h3>
                        <p className="text-lg text-gray-200 leading-relaxed italic">"{detailedFeedback.resumo_geral}"</p>
                      </div>

                      <div className="bg-gray-800 p-6 rounded-3xl border border-gray-700 shadow-xl flex flex-col items-center">
                        <h3 className="text-xs font-black uppercase text-gray-500 mb-2 tracking-widest">Gráfico de Radar de Competências</h3>
                        <SimpleRadarChart metrics={radarMetrics} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-800 p-12 rounded-3xl border border-gray-700 text-center space-y-4">
                    <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto text-gray-500">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-300">Nenhum feedback disponível</h3>
                    <p className="text-gray-500 max-w-sm mx-auto">
                      Gere um novo feedback acima para ver sua análise detalhada ou realize novas sessões de prática.
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

        {
          activeTab === 'profile' && (
            <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
              <form onSubmit={handleSaveProfile} className="bg-gray-800 p-8 rounded-3xl border border-gray-700 space-y-6">
                <h3 className="text-xl font-bold">Dados Pessoais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Nome</label>
                    <input type="text" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Sobrenome</label>
                    <input type="text" value={profileForm.surname} onChange={(e) => setProfileForm({ ...profileForm, surname: e.target.value })} className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Telefone</label>
                  <input type="text" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} placeholder="(00) 00000-0000" className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {saveMessage && <p className={`text-sm p-3 rounded-xl border ${saveMessage.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>{saveMessage.text}</p>}
                <button type="submit" disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all disabled:opacity-50">{isSaving ? "Salvando..." : "Salvar Alterações"}</button>
              </form>
            </div>
          )
        }
      </main >
    </div >
  );
};

export default Dashboard;