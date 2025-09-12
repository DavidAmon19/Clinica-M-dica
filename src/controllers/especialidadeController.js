const service = require('../services/especialidadeService');
const {  parsePagination } = require('../utils/pagination');

const listarTodos = async (req, res) => {
  try {

    if (req.query.convenio) {
      const idConv = Number(req.query.convenio);
      if (Number.isNaN(idConv)) return res.status(400).json({ error: 'convenio inválido.' });
      const data = await service.getByConvenio(idConv);
      return res.status(200).json({ data, meta: { filteredBy: { convenio: idConv } } });
    }

    const { page, pageSize, offset} = parsePagination(req.query);
    const [data, total] = await Promise.all([
      service.getAllPaginated({pageSize,offset}),
      service.countAll()
    ]);
    res.status(200).json({
      data,
      meta: {page,pageSize,total,totalPages: Math.ceil(total / pageSize)}
    });
  } catch (e) {
    console.error('especialidade:listarTodos', e);
    res.status(500).json({ error: 'Erro ao buscar especialidades.' });
  }
};

const listarPorId = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    const dado = await service.getById(id);
    if (!dado) return res.status(404).json({ error: 'Especialidade não encontrada.' });

    res.status(200).json(dado);
  } catch (e) {
    console.error('especialidade:listarPorId', e);
    res.status(500).json({ error: 'Erro ao buscar especialidade.' });
  }
};

const search = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'Parâmetro q é obrigatório' });
    const { page, pageSize, offset } = parsePagination(req.query);
    const data = await service.searchByName(q, { pageSize, offset });
    res.status(200).json({ data, meta: { page, pageSize, q } });
  } catch (e) {
    console.error('especialidade:search', e);
    res.status(500).json({ error: 'Erro na busca de especialidades.' });
  }
};
module.exports = { listarTodos, listarPorId, search };
