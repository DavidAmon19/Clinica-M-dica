const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { queryDB } = require('../utils/db');
const { sendHSM } = require('../integrations/fortics');
const { updateContactSZ, getOrCreateContact } = require('../integrations/sz');

const STATUS_WHATSAPP = {
  MENSAGEM_ENVIADA: 44,          // Whatsapp Enviado
  CONFIRMADO_WHATSAPP: 41,       // Confirmado WhatsApp
  CANCELADO_WHATSAPP: 42,        // Cancelado WhatsApp
  REMARCADO_WHATSAPP: 43         // Remarcado WhatsApp
};

function formatPhoneNumber(raw) {
  if (!raw) return '';
  const cleaned = raw.replace(/\D/g, '');
  return `55${cleaned}`;
}

function getTargetDate() {
  const today = new Date();
  const dayOfWeek = today.getDay(); 
  
  let targetDate = new Date(today);
  
  switch(dayOfWeek) {
    case 1: 
      targetDate.setDate(today.getDate() + 1);
      break;
    case 2: 
      targetDate.setDate(today.getDate() + 1);
      break;
    case 3: 
      targetDate.setDate(today.getDate() + 1);
      break;
    case 4: 
      targetDate.setDate(today.getDate() + 1);
      break;
    case 5:
      return {
        single: false,
        dates: [
          new Date(today.getTime() + 24 * 60 * 60 * 1000), 
          new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)
        ]
      };
    case 0: 
    case 6: 
      return {
        single: false,
        dates: []
      };
    default:
      return {
        single: false,
        dates: []
      };
  }
  
  return {
    single: true,
    date: targetDate
  };
}

function buildQuery() {
  const targetInfo = getTargetDate();
  
  if (!targetInfo.single && targetInfo.dates.length === 0) {
    return null;
  }
  
  let whereClause = '';
  
  if (targetInfo.single) {
    const targetDateStr = targetInfo.date.toISOString().split('T')[0];
    whereClause = `WHERE M.MAR_DATA = CAST('${targetDateStr}' AS DATE)`;
  } else {
    const date1 = targetInfo.dates[0].toISOString().split('T')[0];
    const date2 = targetInfo.dates[1].toISOString().split('T')[0];
    whereClause = `WHERE (M.MAR_DATA = CAST('${date1}' AS DATE) OR M.MAR_DATA = CAST('${date2}' AS DATE))`;
  }
  
  return `
  SELECT
    M.MAR_CODIGO,
    M.MAR_MEDICO,
    M.MAR_DATA,
    M.MAR_LIGOU,
    TRIM(CAST(CAST(M.MAR_HORA AS VARCHAR(5) CHARACTER SET OCTETS) AS VARCHAR(5) CHARACTER SET WIN1252)) AS MAR_HORA,
    TRIM(CAST(CAST(M.MAR_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS NOME_PACIENTE,
    TRIM(CAST(CAST(M.MAR_TELEFONE AS VARCHAR(20) CHARACTER SET OCTETS) AS VARCHAR(20) CHARACTER SET WIN1252)) AS MAR_CEL,
    M.MAR_ESP,
    TRIM(CAST(CAST(DC.MED_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS MEDICO_NOME,
    TRIM(CAST(CAST(L.LOC_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS LOCAL_NOME,
    TRIM(CAST(CAST(E.ESP_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS ESP_NOME
  FROM MARCACAO M
  LEFT JOIN MEDICO DC ON DC.MED_CODIGO = M.MAR_MEDICO
  LEFT JOIN LOCAL L ON L.LOC_CODIGO = M.MAR_LOCAL
  LEFT JOIN ESPECIALIDADE E ON E.ESP_CODIGO = M.MAR_ESP
  ${whereClause}
  ORDER BY M.MAR_DATA, M.MAR_HORA
`;
}

cron.schedule('00 07 * * *', async () => {
  console.log(`[PRODUÇÃO] Iniciando verificação diária de agendamentos...`);

  const today = new Date().toISOString().slice(0, 10);
  const logPath = path.join(__dirname, `../logs/envios_${today}.log`);
  const logLine = (text) => fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${text}\n`);

  const dayOfWeek = new Date().getDay();
  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  
  console.log(`[INFO] Hoje é ${dayNames[dayOfWeek]} (${dayOfWeek})`);
  logLine(`Dia da semana: ${dayNames[dayOfWeek]}`);

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    console.log(`[SKIP] Não processa agendamentos aos ${dayNames[dayOfWeek]}s`);
    logLine(`Não processa agendamentos aos ${dayNames[dayOfWeek]}s`);
    return;
  }

  const query = buildQuery();
  
  if (!query) {
    console.log('[SKIP] Nenhum agendamento para processar hoje');
    logLine('Nenhum agendamento para processar hoje');
    return;
  }

  try {
    const rows = await queryDB(query);

    console.log(`[PRODUÇÃO] Total de agendamentos encontrados: ${rows.length}`);
    logLine(`Total de agendamentos para notificar: ${rows.length}`);

    if (rows.length > 0) {
      const datesProcessed = [...new Set(rows.map(r => r.mar_data.toLocaleDateString('pt-BR')))];
      console.log(`[INFO] Processando agendamentos para as datas: ${datesProcessed.join(', ')}`);
      logLine(`Datas processadas: ${datesProcessed.join(', ')}`);
    }

    for (const r of rows) {
      
      let nomePaciente = 'Paciente';

      if (r.nome_paciente && r.nome_paciente.trim() !== '') {
        const nomesInvalidos = ['CANCELAR', 'CONFIRMAR', 'confirmar', 'cancelar', 'Cancelar', 'Confirmar', 'REAGENDAR', 'reagendar'];
        const nomeUpper = r.nome_paciente.trim().toUpperCase();

        if (nomesInvalidos.some(nome => nomeUpper === nome.toUpperCase()) ||
          nomeUpper.length < 3 ||
          /^[0-9]+$/.test(nomeUpper)) {
          console.log(`[AVISO] Agendamento ${r.mar_codigo} - Nome inválido: "${r.nome_paciente}", usando nome padrão`);
          logLine(`⚠️ Nome inválido para código ${r.mar_codigo}: "${r.nome_paciente}", usando 'Paciente'`);
          nomePaciente = 'Paciente';
        } else {
          nomePaciente = r.nome_paciente.trim();
        }
      } else {
        console.log(`[AVISO] Agendamento ${r.mar_codigo} - Nome vazio, usando nome padrão`);
        logLine(`⚠️ Nome vazio para código ${r.mar_codigo}, usando 'Paciente'`);
      }

      const celular = formatPhoneNumber(r.mar_cel);
      // const celular ="5585992616996"; // Número de teste

      // if (!celular || celular.length < 13 || !r.mar_cel) {
      //   console.log(`[SKIP] Agendamento ${r.mar_codigo} - Telefone inválido: "${r.mar_cel}"`);
      //   logLine(`⚠️ Telefone inválido para ${nomePaciente}: "${r.mar_cel}"`);
      //   continue;
      // }

      console.log(`[PROCESSANDO] ${r.mar_codigo} - Data: ${r.mar_data.toLocaleDateString('pt-BR')} - Status atual: ${r.mar_ligou} - Paciente: ${nomePaciente} - Telefone: ${celular}`);

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

          logLine(`✅ Enviado para ${nomePaciente} (${celular}) | Data: ${dataBR} | Status anterior: ${r.mar_ligou} → ${STATUS_WHATSAPP.MENSAGEM_ENVIADA} | Procedimento: ${procedimento} | Local: ${unidade} | Hora: ${hora}`);
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