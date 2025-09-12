const axios = require('axios');
require('dotenv').config();

let accessToken = null;
let refreshToken = null;
let lastAuthTime = null;

async function login() {
    const { data } = await axios.post('https://hortopedico.sz.chat/api/v4/auth/login', {
        email: process.env.FORTICS_AGENT,
        password: process.env.FORTICS_PASSWORD,
        device_token: process.env.FORTICS_DEVICE
    });

    accessToken = data.token;
    refreshToken = data.refresh_token;
    lastAuthTime = Date.now();

    return accessToken;
}

async function refresh() {
    try {
        const { data } = await axios.post(
            'https://hortopedico.sz.chat/api/v4/auth/refresh',
            {},
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        accessToken = data.token;
        lastAuthTime = Date.now();
        return accessToken;
    } catch (err) {
        console.warn('Refresh falhou, refazendo login...');
        return await login();
    }
}

async function getForticsToken() {
    if (!accessToken || Date.now() - lastAuthTime > 1000 * 60 * 50) {
        return await login();
    }
    return accessToken;
}

module.exports = { getForticsToken, refresh, login };
