const axios = require('axios');
require('dotenv').config();

let accessToken = null;
let lastAuthTime = null;
const BASE_URL = 'https://hortopedico.sz.chat/api/v4';

async function login() {
    try {
        console.log('🔐 Fazendo login na API Fortics...');

        const { data } = await axios.post(`${BASE_URL}/auth/login`, {
            email: process.env.FORTICS_AGENT,
            password: process.env.FORTICS_PASSWORD,
            device_token: process.env.FORTICS_DEVICE || undefined
        });

        console.log("🟦 LOGIN RESPONSE DATA:", data);
        console.log("🟦 TOKEN RECEBIDO:", data.token);
        console.log("🟦 TOKEN LENGTH:", data.token?.length);

        accessToken = data.token;
        lastAuthTime = Date.now();

        console.log('✅ Login realizado com sucesso!');
        console.log('👤 Usuário:', data.user.name);
        console.log('📧 Email:', data.user.email);

        return accessToken;
    } catch (err) {
        console.error('❌ Erro no login:', err.response?.data || err.message);
        throw err;
    }
}

async function refresh() {
    try {
        console.log('🔄 Tentando refresh do token...');

        const { data } = await axios.get(`${BASE_URL}/auth/refresh`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        console.log("🟨 REFRESH RESPONSE DATA:", data);
        console.log("🟨 NOVO TOKEN:", data.token);
        console.log("🟨 TOKEN LENGTH:", data.token?.length);


        accessToken = data.token;
        lastAuthTime = Date.now();

        console.log('✅ Token atualizado com sucesso!');
        return accessToken;
    } catch (err) {
        console.warn('⚠️ Refresh falhou, refazendo login...');
        console.error('Erro:', err.response?.data || err.message);
        return await login();
    }
}

async function getForticsToken() {
    const SETE_HORAS = 1000 * 60 * 60 * 7;

    if (!accessToken) {
        console.log('⚡ Primeiro acesso, fazendo login...');
        return await login();
    }

    if (Date.now() - lastAuthTime > SETE_HORAS) {
        console.log('⏰ Token próximo de expirar, renovando...');
        return await refresh();
    }

    return accessToken;
}

async function validateToken() {
    try {
        const token = await getForticsToken();
        const { data } = await axios.get(`${BASE_URL}/auth/me`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        console.log('✅ Token válido para:', data.name);
        console.log('dados', data);
        return true;
    } catch (err) {
        console.error('❌ Token inválido:', err.response?.data || err.message);
        return false;
    }
}

module.exports = {
    getForticsToken,
    refresh,
    login,
    validateToken
};