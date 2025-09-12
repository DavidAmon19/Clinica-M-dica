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

    await queryDB(`
      UPDATE MARCACAO
         SET MAR_CHECKIN = 1
       WHERE MAR_CODIGO = ?
    `, [mar_codigo]);

    const retorno = {
      hora: Buffer.isBuffer(marcacao.mar_hora)
        ? marcacao.mar_hora.toString('utf8')
        : (marcacao.mar_hora || ''),
      endereco: marcacao.local_nome || 'Endereço não disponível'
    };


    if (marcacao.mar_esp !== 36) {
      retorno.medico = marcacao.medico_nome || 'Médico não informado';
    }

    return res.status(200).json({
      success: true,
      message: '✅ Sua presença foi confirmada com sucesso! Obrigado 🙂',
      dados: retorno
    });

  } catch (err) {
    console.error('Erro ao confirmar presença:', err.message);
    return res.status(500).json({ error: 'Erro interno ao processar confirmação.' });
  }
}

module.exports = { confirmarPresenca };
