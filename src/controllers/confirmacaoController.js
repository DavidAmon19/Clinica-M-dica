const { queryDB } = require('../utils/db');

async function confirmarPresenca(req, res) {
  const mar_codigo = req.body.codigo;
  
  if (!mar_codigo) {
    return res.status(400).json({ error: 'Código da marcação é obrigatório.' });
  }

  try {
    const [marcacao] = await queryDB(`
      SELECT
        M.MAR_CODIGO,
        M.MAR_HORA,
        M.MAR_ESP,
        M.MAR_LIGOU,
        TRIM(CAST(CAST(DC.MED_NOME AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS MEDICO_NOME,
        TRIM(CAST(CAST(L.LOC_NOME  AS VARCHAR(120) CHARACTER SET OCTETS) AS VARCHAR(120) CHARACTER SET WIN1252)) AS LOCAL_NOME
      FROM MARCACAO M
      LEFT JOIN MEDICO DC ON DC.MED_CODIGO = M.MAR_MEDICO
      LEFT JOIN LOCAL  L  ON L.LOC_CODIGO = M.MAR_LOCAL
      WHERE M.MAR_CODIGO = ?
    `, [mar_codigo]);

    if (!marcacao) {
      return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }

    if (marcacao.mar_ligou === 0) {
      const retorno = {
        hora: Buffer.isBuffer(marcacao.mar_hora)
          ? marcacao.mar_hora.toString('utf8')
          : (marcacao.mar_hora || ''),
        endereco: marcacao.local_nome || 'Endereço não disponível'
      };

      if (marcacao.mar_esp !== 36 && marcacao.medico_nome) {
        retorno.medico = marcacao.medico_nome;
      }

      return res.status(200).json({
        success: true,
        message: 'Sua presença já havia sido confirmada anteriormente! Obrigado',
        ja_confirmado: true,
        dados: retorno
      });
    }

    await queryDB(`
      UPDATE MARCACAO
         SET MAR_LIGOU = 0
       WHERE MAR_CODIGO = ?
    `, [mar_codigo]);

    const retorno = {
      hora: Buffer.isBuffer(marcacao.mar_hora)
        ? marcacao.mar_hora.toString('utf8')
        : (marcacao.mar_hora || ''),
      endereco: marcacao.local_nome || 'Endereço não disponível'
    };

    if (marcacao.mar_esp !== 36 && marcacao.medico_nome) {
      retorno.medico = marcacao.medico_nome;
    }

    return res.status(200).json({
      success: true,
      message: 'Sua presença foi confirmada com sucesso! Obrigado',
      dados: retorno,
      debug: {
        status_anterior: marcacao.mar_ligou,
        status_atual: 0
      }
    });

  } catch (err) {
    console.error('Erro ao confirmar presença:', err.message);
    return res.status(500).json({ error: 'Erro interno ao processar confirmação.' });
  }
}

module.exports = { confirmarPresenca };