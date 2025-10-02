const { queryDB } = require('../utils/db');

const STATUS_WHATSAPP = {
  CONFIRMADO_WHATSAPP: 41,       // Confirmado WhatsApp
  CANCELADO_WHATSAPP: 42,        // Cancelado WhatsApp
  REMARCADO_WHATSAPP: 43,        // Remarcado WhatsApp
  MENSAGEM_ENVIADA: 44,          // Whatsapp Enviado
};

const ACOES = {
  CONFIRMAR: 'confirmar',
  CANCELAR: 'cancelar',
  REAGENDAR: 'reagendar'
};

async function processarAcaoWhatsapp(req, res) {
  const { codigo, acao, motivo, nova_data, nova_hora } = req.body;
  
  if (!codigo) {
    return res.status(400).json({ error: 'Código da marcação é obrigatório.' });
  }

  if (!acao || !Object.values(ACOES).includes(acao)) {
    return res.status(400).json({ 
      error: 'Ação inválida. Use: confirmar, cancelar ou reagendar' 
    });
  }

  try {
    const [marcacao] = await queryDB(`
      SELECT
        M.MAR_CODIGO,
        M.MAR_HORA,
        M.MAR_DATA,
        M.MAR_ESP,
        M.MAR_LIGOU,
        TRIM(CAST(CAST(M.MAR_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS NOME_PACIENTE,
        TRIM(CAST(CAST(DC.MED_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS MEDICO_NOME,
        TRIM(CAST(CAST(L.LOC_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS LOCAL_NOME,
        TRIM(CAST(CAST(L.LOC_ENDERECO AS VARCHAR(250) CHARACTER SET OCTETS) AS VARCHAR(250) CHARACTER SET WIN1252)) AS LOCAL_ENDERECO,
        TRIM(CAST(CAST(L.LOC_MAPA AS VARCHAR(1000) CHARACTER SET OCTETS) AS VARCHAR(1000) CHARACTER SET WIN1252)) AS LOCAL_MAPA
      FROM MARCACAO M
      LEFT JOIN MEDICO DC ON DC.MED_CODIGO = M.MAR_MEDICO
      LEFT JOIN LOCAL  L  ON L.LOC_CODIGO = M.MAR_LOCAL
      WHERE M.MAR_CODIGO = ?
    `, [codigo]);

    if (!marcacao) {
      return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }

    switch (acao) {
      case ACOES.CONFIRMAR:
        return await confirmarPresenca(marcacao, res);
      
      case ACOES.CANCELAR:
        return await cancelarAgendamento(marcacao, motivo, res);
      
      case ACOES.REAGENDAR:
        return await reagendarAgendamento(marcacao, { nova_data, nova_hora, motivo }, res);
      
      default:
        return res.status(400).json({ error: 'Ação não implementada.' });
    }

  } catch (err) {
    console.error(`Erro ao processar ação ${acao}:`, err.message);
    return res.status(500).json({ error: 'Erro interno ao processar solicitação.' });
  }
}

async function confirmarPresenca(marcacao, res) {
  const data = marcacao.mar_data ? new Date(marcacao.mar_data).toLocaleDateString('pt-BR') : '';
  const hora = Buffer.isBuffer(marcacao.mar_hora)
    ? marcacao.mar_hora.toString('utf8')
    : (marcacao.mar_hora || '');
  const local = marcacao.local_nome || '';
  const medico = marcacao.medico_nome || '';
  const endereco = marcacao.local_endereco || '';
  const link = extrairLinkDoEndereco(endereco);
  const enderecoSanitizado = removeLocalizacao(endereco);

  if (marcacao.mar_ligou === STATUS_WHATSAPP.CONFIRMADO_WHATSAPP) {
    let mensagem = '✅ *Presença Confirmada com Sucesso!*\n\n';
    mensagem += '_Sua presença já havia sido confirmada anteriormente._\n\n';
    
    if (data) mensagem += `📅 *Data:* ${data}\n`;
    if (hora) mensagem += `⏰ *Horário:* ${hora}\n`;
    if (marcacao.mar_esp !== 36 && medico) mensagem += `👨‍⚕️ *Médico:* ${medico}\n`;
    if (local) mensagem += `🏥 *Local:* ${local}\n`;
    if (enderecoSanitizado) mensagem += `📍 *Endereço:* ${enderecoSanitizado}\n`;
    if (link) mensagem += `🗺️ *Como Chegar:* ${link}\n`;
    mensagem += '\n⚠️ *IMPORTANTE:* Chegue com 20 minutos de antecedência!';
    
    return res.status(200).send(mensagem);
  }

  if ([STATUS_WHATSAPP.CANCELADO_WHATSAPP, STATUS_WHATSAPP.REMARCADO_WHATSAPP].includes(marcacao.mar_ligou)) {
    const statusText = marcacao.mar_ligou === STATUS_WHATSAPP.CANCELADO_WHATSAPP ? 'cancelado' : 'remarcado';
    const mensagem = `❌ *Não foi possível confirmar*\n\nEste agendamento foi ${statusText} anteriormente e não pode ser confirmado.\n\nPor favor, entre em contato com a recepção para mais informações.`;
    return res.status(400).send(mensagem);
  }

  await queryDB(`
    UPDATE MARCACAO
       SET MAR_LIGOU = ?
     WHERE MAR_CODIGO = ?
  `, [STATUS_WHATSAPP.CONFIRMADO_WHATSAPP, marcacao.mar_codigo]);

  console.log(`[CONFIRMAÇÃO] ${marcacao.mar_codigo} - ${marcacao.nome_paciente} - Status: ${marcacao.mar_ligou} → ${STATUS_WHATSAPP.CONFIRMADO_WHATSAPP}`);

  let mensagem = '✅ *Presença Confirmada com Sucesso!*\n\n';
  
  if (data) mensagem += `📅 *Data:* ${data}\n`;
  if (hora) mensagem += `⏰ *Horário:* ${hora}\n`;
  if (marcacao.mar_esp !== 36 && medico) mensagem += `👨‍⚕️ *Médico:* ${medico}\n`;
  if (local) mensagem += `🏥 *Local:* ${local}\n`;
  if (endereco) mensagem += `📍 *Endereço:* ${endereco}\n`;
  if (link) mensagem += `🗺️ *Como Chegar:* ${link}\n`;
  mensagem += '\n⚠️ *IMPORTANTE:* Chegue com 20 minutos de antecedência!';

  return res.status(200).send(mensagem);
}

async function cancelarAgendamento(marcacao, motivo, res) {
  if (marcacao.mar_ligou === STATUS_WHATSAPP.CANCELADO_WHATSAPP) {
    return res.status(400).json({
      error: 'Este agendamento já foi cancelado anteriormente.',
      ja_cancelado: true
    });
  }

  await queryDB(`
    UPDATE MARCACAO
       SET MAR_LIGOU = ?
     WHERE MAR_CODIGO = ?
  `, [STATUS_WHATSAPP.CANCELADO_WHATSAPP, marcacao.mar_codigo]);

  console.log(`[CANCELAMENTO] ${marcacao.mar_codigo} - ${marcacao.nome_paciente} - Motivo: ${motivo || 'Não informado'}`);

  return res.status(200).json({
    success: true,
    message: 'Agendamento cancelado com sucesso via WhatsApp.',
    dados: {
      codigo: marcacao.mar_codigo,
      paciente: marcacao.nome_paciente,
      data: marcacao.mar_data,
      motivo: motivo || null
    },
    debug: {
      status_anterior: marcacao.mar_ligou,
      status_atual: STATUS_WHATSAPP.CANCELADO_WHATSAPP
    }
  });
}

async function reagendarAgendamento(marcacao, { nova_data, nova_hora, motivo }, res) {
  if (marcacao.mar_ligou === STATUS_WHATSAPP.REMARCADO_WHATSAPP) {
    return res.status(400).json({
      error: 'Este agendamento já foi remarcado anteriormente.',
      ja_remarcado: true
    });
  }

  let updateQuery = 'UPDATE MARCACAO SET MAR_LIGOU = ?';
  let params = [STATUS_WHATSAPP.REMARCADO_WHATSAPP];

  if (nova_data) {
    updateQuery += ', MAR_DATA = ?';
    params.push(nova_data);
  }

  if (nova_hora) {
    updateQuery += ', MAR_HORA = ?';
    params.push(nova_hora);
  }

  updateQuery += ' WHERE MAR_CODIGO = ?';
  params.push(marcacao.mar_codigo);

  await queryDB(updateQuery, params);

  console.log(`[REAGENDAMENTO] ${marcacao.mar_codigo} - ${marcacao.nome_paciente} - Nova data: ${nova_data || 'não informada'} - Motivo: ${motivo || 'Não informado'}`);

  return res.status(200).json({
    success: true,
    message: 'Agendamento reagendado com sucesso via WhatsApp.',
    dados: {
      codigo: marcacao.mar_codigo,
      paciente: marcacao.nome_paciente,
      data_anterior: marcacao.mar_data,
      hora_anterior: marcacao.mar_hora,
      nova_data: nova_data || marcacao.mar_data,
      nova_hora: nova_hora || marcacao.mar_hora,
      motivo: motivo || null
    },
    debug: {
      status_anterior: marcacao.mar_ligou,
      status_atual: STATUS_WHATSAPP.REMARCADO_WHATSAPP
    }
  });
}

function extrairLinkDoEndereco(endereco) {
  if (!endereco) return null;
  
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = endereco.match(urlRegex);
  
  if (matches && matches.length > 0) {
    return matches[0];
  }
  
  return null;
}

function montarRetornoConfirmacao(marcacao) {
  const retorno = {
    data: marcacao.mar_data ? new Date(marcacao.mar_data).toLocaleDateString('pt-BR') : '',
    hora: Buffer.isBuffer(marcacao.mar_hora)
      ? marcacao.mar_hora.toString('utf8')
      : (marcacao.mar_hora || ''),
    local: marcacao.local_nome || 'Local não disponível'
  };

  if (marcacao.local_endereco) {
    retorno.endereco = marcacao.local_endereco;
    
    const link = extrairLinkDoEndereco(marcacao.local_endereco);
    if (link) {
      retorno.link_localizacao = link;
    }
  } else {
    retorno.endereco = 'Endereço não disponível';
  }

  if (marcacao.local_mapa) {
    const srcMatch = marcacao.local_mapa.match(/src="([^"]+)"/);
    if (srcMatch && srcMatch[1]) {
      retorno.mapa_google = srcMatch[1];
    }
  }

  if (marcacao.mar_esp !== 36 && marcacao.medico_nome) {
    retorno.medico = marcacao.medico_nome;
  }

  return retorno;
}

function removeLocalizacao(endereco){
   const index = endereco.toLowerCase().indexOf("localização");
    if (index !== -1) {
      return endereco.substring(0, index).trim();
    }
    return endereco;
}

module.exports = { 
  processarAcaoWhatsapp,
  STATUS_WHATSAPP,
  ACOES
};