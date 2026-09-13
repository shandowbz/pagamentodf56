const axios = require('axios');
require('dotenv').config();

const CLIENT_SECRET = process.env.NOWBANKS_CLIENT_SECRET || 'sec_8315a4cb31571ad2e79a00551ab4b7a733374e5b6a2c279b';
const BASE_URL = 'https://api.nowbanks.com.br/v1';

exports.handler = async function(event, context) {
    const path = event.path;
    
    // Rota para Gerar o Pix (POST /api/gerar-pix)
    if (event.httpMethod === 'POST' && path.includes('gerar-pix')) {
        try {
            const bodyData = event.body ? JSON.parse(event.body) : {};
            const identificador = bodyData.identificador || bodyData.name || "Cliente Teste";
            const valor = bodyData.valor || 1000.00;

            const clientId = process.env.NOWBANKS_CLIENT_ID ? process.env.NOWBANKS_CLIENT_ID.trim() : '';
            const clientSecret = process.env.NOWBANKS_CLIENT_SECRET ? process.env.NOWBANKS_CLIENT_SECRET.trim() : '';

            // 1. PASSO DE AUTENTICAÇÃO
            const authResponse = await axios.post(`${BASE_URL}/auth/login`, {
                client_id: clientId,
                client_secret: clientSecret
            });

            const authData = authResponse.data;

            if (!authResponse.status === 200 || !authData.access_token) {
                console.error("[NOWBANKS AUTH ERROR]", authData);
                return {
                    statusCode: 400,
                    body: JSON.stringify({ sucesso: false, erro: authData.detail || 'Falha na autenticação com a NowBanks.' })
                };
            }

            const accessToken = authData.access_token;

            // 2. PASSO DE DEPÓSITO
            const response = await axios.post(`${BASE_URL}/payments/deposit`, {
                amount: parseFloat(valor),
                external_id: `pedido-${identificador}-${Date.now()}`,
                payer: { 
                    name: identificador, 
                    document: bodyData.document || "00000000000" 
                },
                clientCallbackUrl: "https://seuseite.com/webhook"
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            const depositData = response.data;

            return {
                statusCode: 200,
                body: JSON.stringify({
                    sucesso: true,
                    copia_e_cola: depositData.pix_copy_paste,
                    qrcode_imagem: depositData.pix_qr_code || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${depositData.pix_copy_paste}`
                })
            };
        } catch (error) {
            console.error('Erro NowBanks:', error.response?.data || error.message);
            return {
                statusCode: 500,
                body: JSON.stringify({ sucesso: false, erro: 'Falha de comunicação com o gateway de pagamento.', details: error.response?.data || error.message })
            };
        }
    }

    // Rota para Consultar o Status da Transação (GET /api/status-transacao/txn_xxx)
    if (event.httpMethod === 'GET' && path.includes('status-transacao')) {
        const transactionId = path.split('/').pop();
        try {
            const clientId = process.env.NOWBANKS_CLIENT_ID ? process.env.NOWBANKS_CLIENT_ID.trim() : '';
            const clientSecret = process.env.NOWBANKS_CLIENT_SECRET ? process.env.NOWBANKS_CLIENT_SECRET.trim() : '';

            const authResponse = await axios.post(`${BASE_URL}/auth/login`, {
                client_id: clientId,
                client_secret: clientSecret
            });

            const accessToken = authResponse.data.access_token;

            const response = await axios.get(`${BASE_URL}/transactions/${transactionId}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            return {
                statusCode: 200,
                body: JSON.stringify({
                    status: response.data.status,
                    transaction_id: response.data.transaction_id
                })
            };
        } catch (error) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Erro ao consultar status' })
            };
        }
    }

    return { statusCode: 404, body: 'Rota não encontrada' };
};