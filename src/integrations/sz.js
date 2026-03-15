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

async function createContact(contactData) {
    try {
        const token = await getForticsToken();

        const response = await axios({
            method: 'post',
            url: `${process.env.FORTICS_BASE_URL}/api/v4/contacts`,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: contactData
        });

        console.log(`[DEBUG] Resposta completa da criação de contato:`, JSON.stringify(response.data, null, 2));

        let contactId = null;

        if (response.data && response.data.data && response.data.data._id) {
            contactId = response.data.data._id;
        } else if (response.data && response.data._id) {
            contactId = response.data._id;
        } else if (response.data && response.data.id) {
            contactId = response.data.id;
        } else if (response.data && response.data.contact && response.data.contact._id) {
            contactId = response.data.contact._id;
        }

        if (!contactId) {
            console.error(`❌ Não foi possível extrair ID do contato criado. Estrutura da resposta:`);
            console.dir(response.data, { depth: null });
            throw new Error('ID do contato não encontrado na resposta da API');
        }

        console.log(`✅ Contato criado com sucesso: ${contactData.name} (${contactData.Whatsapp}) - ID: ${contactId}`);
        return contactId;

    } catch (error) {
        console.error("🚫 Erro ao criar contato:");

        if (error.response?.status === 422) {
            console.error("Erro 422 - Dados inválidos:");
            console.dir(error.response.data, { depth: null });
        } else {
            console.dir(error.response?.data || error.message, { depth: null });
        }

        throw error;
    }
}

async function getOrCreateContact(phone, patientName) {

    let contactId = await getContactByPhone(phone);

    if (contactId) {
        console.log(`📱 Contato encontrado: ${contactId} para ${phone}`);
        return contactId;
    }


    console.log(`📝 Contato não encontrado. Criando novo contato para: ${patientName} (${phone})`);

    const newContactData = {
        name: patientName || 'Paciente',
        Whatsapp: phone,
        number: phone.replace('55', ''),
        ddi: 55,
        default_language: 'pt-BR',
        opt_in: '1'
    };

    try {
        console.log(`📝 Tentando criar contato com os dados:`);
        console.log(JSON.stringify(newContactData, null, 2));

        contactId = await createContact(newContactData);
        console.log(`✅ Novo contato criado com ID: ${contactId}`);
        return contactId;
    } catch (error) {
        console.error(`❌ Falha ao criar contato para ${phone}`);
        console.error('Dados enviados:', JSON.stringify(newContactData, null, 2));
        console.error('Status:', error.response?.status);
        console.error('Resposta da API:', JSON.stringify(error.response?.data, null, 2));
        console.error('Mensagem:', error.message);
        throw error;
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

module.exports = { updateContactSZ, getContactByPhone, createContact, getOrCreateContact };