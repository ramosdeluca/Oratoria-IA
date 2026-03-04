import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, AvatarConfig, ChatMessage, SessionResult, Course, CourseModule, Lesson, Exercise } from '../types';
import { evaluateStructuredExercise, askQuickQuestion, generateTTS, transcribeAudio, generateEnhancedLessonScript } from '../services/gemini';
import { updateCourseAudioUrl, uploadLessonAudio } from '../services/supabase';
import { getNextLessonForUser, markLessonCompleted } from '../services/progressService';

interface SessionProps {
    user: User;
    avatar: AvatarConfig;
    onComplete: (result: Omit<SessionResult, 'date' | 'avatarName'>, finalCredits: number) => void;
    onCancel: () => void;
    onUpdateCredits: (remainingMinutes: number) => void;
    onBuyCredits: () => void;
}

type LessonMode = 'ensino' | 'duvida' | 'exercicio';

const Session: React.FC<SessionProps> = ({ user, avatar, onComplete, onCancel }) => {
    const [lessonMode, setLessonMode] = useState<LessonMode>('ensino');
    const [isFinishing, setIsFinishing] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [isLoadingContext, setIsLoadingContext] = useState(true);
    const [isProcessingResponse, setIsProcessingResponse] = useState(false);
    const [currentLessonData, setCurrentLessonData] = useState<{
        course: Course,
        module: CourseModule,
        lesson: Lesson,
        exercise: Exercise | null
    } | null>(null);

    // Audio & Animation states
    const [isAvatarTalking, setIsAvatarTalking] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const avatarImageRef = useRef<HTMLImageElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Dúvida mode states
    const [quickQuestion, setQuickQuestion] = useState("");

    // Exercise mode states
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<BlobPart[]>([]);
    const [exerciseFeedback, setExerciseFeedback] = useState<Omit<SessionResult, 'durationSeconds' | 'date' | 'avatarName' | 'isCompleted'> | null>(null);

    useEffect(() => {
        if (user.id) {
            getNextLessonForUser(user.id).then(async (lessonDataOrNull) => {
                if (lessonDataOrNull) {
                    setCurrentLessonData(lessonDataOrNull);
                }
            }).finally(() => {
                setIsLoadingContext(false);
            });
        } else {
            setIsLoadingContext(false);
        }

        // Cleanup audio
        return () => {
            stopAudio();
            if (audioContextRef.current) {
                audioContextRef.current.close().catch(console.error);
            }
        };
    }, [user.id]);

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setIsAvatarTalking(false);
        if (avatarImageRef.current) avatarImageRef.current.style.transform = 'scale(1)';
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };

    const setupAudioAnalyser = (audioElement: HTMLAudioElement) => {
        if (!audioContextRef.current) {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new AudioCtx();
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }

        if (!analyserRef.current) {
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
        }

        if (!sourceRef.current) {
            try {
                sourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
                sourceRef.current.connect(analyserRef.current);
                analyserRef.current.connect(audioContextRef.current.destination);
            } catch (e) {
                console.warn("Source já conectado", e);
            }
        }
    };

    const animateAvatar = () => {
        if (!analyserRef.current || !avatarImageRef.current) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const update = () => {
            if (!isAvatarTalking) return;
            analyserRef.current!.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < 20; i++) sum += dataArray[i];
            const energy = (sum / 20) / 255;
            const scale = 1 + energy * 0.15;

            if (avatarImageRef.current) {
                avatarImageRef.current.style.transform = `scale(${scale})`;
            }
            animationFrameRef.current = requestAnimationFrame(update);
        };
        update();
    };

    const playTTS = async (text: string, forceTTS = false, tableReference?: { table: 'lessons' | 'exercises', id: string, cachedUrl?: string }) => {
        stopAudio();
        setIsProcessingResponse(true);

        let audioUrl = "";

        try {
            // Só usa o cache se for para o mesmo avatar (mesma voz)
            if (!forceTTS && tableReference?.cachedUrl && tableReference.cachedUrl.includes(avatar.name)) {
                console.log(`[Session] Usando áudio em cache para ${tableReference.table}: ${tableReference.id}`);
                audioUrl = tableReference.cachedUrl;
            } else {
                console.log(`[Session] Cache não encontrado ou forçado. Enriquecendo script e gerando novo TTS...`);

                // Enriquece o texto da aula com uma explicação dinâmica da IA
                const enhancedText = await generateEnhancedLessonScript(text);
                console.log(`[Session] Script enriquecido: "${enhancedText.substring(0, 50)}..."`);

                const audioBlob = await generateTTS(enhancedText, avatar.name);
                if (!audioBlob) throw new Error("Falha ao gerar áudio Gemini TTS");

                if (tableReference) {
                    const fileName = `${tableReference.table}_${tableReference.id}_${avatar.name}.mp3`;
                    console.log(`[Session] Solicitando upload do áudio para o bucket: ${fileName}`);
                    const uploadedUrl = await uploadLessonAudio(fileName, audioBlob);

                    if (uploadedUrl) {
                        console.log("[Session] Áudio persistido com sucesso no bucket.");
                        audioUrl = uploadedUrl;
                        await updateCourseAudioUrl(tableReference.table, tableReference.id, uploadedUrl);
                    } else {
                        console.warn("[Session] Falha no upload para o bucket, usando URL local temporária.");
                        audioUrl = URL.createObjectURL(audioBlob);
                    }
                } else {
                    audioUrl = URL.createObjectURL(audioBlob);
                }
            }

            const audio = new Audio(audioUrl);
            audio.crossOrigin = "anonymous";
            audioRef.current = audio;

            audio.onplay = () => {
                setIsProcessingResponse(false);
                setIsAvatarTalking(true);
                setupAudioAnalyser(audio);
                animateAvatar();
            };

            audio.onended = () => {
                setIsAvatarTalking(false);
                if (avatarImageRef.current) avatarImageRef.current.style.transform = 'scale(1)';
                if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            };

            await audio.play();
        } catch (e) {
            console.error("[Session] Erro no Cloud TTS, tentando fallback local:", e);
            try {
                // Fallback para Browser TTS (Web Speech API) para não travar a aula
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'pt-BR';
                utterance.rate = 1.0;

                utterance.onstart = () => {
                    setIsProcessingResponse(false);
                    setIsAvatarTalking(true);
                    // Sem analyser no fallback nativo para evitar complexidade, apenas animação simples se necessário
                };
                utterance.onend = () => setIsAvatarTalking(false);

                window.speechSynthesis.speak(utterance);
            } catch (fallbackErr) {
                setLocalError("Não foi possível reproduzir a voz pela Nuvem (TTS).");
                setIsProcessingResponse(false);
            }
        }
    };



    const handleStart = () => {
        setHasStarted(true);
        if (!currentLessonData) return;

        // Ajuste no intro text
        const introText = `Vamos lá! Hoje veremos ${currentLessonData.lesson.title}. \n\n${currentLessonData.lesson.content}`;
        playTTS(introText, false, { table: 'lessons', id: currentLessonData.lesson.id, cachedUrl: currentLessonData.lesson.audio_url });
    };

    const askQuestion = async () => {
        if (isRecording) {
            toggleRecording();
            return;
        }

        if (!quickQuestion.trim() || !currentLessonData) return;
        setIsProcessingResponse(true);
        setLocalError(null);
        stopAudio();

        const context = `[MÓDULO ${currentLessonData.module.title}]\n[AULA: ${currentLessonData.lesson.title}]\nConteúdo: ${currentLessonData.lesson.content}`;
        const response = await askQuickQuestion(quickQuestion, context, avatar.systemInstruction);

        setQuickQuestion("");
        playTTS(response, true); // Dúvidas não são cacheadas
    };

    const startExerciseMode = () => {
        setLessonMode('exercicio');
        if (currentLessonData?.exercise) {
            playTTS(currentLessonData.exercise.instruction, false, { table: 'exercises', id: currentLessonData.exercise.id, cachedUrl: currentLessonData.exercise.audio_url });
        }
    };

    const toggleRecording = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };

                mediaRecorder.onstop = async () => {
                    stream.getTracks().forEach(track => track.stop());
                    setIsRecording(false);
                    setIsProcessingResponse(true);

                    try {
                        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                        const transcribedText = await transcribeAudio(audioBlob);

                        if (!transcribedText || transcribedText.trim() === "") {
                            setLocalError("Não foi possível entender o áudio. Tente falar novamente mais perto do microfone.");
                            setIsProcessingResponse(false);
                            return;
                        }

                        // Decide o que fazer com base no modo (Ensino [Dúvida] vs Exercício)
                        if (lessonMode === 'ensino') {
                            setQuickQuestion(transcribedText);
                            const context = `[MÓDULO ${currentLessonData?.module.title}]\n[AULA: ${currentLessonData?.lesson.title}]\nConteúdo: ${currentLessonData?.lesson.content}`;
                            const response = await askQuickQuestion(transcribedText, context, avatar.systemInstruction);
                            setQuickQuestion("");
                            playTTS(response, true);
                        } else if (lessonMode === 'exercicio') {
                            let exInstruction = currentLessonData?.exercise?.instruction || "";
                            const isVideo = exInstruction.toLowerCase().includes('vídeo') || exInstruction.toLowerCase().includes('video') || (currentLessonData?.lesson?.title || "").toLowerCase().includes('vídeo') || (currentLessonData?.lesson?.title || "").toLowerCase().includes('video');
                            if (isVideo) {
                                exInstruction += " (O aluno deveria assistir a um vídeo e gravar comentários sobre ele. Avalie a clareza e postura na análise feita do vídeo.)";
                            }
                            const evaluation = await evaluateStructuredExercise(transcribedText, exInstruction, user.name);
                            setExerciseFeedback(evaluation);
                            playTTS(evaluation.feedback, true);
                        }
                    } catch (e) {
                        setLocalError("Erro ao processar gravação.");
                    } finally {
                        setIsProcessingResponse(false);
                    }
                };

                mediaRecorder.start();
                setIsRecording(true);
                stopAudio();
            } catch (err) {
                setLocalError("Permissão de microfone negada.");
            }
        }
    };

    const handleFinish = async () => {
        if (isFinishing || !currentLessonData || !user.id || !exerciseFeedback) return;
        setIsFinishing(true);

        await markLessonCompleted(user.id, currentLessonData.lesson.id, exerciseFeedback.overallScore);
        onComplete({ ...exerciseFeedback, isCompleted: true, lessonId: currentLessonData.lesson.id }, user.creditsRemaining || 0);
    };

    return (
        <div className="flex h-[100dvh] bg-gray-900 text-white overflow-hidden relative">
            <div className="relative flex-1 flex flex-col min-w-0">
                <header className="absolute top-0 left-0 right-0 z-20 p-4 sm:p-6 flex justify-between items-start pointer-events-none">
                    {currentLessonData && (
                        <div className="bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/5 shadow-xl pointer-events-auto">
                            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                                Módulo {currentLessonData.module.position + 1} <span className="text-gray-500 mx-1">•</span> Aula {currentLessonData.lesson.position + 1}
                            </span>
                        </div>
                    )}

                    {hasStarted && (
                        <div className="flex bg-gray-800/80 rounded-full p-1 pointer-events-auto border border-white/10">
                            <button onClick={onCancel} className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors text-gray-400 hover:text-red-400 mr-2 flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                                Sair
                            </button>
                            <div className="w-[1px] h-6 bg-white/10 self-center mx-1"></div>
                            <button onClick={() => setLessonMode('ensino')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ml-1 ${lessonMode === 'ensino' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>Ensino</button>
                            <button onClick={() => startExerciseMode()} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${lessonMode === 'exercicio' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>Exercício</button>
                        </div>
                    )}
                </header>

                <div className="flex-1 flex flex-col items-center justify-center relative bg-gradient-to-b from-gray-800 to-gray-950 px-4">
                    <div className={`relative rounded-full overflow-hidden border-4 transition-all duration-300 ${isAvatarTalking ? 'border-blue-500 shadow-[0_0_30px_#3b82f6]' : 'border-white/10 shadow-2xl'} bg-gray-800
             w-40 h-40 sm:w-60 sm:h-60 md:w-80 md:h-80 lg:w-96 lg:h-96
          `}>
                        <img ref={avatarImageRef} src={avatar.avatarImage} alt={avatar.name} className={`w-full h-full object-cover animate-alive ${avatar.imagePosition || 'object-center'}`} />
                    </div>

                    <div className="mt-16 sm:mt-24 h-32 w-full max-w-md flex flex-col items-center justify-center">
                        {isProcessingResponse && (
                            <div className="flex items-center gap-2 text-blue-400">
                                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></span>
                                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                                <span className="text-sm font-medium ml-2">{avatar.name} está pensando...</span>
                            </div>
                        )}

                        {localError && <p className="text-red-400 text-xs text-center">{localError}</p>}

                        {!isProcessingResponse && hasStarted && lessonMode === 'ensino' && currentLessonData && (
                            <div className="text-center animate-fade-in w-full flex flex-col items-center">
                                <h2 className="text-xl font-bold mb-2 text-white">{currentLessonData.lesson.title}</h2>
                                <p className="text-gray-400 text-sm line-clamp-3 px-4 mb-6">{currentLessonData.lesson.content}</p>

                                {/* Quick Question Area merged into Ensino */}
                                <div className="w-full max-w-md flex flex-col gap-2 px-4 mb-4">
                                    <div className="flex w-full bg-gray-800 border border-gray-700 rounded-full overflow-hidden focus-within:border-blue-500 transition-colors">
                                        <input
                                            type="text"
                                            value={quickQuestion}
                                            onChange={e => setQuickQuestion(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && askQuestion()}
                                            placeholder={`Perguntar ao ${avatar.name}...`}
                                            className="flex-1 bg-transparent px-4 py-3 text-sm outline-none"
                                        />
                                        <div className="flex bg-transparent">
                                            <button
                                                onClick={toggleRecording}
                                                className={`px-3 transition-colors ${isRecording ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-white'}`}
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                                            </button>
                                            <button onClick={askQuestion} disabled={!quickQuestion.trim() && !isRecording} className="px-4 text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <button onClick={startExerciseMode} className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-full text-sm font-bold transition-colors mt-2">
                                    Ir para Exercício →
                                </button>
                            </div>
                        )}

                        {!isProcessingResponse && hasStarted && lessonMode === 'exercicio' && (
                            <div className="flex flex-col items-center animate-fade-in w-full">
                                {exerciseFeedback ? (
                                    <div className="text-center">
                                        <div className="text-4xl font-black text-green-400 mb-2">{exerciseFeedback.overallScore}%</div>
                                        <p className="text-sm text-gray-300 mb-4 px-4 line-clamp-2">{exerciseFeedback.feedback}</p>
                                        <button onClick={handleFinish} className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-full font-bold shadow-lg w-full">
                                            Concluir Exercício
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {(
                                            (currentLessonData?.exercise?.instruction || "").toLowerCase().includes('vídeo') ||
                                            (currentLessonData?.exercise?.instruction || "").toLowerCase().includes('video') ||
                                            (currentLessonData?.lesson?.title || "").toLowerCase().includes('vídeo') ||
                                            (currentLessonData?.lesson?.title || "").toLowerCase().includes('video')
                                        ) && (
                                                <div className="bg-blue-900/40 border border-blue-500/30 px-4 py-2 text-blue-200 text-sm rounded-lg mb-4 text-center max-w-sm animate-pulse">
                                                    <strong className="block text-blue-400 mb-1">Atenção ao Exercício</strong>
                                                    Lembre-se de gravar seu áudio comentando sobre o vídeo que acabou de assistir.
                                                </div>
                                            )}
                                        <button
                                            onClick={toggleRecording}
                                            disabled={isProcessingResponse}
                                            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-blue-600 hover:bg-blue-500 disabled:opacity-50'}`}
                                        >
                                            {isRecording ? <div className="w-6 h-6 bg-white rounded-sm" /> : <div className="w-8 h-8 bg-white rounded-full" />}
                                        </button>
                                        <p className="mt-4 text-xs text-gray-400 text-center max-w-[280px] leading-relaxed font-medium">
                                            Se for uma dinâmica ou trabalho estritamente feito em sala de aula, detalhe como foi e sua percepção da dinâmica/trabalho.
                                        </p>
                                        {isRecording && <span className="text-xs text-red-400 mt-3 font-mono border border-red-500/30 px-2 py-1 rounded">Gravando áudio...</span>}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {!hasStarted && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="bg-gray-800 p-8 rounded-3xl shadow-2xl border border-gray-700 max-w-sm w-full text-center">
                            <img src={avatar.avatarImage} className={`w-24 h-24 mx-auto mb-4 rounded-full border-4 border-blue-500 object-cover ${avatar.imagePosition || 'object-center'}`} />
                            <h2 className="text-2xl font-bold mb-2">Aula Controlada</h2>
                            {currentLessonData && (
                                <div className="mb-4 bg-gray-900/50 p-3 rounded-xl border border-gray-700/50">
                                    <span className="text-[10px] uppercase font-bold text-blue-400 block mb-1">Módulo {currentLessonData.module.position + 1}</span>
                                    <p className="text-sm font-medium text-gray-300 line-clamp-2">{currentLessonData.lesson.title}</p>
                                </div>
                            )}
                            <p className="text-gray-400 text-xs mb-6 px-4">Acesse 'Prática Livre' no painel principal para conversar por vídeo.</p>
                            <button
                                onClick={handleStart}
                                disabled={isLoadingContext}
                                className={`w-full py-4 rounded-xl font-bold transition-all active:scale-95 ${isLoadingContext ? 'bg-gray-700 text-gray-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-900/20'}`}
                            >
                                {isLoadingContext ? 'Carregando aula...' : 'Iniciar Aula'}
                            </button>
                            <button onClick={onCancel} className="mt-4 text-gray-500 hover:text-white text-xs font-bold uppercase tracking-widest">Sair</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Session;
