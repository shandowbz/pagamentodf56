const axios = require('axios');

const BASE_URL = 'https://api.nowbanks.com.br/v1';

exports.handler = async function(event, context) {
    const path = event.path || '';
    const pathParts = path.split('/');
    const transactionId = pathParts[pathParts.length - 1];

    // Rota para Gerar o Pix (POST)
    if (event.httpMethod === 'POST' && (path.endsWith('gerar-pix') || path === '/pagar' || path.endsWith('/pagar'))) {
        try {
            const bodyData = event.body ? JSON.parse(event.body) : {};
            const identificador = bodyData.identificador || bodyData.name || "Cliente Teste";
            const valor = bodyData.valor || 1000.00;

            const clientId = process.env.NOWBANKS_CLIENT_ID ? process.env.NOWBANKS_CLIENT_ID.trim() : '';
            const clientSecret = process.env.NOWBANKS_CLIENT_SECRET ? process.env.NOWBANKS_CLIENT_SECRET.trim() : '';

            console.log(`[NOWBANKS] Autenticando para o usuário: ${identificador}...`);

            const authResponse = await axios.post(`${BASE_URL}/auth/login`, {
                client_id: clientId,
                client_secret: clientSecret
            }, {
                headers: { 'Content-Type': 'application/json' }
            });

            const authData = authResponse.data;

            if (authResponse.status !== 200 || !authData.access_token) {
                console.error("[NOWBANKS AUTH ERROR]", authData);
                return {
                    statusCode: 400,
                    body: JSON.stringify({ sucesso: false, erro: authData.detail || 'Falha na autenticação com a NowBanks.' })
                };
            }

            const accessToken = authData.access_token;
            console.log("[NOWBANKS] Token obtido com sucesso! Gerando Pix...");

            const depositResponse = await axios.post(`${BASE_URL}/payments/deposit`, {
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

            const depositData = depositResponse.data;

            console.log("[NOWBANKS SUCESSO] Pix gerado!");

            return {
                statusCode: 200,
                body: JSON.stringify({
                    sucesso: true,
                    transaction_id: depositData.transaction_id || depositData.id || depositData.external_id,
                    copia_e_cola: depositData.pix_copy_paste,
                    qrcode_imagem: depositData.pix_qr_code || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${depositData.pix_copy_paste}`
                })
            };
        } catch (error) {
            console.error('Erro NowBanks:', error.response?.data || error.message);
            return {
                statusCode: 500,
                body: JSON.stringify({ 
                    sucesso: false, 
                    erro: 'Falha de comunicação com o gateway de pagamento.', 
                    details: error.response?.data || error.message 
                })
            };
        }
    }

    // Rota para Consultar o Status da Transação (GET) adaptada às normas da NowBanks
    if (event.httpMethod === 'GET' && (path.includes('status-transacao') || transactionId.startsWith('txn_'))) {
        if (!transactionId || transactionId === 'status-transacao' || transactionId === 'pagar') {
            return { statusCode: 400, body: JSON.stringify({ error: 'ID da transação não informado' }) };
        }

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

            const txData = response.data;

            return {
                statusCode: 200,
                body: JSON.stringify({
                    transaction_id: txData.transaction_id,
                    external_id: txData.external_id,
                    type: txData.type,
                    status: txData.status, // Ex: WAITING_PAYMENT, PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED, REJECTED, RETIDO
                    amount: txData.amount,
                    fee: txData.fee,
                    net_amount: txData.net_amount,
                    payment_method: txData.payment_method,
                    created_at: txData.created_at,
                    updated_at: txData.updated_at,
                    end_to_end_id: txData.end_to_end_id,
                    payer_name: txData.payer_name,
                    payer_document: txData.payer_document,
                    beneficiary_name: txData.beneficiary_name,
                    beneficiary_document: txData.beneficiary_document
                })
            };
        } catch (error) {
            console.error('Erro ao consultar status:', error.response?.data || error.message);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Erro ao consultar status', details: error.response?.data || error.message })
            };
        }
    }

    return { statusCode: 404, body: JSON.stringify({ erro: 'Rota não encontrada', pathRecebido: path }) };
};
