const { queryDB } = require('../utils/db');

const STATUS_WHATSAPP = {
  PODE_ENVIAR: [null, 1, 40, 0],
  MENSAGEM_ENVIADA: 44,
  CONFIRMADO_WHATSAPP: 41,
  CANCELADO_WHATSAPP: 42,
  REMARCADO_WHATSAPP: 43,
  NAO_ENVIAR: [2, 5, 42, 43]
};

async function getMetrics(req, res) {
  try {
    const {
      data_inicio,
      data_fim,
      especialidade,
      medico,
      local
    } = req.query;

    const dataFim = data_fim || new Date().toISOString().split('T')[0];
    const dataInicio = data_inicio || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let whereConditions = [
      `M.MAR_DATA BETWEEN CAST('${dataInicio}' AS DATE) AND CAST('${dataFim}' AS DATE)`
    ];

    if (especialidade) whereConditions.push(`M.MAR_ESP = ${especialidade}`);
    if (medico) whereConditions.push(`M.MAR_MEDICO = ${medico}`);
    if (local) whereConditions.push(`M.MAR_LOCAL = ${local}`);

    const whereClause = whereConditions.join(' AND ');

    const metricsQuery = `
      SELECT
        COUNT(*) as total_agendamentos,
        COUNT(CASE WHEN M.MAR_LIGOU = 44 THEN 1 ELSE NULL END) as mensagens_enviadas,
        COUNT(
          CASE 
            WHEN M.MAR_LIGOU = 41 
              AND EXISTS (
                SELECT 1 FROM MARCACAO M2
                WHERE M2.MAR_CODIGO = M.MAR_CODIGO
                  AND M2.MAR_LIGOU = 44
                  AND M2.MAR_DATA = M.MAR_DATA
              )
            THEN 1 ELSE NULL 
          END
        ) as confirmados,
        COUNT(CASE WHEN M.MAR_LIGOU = 42 THEN 1 ELSE NULL END) as cancelados,
        COUNT(CASE WHEN M.MAR_LIGOU = 43 THEN 1 ELSE NULL END) as remarcados,
        COUNT(CASE WHEN (M.MAR_LIGOU IS NULL OR M.MAR_LIGOU IN (0, 1, 40)) THEN 1 ELSE NULL END) as pendentes
      FROM MARCACAO M
      WHERE ${whereClause}
    `;

    const totalRealQuery = `
      SELECT COUNT(*) as total_real_agendamentos
      FROM MARCACAO M
      WHERE ${whereClause}
        AND M.MAR_LIGOU NOT IN (2, 3, 5, 12, 99)
    `;

    const [totalReal] = await queryDB(totalRealQuery);
    const [metrics] = await queryDB(metricsQuery);

    const taxa_envio = metrics.total_agendamentos > 0 ?
      (metrics.mensagens_enviadas / metrics.total_agendamentos) * 100 : 0;

    const confirmados_whatsapp = metrics.confirmados;
    const taxa_confirmacao = metrics.mensagens_enviadas > 0 ?
      (confirmados_whatsapp / metrics.mensagens_enviadas) * 100 : 0;

    const taxa_confirmacao_final = Math.min(taxa_confirmacao, 100);

   const dailyQuery = `
  SELECT
    M.MAR_DATA as data,
    COUNT(*) as total,
    COUNT(CASE WHEN M.MAR_LIGOU = 44 THEN 1 ELSE NULL END) as enviadas,
    COUNT(
      CASE 
        WHEN M.MAR_LIGOU = 41 
          AND EXISTS (
            SELECT 1 FROM MARCACAO M2
            WHERE M2.MAR_CODIGO = M.MAR_CODIGO
              AND M2.MAR_LIGOU = 44
              AND M2.MAR_DATA = M.MAR_DATA
          )
        THEN 1 ELSE NULL 
      END
    ) as confirmadas,
    COUNT(CASE WHEN M.MAR_LIGOU = 42 THEN 1 ELSE NULL END) as canceladas
  FROM MARCACAO M
  WHERE M.MAR_DATA BETWEEN CAST('${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}' AS DATE) 
    AND CAST('${dataFim}' AS DATE)
  GROUP BY M.MAR_DATA
  ORDER BY M.MAR_DATA DESC
`;


    const dailyStats = await queryDB(dailyQuery);

    res.json({
      success: true,
      data: {
        periodo: {
          data_inicio: dataInicio,
          data_fim: dataFim
        },
        metricas_gerais: {
          total_agendamentos: parseInt(metrics.total_agendamentos) || 0,
          mensagens_enviadas: parseInt(metrics.mensagens_enviadas) || 0,
          confirmados: parseInt(metrics.confirmados) || 0,
          cancelados: parseInt(metrics.cancelados) || 0,
          remarcados: parseInt(metrics.remarcados) || 0,
          pendentes: parseInt(metrics.pendentes) || 0,
          taxa_envio: parseFloat(taxa_envio.toFixed(1)) || 0,
          taxa_confirmacao: parseFloat(taxa_confirmacao_final.toFixed(1)) || 0
        },
        estatisticas_diarias: dailyStats.map(day => ({
          data: day.data.toISOString().split('T')[0],
          data_formatada: day.data.toLocaleDateString('pt-BR'),
          dia_semana: new Date(day.data).toLocaleDateString('pt-BR', { weekday: 'long' }),
          total: parseInt(day.total),
          enviadas: parseInt(day.enviadas),
          confirmadas: parseInt(day.confirmadas),
          canceladas: parseInt(day.canceladas),
          taxa_confirmacao: day.enviadas > 0 ?
            parseFloat(((day.confirmadas / day.enviadas) * 100).toFixed(1)) : 0
        }))
      }
    });

  } catch (error) {
    console.error('ERRO DETALHADO:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno ao obter métricas do dashboard',
      debug: error.message
    });
  }
}


async function getConfirmations(req, res) {
  try {
    const {
      data_inicio,
      data_fim,
      status,
      page = 1,
      limit = 50,
      search
    } = req.query;

    const dataFim = data_fim || new Date().toISOString().split('T')[0];
    const dataInicio = data_inicio || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereConditions = [`M.MAR_DATA BETWEEN CAST('${dataInicio}' AS DATE) AND CAST('${dataFim}' AS DATE)`];

    if (status) {
      switch (status) {
        case 'confirmado':
          whereConditions.push('M.MAR_LIGOU = 41');
          break;
        case 'cancelado':
          whereConditions.push('M.MAR_LIGOU = 42');
          break;
        case 'remarcado':
          whereConditions.push('M.MAR_LIGOU = 43');
          break;
        case 'enviado':
          whereConditions.push('M.MAR_LIGOU = 44');
          break;
        case 'pendente':
          whereConditions.push('(M.MAR_LIGOU IS NULL OR M.MAR_LIGOU IN (0, 1, 40))');
          break;
      }
    }

    if (search) {
      whereConditions.push(`(
        UPPER(TRIM(CAST(CAST(M.MAR_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252))) LIKE UPPER('%${search}%')
        OR CAST(M.MAR_CODIGO AS VARCHAR) LIKE '%${search}%'
        OR TRIM(CAST(CAST(M.MAR_TELEFONE AS VARCHAR(20) CHARACTER SET OCTETS) AS VARCHAR(20) CHARACTER SET WIN1252)) LIKE '%${search}%'
      )`);
    }

    const whereClause = whereConditions.join(' AND ');

    // Query para buscar confirmações
    const confirmationsQuery = `
      SELECT FIRST ${limit} SKIP ${offset}
        M.MAR_CODIGO,
        M.MAR_DATA,
        TRIM(CAST(CAST(M.MAR_HORA AS VARCHAR(5) CHARACTER SET OCTETS) AS VARCHAR(5) CHARACTER SET WIN1252)) AS MAR_HORA,
        TRIM(CAST(CAST(M.MAR_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS NOME_PACIENTE,
        TRIM(CAST(CAST(M.MAR_TELEFONE AS VARCHAR(20) CHARACTER SET OCTETS) AS VARCHAR(20) CHARACTER SET WIN1252)) AS TELEFONE,
        M.MAR_LIGOU,
        TRIM(CAST(CAST(DC.MED_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS MEDICO_NOME,
        TRIM(CAST(CAST(L.LOC_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS LOCAL_NOME,
        TRIM(CAST(CAST(E.ESP_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS ESPECIALIDADE_NOME
      FROM MARCACAO M
      LEFT JOIN MEDICO DC ON DC.MED_CODIGO = M.MAR_MEDICO
      LEFT JOIN LOCAL L ON L.LOC_CODIGO = M.MAR_LOCAL
      LEFT JOIN ESPECIALIDADE E ON E.ESP_CODIGO = M.MAR_ESP
      WHERE ${whereClause}
      ORDER BY M.MAR_DATA DESC, M.MAR_HORA DESC
    `;

    // Query para contar total de registros
    const countQuery = `
      SELECT COUNT(*) as total
      FROM MARCACAO M
      WHERE ${whereClause}
    `;

    const [confirmations, countResult] = await Promise.all([
      queryDB(confirmationsQuery),
      queryDB(countQuery)
    ]);

    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / parseInt(limit));

    // Mapear status para texto legível
    const mapearStatus = (status) => {
      const statusMap = {
        41: 'Confirmado',
        42: 'Cancelado',
        43: 'Remarcado',
        44: 'Enviado',
        0: 'Agendado',
        1: 'Confirmado',
        40: 'WhatsApp',
        null: 'Pendente'
      };
      return statusMap[status] || 'Desconhecido';
    };

    const formattedConfirmations = confirmations.map(conf => ({
      codigo: conf.mar_codigo,
      data: conf.mar_data.toISOString().split('T')[0],
      hora: conf.mar_hora || '',
      paciente: conf.nome_paciente || 'Nome não informado',
      telefone: conf.telefone || '',
      status: conf.mar_ligou,
      status_texto: mapearStatus(conf.mar_ligou),
      medico: conf.medico_nome || '',
      local: conf.local_nome || '',
      especialidade: conf.especialidade_nome || ''
    }));

    res.json({
      success: true,
      data: {
        confirmations: formattedConfirmations,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total: parseInt(total),
          total_pages: totalPages,
          has_next: parseInt(page) < totalPages,
          has_prev: parseInt(page) > 1
        },
        filtros: {
          data_inicio: dataInicio,
          data_fim: dataFim,
          status,
          search
        }
      }
    });

  } catch (error) {
    console.error('Erro ao obter confirmações:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno ao obter lista de confirmações'
    });
  }
}

// GET /dashboard/charts  
async function getCharts(req, res) {
  try {
    const {
      data_inicio,
      data_fim,
      tipo = 'status' // status, horario, especialidade, medico
    } = req.query;

    const dataFim = data_fim || new Date().toISOString().split('T')[0];
    const dataInicio = data_inicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let chartData = {};

    switch (tipo) {
      case 'status':
        const statusQuery = `
          SELECT
            CASE 
              WHEN M.MAR_LIGOU = 41 THEN 'Confirmado'
              WHEN M.MAR_LIGOU = 42 THEN 'Cancelado'
              WHEN M.MAR_LIGOU = 43 THEN 'Remarcado'
              WHEN M.MAR_LIGOU = 44 THEN 'Enviado'
              WHEN M.MAR_LIGOU IN (0, 1) THEN 'Agendado'
              WHEN M.MAR_LIGOU = 40 THEN 'WhatsApp'
              ELSE 'Pendente'
            END as status,
            COUNT(*) as quantidade
          FROM MARCACAO M
          WHERE M.MAR_DATA BETWEEN CAST('${dataInicio}' AS DATE) AND CAST('${dataFim}' AS DATE)
          GROUP BY M.MAR_LIGOU
          ORDER BY quantidade DESC
        `;
        chartData = await queryDB(statusQuery);
        break;

      case 'horario':
        const horarioQuery = `
          SELECT
            EXTRACT(HOUR FROM CAST(TRIM(CAST(CAST(M.MAR_HORA AS VARCHAR(5) CHARACTER SET OCTETS) AS VARCHAR(5) CHARACTER SET WIN1252)) AS TIME)) as hora,
            COUNT(*) as total_agendamentos,
            COUNT(CASE WHEN M.MAR_LIGOU = 41 THEN 1 END) as confirmados
          FROM MARCACAO M
          WHERE M.MAR_DATA BETWEEN CAST('${dataInicio}' AS DATE) AND CAST('${dataFim}' AS DATE)
            AND M.MAR_HORA IS NOT NULL
          GROUP BY EXTRACT(HOUR FROM CAST(TRIM(CAST(CAST(M.MAR_HORA AS VARCHAR(5) CHARACTER SET OCTETS) AS VARCHAR(5) CHARACTER SET WIN1252)) AS TIME))
          ORDER BY hora
        `;
        chartData = await queryDB(horarioQuery);
        break;

      case 'especialidade':
        const especialidadeQuery = `
          SELECT
            TRIM(CAST(CAST(E.ESP_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS especialidade,
            COUNT(*) as total,
            COUNT(CASE WHEN M.MAR_LIGOU = 41 THEN 1 END) as confirmados,
            COUNT(CASE WHEN M.MAR_LIGOU = 44 THEN 1 END) as enviados
          FROM MARCACAO M
          LEFT JOIN ESPECIALIDADE E ON E.ESP_CODIGO = M.MAR_ESP
          WHERE M.MAR_DATA BETWEEN CAST('${dataInicio}' AS DATE) AND CAST('${dataFim}' AS DATE)
          GROUP BY E.ESP_NOME
          ORDER BY total DESC
          ROWS 10
        `;
        chartData = await queryDB(especialidadeQuery);
        break;

      case 'medico':
        const medicoQuery = `
          SELECT
            TRIM(CAST(CAST(DC.MED_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS medico,
            COUNT(*) as total,
            COUNT(CASE WHEN M.MAR_LIGOU = 41 THEN 1 END) as confirmados,
            COUNT(CASE WHEN M.MAR_LIGOU = 44 THEN 1 END) as enviados
          FROM MARCACAO M
          LEFT JOIN MEDICO DC ON DC.MED_CODIGO = M.MAR_MEDICO
          WHERE M.MAR_DATA BETWEEN CAST('${dataInicio}' AS DATE) AND CAST('${dataFim}' AS DATE)
          GROUP BY DC.MED_NOME
          ORDER BY total DESC
          ROWS 10
        `;
        chartData = await queryDB(medicoQuery);
        break;

      default:
        throw new Error('Tipo de chart não suportado');
    }

    res.json({
      success: true,
      data: {
        tipo,
        periodo: {
          data_inicio: dataInicio,
          data_fim: dataFim
        },
        chart_data: chartData
      }
    });

  } catch (error) {
    console.error('Erro ao obter dados do gráfico:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno ao obter dados do gráfico'
    });
  }
}

async function getProcedures(req, res) {
  try {
    const especialidadesQuery = `
      SELECT DISTINCT
        E.ESP_CODIGO,
        TRIM(CAST(CAST(E.ESP_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS ESP_NOME
      FROM ESPECIALIDADE E
      WHERE E.ESP_CODIGO IN (
        SELECT DISTINCT M.MAR_ESP 
        FROM MARCACAO M 
        WHERE M.MAR_DATA >= CAST('${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}' AS DATE)
      )
      ORDER BY E.ESP_NOME
    `;

    const medicosQuery = `
      SELECT DISTINCT
        DC.MED_CODIGO,
        TRIM(CAST(CAST(DC.MED_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS MED_NOME
      FROM MEDICO DC
      WHERE DC.MED_CODIGO IN (
        SELECT DISTINCT M.MAR_MEDICO 
        FROM MARCACAO M 
        WHERE M.MAR_DATA >= CAST('${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}' AS DATE)
      )
      ORDER BY DC.MED_NOME
    `;

    const locaisQuery = `
      SELECT DISTINCT
        L.LOC_CODIGO,
        TRIM(CAST(CAST(L.LOC_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS LOC_NOME
      FROM LOCAL L
      WHERE L.LOC_CODIGO IN (
        SELECT DISTINCT M.MAR_LOCAL 
        FROM MARCACAO M 
        WHERE M.MAR_DATA >= CAST('${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}' AS DATE)
      )
      ORDER BY L.LOC_NOME
    `;

    const [especialidades, medicos, locais] = await Promise.all([
      queryDB(especialidadesQuery),
      queryDB(medicosQuery),
      queryDB(locaisQuery)
    ]);

    res.json({
      success: true,
      data: {
        especialidades: especialidades.map(e => ({
          codigo: e.esp_codigo,
          nome: e.esp_nome || 'Especialidade não informada'
        })),
        medicos: medicos.map(m => ({
          codigo: m.med_codigo,
          nome: m.med_nome || 'Médico não informado'
        })),
        locais: locais.map(l => ({
          codigo: l.loc_codigo,
          nome: l.loc_nome || 'Local não informado'
        }))
      }
    });

  } catch (error) {
    console.error('Erro ao obter procedimentos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno ao obter lista de procedimentos'
    });
  }
}
async function resetStatusAgendamento(req, res) {
  const { codigo } = req.body;

  if (!codigo) {
    return res.status(400).json({
      success: false,
      error: 'Código da marcação é obrigatório.'
    });
  }

  try {
    const [agendamento] = await queryDB(`
      SELECT
        M.MAR_CODIGO,
        M.MAR_LIGOU,
        M.MAR_DATA,
        TRIM(CAST(CAST(M.MAR_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS NOME_PACIENTE,
        TRIM(CAST(CAST(M.MAR_TELEFONE AS VARCHAR(20) CHARACTER SET OCTETS) AS VARCHAR(20) CHARACTER SET WIN1252)) AS TELEFONE
      FROM MARCACAO M
      WHERE M.MAR_CODIGO = ?
    `, [codigo]);

    if (!agendamento) {
      return res.status(404).json({
        success: false,
        error: 'Agendamento não encontrado.'
      });
    }


    await queryDB(`
      UPDATE MARCACAO
         SET MAR_LIGOU = 40
       WHERE MAR_CODIGO = ?
    `, [codigo]);

    console.log(`[REENVIO] Status resetado para agendamento ${codigo} - ${agendamento.nome_paciente} - ${agendamento.telefone} - Status anterior: ${agendamento.mar_ligou}`);

    return res.status(200).json({
      success: true,
      message: 'Status resetado com sucesso. A mensagem será reenviada no próximo ciclo ou você pode forçar o reenvio imediato.',
      dados: {
        codigo: agendamento.mar_codigo,
        paciente: agendamento.nome_paciente,
        telefone: agendamento.telefone,
        data_agendamento: agendamento.mar_data,
        status_anterior: agendamento.mar_ligou,
        status_atual: 40,
        observacao: 'Reenvio permitido independente do status anterior ou data do agendamento'
      }
    });

  } catch (err) {
    console.error(`Erro ao resetar status do agendamento ${codigo}:`, err.message);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar solicitação.'
    });
  }
}

async function getConfirmedWithValidSend(req, res) {
  try {
    const {
      data_inicio,
      data_fim,
      page = 1,
      limit = 50,
      search
    } = req.query;

    const dataFim = data_fim || new Date().toISOString().split('T')[0];
    const dataInicio = data_inicio || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereConditions = [
      `M.MAR_LIGOU = 41`,
      `M.MAR_DATA BETWEEN CAST('${dataInicio}' AS DATE) AND CAST('${dataFim}' AS DATE)`,
      `EXISTS (
        SELECT 1 FROM MARCACAO M2
        WHERE M2.MAR_CODIGO = M.MAR_CODIGO
          AND M2.MAR_LIGOU = 44
          AND M2.MAR_DATA = M.MAR_DATA
      )`
    ];

    if (search) {
      whereConditions.push(`(
        UPPER(TRIM(CAST(CAST(M.MAR_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252))) LIKE UPPER('%${search}%')
        OR CAST(M.MAR_CODIGO AS VARCHAR) LIKE '%${search}%'
        OR TRIM(CAST(CAST(M.MAR_TELEFONE AS VARCHAR(20) CHARACTER SET OCTETS) AS VARCHAR(20) CHARACTER SET WIN1252)) LIKE '%${search}%'
      )`);
    }

    const whereClause = whereConditions.join(' AND ');

    const query = `
      SELECT FIRST ${limit} SKIP ${offset}
        M.MAR_CODIGO,
        M.MAR_DATA,
        TRIM(CAST(CAST(M.MAR_HORA AS VARCHAR(5) CHARACTER SET OCTETS) AS VARCHAR(5) CHARACTER SET WIN1252)) AS MAR_HORA,
        TRIM(CAST(CAST(M.MAR_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS NOME_PACIENTE,
        TRIM(CAST(CAST(M.MAR_TELEFONE AS VARCHAR(20) CHARACTER SET OCTETS) AS VARCHAR(20) CHARACTER SET WIN1252)) AS TELEFONE,
        M.MAR_LIGOU,
        TRIM(CAST(CAST(DC.MED_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS MEDICO_NOME,
        TRIM(CAST(CAST(L.LOC_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS LOCAL_NOME,
        TRIM(CAST(CAST(E.ESP_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS ESPECIALIDADE_NOME
      FROM MARCACAO M
      LEFT JOIN MEDICO DC ON DC.MED_CODIGO = M.MAR_MEDICO
      LEFT JOIN LOCAL L ON L.LOC_CODIGO = M.MAR_LOCAL
      LEFT JOIN ESPECIALIDADE E ON E.ESP_CODIGO = M.MAR_ESP
      WHERE ${whereClause}
      ORDER BY M.MAR_DATA DESC, M.MAR_HORA DESC
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM MARCACAO M
      WHERE ${whereClause}
    `;

    const [result, countResult] = await Promise.all([
      queryDB(query),
      queryDB(countQuery)
    ]);

    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / parseInt(limit));

    const mapearStatus = (status) => {
      const statusMap = {
        41: 'Confirmado',
        42: 'Cancelado',
        43: 'Remarcado',
        44: 'Enviado',
        0: 'Agendado',
        1: 'Confirmado',
        40: 'WhatsApp',
        null: 'Pendente'
      };
      return statusMap[status] || 'Desconhecido';
    };

    const formatted = result.map(conf => ({
      codigo: conf.mar_codigo,
      data: conf.mar_data.toISOString().split('T')[0],
      hora: conf.mar_hora || '',
      paciente: conf.nome_paciente || 'Nome não informado',
      telefone: conf.telefone || '',
      status: conf.mar_ligou,
      status_texto: mapearStatus(conf.mar_ligou),
      medico: conf.medico_nome || '',
      local: conf.local_nome || '',
      especialidade: conf.especialidade_nome || ''
    }));

    res.json({
      success: true,
      data: {
        confirmations: formatted,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total: parseInt(total),
          total_pages: totalPages,
          has_next: parseInt(page) < totalPages,
          has_prev: parseInt(page) > 1
        },
        filtros: {
          data_inicio: dataInicio,
          data_fim: dataFim,
          search
        }
      }
    });

  } catch (error) {
    console.error('Erro ao obter confirmações validadas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno ao obter confirmações validadas'
    });
  }
}


module.exports = {
  getMetrics,
  getConfirmations,
  getCharts,
  getProcedures,
  resetStatusAgendamento,
  getConfirmedWithValidSend
};


