
const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

const app = express();
const PORT = 3001;

// Configuração de CORS permissiva para o Proxy
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const VERCEL_API_URL = 'https://asaas-api-segura.vercel.app/api';
const N8N_WEBHOOK_URL = 'https://webhook.delucatech.site/webhook/fluentai-pagto';

/**
 * Proxy para pagamento pontual (Asaas)
 */
app.post('/api/processar-pagamento', async (req, res) => {
  try {
    console.log('[Proxy] Processando pagamento pontual...');
    const response = await fetch(`${VERCEL_API_URL}/processar-pagamento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('[Proxy Error] Asaas:', error.message);
    res.status(500).json({ error: 'Erro interno no proxy Asaas' });
  }
});

/**
 * Proxy para Assinatura (n8n)
 */
app.post('/api/subscribe', async (req, res) => {
  try {
    console.log('[Proxy] Encaminhando assinatura para n8n...');
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    // Se o n8n não retornar JSON válido, o .json() vai falhar. 
    // Tentamos parsear, senão retornamos o texto bruto.
    const text = await response.text();
    try {
        const data = JSON.parse(text);
        res.status(response.status).json(data);
    } catch (e) {
        res.status(response.status).send(text);
    }
  } catch (error) {
    console.error('[Proxy Error] n8n:', error.message);
    res.status(500).json({ 
      error: 'Erro interno no proxy n8n',
      message: error.message 
    });
  }
});

/**
 * Proxy para Status
 */
app.get('/api/checar-status', async (req, res) => {
  try {
    const { id } = req.query;
    const response = await fetch(`${VERCEL_API_URL}/checar-status?id=${id}`);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao checar status' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 PROXY PRATIQUEPRO RODANDO`);
  console.log(`------------------------------------------------`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Network: http://127.0.0.1:${PORT}`);
  console.log(`URL n8n configurada: ${N8N_WEBHOOK_URL}`);
  console.log(`------------------------------------------------\n`);
});
