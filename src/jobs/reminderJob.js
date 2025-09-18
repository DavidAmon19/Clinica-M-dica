const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { queryDB } = require('../utils/db');
const { sendHSM } = require('../integrations/fortics');
const { updateContactSZ, getOrCreateContact } = require('../integrations/sz');

const STATUS_WHATSAPP = {
  PODE_ENVIAR: [null, 1, 40],    // NULL, Confirmado, Whatsapp
  MENSAGEM_ENVIADA: 44,          // Whatsapp Enviado
  CONFIRMADO_WHATSAPP: 41,       // Confirmado WhatsApp
  CANCELADO_WHATSAPP: 42,        // Cancelado WhatsApp
  REMARCADO_WHATSAPP: 43,        // Remarcado WhatsApp
  NAO_ENVIAR: [2, 5, 42, 43]     // Cancelado, Desmarcado, Cancelado/Remarcado WhatsApp
};

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
        FIRIST 1
        M.MAR_CODIGO,
        M.MAR_MEDICO,
        M.MAR_DATA,
        M.MAR_LIGOU,
        TRIM(CAST(CAST(M.MAR_HORA AS VARCHAR(5) CHARACTER SET OCTETS) AS VARCHAR(5) CHARACTER SET WIN1252)) AS MAR_HORA,
        TRIM(CAST(CAST(M.MAR_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS NOME_PACIENTE,
        TRIM(CAST(CAST(M.MAR_TELEFONE AS VARCHAR(20) CHARACTER SET OCTETS) AS VARCHAR(20) CHARACTER SET WIN1252)) AS MAR_CEL,
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
        AND (M.MAR_LIGOU IS NULL OR M.MAR_LIGOU IN (1, 40))
        AND M.MAR_LIGOU NOT IN (44, 41, 42, 43, 2, 5)
    `);

    console.log(`[PRODUÇÃO] Total de agendamentos encontrados: ${rows.length}`);
    logLine(`Total de agendamentos para notificar: ${rows.length}`);

    for (const r of rows) {
      if (!STATUS_WHATSAPP.PODE_ENVIAR.includes(r.mar_ligou)) {
        console.log(`[SKIP] Agendamento ${r.mar_codigo} - Status: ${r.mar_ligou} não permite envio`);
        logLine(`⏭️ Pulado ${r.mar_codigo} - Status: ${r.mar_ligou}`);
        continue;
      }

      // const celular = formatPhoneNumber(r.mar_cel);
      const celular = "5585992616996"
      const nomePaciente = r.nome_paciente || 'Paciente';

      console.log(`[PROCESSANDO] ${r.mar_codigo} - Status atual: ${r.mar_ligou} - Paciente: ${nomePaciente}`);

      try {
        const contactId = await getOrCreateContact(celular, nomePaciente);
        
        if (!contactId) {
          logLine(`❌ Não foi possível obter/criar contato: ${celular}`);
          continue;
        }

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

          await queryDB(`
            UPDATE MARCACAO
               SET MAR_LIGOU = ?
             WHERE MAR_CODIGO = ?
          `, [STATUS_WHATSAPP.MENSAGEM_ENVIADA, r.mar_codigo]);

          logLine(`✅ Enviado para ${nomePaciente} (${celular}) | Status: ${r.mar_ligou} → ${STATUS_WHATSAPP.MENSAGEM_ENVIADA} | Procedimento: ${procedimento} | Local: ${unidade} | Data: ${dataBR} ${hora}`);
          console.log(`[SUCESSO] Mensagem enviada e status atualizado para ${STATUS_WHATSAPP.MENSAGEM_ENVIADA}`);

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