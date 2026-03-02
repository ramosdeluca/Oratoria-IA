
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, AvatarConfig, ChatMessage, SessionResult } from '../types';
import { useLiveAvatar } from '../hooks/useLiveAvatar';
import { evaluateSession } from '../services/gemini';
import { getLastSessionContext } from '../services/supabase';

interface SessionProps {
  user: User;
  avatar: AvatarConfig;
  onComplete: (result: Omit<SessionResult, 'date' | 'avatarName'>, finalCredits: number) => void;
  onCancel: () => void;
  onUpdateCredits: (remainingMinutes: number) => void;
  onBuyCredits: () => void;
}

const Session: React.FC<SessionProps> = ({ user, avatar, onComplete, onCancel, onUpdateCredits, onBuyCredits }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [previousContext, setPreviousContext] = useState<string | undefined>(undefined);
  const [isLoadingContext, setIsLoadingContext] = useState(true);

  useEffect(() => {
    // Carrega o contexto da última conversa ao montar
    if (user.id) {
      getLastSessionContext(user.id, avatar.name).then(context => {
        if (context) {
          console.log('[Session] Contexto anterior carregado:', context.substring(0, 50) + '...');
          setPreviousContext(context);
        }
      }).finally(() => {
        setIsLoadingContext(false);
      });
    } else {
      setIsLoadingContext(false);
    }
  }, [user.id, avatar.name]);

  const [remainingSeconds, setRemainingSeconds] = useState(Math.max(0, Math.floor(Number(user.creditsRemaining || 0) * 60)));
  const [showCreditModal, setShowCreditModal] = useState(false);

  const userVideoRef = useRef<HTMLVideoElement>(null);
  const userStreamRef = useRef<MediaStream | null>(null);
  const fullTranscriptRef = useRef<string>("");
  const lastSyncMinutesRef = useRef<number>(Math.floor(Number(user.creditsRemaining || 0)));
  const lastActivityRef = useRef<number>(Date.now());

  const avatarImageRef = useRef<HTMLImageElement>(null);

  const [currentTurnText, setCurrentTurnText] = useState("");
  const [currentTurnRole, setCurrentTurnRole] = useState<'user' | 'model' | null>(null);

  const currentTurnTextRef = useRef("");
  const currentTurnRoleRef = useRef<'user' | 'model' | null>(null);

  useEffect(() => {
    currentTurnTextRef.current = currentTurnText;
    currentTurnRoleRef.current = currentTurnRole;
  }, [currentTurnText, currentTurnRole]);

  const handleTranscriptUpdate = useCallback((text: string, isUser: boolean) => {
    // Ignore system prompts from the transcript and activity tracking
    if (text.startsWith('(System:')) return;

    // Ignore noise (very short or empty strings)
    if (!text.trim()) return;

    lastActivityRef.current = Date.now();
    const role = isUser ? 'user' : 'model';

    if (currentTurnRoleRef.current && currentTurnRoleRef.current !== role) {
      const turnHeader = currentTurnRoleRef.current === 'user' ? 'User: ' : 'Avatar: ';
      fullTranscriptRef.current += `${turnHeader}${currentTurnTextRef.current}\n`;
      setMessages(prev => [...prev, { role: currentTurnRoleRef.current!, text: currentTurnTextRef.current, timestamp: Date.now() }]);
      setCurrentTurnText(text);
    } else {
      setCurrentTurnText(prev => prev + text);
    }
    setCurrentTurnRole(role);
  }, []);

  const { connect, disconnect, isConnected, isTalking, isReconnecting, error: hookError, analyserNode, sendText } = useLiveAvatar({
    avatarConfig: avatar,
    userName: user.name?.split(' ')[0] || user.username,
    previousContext: isLoadingContext ? undefined : previousContext, // Garante que só passa se já carregou
    onTranscriptUpdate: handleTranscriptUpdate
  });

  const error = localError || hookError;

  const getStatusMessage = () => {
    if (showCreditModal) return "Seus créditos acabaram! Finalizando...";
    if (isFinishing) return "Finalizando...";
    if (isReconnecting) return "Reconectando...";
    if (isConnected) {
      if (isTalking) return `${avatar.name} está falando...`;
      const genderSuffix = ['Sophia', 'Maya'].includes(avatar.name) ? 'a' : 'o';
      return `${avatar.name} está pront${genderSuffix} para te ouvir`;
    }
    if (hasStarted && !isConnected) return "Iniciando conexão...";
    return "";
  };

  const statusMessage = getStatusMessage();

  const isFinishingRef = useRef(false);

  useEffect(() => {
    if (!hasStarted || !isConnected || isFinishing || showCreditModal) return;
    const timer = setInterval(() => {
      setRemainingSeconds(prev => {
        const newVal = prev - 1;
        if (newVal <= 0) {
          clearInterval(timer);
          // Only trigger finish if not already finishing
          if (!isFinishingRef.current) {
            setShowCreditModal(true);
            handleFinish(0);
          }
          return 0;
        }
        return newVal;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [hasStarted, isConnected, isFinishing, showCreditModal, onUpdateCredits]);

  useEffect(() => {
    if (!hasStarted || isFinishing) return;
    const syncInterval = setInterval(() => {
      const currentMinutes = Math.floor(remainingSeconds / 60);
      if (Math.abs(lastSyncMinutesRef.current - currentMinutes) >= 1) {
        onUpdateCredits(currentMinutes);
        lastSyncMinutesRef.current = currentMinutes;
      }
    }, 15000);
    return () => clearInterval(syncInterval);
  }, [remainingSeconds, hasStarted, isFinishing, onUpdateCredits]);

  useEffect(() => {
    if (hasStarted && userVideoRef.current && userStreamRef.current) {
      userVideoRef.current.srcObject = userStreamRef.current;
    }
  }, [hasStarted]);

  useEffect(() => {
    if (!isTalking || !analyserNode) {
      if (avatarImageRef.current) avatarImageRef.current.style.transform = 'scale(1)';
      return;
    }
    let rafId: number;
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const updateAnimation = () => {
      analyserNode.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < 20; i++) sum += dataArray[i];
      const energy = (sum / 20) / 255;
      const scale = 1 + energy * 0.15;
      if (avatarImageRef.current) avatarImageRef.current.style.transform = `scale(${scale})`;
      rafId = requestAnimationFrame(updateAnimation);
    };
    updateAnimation();
    return () => cancelAnimationFrame(rafId);
  }, [isTalking, analyserNode]);

  // Update last activity when avatar starts or stops talking
  useEffect(() => {
    lastActivityRef.current = Date.now();
  }, [isTalking]);

  // Idle timeout check
  useEffect(() => {
    if (!isConnected || isTalking || !hasStarted || isFinishing) return;

    const idleTimer = setInterval(() => {
      const secondsSinceActivity = (Date.now() - lastActivityRef.current) / 1000;
      if (secondsSinceActivity > 8) {
        sendText("Keep the conversation going: ask me something or suggest a new topic.");
        lastActivityRef.current = Date.now();
      }
    }, 1000);

    return () => clearInterval(idleTimer);
  }, [isConnected, isTalking, hasStarted, isFinishing, sendText]);

  const handleStart = async () => {
    if (remainingSeconds <= 0) {
      alert("Seus créditos acabaram. Adicione créditos para começar!");
      onBuyCredits();
      return;
    }
    setLocalError(null);
    setHasStarted(true);
    setStartTime(Date.now());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      userStreamRef.current = stream;
      connect();
    } catch (err: any) {
      setLocalError("Câmera ou microfone não detectados.");
      setHasStarted(false);
    }
  };

  const handleFinish = async (forcedCredits?: number) => {
    if (isFinishing || isFinishingRef.current) return;
    isFinishingRef.current = true;
    setIsFinishing(true);

    const finalMinutes = typeof forcedCredits === 'number' ? forcedCredits : Math.max(0, Math.floor(remainingSeconds / 60));

    await disconnect();

    if (userStreamRef.current) {
      userStreamRef.current.getTracks().forEach(track => track.stop());
    }

    let finalTranscript = fullTranscriptRef.current;
    if (currentTurnRoleRef.current && currentTurnTextRef.current) {
      const turnHeader = currentTurnRoleRef.current === 'user' ? 'User: ' : 'Avatar: ';
      finalTranscript += `${turnHeader}${currentTurnTextRef.current}\n`;
    }

    const duration = startTime ? (Date.now() - startTime) / 1000 : 0;
    try {
      const result = await evaluateSession(finalTranscript);
      onComplete({ ...result, durationSeconds: duration }, finalMinutes);
    } catch (e) {
      onComplete({
        overallScore: 0, vocabularyScore: 0, grammarScore: 0, pronunciationScore: 0,
        fluencyRating: 'Beginner', feedback: "Prática concluída.",
        transcript: finalTranscript, durationSeconds: duration
      }, finalMinutes);
    }
  };

  const handleCancelWithSync = () => {
    onUpdateCredits(Math.floor(remainingSeconds / 60));
    onCancel();
  };

  return (
    <div className="flex h-[100dvh] bg-gray-900 text-white overflow-hidden relative">
      <div className="relative flex-1 flex flex-col min-w-0">
        <header className="absolute top-0 left-0 right-0 z-20 p-4 sm:p-6 flex justify-between items-start pointer-events-none">
          <div className="bg-black/60 backdrop-blur-xl px-4 py-2.5 rounded-full border border-white/10 flex items-center gap-3 pointer-events-auto shadow-2xl">
            <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_12px_#22c55e]' : (isReconnecting ? 'bg-yellow-500 animate-pulse' : 'bg-red-500')}`}></div>
            <span className={`text-sm font-mono font-black ${remainingSeconds < 60 ? 'text-red-400' : 'text-green-400'}`}>
              {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}
            </span>
          </div>
          <div className="flex gap-2 pointer-events-auto">
            <button onClick={() => setShowTranscript(!showTranscript)} className={`p-3 rounded-full backdrop-blur-md transition-all ${showTranscript ? 'bg-blue-600' : 'bg-black/40 border border-white/10'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
            </button>
            <button onClick={() => handleFinish()} className="bg-red-600 hover:bg-red-700 p-3 rounded-full text-white shadow-lg transition-transform active:scale-95">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center relative bg-gradient-to-b from-gray-800 to-gray-950">
          <div className="relative w-52 h-52 sm:w-80 sm:h-80 md:w-96 md:h-96 lg:w-[32rem] lg:h-[32rem] rounded-full overflow-hidden border-4 border-white/10 shadow-2xl bg-gray-800">
            <img ref={avatarImageRef} src={avatar.avatarImage} alt={avatar.name} className={`w-full h-full object-cover animate-alive ${avatar.imagePosition || 'object-center'}`} />
          </div>

          <div className="mt-8 h-12 flex flex-col items-center">
            {showCreditModal && (
              <div className="bg-red-500/90 backdrop-blur-md px-6 py-3 rounded-xl border border-red-400/50 animate-bounce shadow-2xl z-50 mt-4">
                <p className="text-white font-bold text-center">
                  Seus créditos acabaram!<br />
                  <span className="text-xs font-normal">Encerrando e salvando sua sessão...</span>
                </p>
              </div>
            )}

            {!showCreditModal && statusMessage && (
              <div className="bg-black/40 backdrop-blur-md px-6 py-2 rounded-full border border-white/5 animate-fade-in shadow-xl">
                <p className="text-sm font-medium text-blue-100 tracking-wide flex items-center gap-2">
                  {(isConnected && !isTalking && !isFinishing) || isReconnecting ? (
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </span>
                  ) : null}
                  {statusMessage}
                </p>
              </div>
            )}
            {error && <p className="text-red-400 text-xs mt-2 animate-shake">{error}</p>}
          </div>
        </div>

        {!hasStarted && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-800 p-8 rounded-3xl shadow-2xl border border-gray-700 max-w-sm w-full text-center">
              <img src={avatar.avatarImage} className={`w-24 h-24 mx-auto mb-4 rounded-full border-4 border-blue-500 object-cover ${avatar.imagePosition || 'object-center'}`} />
              <h2 className="text-2xl font-bold mb-2">Praticar com {avatar.name}</h2>
              <p className="text-gray-400 text-sm mb-6">{avatar.description}</p>
              <button
                onClick={handleStart}
                disabled={isLoadingContext}
                className={`w-full py-4 rounded-xl font-bold transition-all active:scale-95 ${isLoadingContext ? 'bg-gray-700 text-gray-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
              >
                {isLoadingContext ? 'Carregando memórias...' : 'Iniciar Conversa'}
              </button>
              <button onClick={handleCancelWithSync} className="mt-4 text-gray-500 hover:text-white text-xs font-bold uppercase tracking-widest">Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {showTranscript && (
        <div className="w-80 h-full bg-gray-900 border-l border-white/10 flex flex-col shadow-2xl z-40 animate-slide-in-right">
          <div className="p-4 border-b border-white/10 flex justify-between items-center">
            <h3 className="font-bold text-xs uppercase tracking-widest">Transcrição</h3>
            <button onClick={() => setShowTranscript(false)} className="text-white/50 hover:text-white p-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <span className="text-[9px] text-gray-500 mb-1 uppercase font-black">{msg.role === 'user' ? 'VOCÊ' : avatar.name}</span>
                <div className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-200 border border-gray-700'}`}>{msg.text}</div>
              </div>
            ))}
            {currentTurnText && (
              <div className={`flex flex-col ${currentTurnRole === 'user' ? 'items-end' : 'items-start'}`}>
                <span className="text-[9px] text-gray-500 mb-1 uppercase font-black">{currentTurnRole === 'user' ? 'VOCÊ' : avatar.name}</span>
                <div className="max-w-[90%] rounded-2xl px-3 py-2 text-sm bg-blue-600/50 italic">{currentTurnText}...</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Session;