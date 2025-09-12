const service = require('../services/localService');

const listar = async (_req, res) => {
  try {
    const data = await service.listAll();
    res.status(200).json({ data });
  } catch (e) {
    console.error('local:listar', e);
    res.status(500).json({ error: 'Erro ao listar locais.' });
  }
};

module.exports = { listar };
