const axios = require('axios');
const BASE_URL = 'https://api.nowbanks.com.br/v1';

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ erro: 'Método não permitido' }) };
    }

    try {
        const bodyData = event.body ? JSON.parse(event.body) : {};
        const identificador = bodyData.identificador || bodyData.name || "Cliente Teste";
        const valor = bodyData.valor || 1000.00;

        const clientId = process.env.NOWBANKS_CLIENT_ID ? process.env.NOWBANKS_CLIENT_ID.trim() : '';
        const clientSecret = process.env.NOWBANKS_CLIENT_SECRET ? process.env.NOWBANKS_CLIENT_SECRET.trim() : '';

        // Autenticação
        const authResponse = await axios.post(`${BASE_URL}/auth/login`, {
            client_id: clientId,
            client_secret: clientSecret
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        const accessToken = authResponse.data.access_token;

        // Depósito / Pix
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
};
