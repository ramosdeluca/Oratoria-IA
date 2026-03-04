
import React from 'react';

interface LandingPageProps {
  onStart: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  return (
    <div className="bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30">
      {/* Navigation Header */}
      <nav className="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
        <div className="text-2xl font-black text-blue-400 tracking-tight">OratoriaIA</div>
        <button
          onClick={onStart}
          className="text-sm font-bold bg-slate-900 border border-slate-800 hover:border-blue-500 px-6 py-2.5 rounded-full transition-all"
        >
          Entrar
        </button>
      </nav>

      {/* Hero Section */}
      <header className="max-w-7xl mx-auto px-6 pt-16 pb-24 md:pt-24 md:pb-32 text-center">
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white leading-tight mb-6">
          Fale em público com confiança <br className="hidden md:block" />
          através da prática real.
        </h1>
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Desenvolva sua fluência conversando com tutores preparados para o seu ritmo,
          disponíveis a qualquer hora para transformar seu conhecimento em fala natural.
        </p>
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={onStart}
            translate="no"
            className="bg-blue-600 hover:bg-blue-500 text-white text-lg font-bold px-10 py-5 rounded-2xl shadow-2xl shadow-blue-900/20 transition-all active:scale-95 whitespace-nowrap"
          >
            Começar Teste Grátis
          </button>
          <span className="text-sm font-medium text-slate-500">Ganhe 10 minutos grátis agora. Sem cartão de crédito.</span>
        </div>
      </header>

      {/* Pricing Section (Removido Temporariamente) */}
      {/* 
      <section className="py-24 bg-slate-950 border-t border-slate-900 text-center">
        ...
      </section> 
      */}

      {/* Why OratoriaIA */}
      <section className="bg-slate-900/50 py-24 border-y border-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Por que praticar com o OratoriaIA</h2>
            <div className="w-20 h-1 bg-blue-500"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl hover:border-slate-700 transition-colors">
              <h3 className="text-xl font-bold text-white mb-4">Prática por voz</h3>
              <p className="text-slate-400 leading-relaxed">Interação verbal constante. Sem digitação, sem distrações. Apenas você e a prática da fala real.</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl hover:border-slate-700 transition-colors">
              <h3 className="text-xl font-bold text-white mb-4">Confiança ao falar</h3>
              <p className="text-slate-400 leading-relaxed">Um ambiente seguro e privado para você errar e aprender sem o julgamento de uma sala de aula tradicional.</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl hover:border-slate-700 transition-colors">
              <h3 className="text-xl font-bold text-white mb-4">Feedback inteligente</h3>
              <p className="text-slate-400 leading-relaxed">Receba correções gramaticais e sugestões de vocabulário precisas logo após cada interação.</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl hover:border-slate-700 transition-colors">
              <h3 className="text-xl font-bold text-white mb-4">Evolução contínua</h3>
              <p className="text-slate-400 leading-relaxed">Métricas claras de progresso que mostram exatamente onde você está melhorando e onde precisa focar.</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl hover:border-slate-700 transition-colors">
              <h3 className="text-xl font-bold text-white mb-4">Flexibilidade total</h3>
              <p className="text-slate-400 leading-relaxed">Acesse seus tutores 24 horas por dia. Pratique 5 ou 50 minutos, sempre que tiver uma brecha na rotina.</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl hover:border-slate-700 transition-colors">
              <h3 className="text-xl font-bold text-white mb-4">Foco em adultos</h3>
              <p className="text-slate-400 leading-relaxed">Conteúdo e interações moldadas para situações profissionais e sociais da vida adulta.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feedback & Evolution Details - Redesigned for Premium Look */}
      <section className="bg-slate-950 py-24 md:py-32 overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-6">Análise Profissional por IA</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Nossa inteligência artificial mapeia cada detalhe da sua comunicação em tempo real,
              fornecendo um diagnóstico preciso de onde você deve focar para atingir a excelência.
            </p>
          </div>

          {/* Grid de Métricas (Inspirado na imagem do usuário) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {[
              { label: 'CLAREZA', score: 15, trend: 'REGREDINDO', text: 'Dificuldade em expressar a ideia principal. Organize o pensamento antes de falar.' },
              { label: 'POSTURA', score: 20, trend: 'REGREDINDO', text: 'A fragmentação da fala sugere inconsistência. Mantenha-se ereto e gesticule com propósito.' },
              { label: 'FLUÊNCIA', score: 20, trend: 'REGREDINDO', text: 'Frases incompletas e hesitação. Conecte ideias e use pausas estrategicamente.' },
              { label: 'COERÊNCIA', score: 18, trend: 'REGREDINDO', text: 'Ideias desconexas comprometem a lógica. Estruture sua fala em pontos principais.' },
              { label: 'CONFIANÇA', score: 25, trend: 'REGREDINDO', text: 'A insegurança transparece. Pratique a firmeza vocal e o contato visual.' },
              { label: 'PERSUASÃO', score: 10, trend: 'REGREDINDO', text: 'Não há objetivo claro. Defina sua mensagem e apoie com argumentos concisos.' },
            ].map((m, i) => (
              <div key={i} className="bg-slate-900/40 backdrop-blur-xl border border-white/5 p-6 rounded-[2rem] hover:border-blue-500/30 transition-all duration-500 group">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[10px] font-black text-slate-500 tracking-widest">{m.label}</span>
                  <div className="flex items-center gap-1.5 text-red-500">
                    <span className="text-[9px] font-black tracking-tight">{m.trend}</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path></svg>
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-5xl font-black text-white group-hover:text-blue-400 transition-colors tracking-tighter">{m.score}</span>
                  <span className="text-slate-600 text-sm font-bold">/ 100</span>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed font-medium">
                  {m.text}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Resumo Box */}
            <div className="lg:col-span-2 bg-gradient-to-br from-blue-900/20 to-purple-900/20 backdrop-blur-md border border-white/10 p-10 rounded-[2.5rem] flex flex-col justify-center">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-8 h-8 rounded-full border-2 border-blue-400 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <h3 className="text-2xl font-black text-white tracking-tight">Resumo do seu Aprendizado</h3>
              </div>
              <p className="text-xl italic font-medium text-blue-100/80 leading-relaxed">
                "Houve uma regressão significativa em todas as métricas, com fala fragmentada, falta de clareza e baixa confiança."
              </p>
            </div>

            {/* Radar Chart Box */}
            <div className="lg:col-span-3 bg-slate-900/40 backdrop-blur-md border border-white/5 p-10 rounded-[2.5rem] flex flex-col items-center">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-10">Gráfico de Radar de Competências</span>

              <div className="relative w-full max-w-[400px] aspect-square flex items-center justify-center">
                {/* Radar Grid (SVG) */}
                <svg viewBox="0 0 100 100" className="w-full h-full opacity-20">
                  <polygon points="50,5 95,25 95,75 50,95 5,75 5,25" fill="none" stroke="white" strokeWidth="0.5" />
                  <polygon points="50,25 72.5,35 72.5,65 50,75 27.5,65 27.5,35" fill="none" stroke="white" strokeWidth="0.5" />
                  <line x1="50" y1="50" x2="50" y2="5" stroke="white" strokeWidth="0.5" />
                  <line x1="50" y1="50" x2="95" y2="25" stroke="white" strokeWidth="0.5" />
                  <line x1="50" y1="50" x2="95" y2="75" stroke="white" strokeWidth="0.5" />
                  <line x1="50" y1="50" x2="50" y2="95" stroke="white" strokeWidth="0.5" />
                  <line x1="50" y1="50" x2="5" y2="75" stroke="white" strokeWidth="0.5" />
                  <line x1="50" y1="50" x2="5" y2="25" stroke="white" strokeWidth="0.5" />
                </svg>

                {/* Radar Visual Data */}
                <svg viewBox="0 0 100 100" className="w-full h-full absolute inset-0 filter drop-shadow-[0_0_12px_rgba(59,130,246,0.5)]">
                  <polygon
                    points="50,35 65,45 62,60 50,68 38,60 35,45"
                    fill="rgba(59,130,246,0.3)"
                    stroke="#3b82f6"
                    strokeWidth="1.5"
                    className="animate-pulse"
                  />
                  {/* Nodes */}
                  <circle cx="50" cy="35" r="1.5" fill="#3b82f6" />
                  <circle cx="65" cy="45" r="1.5" fill="#3b82f6" />
                  <circle cx="62" cy="60" r="1.5" fill="#3b82f6" />
                  <circle cx="50" cy="68" r="1.5" fill="#3b82f6" />
                  <circle cx="38" cy="60" r="1.5" fill="#3b82f6" />
                  <circle cx="35" cy="45" r="1.5" fill="#3b82f6" />
                </svg>

                {/* Labels */}
                <div className="absolute top-0 text-[8px] font-black text-slate-500 uppercase tracking-tighter">Confiança</div>
                <div className="absolute right-[5%] top-[20%] text-[8px] font-black text-slate-500 uppercase tracking-tighter">Clareza</div>
                <div className="absolute right-[5%] bottom-[20%] text-[8px] font-black text-slate-500 uppercase tracking-tighter">Persuasão</div>
                <div className="absolute bottom-0 text-[8px] font-black text-slate-500 uppercase tracking-tighter">Postura</div>
                <div className="absolute left-[5%] bottom-[20%] text-[8px] font-black text-slate-500 uppercase tracking-tighter">Coerência</div>
                <div className="absolute left-[5%] top-[20%] text-[8px] font-black text-slate-500 uppercase tracking-tighter">Fluência</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who is it for */}
      <section className="py-24 max-w-7xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-black text-white mb-12">Para quem é o OratoriaIA</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <h4 className="text-white font-bold mb-4 text-xl">Profissionais</h4>
            <p className="text-slate-400 text-sm leading-relaxed">Para quem precisa de boa oratória para reuniões, apresentações e networking.</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 text-xl">Ex-estudantes</h4>
            <p className="text-slate-400 text-sm leading-relaxed">Para quem já estudou a gramática por anos, mas ainda "trava" na hora de falar com alguém.</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 text-xl">Práticos</h4>
            <p className="text-slate-400 text-sm leading-relaxed">Para quem busca um ambiente livre de julgamentos para ganhar segurança através da repetição.</p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-slate-900 border-t border-slate-800 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl md:text-5xl font-black text-white mb-8">Pronto para destravar sua fala?</h2>
          <button
            onClick={onStart}
            translate="no"
            className="bg-blue-600 hover:bg-blue-500 text-white text-lg font-bold px-12 py-5 rounded-2xl shadow-xl transition-all whitespace-nowrap"
          >
            Começar Teste Grátis
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-900 text-center">
        <div className="text-xl font-black text-slate-600 mb-4 tracking-tight">OratoriaIA</div>
        <p className="text-slate-700 text-sm">&copy; {new Date().getFullYear()} OratoriaIA. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
