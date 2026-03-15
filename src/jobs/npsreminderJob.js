const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { queryDB } = require('../utils/db');
const { sendHSM } = require('../integrations/fortics');
const { getOrCreateContact, updateContactSZ } = require('../integrations/sz');

function formatPhoneNumber(raw) {
  if (!raw) return '';
  const cleaned = raw.replace(/\D/g, '');
  return `55${cleaned}`;
}

function getDateRangeForNPS() {
  const today = new Date();
  const dow = today.getDay();

  let start, end;

  switch (dow) {
    case 1:
      start = new Date(today);
      start.setDate(today.getDate() - 3);

      end = new Date(today);
      end.setDate(today.getDate() - 2);
      break;

    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
      start = end = new Date(today);
      start.setDate(today.getDate() - 1);
      break;

    case 0:
    default:
      return null;
  }

  const iso = d => d.toISOString().split('T')[0];

  return {
    start: iso(start),
    end: iso(end)
  };
}

function buildQueryNPS() {
  const range = getDateRangeForNPS();
  if (!range) return null;

  return `
    SELECT
      M.MOV_CODIGO,
      M.MOV_DATA,
      M.MOV_STATUS,
      TRIM(CAST(CAST(P.PAC_NOME AS VARCHAR(120) CHARACTER SET OCTETS)
          AS VARCHAR(120) CHARACTER SET WIN1252)) AS NOME_PACIENTE,
      TRIM(CAST(CAST(P.PAC_CELULAR AS VARCHAR(20) CHARACTER SET OCTETS)
          AS VARCHAR(20) CHARACTER SET WIN1252)) AS CELULAR_PACIENTE
    FROM MOV M
    LEFT JOIN PACIENTE P ON P.PAC_CODIGO = M.MOV_PACIENTE
    WHERE 
      M.MOV_STATUS = 'ATENDIDO'
      AND M.MOV_DATA BETWEEN CAST('${range.start}' AS DATE)
                         AND CAST('${range.end}' AS DATE)
    ORDER BY M.MOV_DATA DESC
  `;
}

cron.schedule('00 18 * * *', async () => {
  console.log(`[NPS] Iniciando envio NPS...`);

  const logDir = path.join(__dirname, '../logsNPS');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

  const today = new Date().toISOString().split('T')[0];
  const logPath = path.join(logDir, `envios_${today}.log`);

  const logLine = (text) =>
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${text}\n`);

  logLine(`🚀 Início do processo NPS`);

  const query = buildQueryNPS();

  if (!query) {
    console.log(`[NPS] Domingo → não envia.`);
    logLine(`🔕 Domingo — processo não executado`);
    return;
  }

  const range = getDateRangeForNPS();
  logLine(`📅 Range utilizado: ${range.start} → ${range.end}`);

  try {
    const rows = await queryDB(query);

    console.log(`[NPS] Total encontrados: ${rows.length}`);
    logLine(`👥 Total de pacientes encontrados: ${rows.length}`);

    for (const r of rows) {
      const celular = formatPhoneNumber(r.celular_paciente);
      // const celular = "5585992616996";

      const nome = r.nome_paciente?.trim() || 'Paciente';

      if (!celular || celular.length < 12) {
        logLine(`⚠️ Telefone inválido ignorado: ${r.celular_paciente}`);
        continue;
      }

      const dataAtendimento = new Date(r.mov_data).toLocaleDateString("pt-BR");

      console.log(`[NPS] Processando ${nome} (${celular}) | Atendimento: ${dataAtendimento}`);
      logLine(`➡️ Processando ${nome} (${celular}) | Atendimento: ${dataAtendimento}`);

      try {
        const contactId = await getOrCreateContact(celular, nome);

        if (!contactId) {
          logLine(`❌ Falha ao criar/obter contato: ${celular}`);
          continue;
        }

        try {
          await updateContactSZ(contactId, { DATA: dataAtendimento });
          logLine(`📌 DATA atualizada no contato ${contactId}: ${dataAtendimento}`);
        } catch (err) {
          logLine(`❌ Erro ao atualizar DATA do contato ${contactId}: ${err.message}`);
          continue;
        }

        await sendHSM({
          to: celular,
          agent_id: process.env.FORTICS_AGENT_ID,
          channel_id: process.env.FORTICS_CHANNEL_ID_OFICIAL,
          close_session: 3,
          agent: process.env.FORTICS_AGENT,
          type: "text",
          is_hsm: 1,
          deviceToken: process.env.FORTICS_AGENT_DEVICE,
          attendance_id: process.env.FORTICS_ATTENDANCE,
          hsm_template_name: process.env.FORTICS_NOTAS
        });

        console.log(`[NPS] ✔ Enviado para ${nome}`);
        logLine(`✅ Sucesso ao enviar para ${nome} (${celular})`);

      } catch (err) {
        console.error(`[NPS] ❌ Erro ao enviar p/ ${celular}:`, err.message);
        logLine(`❌ Erro ao enviar para ${celular} — ${err.message}`);
      }
    }

    logLine(`📘 Processo finalizado — total processados: ${rows.length}`);

  } catch (err) {
    console.error('[NPS] Erro geral:', err);
    logLine(`🔥 Erro geral no processo: ${err.message || err}`);
  }
});
