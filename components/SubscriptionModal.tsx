
import React, { useState } from 'react';
import { User } from '../types';
import { generateSubscriptionCheckout } from '../services/asaas';
import { logPayment, updateUserStats, getPaymentStatusFromDB, getUserProfile } from '../services/supabase';

interface SubscriptionModalProps {
  user: User;
  onClose: () => void;
  onSuccess: (updatedUser: User) => void;
  onPartialUpdate?: (updates: Partial<User>) => void;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ user, onClose, onSuccess, onPartialUpdate }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [cpf, setCpf] = useState(user.cpf || '');
  const [error, setError] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const SUBSCRIPTION_PRICE = 49.90;
  const SUBSCRIPTION_MINUTES = 300; // 5 horas = 300 minutos

  const handleSubscribe = async () => {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setError("CPF inválido.");
      return;
    }

    if (!user.email) {
      setError("E-mail não identificado.");
      return;
    }

    setError(null);
    setStep(2);

    try {
      const checkoutData = await generateSubscriptionCheckout({
        name: `${user.name} ${user.surname}`,
        email: user.email,
        cpf: cleanCpf,
        value: SUBSCRIPTION_PRICE,
        customerIdAsaas: user.customerIdAsaas
      });

      const pid = checkoutData.paymentid;
      const url = checkoutData.invoiceUrl;
      const subscriptionId = checkoutData.subscription;
      const custumerIdAsaas = checkoutData.custumer_id_asaas;

      if (!pid || !url) {
        throw new Error("O servidor não retornou um link de pagamento válido.");
      }

      setPaymentId(pid);
      setInvoiceUrl(url);

      if (user.id) {
        const statsUpdate: Partial<User> = {
          subscription: subscriptionId || 'PENDING',
          subscriptionStatus: 'PENDING',
          customerIdAsaas: custumerIdAsaas,
          cpf: cleanCpf
        };
        await updateUserStats(user.id, statsUpdate);
        if (onPartialUpdate) onPartialUpdate(statsUpdate);
        await logPayment(user.id, pid, SUBSCRIPTION_PRICE, SUBSCRIPTION_MINUTES, true, url, 'SUBSCRIPTION');
      }

      window.open(url, '_blank');
      setStep(3); // Mudar para tela de verificação após abrir o link

    } catch (err: any) {
      setError(err.message || "Erro ao processar assinatura.");
      setStep(1);
    }
  };

  const handleCheckPayment = async () => {
    if (!paymentId || !user.id) return;
    setIsChecking(true);
    setError(null);

    try {
      const currentStatus = await getPaymentStatusFromDB(paymentId);

      if (currentStatus === 'RECEIVED' || currentStatus === 'CONFIRMED' || currentStatus === 'PAID') {
        // Atualizar o perfil com os 1800 minutos e status ACTIVE
        await updateUserStats(user.id, {
          subscriptionStatus: 'ACTIVE',
          creditsRemaining: SUBSCRIPTION_MINUTES,
          creditsTotal: SUBSCRIPTION_MINUTES
        });

        const updatedProfile = await getUserProfile(user.id);
        if (updatedProfile) {
          onSuccess(updatedProfile);
        } else {
          onClose();
          window.location.reload();
        }
      } else if (currentStatus === 'PENDING') {
        setError("O seu pagamento ainda não foi processado pela operadora do cartão. Por favor, aguarde alguns instantes.");
      } else {
        setError("Pagamento ainda não compensado ou recusado. Verifique o link de pagamento.");
      }
    } catch (err: any) {
      setError("Erro ao verificar status no servidor.");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="bg-gray-800 rounded-3xl w-full max-w-md border border-gray-700 shadow-2xl overflow-hidden relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white p-2 z-10">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        <div className="p-8">
          {step === 1 && (
            <div className="space-y-6 text-center">
              <h2 className="text-2xl font-bold text-white">Plano Mensal PratiquePRO</h2>
              <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-700">
                <p className="text-4xl font-black text-blue-400">R$ 49,90</p>
                <p className="text-sm text-gray-400 mt-2">300 minutos de Conversação</p>
              </div>

              <div className="text-left space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">CPF</label>
                <input
                  type="text" placeholder="000.000.000-00"
                  value={cpf} onChange={(e) => setCpf(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              {error && <p className="text-red-400 text-sm bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</p>}

              <button onClick={handleSubscribe} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95">
                Assinar e Ir para Pagamento
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="py-12 flex flex-col items-center justify-center space-y-6 text-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <div>
                <p className="text-xl font-bold text-white">Abrindo Link de Pagamento...</p>
                <p className="text-gray-400 text-sm px-4">Uma nova aba deve abrir em instantes.</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 text-center animate-fade-in">
              <div className="bg-blue-500/10 p-6 rounded-2xl border border-blue-500/20">
                <h3 className="text-xl font-bold text-white mb-2">Aguardando Pagamento</h3>
                <p className="text-sm text-gray-400">Clique no botão abaixo após concluir o pagamento no site do Asaas para liberar seu acesso.</p>
              </div>

              {invoiceUrl && (
                <a href={invoiceUrl} target="_blank" className="block text-blue-400 text-sm font-bold hover:underline mb-4">
                  Abrir link de pagamento novamente
                </a>
              )}

              {error && <p className="text-red-400 text-sm bg-red-500/10 p-3 rounded-xl border border-red-500/20 text-center">{error}</p>}

              <button
                onClick={handleCheckPayment}
                disabled={isChecking}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-3 shadow-lg transition-all active:scale-95"
              >
                {isChecking && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                {isChecking ? 'Verificando...' : 'Já paguei! Liberar Acesso'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionModal;
