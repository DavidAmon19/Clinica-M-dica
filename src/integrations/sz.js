const axios = require('axios');
const { getForticsToken } = require('./forticsAuth');

async function getContactByPhone(phone) {
    if (!phone) {
        console.warn("⚠️ getContactByPhone chamado com número vazio!");
        return null;
    }

    const token = await getForticsToken();

    try {
        const response = await axios({
            method: 'get',
            url: `${process.env.FORTICS_BASE_URL}/api/v4/contacts/search`,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: {
                platform_id: phone
            }
        });

        const contact = response.data?.data?.[0];
        if (!contact) {
            console.warn(`⚠️ Nenhum contato encontrado para ${phone}`);
            return null;
        }

        return contact._id;
    } catch (error) {
        console.error("🚫 Erro ao buscar contato por telefone:");
        console.dir(error.response?.data || error.message, { depth: null });
        return null;
    }
}



async function updateContactSZ(contactId, data) {
    try {
        let token = await getForticsToken();
        const response = await axios({
            method: 'put',
            url: `${process.env.FORTICS_BASE_URL}/api/v4/contacts/update_fields/${contactId}`,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json; charset=utf-8'
            },
            data: data
        });
        return response.data;
    } catch (error) {
        console.error("🚫 Erro ao atualizar contato:");
        console.dir(error.response?.data || error.message, { depth: null });

        if (error.response?.status === 422) {
            console.error("🚫 Erro 422 - Dados inválidos ao atualizar contato:");
            console.dir({
                enviado: data,
                recebido: error.response.data
            }, { depth: null });
        }


        throw error;
    }
}


module.exports = { updateContactSZ, getContactByPhone };
