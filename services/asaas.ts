
// Service to handle Asaas and Subscription API interactions

const getProxyBaseUrl = () => {
  const { hostname, protocol } = window.location;
  // Detecção robusta de ambiente local
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  
  if (isLocal) {
    // Protocolo dinâmico para evitar erros de Mixed Content
    return `${protocol}//${hostname}:3001/api`;
  }
  
  // URL da API de produção (Proxy Seguro)
  return 'https://asaas-api-segura.vercel.app/api';
};

const API_BASE_URL = getProxyBaseUrl();

/** 
 * URL direta do webhook conforme solicitado pelo usuário.
 * Isso ignora o proxy local para esta chamada específica, evitando 'Failed to fetch' 
 * caso o servidor proxy local não esteja rodando ou seja inacessível.
 */
const SUBSCRIPTION_WEBHOOK_URL = 'https://webhook.delucatech.site/webhook/fluentai-pagto';

export interface CheckoutResponse {
  id: string;
  encodedImage: string;
  payload: string;
  expirationDate: string;
  customerIdAsaas?: string;
  paymentid?: string;
  subscription?: string;
  invoiceUrl?: string;
  body?: any;
  custumer_id_asaas?: string;
}

const fetchAPI = async (targetUrl: string, options: RequestInit) => {
  try {
    const response = await fetch(targetUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers || {})
      },
      mode: 'cors'
    });

    const contentType = response.headers.get("content-type");
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ${response.status}: ${errorText || 'Erro no servidor'}`);
    }

    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    } else {
      const textData = await response.text();
      try {
        return JSON.parse(textData);
      } catch (e) {
        return { success: true, message: textData };
      }
    }
  } catch (error: any) {
    if (error.message === 'Failed to fetch') {
      console.error('[API Service] Falha de conexão ao acessar:', targetUrl);
      throw new Error(`Não foi possível conectar ao servidor (${targetUrl}). Verifique sua conexão ou se o serviço de pagamentos está online.`);
    }
    console.error('[API Service] Erro:', error.message);
    throw error;
  }
};

export const generatePixCheckout = async (userData: { 
  name: string; 
  email: string; 
  cpf: string; 
  value: number; 
  customerIdAsaas?: string;
}): Promise<CheckoutResponse> => {
  const payload = {
    nomeCliente: userData.name,
    cpfCnpj: userData.cpf,
    emailCliente: userData.email,
    valorCreditos: userData.value,
    descricao: "Recarga de Minutos - PratiquePRO",
    customer_id_asaas: userData.customerIdAsaas || ''
  };

  const rawData = await fetchAPI(`${API_BASE_URL}/processar-pagamento`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  return mapAsaasResponse(rawData);
};

export const generateSubscriptionCheckout = async (userData: { 
  name: string; 
  email: string; 
  cpf: string; 
  value: number; 
  customerIdAsaas?: string;
}): Promise<CheckoutResponse> => {
  const payload = {
    nome: userData.name,
    email: userData.email,
    cpf: userData.cpf,
    custumer_id_asaas: userData.customerIdAsaas || ''
  };

  /**
   * Chamada direta para o webhook solicitado. 
   * Se houver erros de CORS, o webhook precisará permitir a origem do site.
   */
  const rawData = await fetchAPI(SUBSCRIPTION_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  return mapAsaasResponse(rawData);
};

export const cancelSubscription = async (userData: {
  nome: string;
  email: string;
  cpf: string;
  custumer_id_asaas: string;
  subscription: string;
}): Promise<boolean> => {
  const CANCEL_WEBHOOK_URL = 'https://webhook.delucatech.site/webhook/fluentai-cancelamento';
  try {
    // IMPORTANTE: Removido 'mode: no-cors' e usando fetchAPI para garantir que o Content-Type seja application/json
    // Isso faz com que os campos sejam enviados "separados" (em um objeto JSON real) para o n8n/webhook
    await fetchAPI(CANCEL_WEBHOOK_URL, {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    return true;
  } catch (err: any) {
    console.error('[Asaas Service] Erro fatal no cancelamento:', err.message);
    throw err;
  }
};

const findKeyDeep = (obj: any, targetKey: string): any => {
  if (!obj || typeof obj !== 'object') return null;
  if (obj[targetKey] !== undefined && obj[targetKey] !== null && obj[targetKey] !== "" && obj[targetKey] !== "undefined") {
    return obj[targetKey];
  }
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      if (val && typeof val === 'object') {
        const result = findKeyDeep(val, targetKey);
        if (result !== null && result !== undefined && result !== "" && result !== "undefined") {
          return result;
        }
      }
    }
  }
  return null;
};

const mapAsaasResponse = (rawData: any): CheckoutResponse => {
  const base = Array.isArray(rawData) ? rawData[0] : rawData;
  
  const paymentid = findKeyDeep(base, 'paymentid') || findKeyDeep(base, 'paymentId') || findKeyDeep(base, 'id') || '';
  const invoiceUrl = findKeyDeep(base, 'paymentUrl') || findKeyDeep(base, 'invoiceUrl') || findKeyDeep(base, 'invoiceURL') || findKeyDeep(base, 'invoice_url') || '';
  const subscriptionId = findKeyDeep(base, 'subscription') || findKeyDeep(base, 'subscriptionId') || '';
  const custumerIdAsaas = findKeyDeep(base, 'custumer_id_asaas') || findKeyDeep(base, 'customer_id_asaas') || findKeyDeep(base, 'customer') || '';
  const encodedImage = findKeyDeep(base, 'encodedImage') || findKeyDeep(base, 'qrCode') || '';
  const payload = findKeyDeep(base, 'payload') || findKeyDeep(base, 'pixCopyPaste') || '';

  return {
    id: paymentid,
    encodedImage,
    payload,
    expirationDate: findKeyDeep(base, 'expirationDate') || '',
    customerIdAsaas: custumerIdAsaas,
    paymentid: paymentid,
    subscription: subscriptionId,
    invoiceUrl: invoiceUrl,
    body: base,
    custumer_id_asaas: custumerIdAsaas
  };
};

export const checkPaymentStatus = async (paymentId: string): Promise<boolean> => {
  if (!paymentId) return false;
  try {
    const result = await fetchAPI(`${API_BASE_URL}/checar-status?id=${paymentId}`, { 
      method: 'GET' 
    });
    const status = result.status || (result.data && result.data.status);
    return ['RECEIVED', 'CONFIRMED', 'PAID', 'RECEIVED_IN_CASH'].includes(String(status).toUpperCase());
  } catch (e) {
    return false;
  }
};
