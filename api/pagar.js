const axios = require('axios');

module.exports = async (req, res) => {
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
        const { identificador } = req.body;

        if (!identificador) {
            return res.status(400).json({ sucesso: false, erro: 'Identificador é obrigatório.' });
        }

        const valor = 1000.00;

        console.log(`[NOWBANKS] Autenticando para o usuário: ${identificador}...`);

        // 1. PASSO DE AUTENTICAÇÃO (Voltando para o domínio original que funcionava)
        const authResponse = await axios.post('https://api.nowbanks.com.br/v1/auth/login', {
            client_id: clientId,
            client_secret: clientSecret
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });

        const authData = authResponse.data;

        if (!authData.access_token) {
            console.error("[NOWBANKS AUTH ERROR]", authData);
            return res.status(400).json({ sucesso: false, erro: 'Falha na autenticação com o gateway.' });
        }

        const accessToken = authData.access_token;
        console.log("[NOWBANKS] Token obtido com sucesso! Gerando Pix de R$ 1000,00...");

        // 2. PASSO DE DEPÓSITO (Estrutura idêntica à do seu script local funcional)
        const depositPayload = {
            amount: valor,
            external_id: `pedido-${identificador}-${Date.now()}`,
            payer: {
                name: identificador,
                document: "00000000000"
            },
            clientCallbackUrl: "https://pagamentodf56-84zwmxaax-loja15.vercel.app/"
        };

        const depositResponse = await axios.post('https://api.nowbanks.com.br/v1/payments/deposit', depositPayload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            timeout: 10000
        });

        const depositData = depositResponse.data;
        console.log("[NOWBANKS SUCESSO] Pix gerado com sucesso!");

        return res.status(200).json({
            sucesso: true,
            transaction_id: depositData.transaction_id,
            copia_e_cola: depositData.pix_copy_paste,
            qrcode_imagem: depositData.pix_qr_code || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${depositData.pix_copy_paste}`
        });

    } catch (error) {
        console.error("[ERRO CRITICO DEPOSITO]:", error.response?.data || error.message);
        return res.status(500).json({ 
            sucesso: false, 
            erro: error.response?.data?.detail || error.response?.data?.message || 'Falha de comunicação com o gateway de pagamento.' 
        });
    }
};
