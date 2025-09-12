const medicoService = require('../services/medicoService');
const { parsePagination } = require('../utils/pagination');

const listarTodos = async (req, res) => {
  try {

    const conv = req.query.convenio ? Number(req.query.convenio) : null;
    const esp = req.query.especialidade ? Number(req.query.especialidade) : null;


    if (conv && esp) {
      const data = await service.getByConvenioEspecialidade(conv, esp);
      return res.status(200).json({ data, meta: { filteredBy: { convenio: conv, especialidade: esp } } });
    }

    const { page, pageSize, offset } = parsePagination(req.query);
    const [data, total] = await Promise.all([
      medicoService.getAllPaginated({ page, pageSize, offset }),
      medicoService.countAll(),
    ]);

    res.status(200).json({
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Erro listarTodos(médicos):', error);
    res.status(500).json({ error: 'Erro ao buscar médicos.' });
  }
};

const listarPorId = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    const medico = await medicoService.getById(id);
    if (!medico) return res.status(404).json({ error: 'Médico não encontrado.' });

    res.status(200).json(medico);
  } catch (error) {
    console.error('Erro listarPorId(médicos):', error);
    res.status(500).json({ error: 'Erro ao buscar médico por ID.' });
  }
};

const search = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'Parâmetro q é obrigatório' });

    const { page, pageSize, offset } = parsePagination(req.query);
    const convenio = req.query.convenio ? Number(req.query.convenio) : null;
    const especialidade = req.query.especialidade ? Number(req.query.especialidade) : null;

    const data = await service.searchByName(q, { pageSize, offset, convenio, especialidade });
    res.status(200).json({ data, meta: { page, pageSize, q, filteredBy: { convenio, especialidade } } });
  } catch (e) {
    console.error('medico:search', e);
    res.status(500).json({ error: 'Erro na busca de médicos.' });
  }
};

module.exports = { listarTodos, listarPorId, search };
