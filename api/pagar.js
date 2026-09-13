const axios = require('axios');

module.exports = async (req, res) => {
    // Configura os cabeçalhos para aceitar requisições do frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ sucesso: false, erro: "Método não permitido" });
    }

    const clientId = process.env.NOWBANKS_CLIENT_ID ? process.env.NOWBANKS_CLIENT_ID.trim() : '';
    const clientSecret = process.env.NOWBANKS_CLIENT_SECRET ? process.env.NOWBANKS_CLIENT_SECRET.trim() : '';

    if (!clientId || !clientSecret) {
        return res.status(500).json({ sucesso: false, erro: "Credenciais da NowBanks não configuradas nas variáveis de ambiente da Vercel." });
    }

    try {
        const { valor, identificador } = req.body;

        if (!valor || !identificador) {
            return res.status(400).json({ sucesso: false, erro: 'Identificador e valor são obrigatórios.' });
        }

        console.log(`[NOWBANKS] Autenticando em /v1/auth/login para o usuário: ${identificador}...`);

        // 1. PASSO DE AUTENTICAÇÃO (Utilizando Axios compatível com Vercel Serverless)
        const authResponse = await axios.post('https://api.nowbanks.com.br/v1/auth/login', {
            client_id: clientId,
            client_secret: clientSecret
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        const authData = authResponse.data;

        if (!authResponse.status === 200 || !authData.access_token) {
            console.error("[NOWBANKS AUTH ERROR]", authData);
            return res.status(400).json({ sucesso: false, erro: authData.detail || 'Falha na autenticação com a NowBanks.' });
        }

        const accessToken = authData.access_token;
        console.log("[NOWBANKS] Token obtido com sucesso! Gerando Pix...");

        // 2. PASSO DE DEPÓSITO
        const depositResponse = await axios.post('https://api.nowbanks.com.br/v1/payments/deposit', {
            amount: parseFloat(valor),
            external_id: `pedido-${identificador}-${Date.now()}`,
            payer: {
                name: identificador,
                document: "00000000000"
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

        return res.status(200).json({
            sucesso: true,
            copia_e_cola: depositData.pix_copy_paste,
            qrcode_imagem: depositData.pix_qr_code || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${depositData.pix_copy_paste}`
        });

    } catch (error) {
        console.error("[ERRO CRITICO DEPOSITO]:", error.response?.data || error.message);
        return res.status(500).json({ 
            sucesso: false, 
            erro: error.response?.data?.message || 'Falha de comunicação com o gateway de pagamento.' 
        });
    }
};
