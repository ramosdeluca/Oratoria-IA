import React, { useState } from 'react';
import TermsModal from './TermsModal';
import { TermsContent, PrivacyContent } from './LegalContent';
import { User } from '../types';
import { supabase, getUserProfile, getEmailByUsername, updateUserStats, resetPasswordForEmail, updateUserPassword } from '../services/supabase';

interface LoginProps {
  onLogin: (user: User) => void;
  initialMode?: 'login' | 'register' | 'reset' | 'updatePassword';
}

type AuthMode = 'login' | 'register' | 'reset' | 'updatePassword';

const Login: React.FC<LoginProps> = ({ onLogin, initialMode }) => {
  const [mode, setMode] = useState<AuthMode>(initialMode || 'login');
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    surname: '',
    cpf: '',
    phone: '',
    resetEmail: '',
    newPassword: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Terms and Privacy State
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let loginEmail = formData.username;

    if (!loginEmail.includes('@')) {
      const resolvedEmail = await getEmailByUsername(loginEmail);
      if (resolvedEmail) {
        loginEmail = resolvedEmail;
      } else {
        loginEmail = `${loginEmail.toLowerCase()}@pratiquepro.com`;
      }
    }

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: formData.password,
    });

    if (authError) {
      setError("Credenciais inválidas. Verifique e-mail/usuário e senha.");
      setLoading(false);
      return;
    }

    if (data.user) {
      const profile = await getUserProfile(data.user.id);
      if (profile) {
        onLogin(profile);
      } else {
        setError("Erro ao carregar perfil do banco de dados.");
      }
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.name || !formData.surname || !formData.username || !formData.email || !formData.password || !formData.cpf) {
      setError("Campos obrigatórios: Nome, Sobrenome, Usuário, E-mail, Senha e CPF.");
      setLoading(false);
      return;
    }

    if (!termsAccepted) {
      setError("Você deve aceitar os Termos de Uso e Política de Privacidade para criar a conta.");
      setLoading(false);
      return;
    }

    const cleanCpf = formData.cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setError("CPF deve conter exatamente 11 dígitos.");
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("As senhas não coincidem.");
      setLoading(false);
      return;
    }

    // 1. Criar o usuário no Auth do Supabase
    const { data, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          username: formData.username.toLowerCase(),
          name: formData.name,
          surname: formData.surname,
          email: formData.email,
          cpf: cleanCpf,
          phone: formData.phone
        }
      }
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      setSuccess("Conta criada com sucesso! Sincronizando dados...");

      // 2. Gravação EXPLÍCITA na tabela profiles para garantir que CPF, Telefone e CRÉDITOS sejam salvos
      try {
        await updateUserStats(data.user.id, {
          cpf: cleanCpf,
          phone: formData.phone,
          creditsRemaining: 10, // Créditos Iniciais de 10 minutos
          creditsTotal: 10,
          name: formData.name,
          surname: formData.surname,
          username: formData.username.toLowerCase(),
          termsAcceptedAt: new Date().toISOString()
        } as any);
      } catch (err) {
        console.warn("[Login] Erro ao forçar gravação no profile", err);
      }

      // Objeto de fallback imediato para garantir que a UI tenha os dados sem esperar o banco
      const initialUser: User = {
        id: data.user.id,
        username: formData.username.toLowerCase(),
        email: formData.email,
        name: formData.name,
        surname: formData.surname,
        cpf: cleanCpf,
        phone: formData.phone,
        rank: 'Novato',
        points: 0,
        sessionsCompleted: 0,
        joinedDate: new Date().toISOString(),
        creditsRemaining: 10,
        creditsTotal: 10
      };

      // Tenta carregar o perfil do banco
      setTimeout(async () => {
        const profile = await getUserProfile(data.user!.id);
        onLogin(profile && profile.name ? profile : initialUser);
      }, 1200);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const { success, error } = await resetPasswordForEmail(formData.resetEmail);

    if (!success) {
      setError(error?.message || "Erro ao solicitar redefinição.");
    } else {
      setSuccess("Link de redefinição enviado para seu e-mail!");
    }
    setLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (formData.newPassword !== formData.confirmPassword) {
      setError("As senhas não coincidem.");
      setLoading(false);
      return;
    }

    const { success, error } = await updateUserPassword(formData.newPassword);

    if (!success) {
      setError(error?.message || "Erro ao atualizar senha.");
    } else {
      setSuccess("Senha atualizada com sucesso! Redirecionando...");
      setTimeout(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const profile = await getUserProfile(user.id);
          if (profile) onLogin(profile);
        }
      }, 2000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4 py-12 text-white">
      <div className="max-w-md w-full space-y-8 bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700">
        <div className="text-center">
          <h2 className="text-3xl font-black text-blue-400">PratiquePRO</h2>
          <p className="mt-2 text-sm text-gray-400">
            {mode === 'login' ? 'Bem-vindo de volta' : mode === 'register' ? 'Crie sua conta gratuita' : mode === 'reset' ? 'Redefinir senha' : 'Crie sua nova senha'}
          </p>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl text-sm text-center">{error}</div>}
        {success && <div className="bg-green-500/10 border border-green-500/50 text-green-400 p-3 rounded-xl text-sm text-center">{success}</div>}

        <div className="mt-8">
          {mode === 'login' && (
            <form className="space-y-6" onSubmit={handleLogin}>
              <input name="username" type="text" required className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="E-mail ou Usuário" value={formData.username} onChange={handleInputChange} disabled={loading} />
              <div className="space-y-2">
                <input name="password" type="password" required className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="Senha" value={formData.password} onChange={handleInputChange} disabled={loading} />
                <div className="text-right">
                  <button type="button" onClick={() => { setMode('reset'); setError(null); setSuccess(null); }} className="text-xs text-blue-400 hover:text-blue-300">Esqueci minha senha</button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full py-4 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl shadow-lg transition-all disabled:opacity-50">{loading ? "Entrando..." : "Entrar"}</button>

              <div className="flex justify-center gap-4 text-xs text-gray-500 mt-4">
                <button type="button" onClick={() => setShowTerms(true)} className="hover:text-gray-300 transition-colors">Termos de Uso</button>
                <span>|</span>
                <button type="button" onClick={() => setShowPrivacy(true)} className="hover:text-gray-300 transition-colors">Política de Privacidade</button>
              </div>
            </form>
          )}

          {mode === 'reset' && (
            <form className="space-y-6" onSubmit={handleResetRequest}>
              <p className="text-xs text-gray-400 px-1">Insira seu e-mail para receber um link de redefinição de senha.</p>
              <input name="resetEmail" type="email" required className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="Seu e-mail" value={formData.resetEmail} onChange={handleInputChange} disabled={loading} />
              <button type="submit" disabled={loading} className="w-full py-4 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl shadow-lg transition-all disabled:opacity-50">{loading ? "Enviando..." : "Enviar link"}</button>
              <button type="button" onClick={() => setMode('login')} className="w-full text-gray-400 text-sm hover:text-white transition-colors">Voltar para o Login</button>
            </form>
          )}

          {mode === 'updatePassword' && (
            <form className="space-y-6" onSubmit={handleUpdatePassword}>
              <div className="space-y-4">
                <input name="newPassword" type="password" required className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nova senha" value={formData.newPassword} onChange={handleInputChange} disabled={loading} />
                <input name="confirmPassword" type="password" required className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="Confirmar nova senha" value={formData.confirmPassword} onChange={handleInputChange} disabled={loading} />
              </div>
              <button type="submit" disabled={loading} className="w-full py-4 bg-green-600 hover:bg-green-500 font-bold rounded-xl shadow-lg transition-all disabled:opacity-50">{loading ? "Atualizando..." : "Atualizar Senha"}</button>
            </form>
          )}

          {mode === 'register' && (
            <form className="space-y-4" onSubmit={handleRegister}>
              <div className="grid grid-cols-2 gap-4">
                <input name="name" type="text" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-xl outline-none text-sm" placeholder="Nome" value={formData.name} onChange={handleInputChange} />
                <input name="surname" type="text" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-xl outline-none text-sm" placeholder="Sobrenome" value={formData.surname} onChange={handleInputChange} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input name="username" type="text" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-xl outline-none text-sm" placeholder="Usuário" value={formData.username} onChange={handleInputChange} />
                <input name="cpf" type="text" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-xl outline-none text-sm" placeholder="CPF (Apenas números)" value={formData.cpf} onChange={handleInputChange} />
              </div>
              <input name="email" type="email" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-xl outline-none text-sm" placeholder="E-mail" value={formData.email} onChange={handleInputChange} />
              <input name="phone" type="text" className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-xl outline-none text-sm" placeholder="Telefone: (00) 00000-0000" value={formData.phone} onChange={handleInputChange} />
              <div className="grid grid-cols-2 gap-4">
                <input name="password" type="password" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-xl outline-none text-sm" placeholder="Senha" value={formData.password} onChange={handleInputChange} />
                <input name="confirmPassword" type="password" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-xl outline-none text-sm" placeholder="Confirmar" value={formData.confirmPassword} onChange={handleInputChange} />
              </div>
              <div className="flex items-start gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <label>
                  Ao criar a conta, você concorda com os <button type="button" onClick={() => setShowTerms(true)} className="text-blue-400 hover:text-blue-300 underline">Termos de Uso</button> e <button type="button" onClick={() => setShowPrivacy(true)} className="text-blue-400 hover:text-blue-300 underline">Política de Privacidade</button>.
                </label>
              </div>

              <button type="submit" disabled={loading} className="w-full py-4 bg-green-600 hover:bg-green-500 font-bold rounded-xl shadow-lg transition-all disabled:opacity-50">{loading ? "Processando..." : "Criar Conta Agora"}</button>
            </form>
          )}
        </div>

        <div className="mt-6 text-center">
          <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-blue-400 text-sm font-bold">{mode === 'login' ? 'Criar nova conta' : 'Já tenho conta'}</button>
        </div>
      </div>

      <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} title="Termos de Uso">
        <TermsContent />
      </TermsModal>

      <TermsModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} title="Política de Privacidade">
        <PrivacyContent />
      </TermsModal>
    </div>
  );
};


export default Login;
