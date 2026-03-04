import React, { useState, useEffect, useMemo } from 'react';
import { User, SessionResult, Course, CourseModule, Lesson } from '../types';
import { getAllStudentsData } from '../services/supabase';
import { getFirstCourse, getCourseModules, getModuleLessons } from '../services/courseService';
import {
    LineChart,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar
} from 'recharts';

interface AdminDashboardProps {
    onBack: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{
        profiles: any[];
        progress: any[];
        sessions: any[];
    } | null>(null);
    const [totalCourseLessons, setTotalCourseLessons] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
    const [historyModalUserId, setHistoryModalUserId] = useState<string | null>(null);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [lessonMap, setLessonMap] = useState<Record<string, string>>({});

    useEffect(() => {
        const loadAllData = async () => {
            setLoading(true);
            try {
                const adminData = await getAllStudentsData();
                setData(adminData);

                // Get total lessons for progress calc
                const course = await getFirstCourse();
                if (course) {
                    const modules = await getCourseModules(course.id);
                    let total = 0;
                    const lMap: Record<string, string> = {};
                    for (const mod of modules) {
                        const lessons = await getModuleLessons(mod.id);
                        total += lessons.length;
                        lessons.forEach(l => {
                            lMap[l.id] = l.title;
                        });
                    }
                    setTotalCourseLessons(total);
                    setLessonMap(lMap);
                }
            } catch (err) {
                console.error("Erro dashboard admin:", err);
            } finally {
                setLoading(false);
            }
        };
        loadAllData();
    }, []);

    const studentStats = useMemo(() => {
        if (!data) return [];

        return data.profiles.map(profile => {
            const userSessions = data.sessions.filter(s => s.user_id === profile.id);
            const userProgress = data.progress.filter(p => p.user_id === profile.id && p.completed);

            const avgScores = {
                overall: 0,
                confidence: 0,
                clarity: 0,
                persuasion: 0,
                posture: 0
            };

            if (userSessions.length > 0) {
                avgScores.overall = Math.round(userSessions.reduce((acc, s) => acc + (s.overall_score || 0), 0) / userSessions.length);
                avgScores.confidence = Math.round(userSessions.reduce((acc, s) => acc + (s.confidence_score || 0), 0) / userSessions.length);
                avgScores.clarity = Math.round(userSessions.reduce((acc, s) => acc + (s.clarity_score || 0), 0) / userSessions.length);
                avgScores.persuasion = Math.round(userSessions.reduce((acc, s) => acc + (s.persuasion_score || 0), 0) / userSessions.length);
                avgScores.posture = Math.round(userSessions.reduce((acc, s) => acc + (s.posture_score || 0), 0) / userSessions.length);
            }

            return {
                ...profile,
                sessionsCount: userSessions.length,
                lessonsCompleted: userProgress.length,
                progressPercent: totalCourseLessons > 0 ? Math.round((userProgress.length / totalCourseLessons) * 100) : 0,
                avgScores,
                liveSessionsCount: userSessions.filter(s => !s.lesson_id).length,
                lastActive: userSessions.length > 0 ? userSessions[0].date : profile.joined_date
            };
        });
    }, [data, totalCourseLessons]);

    const filteredStudents = useMemo(() => {
        return studentStats
            .filter(s =>
                (s.name + ' ' + s.surname).toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.email.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => b.avgScores.overall - a.avgScores.overall);
    }, [studentStats, searchTerm]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-6">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-400 font-medium">Carregando painel gerencial...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-xl border border-gray-700 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-blue-400">Dashboard Administrativo</h1>
                        <p className="text-sm text-gray-500">Gestão e acompanhamento de alunos</p>
                    </div>
                </div>

                <div className="flex bg-gray-800 border border-gray-700 rounded-2xl p-4 gap-8 shadow-xl">
                    <div className="text-center">
                        <p className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Total Alunos</p>
                        <p className="text-2xl font-black text-white">{data?.profiles.length || 0}</p>
                    </div>
                    <div className="w-px bg-gray-700 h-8 self-center"></div>
                    <div className="text-center">
                        <p className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Sessões Totais</p>
                        <p className="text-2xl font-black text-white">{data?.sessions.length || 0}</p>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto space-y-6">
                {/* Barra de Busca */}
                <div className="relative group">
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    <input
                        type="text"
                        placeholder="Pesquisar por nome ou e-mail..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-800/50 backdrop-blur-md border border-gray-700 focus:border-blue-500/50 rounded-2xl pl-12 pr-6 py-4 outline-none transition-all shadow-inner text-sm"
                    />
                </div>

                {/* Tabela de Alunos */}
                <div className="bg-gray-800/30 rounded-[2rem] border border-gray-700/50 overflow-hidden backdrop-blur-sm shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-800/50 text-[10px] uppercase font-black tracking-widest text-gray-500 border-b border-gray-700">
                                    <th className="px-6 py-4">Aluno</th>
                                    <th className="px-6 py-4">Práticas Livres</th>
                                    <th className="px-6 py-4">Progresso Curso</th>
                                    <th className="px-6 py-4">Média Geral</th>
                                    <th className="px-6 py-4">Créditos</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700/30">
                                {filteredStudents.map((std) => (
                                    <React.Fragment key={std.id}>
                                        <tr className="hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setExpandedUserId(expandedUserId === std.id ? null : std.id)}>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-bold text-sm">
                                                        {(std.name || 'U').charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm text-white">{std.name} {std.surname}</p>
                                                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">{std.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="text-sm font-bold text-blue-400">{std.liveSessionsCount} sessões</span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="w-32">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[10px] font-bold text-gray-500">{std.progressPercent}%</span>
                                                        <span className="text-[10px] font-bold text-gray-500">{std.lessonsCompleted}/{totalCourseLessons}</span>
                                                    </div>
                                                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${std.progressPercent}%` }}></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className={`text-lg font-black ${std.avgScores.overall > 70 ? 'text-green-400' : 'text-yellow-400'}`}>
                                                    {std.avgScores.overall}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 font-mono font-bold text-xs">
                                                {Math.floor(std.credits_remaining)} min
                                            </td>
                                            <td className="px-6 py-5">
                                                <button className={`p-2 rounded-lg transition-transform ${expandedUserId === std.id ? 'rotate-180 bg-gray-700' : 'hover:bg-gray-700'}`}>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedUserId === std.id && (
                                            <tr className="bg-gray-900/50">
                                                <td colSpan={6} className="p-8 animate-fade-in border-b border-gray-700/50">
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                                        {/* Radar de Competências */}
                                                        <div className="space-y-6">
                                                            <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-400 flex items-center gap-2">
                                                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                                                Radar de Habilidades
                                                            </h4>
                                                            <div className="h-72 w-full flex items-center justify-center">
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <RadarChart outerRadius="70%" data={[
                                                                        { subject: 'Confiança', A: std.avgScores.confidence },
                                                                        { subject: 'Clareza', A: std.avgScores.clarity },
                                                                        { subject: 'Persuasão', A: std.avgScores.persuasion },
                                                                        { subject: 'Postura', A: std.avgScores.posture },
                                                                        { subject: 'Geral', A: std.avgScores.overall },
                                                                    ]}>
                                                                        <PolarGrid stroke="#374151" />
                                                                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 'bold' }} tickLine={false} />
                                                                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                                                        <Radar name={std.name} dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                                                                    </RadarChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        </div>

                                                        {/* Detalhes e Sessões */}
                                                        <div className="space-y-6">
                                                            <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-400 flex items-center gap-2">
                                                                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                                                Últimas Atividades
                                                            </h4>
                                                            <div className="space-y-3">
                                                                {data?.sessions.filter(s => s.user_id === std.id).slice(0, 5).map((session, sIdx) => (
                                                                    <div key={sIdx} className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 flex items-center justify-between">
                                                                        <div>
                                                                            <p className="text-xs font-bold text-white">
                                                                                {session.lesson_id ? '🎓 Exercício de Aula' : '💬 Prática Livre'}
                                                                            </p>
                                                                            <p className="text-[10px] text-gray-500 mt-1">
                                                                                {new Date(session.date).toLocaleDateString('pt-BR')} • Score: <span className="text-blue-400 font-bold">{session.overall_score}</span>
                                                                            </p>
                                                                        </div>
                                                                        <div className="flex gap-1">
                                                                            {[1, 2, 3, 4, 5].map(star => {
                                                                                const score = (session.overall_score / 100) * 5;
                                                                                return (
                                                                                    <div key={star} className={`w-1.5 h-1.5 rounded-full ${star <= score ? 'bg-blue-400' : 'bg-gray-700'}`}></div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {data?.sessions.filter(s => s.user_id === std.id).length === 0 && (
                                                                    <p className="text-gray-600 italic text-xs py-10 text-center">Nenhuma sessão registrada para este aluno.</p>
                                                                )}
                                                            </div>
                                                            <div className="flex justify-end pt-4">
                                                                <button
                                                                    onClick={() => setHistoryModalUserId(std.id)}
                                                                    className="text-blue-400 hover:text-blue-300 text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors"
                                                                >
                                                                    Ver Histórico Completo
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* Modal de Histórico Completo */}
            {historyModalUserId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-gray-800 border border-gray-700 w-full max-w-5xl h-[90vh] rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl relative">
                        <header className="p-8 border-b border-gray-700 flex justify-between items-center bg-gray-800/50 backdrop-blur-md sticky top-0 z-10">
                            <div>
                                <h2 className="text-2xl font-black text-white">Histórico Completo</h2>
                                <p className="text-sm text-gray-400">
                                    {studentStats.find(s => s.id === historyModalUserId)?.name} {studentStats.find(s => s.id === historyModalUserId)?.surname}
                                </p>
                            </div>
                            <button
                                onClick={() => { setHistoryModalUserId(null); setSelectedSessionId(null); }}
                                className="p-3 bg-gray-700 hover:bg-red-500/20 hover:text-red-400 rounded-2xl transition-all"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </header>

                        <div className="flex-1 overflow-hidden flex">
                            {/* Lista de Sessões */}
                            <div className="w-1/3 border-r border-gray-700 overflow-y-auto custom-scrollbar p-6 space-y-4 bg-gray-900/20">
                                {data?.sessions
                                    .filter(s => s.user_id === historyModalUserId)
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .map((session, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => setSelectedSessionId(idx.toString())}
                                            className={`p-4 rounded-2xl border transition-all cursor-pointer ${selectedSessionId === idx.toString() ? 'bg-blue-600 border-blue-400 shadow-blue-500/20 shadow-lg' : 'bg-gray-800 border-gray-700 hover:border-blue-500/50'}`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <p className={`text-[10px] font-black uppercase tracking-widest ${selectedSessionId === idx.toString() ? 'text-blue-100' : 'text-gray-500'}`}>
                                                    {session.lesson_id ? `🎓 ${lessonMap[session.lesson_id] || 'Aula'}` : '💬 Livre'}
                                                </p>
                                                <span className={`text-xs font-black ${selectedSessionId === idx.toString() ? 'text-white' : 'text-blue-400'}`}>{session.overall_score}</span>
                                            </div>
                                            <p className={`text-xs font-bold ${selectedSessionId === idx.toString() ? 'text-white' : 'text-gray-300'}`}>
                                                {new Date(session.date).toLocaleString('pt-BR')}
                                            </p>
                                        </div>
                                    ))}
                                {data?.sessions.filter(s => s.user_id === historyModalUserId).length === 0 && (
                                    <p className="text-gray-500 text-center py-20 italic">Sem sessões registradas.</p>
                                )}
                            </div>

                            {/* Detalhes da Sessão */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-gray-900/30">
                                {selectedSessionId !== null ? (() => {
                                    const s = data?.sessions.filter(s => s.user_id === historyModalUserId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[parseInt(selectedSessionId)];
                                    if (!s) return null;
                                    return (
                                        <div className="space-y-8 animate-fade-in">
                                            <div className="grid grid-cols-4 gap-4">
                                                <div className="bg-gray-800 p-4 rounded-2xl border border-gray-700 text-center">
                                                    <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Confiança</p>
                                                    <p className="text-xl font-black text-purple-400">{s.confidence_score}%</p>
                                                </div>
                                                <div className="bg-gray-800 p-4 rounded-2xl border border-gray-700 text-center">
                                                    <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Clareza</p>
                                                    <p className="text-xl font-black text-pink-400">{s.clarity_score}%</p>
                                                </div>
                                                <div className="bg-gray-800 p-4 rounded-2xl border border-gray-700 text-center">
                                                    <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Persuasão</p>
                                                    <p className="text-xl font-black text-green-400">{s.persuasion_score}%</p>
                                                </div>
                                                <div className="bg-gray-800 p-4 rounded-2xl border border-gray-700 text-center">
                                                    <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Postura</p>
                                                    <p className="text-xl font-black text-blue-400">{s.posture_score}%</p>
                                                </div>
                                            </div>

                                            <div className="bg-blue-600/10 border border-blue-500/20 p-6 rounded-3xl">
                                                <h4 className="text-[10px] uppercase font-black tracking-widest text-blue-400 mb-3 flex items-center gap-2">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                                                    Feedback da IA
                                                </h4>
                                                <p className="text-sm text-gray-200 leading-relaxed italic">"{s.feedback}"</p>
                                            </div>

                                            <div className="space-y-4">
                                                <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-500 mb-3 flex items-center gap-2">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                                    Transcrição Completa
                                                </h4>
                                                <div className="bg-black/20 rounded-3xl p-6 h-[400px] overflow-y-auto custom-scrollbar space-y-4 border border-gray-700/30">
                                                    {s.transcript ? s.transcript.split('\n').map((line, lIdx) => {
                                                        const isUser = line.toLowerCase().startsWith('user:');
                                                        const isAvatar = line.toLowerCase().startsWith('avatar:');
                                                        const text = line.replace(/^(User|Avatar): /i, '');
                                                        if (!isUser && !isAvatar) return <p key={lIdx} className="text-[11px] text-gray-600 italic text-center py-2">{line}</p>;
                                                        return (
                                                            <div key={lIdx} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                                                                <span className="text-[9px] text-gray-600 mb-1 uppercase font-black">{isUser ? 'ALUNO' : 'IA'}</span>
                                                                <div className={`px-4 py-3 rounded-2xl max-w-[85%] text-xs leading-relaxed ${isUser ? 'bg-blue-600/20 text-blue-100 border border-blue-500/20' : 'bg-gray-800 text-gray-300 border border-gray-700'}`}>
                                                                    {text}
                                                                </div>
                                                            </div>
                                                        );
                                                    }) : <p className="text-gray-600 text-xs italic text-center py-20">Transcrição não disponível.</p>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })() : (
                                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                                        <svg className="w-20 h-20 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>
                                        <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Selecione uma sessão ao lado</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
