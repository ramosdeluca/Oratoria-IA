
import React, { useState } from 'react';
import { User } from '../types';
import { generatePixCheckout, CheckoutResponse } from '../services/asaas';
import { logPayment, getPaymentRecord, getUserProfile, updateUserStats, markPaymentAsProcessed } from '../services/supabase';

interface PaymentModalProps {
  user: User;
  onClose: () => void;
  onSuccess: (updatedUser: User) => void;
  onPartialUpdate?: (updates: Partial<User>) => void;
}

const RATE_PER_MINUTE = 0.30;

const PaymentModal: React.FC<PaymentModalProps> = ({ user, onClose, onSuccess, onPartialUpdate }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [amountBRL, setAmountBRL] = useState(5);
  const [cpf, setCpf] = useState(user.cpf || '');
  const [qrCodeData, setQrCodeData] = useState<CheckoutResponse | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const minutesToBuy = Math.floor(amountBRL / RATE_PER_MINUTE);

  const handleGeneratePix = async () => {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setError("CPF inválido. Digite exatamente os 11 números.");
      return;
    }

    if (!user.email) {
      setError("E-mail de cadastro não identificado.");
      return;
    }

    setError(null);
    setStep(2);

    try {
      const checkoutData = await generatePixCheckout({
        name: `${user.name} ${user.surname}`,
        email: user.email,
        cpf: cleanCpf,
        value: amountBRL,
        customerIdAsaas: user.customerIdAsaas
      });

      if (!checkoutData.payload && !checkoutData.encodedImage) {
        throw new Error("A API não enviou os dados do PIX.");
      }

      setPaymentId(checkoutData.id);
      setQrCodeData(checkoutData);

      if (user.id && checkoutData.customerIdAsaas) {
        await updateUserStats(user.id, { customerIdAsaas: checkoutData.customerIdAsaas, cpf: cleanCpf });
        if (onPartialUpdate) {
          onPartialUpdate({ customerIdAsaas: checkoutData.customerIdAsaas, cpf: cleanCpf });
        }
      }

      if (user.id) {
        await logPayment(user.id, checkoutData.id, amountBRL, minutesToBuy, false, undefined, 'ONE_TIME');
      }

      setStep(3);
    } catch (err: any) {
      console.error('[PaymentModal] Erro ao gerar checkout:', err);
      setError(err.message || "Erro ao processar pagamento.");
      setStep(1);
    }
  };

  const handleCheckPayment = async () => {
    if (!paymentId || !user.id) return;
    setIsChecking(true);
    setError(null);

    try {
      // Busca o registro completo do pagamento no DB
      const paymentRecord = await getPaymentRecord(paymentId);
      const isConfirmed = paymentRecord && ['RECEIVED', 'CONFIRMED', 'PAID', 'RECEIVED_IN_CASH'].includes(String(paymentRecord.status).toUpperCase());

      if (isConfirmed) {
        // Se o pagamento ainda não foi processado pelo app (evita duplicidade de processamento no front)
        if (!paymentRecord.processed) {
          // NOTA: A soma dos créditos agora é realizada exclusivamente via TRIGGER no banco de dados.
          // O front-end não deve mais calcular 'newCredits' ou chamar 'updateUserStats' para créditos.
          await markPaymentAsProcessed(paymentId);
        }

        // Busca o perfil final atualizado para retornar ao App e exibir na UI.
        // O trigger já terá atualizado os créditos antes de buscarmos o perfil.
        const finalProfile = await getUserProfile(user.id);
        if (finalProfile) {
          onSuccess(finalProfile);
        } else {
          onClose();
          window.location.reload();
        }
      } else {
        setError("Pagamento ainda não compensado. Aguarde um instante e tente novamente.");
      }
    } catch (err: any) {
      console.error('[PaymentModal] Erro ao verificar pagamento:', err);
      setError("Erro ao verificar status no servidor.");
    } finally {
      setIsChecking(false);
    }
  };

  const copyToClipboard = () => {
    if (qrCodeData?.payload) {
      navigator.clipboard.writeText(qrCodeData.payload);
      alert("Código PIX copiado!");
    }
  };

  const getQrCodeSrc = (data: string) => {
    if (!data) return '';
    return data.startsWith('data:') ? data : `data:image/png;base64,${data}`;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="bg-gray-800 rounded-3xl w-full max-w-md border border-gray-700 shadow-2xl overflow-hidden relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white p-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        <div className="p-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Recarregar Créditos</h2>

          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-700 text-center">
                <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-1">Valor da Recarga</p>
                <span className="text-4xl font-black text-green-400">R$ {amountBRL.toFixed(2)}</span>
                <p className="text-blue-300 text-sm mt-2">Equivale a ~{minutesToBuy} minutos</p>
              </div>

              <input
                type="range" min="5" max="500" step="5" value={amountBRL}
                onChange={(e) => setAmountBRL(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">CPF do Titular</label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {error && <p className="text-red-400 text-sm text-center bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</p>}

              <button
                onClick={handleGeneratePix}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95"
              >
                Gerar PIX
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-300">Gerando cobrança PIX...</p>
            </div>
          )}

          {step === 3 && qrCodeData && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white p-4 rounded-2xl mx-auto w-fit shadow-2xl">
                {qrCodeData.encodedImage ? (
                  <img
                    src={getQrCodeSrc(qrCodeData.encodedImage)}
                    alt="QR Code PIX"
                    className="w-48 h-48 mx-auto"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-gray-400 text-center text-xs bg-gray-100 rounded-lg p-4">
                    QR Code Visual não disponível.<br />Utilize o botão "Copiar Código".
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[10px] text-gray-400 font-bold uppercase text-center tracking-widest">Pix Copia e Cola</p>
                <div className="flex gap-2">
                  <input readOnly value={qrCodeData.payload} className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-[10px] text-gray-500 truncate" />
                  <button onClick={copyToClipboard} className="bg-blue-600 px-4 py-2 rounded-xl text-xs font-bold text-white whitespace-nowrap">Copiar Código</button>
                </div>
              </div>

              {error && <p className="text-red-400 text-sm bg-red-500/10 p-3 rounded-xl border border-red-500/20 text-center">{error}</p>}

              <button
                onClick={handleCheckPayment}
                disabled={isChecking}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-3 shadow-lg"
              >
                {isChecking && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                {isChecking ? 'Sincronizando...' : 'Já paguei! Liberar Créditos'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;