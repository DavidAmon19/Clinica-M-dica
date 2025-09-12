const service = require('../services/gradeService');

const listarConfig = async (req, res) => {
  try {
    const medico = Number(req.params.medico);
    if (Number.isNaN(medico)) return res.status(400).json({ error: 'medico inválido.' });
    const local = req.query.local ? Number(req.query.local) : null;
    const data = await service.getAgendaConfigByMedico(medico, local);
    res.status(200).json({ data, meta: { medico, local } });
  } catch (e) {
    console.error('grade:listarConfig', e);
    res.status(500).json({ error: 'Erro ao buscar configuração de agenda.' });
  }
};

const listarPorMedicoData = async (req, res) => {
  try {
    const medico = Number(req.params.medico);
    const data = req.params.data;
    if (Number.isNaN(medico) || !data) return res.status(400).json({ error: 'Parâmetros inválidos.' });
    const local = req.query.local ? Number(req.query.local) : null;
    const rows = await service.getSlotsByMedicoData(medico, data, local);
    res.status(200).json({ data: rows, meta: { medico, data, local } });
  } catch (e) {
    console.error('grade:porMedicoData', e);
    res.status(500).json({ error: 'Erro ao listar horários por médico/data.' });
  }
};

const listarPorMedicoDias = async (req, res) => {
  try {
    const medico = Number(req.params.medico);
    const dias = Number(req.params.dias);
    if (Number.isNaN(medico) || Number.isNaN(dias)) return res.status(400).json({ error: 'Parâmetros inválidos.' });
    const local = req.query.local ? Number(req.query.local) : null;
    const data = await service.getSlotsByMedicoDias(medico, dias, local);
    res.status(200).json({ data, meta: { medico, dias, local } });
  } catch (e) {
    console.error('grade:porMedicoDias', e);
    res.status(500).json({ error: 'Erro ao listar horários por médico/dias.' });
  }
};

module.exports = { listarConfig, listarPorMedicoData, listarPorMedicoDias };