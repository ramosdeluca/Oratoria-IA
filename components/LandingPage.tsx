
import React from 'react';

interface LandingPageProps {
  onStart: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  return (
    <div className="bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30">
      {/* Navigation Header */}
      <nav className="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
        <div className="text-2xl font-black text-blue-400 tracking-tight">PratiquePRO</div>
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
          Fale inglês com confiança <br className="hidden md:block" />
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

      {/* Pricing Section */}
      <section className="py-24 bg-slate-950 border-t border-slate-900 text-center">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl md:text-5xl font-black text-white mb-6">
            Plano Premium
          </h2>

          <p className="text-slate-400 text-lg mb-10">
            Ganhe 10 minutos grátis para testar agora.
            Se gostar, continue com até 300 minutos de conversação real por mês
            (5 horas de prática por voz) com feedback inteligente incluído.
          </p>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 inline-block">
            <div className="text-5xl font-black text-white mb-2">
              R$ 49,90
            </div>
            <div className="text-slate-500 mb-6">
              por mês
            </div>

            <ul className="text-left text-slate-300 space-y-3 mb-8">
              <li>✔️ Até 300 minutos mensais</li>
              <li>✔️ Conversas ilimitadas por sessão</li>
              <li>✔️ Relatórios de evolução</li>
              <li>✔️ Todos os avatares liberados</li>
              <li>✔️ Recarregue minutos via PIX quando quiser</li>
              <li>✔️ Menos de R$ 1,70 por dia</li>
              <li>✔️ Cancele quando quiser. Sem fidelidade.</li>
            </ul>

            <button
              onClick={onStart}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-2xl transition-all"
            >
              Começar Agora
            </button>
          </div>
        </div>
      </section>

      {/* Why PratiquePRO */}
      <section className="bg-slate-900/50 py-24 border-y border-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Por que praticar com o PratiquePRO</h2>
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

      {/* Feedback & Evolution Details */}
      <section className="bg-blue-600 py-24 md:py-32 overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="z-10">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-8">Feedback e Evolução em Tempo Real</h2>
            <p className="text-blue-100 text-lg leading-relaxed mb-10">
              O PratiquePRO não apenas ouve você; ele analisa profundamente sua competência linguística.
              Atuamos como seu treinador pessoal de conversação, mapeando sua fluência,
              precisão gramatical e riqueza de vocabulário a cada palavra dita.
            </p>
            <ul className="space-y-5">
              {[
                "Análise detalhada de erros comuns",
                "Gráficos de evolução histórica por competência",
                "Identificação de tendências de aprendizado",
                "Resumos de desempenho personalizados"
              ].map((text, i) => (
                <li key={i} className="flex items-center gap-4 text-white text-lg font-bold">
                  <div className="w-2.5 h-2.5 bg-white rounded-full shadow-lg shadow-white/20"></div>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative pb-24 md:pb-32"> {/* Added padding to container to accommodate floating card */}
            {/* Primary Dashboard Mockup */}
            <div className="bg-slate-950 p-6 rounded-[2.5rem] shadow-[0_32px_64px_rgba(0,0,0,0.6)] border border-white/10 relative z-20">
              {/* Fake Header Stats */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-slate-900/80 p-3 rounded-2xl border border-white/5">
                  <div className="text-[8px] text-slate-500 uppercase font-bold mb-1">Pontos</div>
                  <div className="text-lg font-black text-yellow-500">3.719</div>
                </div>
                <div className="bg-slate-900/80 p-3 rounded-2xl border border-white/5">
                  <div className="text-[8px] text-slate-500 uppercase font-bold mb-1">Patente</div>
                  <div className="text-xs font-black text-white">Falante</div>
                </div>
                <div className="bg-slate-900/80 p-3 rounded-2xl border border-white/5">
                  <div className="text-[8px] text-slate-500 uppercase font-bold mb-1">Aulas</div>
                  <div className="text-lg font-black text-white">90</div>
                </div>
              </div>

              {/* Fake Feedback Panel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 border border-blue-500/20 p-5 rounded-3xl">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    <span className="text-[9px] font-black uppercase text-white tracking-wider">Resumo do seu Aprendizado</span>
                  </div>
                  <p className="text-[10px] text-blue-100/70 leading-relaxed italic">
                    "O usuário demonstra excelente compreensão auditiva... precisa trabalhar tempos verbais passados para atingir a fluência nativa."
                  </p>
                </div>

                {/* Simplified Radar Chart SVG */}
                <div className="bg-slate-900/50 p-4 rounded-3xl border border-white/5 flex flex-col items-center justify-center">
                  <div className="text-[8px] text-slate-600 font-black uppercase mb-2 tracking-tighter">Competências</div>
                  <svg width="100" height="100" viewBox="0 0 100 100" className="drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">
                    <polygon points="50,10 90,40 75,90 25,90 10,40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                    <polygon points="50,25 75,45 65,75 35,75 25,45" fill="rgba(59,130,246,0.3)" stroke="#3b82f6" strokeWidth="2" />
                    <circle cx="50" cy="25" r="2" fill="#3b82f6" />
                    <circle cx="75" cy="45" r="2" fill="#3b82f6" />
                    <circle cx="65" cy="75" r="2" fill="#3b82f6" />
                    <circle cx="35" cy="75" r="2" fill="#3b82f6" />
                    <circle cx="25" cy="45" r="2" fill="#3b82f6" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Secondary Floating Mockup (Metric Cards) - Adjusted bottom/left to clear first image */}
            <div className="absolute -bottom-10 md:-bottom-16 -left-4 md:-left-12 bg-slate-900 border border-white/10 p-5 rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.6)] z-30 w-[260px] md:w-[300px] transform -rotate-2 transition-transform hover:rotate-0 duration-500">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Métrica em destaque</span>
                <div className="flex items-center gap-1">
                  <span className="text-[8px] font-bold text-green-400 uppercase">Evoluindo</span>
                  <svg className="w-2.5 h-2.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                </div>
              </div>

              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-black text-yellow-500">55</span>
                <span className="text-slate-600 text-[10px] font-bold">/ 100</span>
              </div>

              <p className="text-[9px] text-slate-400 leading-relaxed mb-6">
                "O usuário mantém a troca de turnos adequadamente, mas utiliza frases curtas e fragmentadas..."
              </p>

              <div className="border-t border-white/5 pt-4">
                <span className="text-[8px] text-slate-600 font-black uppercase block mb-2">Evolução Histórica</span>
                <svg width="100%" height="30" viewBox="0 0 100 20">
                  <path
                    d="M0,15 Q20,10 40,16 T80,8 T120,12"
                    fill="none"
                    stroke="#eab308"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M0,15 Q20,10 40,16 T80,8 T120,12 L120,20 L0,20 Z"
                    fill="url(#grad2)"
                    opacity="0.1"
                  />
                  <defs>
                    <linearGradient id="grad2" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style={{ stopColor: '#eab308', stopOpacity: 1 }} />
                      <stop offset="100%" style={{ stopColor: '#eab308', stopOpacity: 0 }} />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            {/* Decorative backgrounds */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400/20 rounded-full blur-[100px] z-0"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-[100px] z-0"></div>
          </div>
        </div>
      </section>

      {/* Who is it for */}
      <section className="py-24 max-w-7xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-black text-white mb-12">Para quem é o PratiquePRO</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <h4 className="text-white font-bold mb-4 text-xl">Profissionais</h4>
            <p className="text-slate-400 text-sm leading-relaxed">Para quem precisa do inglês para reuniões, apresentações e networking internacional.</p>
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
        <div className="text-xl font-black text-slate-600 mb-4 tracking-tight">PratiquePRO</div>
        <p className="text-slate-700 text-sm">&copy; {new Date().getFullYear()} PratiquePRO. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
