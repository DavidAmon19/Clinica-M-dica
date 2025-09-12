const fs = require('fs');
const path = require('path');
const { queryDB } = require('../utils/db');
const { sendHSM } = require('../integrations/fortics');
const { updateContactSZ, getContactByPhone } = require('../integrations/sz');
require('dotenv').config();

function logToFile(text) {
  const today = new Date().toISOString().slice(0, 10);
  const logDir = path.join(__dirname, '../logs');
  const logPath = path.join(logDir, `test_envios_${today}.log`);

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }

  const timestamp = new Date().toISOString();
  fs.appendFileSync(logPath, `[${timestamp}] ${text}\n`);
}

(async () => {
  try {
    const [r] = await queryDB(`
      SELECT
        FIRST 1
        M.MAR_CODIGO,
        M.MAR_MEDICO,
        M.MAR_DATA,
        TRIM(CAST(CAST(M.MAR_HORA AS VARCHAR(5) CHARACTER SET OCTETS) AS VARCHAR(5) CHARACTER SET WIN1252)) AS MAR_HORA,
        TRIM(CAST(CAST(M.MAR_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS MAR_NOME,
        TRIM(CAST(CAST(M.MAR_TELEFONE AS VARCHAR(20) CHARACTER SET OCTETS) AS VARCHAR(20) CHARACTER SET WIN1252)) AS MAR_CEL,
        M.MAR_CONFIRMACAO,
        M.MAR_CHEGADA,
        M.MAR_ESP,
        TRIM(CAST(CAST(DC.MED_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS MEDICO_NOME,
        TRIM(CAST(CAST(L.LOC_NOME  AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS LOCAL_NOME,
        TRIM(CAST(CAST(E.ESP_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS ESP_NOME
      FROM MARCACAO M
      LEFT JOIN MEDICO DC ON DC.MED_CODIGO = M.MAR_MEDICO
      LEFT JOIN LOCAL  L  ON L.LOC_CODIGO = M.MAR_LOCAL
      LEFT JOIN ESPECIALIDADE E ON E.ESP_CODIGO = M.MAR_ESP
      WHERE M.MAR_DATA >= CAST('TODAY' AS DATE)
        AND M.MAR_DATA <= DATEADD(3 DAY TO CAST('TODAY' AS DATE))
    `);

    if (!r) {
      console.log('Nenhum agendamento elegível encontrado.');
      logToFile('⚠️ Nenhum agendamento encontrado para teste.');
      return;
    }

    const YOUR_TEST_NUMBER = '5585992616996';
    const nomePaciente = r.mar_nome || 'Paciente';
    const medico = r.medico_nome || 'Médico';
    const unidade = r.local_nome || 'Unidade';
    const celular = (r.mar_cel || '').replace(/\D/g, '');
    const dataFormatada = r.mar_data.toISOString().split('T')[0];
    const dataBR = r.mar_data.toLocaleDateString('pt-BR');
    const hora = r.mar_hora || '';
    const local = 'Hospital Ortopédico';
    const phoneNumber = '7533219050';
    const procedimento = r.esp_nome || 'Consulta';

    const contactId = await getContactByPhone(YOUR_TEST_NUMBER);
    if (!contactId) {
      const msg = `⚠️ Contato ${YOUR_TEST_NUMBER} não encontrado na base do SZ.chat`;
      console.error(msg);
      logToFile(msg);
      return;
    }

    const saudacao = `Olá, ${nomePaciente}`;
    let hsmTemplate = '';
    let campos = {};

    if (r.mar_esp === 36) {
      hsmTemplate = process.env.FORTICS_TEMPLATE_HSM_RESSO;
      campos = {
        LOCAL: local,
        DATA: dataBR,
        HORA: hora,
        PROCEDIMENTO: procedimento,
        ENDERECO: unidade
      };
    } else if (r.mar_chegada) {
      hsmTemplate = process.env.FORTICS_TEMPLATE_HSM_ORDEM;
      campos = {
        LOCAL: local,
        DATA: dataBR,
        HORA: hora,
        MEDICO: medico,
        ENDERECO: unidade
      };
    } else {
      hsmTemplate = process.env.FORTICS_TEMPLATE_HSM_AGENDA;
      campos = {
        LOCAL: local,
        DATA: dataBR,
        HORA: hora,
        MEDICO: medico,
        ENDERECO: unidade,
        PROCEDIMENTO: procedimento
      };
    }

    await updateContactSZ(contactId, campos);
    await new Promise((res) => setTimeout(res, 300));

    const payload = {
      to: YOUR_TEST_NUMBER,
      agent_id: process.env.FORTICS_AGENT_ID,
      channel_id: process.env.FORTICS_CHANNEL_ID,
      close_session: 0,
      agent: process.env.FORTICS_AGENT,
      type: "text",
      is_hsm: 1,
      deviceToken: process.env.FORTICS_AGENT_DEVICE,
      attendance_id: process.env.FORTICS_ATTENDANCE,
      hsm_template_name: hsmTemplate
    };

    console.log('➡️ Enviando mensagem simulada para seu número...');
    console.log({ payload });
    await sendHSM(payload);

    await queryDB(`
      UPDATE MARCACAO
         SET MAR_CONFIRMACAO = CURRENT_TIMESTAMP
       WHERE MAR_CODIGO = ?
    `, [r.mar_codigo]);

    const logMsg = `✅ [TESTE] Enviado para ${nomePaciente} (${YOUR_TEST_NUMBER}) | Médico: ${medico} | Local: ${unidade} | Data: ${dataFormatada} ${hora} | Procedimento: ${procedimento}`;
    console.log(logMsg);
    logToFile(logMsg);

  } catch (e) {
    console.error('Erro ao enviar HSM mockado:', e);
    logToFile(`❌ Erro durante envio mockado: ${e.message}`);
  }
})();
