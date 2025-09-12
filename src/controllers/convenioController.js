const service = require('../services/convenioService');
const { parsePagination } = require('../utils/pagination');

const listarTodos = async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const [data, total] = await Promise.all([
      service.getAllPaginated({ pageSize, offset }),
      service.countAll()
    ]);
    res.status(200).json({
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    });
  } catch (e) {
    console.error('convenio:listarTodos', e);
    res.status(500).json({ error: 'Erro ao buscar convênios.' });
  }
};

const listarPorId = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    const item = await service.getById(id);
    if (!item) return res.status(404).json({ error: 'Convênio não encontrado.' });
    res.status(200).json(item);
  } catch (e) {
    console.error('convenio:listarPorId', e);
    res.status(500).json({ error: 'Erro ao buscar convênio.' });
  }
};

const search = async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const q = (req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'Parâmetro q é obrigatório' });

    const data = await service.searchByName(q, { pageSize, offset });
    res.status(200).json({ data, meta: { page, pageSize, q } });
  } catch (e) {
    console.error('convenio:search', e);
    res.status(500).json({ error: 'Erro na busca de convênios.' });
  }
};

module.exports = { listarTodos, listarPorId, search };
