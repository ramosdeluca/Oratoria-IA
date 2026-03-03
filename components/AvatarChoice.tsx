import React, { useState, useEffect } from 'react';
import { User, AvatarVoice, Course, CourseModule, Lesson } from '../types';
import { getFirstCourse, getCourseModules, getModuleLessons } from '../services/courseService';
import { getStudentProgress } from '../services/progressService';

export const LEO_AVATAR = {
    id: 'leo',
    name: 'Leo',
    accent: 'American' as const,
    voice: AvatarVoice.Charon,
    systemInstruction: 'Você é Leo, um professor de oratória paciente, empático e encorajador. Você guia o aluno passo a passo, corrige gentilmente e propõe prática oral contínua. Seja sempre claro nas instruções e nunca deixe de motivar. Importante: Quando você sentir que o aluno já praticou o exercício proposto de forma satisfatória e não há mais motivo para prolongar a conversa, diga explicitamente: "Ótimo trabalho! Para finalizarmos e avaliarmos seu desempenho nesta aula, por favor clique no botão \'Concluir Exercício\' na sua tela."',
    description: 'Professor focado em estruturação de pensamento e confiança, ideal para quem quer falar com clareza.',
    color: 'bg-indigo-600',
    avatarImage: '/Leoavatar.png', // Update later if needed
    imagePosition: 'object-top',
    videoUrl: '',
};

export const SARAH_AVATAR = {
    id: 'sarah',
    name: 'Sarah',
    accent: 'American' as const,
    voice: AvatarVoice.Kore,
    systemInstruction: 'Você é Sarah, uma professora de oratória dinâmica e inspiradora. Você foca na expressividade, naturalidade e controle da ansiedade. Dê dicas práticas e faça com que o aluno se sinta seguro para arriscar e falar em público. Importante: Quando você sentir que o aluno já praticou o exercício proposto de forma satisfatória e não há mais motivo para prolongar a conversa, diga explicitamente: "Ótimo trabalho! Para finalizarmos e avaliarmos seu desempenho nesta aula, por favor clique no botão \'Concluir Exercício\' na sua tela."',
    description: 'Professora especialista em expressividade e controle de ansiedade, perfeita para apresentações em público.',
    color: 'bg-emerald-600',
    avatarImage: '/Sarahavatar.png', // Update later if needed
    imagePosition: 'object-top',
    videoUrl: '',
};

export const AVATARS = [SARAH_AVATAR, LEO_AVATAR];

interface AvatarChoiceProps {
    user: User;
    onAvatarSelected: (avatarId: string) => void;
}

const AvatarChoice: React.FC<AvatarChoiceProps> = ({ user, onAvatarSelected }) => {
    const [loading, setLoading] = useState(false);

    // Curriculum state
    const [course, setCourse] = useState<Course | null>(null);
    const [modules, setModules] = useState<CourseModule[]>([]);
    const [lessonsByModule, setLessonsByModule] = useState<Record<string, Lesson[]>>({});
    const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());
    const [isLoadingCurriculum, setIsLoadingCurriculum] = useState(true);

    useEffect(() => {
        const loadCurriculum = async () => {
            if (!user.id) return;
            try {
                const fetchedCourse = await getFirstCourse();
                if (fetchedCourse) {
                    setCourse(fetchedCourse);
                    const fetchedModules = await getCourseModules(fetchedCourse.id);
                    setModules(fetchedModules);

                    const lessonsMap: Record<string, Lesson[]> = {};
                    for (const mod of fetchedModules) {
                        lessonsMap[mod.id] = await getModuleLessons(mod.id);
                    }
                    setLessonsByModule(lessonsMap);

                    const progress = await getStudentProgress(user.id);
                    const completedIds = new Set(progress.filter(p => p.completed).map(p => p.lesson_id));
                    setCompletedLessonIds(completedIds);
                }
            } catch (err) {
                console.error("Failed to load curriculum", err);
            } finally {
                setIsLoadingCurriculum(false);
            }
        };
        loadCurriculum();
    }, [user.id]);

    const handleSelect = async (avatarId: string) => {
        setLoading(true);
        await onAvatarSelected(avatarId);
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 lg:p-12 animate-fade-in relative overflow-x-hidden">
            {/* Background decoration */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 z-10 relative">

                {/* Left Side: Mentors */}
                <div className="lg:col-span-7 flex flex-col justify-center">
                    <div className="mb-8">
                        <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                            Bem-vindo à sua Jornada de Oratória!
                        </h1>
                        <p className="text-lg text-gray-400">
                            Para começarmos as aulas, escolha o seu professor mentor.
                            Essa escolha vai guiar todo o seu aprendizado.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {AVATARS.map((avatar) => (
                            <div
                                key={avatar.id}
                                className="group relative bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-6 cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:bg-gray-800 hover:border-gray-600 hover:shadow-2xl flex flex-col h-full"
                                onClick={() => handleSelect(avatar.id)}
                            >
                                <div className={`absolute top-0 left-0 w-full h-1.5 ${avatar.color}`}></div>

                                <div className="flex flex-col items-center flex-grow">
                                    <div className="w-24 h-24 rounded-full overflow-hidden mb-4 border-4 border-gray-700 group-hover:border-blue-500 transition-colors duration-300">
                                        <img
                                            src={avatar.avatarImage}
                                            alt={avatar.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>

                                    <h3 className="text-xl font-bold mb-2">{avatar.name}</h3>
                                    <p className="text-xs text-gray-400 text-center mb-6 leading-relaxed flex-grow">
                                        {avatar.description}
                                    </p>

                                    <button
                                        disabled={loading}
                                        className={`w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all mt-auto ${loading ? 'bg-gray-700 opacity-50' : 'bg-blue-600 group-hover:bg-blue-500 shadow-lg shadow-blue-900/20'}`}
                                    >
                                        {loading ? 'Praticando...' : `Praticar com ${avatar.name}`}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Side: Curriculum */}
                <div className="lg:col-span-5 bg-gray-800/40 backdrop-blur-md border border-gray-700/50 rounded-3xl p-6 lg:p-8 flex flex-col h-[80vh] sticky top-8">
                    <h2 className="text-2xl font-black mb-1">Trilha de Aprendizagem</h2>
                    <p className="text-sm text-gray-400 mb-6">Acompanhe sua evolução no curso</p>

                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                        {isLoadingCurriculum ? (
                            <div className="flex items-center justify-center py-12 text-gray-500">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Carregando currículo...
                            </div>
                        ) : modules.length === 0 ? (
                            <p className="text-gray-500 text-center py-10">Nenhum módulo encontrado.</p>
                        ) : (
                            modules.map((mod) => (
                                <div key={mod.id} className="bg-gray-900/50 rounded-2xl border border-gray-700 overflow-hidden">
                                    <div className="p-4 border-b border-gray-800 bg-gray-800/20">
                                        <h3 className="font-bold text-sm uppercase tracking-wider text-blue-400">
                                            Módulo {mod.position + 1}
                                        </h3>
                                        <p className="font-bold text-white mt-1">{mod.title}</p>
                                    </div>
                                    <div className="bg-gray-900/40 divide-y divide-gray-800">
                                        {(lessonsByModule[mod.id] || []).map((lesson) => {
                                            const isCompleted = completedLessonIds.has(lesson.id);
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

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 8px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 8px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
            `}} />
        </div>
    );
};

export default AvatarChoice;
