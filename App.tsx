
import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Session from './components/Session';
import PaymentModal from './components/PaymentModal';
import SubscriptionModal from './components/SubscriptionModal';
import { User, AvatarConfig, SessionResult, RANKS } from './types';
import { supabase, getUserHistory, updateUserStats, saveSession, getUserProfile, updateUserProfile } from './services/supabase';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<SessionResult[]>([]);
  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'dashboard' | 'session' | 'result'>('landing');
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarConfig | null>(null);
  const [lastSessionResult, setLastSessionResult] = useState<SessionResult | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      try {
        // Inicializa o listener ANTES de checar a sessão
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'PASSWORD_RECOVERY') {
            setIsRecovering(true);
            setCurrentView('login');
          }
          if (event === 'SIGNED_IN' && session?.user) {
            getUserProfile(session.user.id).then(profile => {
              if (profile) setUser(profile);
            });
          }
          if (event === 'SIGNED_OUT') {
            setUser(null);
            setCurrentView('landing');
          }
        });

        const { data } = await supabase.auth.getSession();
        const session = data?.session;

        // Verificação robusta via hash ou evento já disparado
        const hashIsRecovery = window.location.hash.includes('type=recovery');
        if (hashIsRecovery) setIsRecovering(true);

        if (session?.user) {
          const profile = await getUserProfile(session.user.id);
          if (profile) {
            setUser(profile);
            const userHistory = await getUserHistory(session.user.id);
            setHistory(userHistory);

            if (hashIsRecovery || isRecovering) {
              setCurrentView('login');
            } else {
              setCurrentView('dashboard');
            }

            if (profile.subscription === 'CANCELLED' || profile.subscriptionStatus === 'CANCELLED') {
              setShowSubscriptionModal(true);
            }
          } else {
            setCurrentView('landing');
          }
        } else {
          setCurrentView('landing');
        }

        return () => authSubscription.unsubscribe();
      } catch (err) {
        console.error('App check session error:', err);
        setCurrentView('landing');
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, [isRecovering]);

  const handleLogin = async (userData: User) => {
    setUser(userData);
    setIsRecovering(false); // Reset ao logar
    if (userData.id) {
      const userHistory = await getUserHistory(userData.id);
      setHistory(userHistory);
    }
    setCurrentView('dashboard');

    if (userData.subscription === 'CANCELLED' || userData.subscriptionStatus === 'CANCELLED') {
      setShowSubscriptionModal(true);
    }
  };

  const handleLogout = async () => {
    try { await supabase.auth.signOut(); } catch (e) { }
    setUser(null);
    setHistory([]);
    setIsRecovering(false);
    setCurrentView('landing');
  };

  const handleStartSession = (avatar: AvatarConfig) => {
    setSelectedAvatar(avatar);
    setCurrentView('session');
  };

  const handleUpdateCredits = async (remainingMinutes: number) => {
    if (!user?.id) return;
    setUser(prev => prev ? ({ ...prev, creditsRemaining: remainingMinutes }) : null);
    await updateUserStats(user.id, { creditsRemaining: remainingMinutes });
  };

  const handleUpdateProfile = async (data: { name: string, surname: string }) => {
    if (!user?.id) return false;
    const success = await updateUserProfile(user.id, data);
    if (success) {
      setUser(prev => prev ? ({ ...prev, ...data }) : null);
      return true;
    }
    return false;
  };

  const handlePartialUserUpdate = (updates: Partial<User>) => {
    setUser(prev => prev ? ({ ...prev, ...updates }) : null);
  };

  const handlePaymentSuccess = (updatedUser: User) => {
    setUser(updatedUser);
    setShowPaymentModal(false);
    setShowSubscriptionModal(false);
    alert(`Parabéns! Sua conta foi atualizada com sucesso. Seu saldo atual é de ${updatedUser.creditsRemaining} minutos.`);
  };

  const handleSessionComplete = async (
    result: Omit<SessionResult, 'date' | 'avatarName' | 'durationSeconds'> & { durationSeconds: number },
    finalCredits: number
  ) => {
    if (!user?.id || !selectedAvatar) {
      console.error("[App] Erro crítico: Usuário ou Avatar ausentes.");
      return;
    }

    const fullResult: SessionResult = {
      ...result,
      date: new Date().toISOString(),
      avatarName: selectedAvatar.name,
    };

    setLastSessionResult(fullResult);
    setHistory(prev => [fullResult, ...prev]);
    setCurrentView('result');

    const updatedPoints = user.points + fullResult.overallScore;
    const updatedSessions = user.sessionsCompleted + 1;
    const achievedRank = [...RANKS].reverse().find(r => updatedPoints >= r.minPoints);
    const newRank = achievedRank ? achievedRank.name : user.rank;

    try {
      await saveSession(user.id, fullResult);
      await updateUserStats(user.id, {
        points: updatedPoints,
        sessionsCompleted: updatedSessions,
        rank: newRank,
        creditsRemaining: finalCredits
      });

      setUser(prev => prev ? ({
        ...prev,
        points: updatedPoints,
        sessionsCompleted: updatedSessions,
        rank: newRank,
        creditsRemaining: finalCredits
      }) : null);
    } catch (e) {
      console.error("[App] Erro na sincronização pós-sessão:", e);
    }
  };

  const handleCancelSession = () => {
    setCurrentView('dashboard');
    setSelectedAvatar(null);
  };

  const handleReturnToDashboard = () => {
    setCurrentView('dashboard');
    setLastSessionResult(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Render Logic
  if (currentView === 'landing') {
    return <LandingPage onStart={() => setCurrentView('login')} />;
  }

  if (!user || currentView === 'login' || isRecovering) {
    return <Login onLogin={handleLogin} initialMode={isRecovering ? 'updatePassword' : 'login'} />;
  }

  return (
    <>
      {currentView === 'session' && selectedAvatar ? (
        <Session
          user={user}
          avatar={selectedAvatar}
          onComplete={handleSessionComplete}
          onCancel={handleCancelSession}
          onUpdateCredits={handleUpdateCredits}
          onBuyCredits={() => {
            setCurrentView('dashboard');
            setShowPaymentModal(true);
          }}
        />
      ) : currentView === 'result' && lastSessionResult ? (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-gray-800 p-8 rounded-3xl shadow-2xl max-w-2xl w-full border border-gray-700 text-center animate-fade-in relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-blue-500/10 text-blue-400 mb-6 ring-1 ring-blue-500/30">
              <span className="text-4xl font-extrabold">{lastSessionResult.overallScore}</span>
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Sessão Finalizada!</h2>
            <p className="text-gray-400 mb-8">Sua prática foi avaliada e gravada.</p>
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-700">
                <div className="text-[10px] uppercase text-gray-500 font-bold mb-1">Vocabulário</div>
                <div className="text-xl font-bold text-purple-400">{lastSessionResult.vocabularyScore}%</div>
              </div>
              <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-700">
                <div className="text-[10px] uppercase text-gray-500 font-bold mb-1">Gramática</div>
                <div className="text-xl font-bold text-pink-400">{lastSessionResult.grammarScore}%</div>
              </div>
              <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-700">
                <div className="text-[10px] uppercase text-gray-500 font-bold mb-1">Pronúncia</div>
                <div className="text-xl font-bold text-emerald-400">{lastSessionResult.pronunciationScore}%</div>
              </div>
            </div>
            <div className="bg-blue-900/20 p-6 rounded-2xl text-left mb-8 border border-blue-500/20">
              <p className="text-gray-300 leading-relaxed text-sm">{lastSessionResult.feedback}</p>
            </div>
            <button onClick={handleReturnToDashboard} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg">
              Voltar ao Painel
            </button>
          </div>
        </div>
      ) : (
        <Dashboard
          user={user}
          history={history}
          onStartSession={handleStartSession}
          onLogout={handleLogout}
          onAddCredits={() => setShowPaymentModal(true)}
          onSubscribe={() => setShowSubscriptionModal(true)}
          onUpdateProfile={handleUpdateProfile}
          onPartialUpdate={handlePartialUserUpdate}
        />
      )}

      {showPaymentModal && (
        <PaymentModal
          user={user}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
          onPartialUpdate={handlePartialUserUpdate}
        />
      )}

      {showSubscriptionModal && (
        <SubscriptionModal
          user={user}
          onClose={() => setShowSubscriptionModal(false)}
          onSuccess={handlePaymentSuccess}
          onPartialUpdate={handlePartialUserUpdate}
        />
      )}
    </>
  );
}

export default App;
