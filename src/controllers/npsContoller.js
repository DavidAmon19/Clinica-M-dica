const service = require('../services/npsService');

const buscarAtendimentoPorTelefone = async (req, res) => {
  try {
    const { telefone } = req.query;

    if (!telefone) {
      return res.status(400).json({ error: 'Telefone é obrigatório' });
    }

    const atendimento = await service.getAtendimentoByTelefone(telefone);

    if (!atendimento) {
      return res.status(404).json({ error: 'Atendimento não encontrado' });
    }

    return res.json({
      ok: true,
      data: atendimento
    });

  } catch (err) {
    console.error('nps:buscarAtendimento', err);
    res.status(500).json({ error: 'Erro ao buscar atendimento' });
  }
};

module.exports = {
  buscarAtendimentoPorTelefone
};
