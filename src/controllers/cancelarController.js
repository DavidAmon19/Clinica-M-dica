const service = require('../services/cancelarService');

const cancelar = async (req, res) => {
  try {
    const { id, motivo } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Campo "id" é obrigatório.' });

    const out = await service.cancelar(Number(id), motivo);
    res.status(200).json({ message: 'Agendamento cancelado com sucesso.', ...out });
  } catch (e) {
    console.error('cancelar:cancelar', e);
    res.status(400).json({ error: e.message || 'Erro ao cancelar agendamento.' });
  }
};

module.exports = { cancelar };