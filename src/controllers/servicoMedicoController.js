const service = require('../services/servicoMedicoService');

const listar = async (req, res) => {
  try {
    const id_conv = Number(req.params.id_conv);
    const id_medico = Number(req.params.id_medico);
    if (Number.isNaN(id_conv) || Number.isNaN(id_medico)) {
      return res.status(400).json({ error: 'Parâmetros inválidos (id_conv, id_medico).' });
    }
    const rows = await service.getByConvenioMedico(id_conv, id_medico);
    res.status(200).json(rows);
  } catch (e) {
    console.error('servicoMedico:listar', e);
    res.status(500).json({ error: 'Erro ao listar serviços por convênio/médico.' });
  }
};

module.exports = { listar };