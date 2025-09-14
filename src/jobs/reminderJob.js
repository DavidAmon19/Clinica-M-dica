const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { queryDB } = require('../utils/db');
const { sendHSM } = require('../integrations/fortics');
const { updateContactSZ, getOrCreateContact } = require('../integrations/sz');

function formatPhoneNumber(raw) {
  if (!raw) return '';
  const cleaned = raw.replace(/\D/g, '');
  return `55${cleaned}`;
}

cron.schedule('58 15 * * *', async () => {
  console.log(`[PRODUÇÃO] Iniciando verificação diária de agendamentos...`);

  const today = new Date().toISOString().slice(0, 10);
  const logPath = path.join(__dirname, `../logs/envios_${today}.log`);
  const logLine = (text) => fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${text}\n`);

  try {
    const rows = await queryDB(`
       SELECT
  FIRST 1
  M.MAR_CODIGO,
  M.MAR_MEDICO,
  M.MAR_DATA,
  TRIM(CAST(CAST(M.MAR_HORA AS VARCHAR(5) CHARACTER SET OCTETS) AS VARCHAR(5) CHARACTER SET WIN1252)) AS MAR_HORA,
  TRIM(CAST(CAST(M.MAR_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS NOME_PACIENTE,
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

    console.log(`[PRODUÇÃO] Total de agendamentos encontrados: ${rows.length}`);
    logLine(`Total de agendamentos para notificar: ${rows.length}`);

    for (const r of rows) {
      // const celular = formatPhoneNumber(r.mar_cel);
      const celular = "5575982064309"
      const nomePaciente = r.nome_paciente || 'Paciente';

      try {
        const contactId = await getOrCreateContact(celular, nomePaciente);
        
        if (!contactId) {
          logLine(`❌ Não foi possível obter/criar contato: ${celular}`);
          continue;
        }

        console.log(r, 'da um olhada aqui')
        const unidade = r.local_nome || 'Unidade';
        const procedimento = r.esp_nome || 'Procedimento';
        const dataBR = r.mar_data.toLocaleDateString('pt-BR');
        const hora = r.mar_hora || '';
        const codigo = String(r.mar_codigo);

        const hsmTemplate = process.env.FORTICS_TEMPLATE_HSM_EXAME;

        let campos = {
          DATA: dataBR,
          PROCEDIMENTO: procedimento,
          LOCAL: unidade,
          CODIGO: codigo,
          ...(hora && { HORA: hora }),
          ...(r.mar_esp !== 36 && r.medico_nome && { MEDICO: r.medico_nome })
        };

        if (hora) campos.HORA = hora;

        if (r.mar_esp !== 36 && r.medico_nome) {
          campos.MEDICO = r.medico_nome;
        }

        try {
          console.log(`[DEBUG] Atualizando contato (${contactId}) com os campos:`);
          console.dir(campos, { depth: null });

          await updateContactSZ(contactId, campos);

          logLine(`📌 Contato atualizado: ${contactId} com campos ${JSON.stringify(campos)}`);
        } catch (err) {
          console.error(`[ERRO] Falha ao atualizar contato ${contactId}:`, err.message);
          logLine(`❌ Erro ao atualizar contato ${contactId} - ${err.message}`);
          continue;
        }

        // await new Promise((r) => setTimeout(r, 200));

        try {
          await sendHSM({
            to: celular,
            agent_id: process.env.FORTICS_AGENT_ID,
            channel_id: process.env.FORTICS_CHANNEL_ID,
            close_session: 3,
            agent: process.env.FORTICS_AGENT,
            type: "text",
            is_hsm: 1,
            deviceToken: process.env.FORTICS_AGENT_DEVICE,
            attendance_id: process.env.FORTICS_ATTENDANCE,
            hsm_template_name: hsmTemplate
          });

          logLine(`✅ Enviado para ${nomePaciente} (${celular}) | Procedimento: ${procedimento} | Local: ${unidade} | Data: ${dataBR} ${hora}`);

          await queryDB(`
            UPDATE MARCACAO
               SET MAR_CONFIRMACAO = CURRENT_TIMESTAMP
             WHERE MAR_CODIGO = ?
          `, [r.mar_codigo]);

        } catch (err) {
          console.error(`[PRODUÇÃO] Erro ao enviar para ${celular}:`, err.message);
          logLine(`❌ Falha ao enviar para ${celular} - ${err.message}`);
        }
        
      } catch (err) {
        console.error(`[PRODUÇÃO] Erro ao processar contato ${celular}:`, err.message);
        logLine(`❌ Erro geral ao processar ${celular} - ${err.message}`);
      }
    }
  } catch (err) {
    console.error('[PRODUÇÃO] Erro geral no cronjob:', err);
    logLine(`❌ Erro geral: ${err}`);
  }
});