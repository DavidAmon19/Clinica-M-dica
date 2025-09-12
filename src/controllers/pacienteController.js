const service = require('../services/pacienteService');

const buscarPorCpf = async (req, res) => {
  try {
    const { cpf } = req.params;
    if (!cpf) return res.status(400).json({ error: 'CPF é obrigatório.' });

    const paciente = await service.getByCpf(cpf);
    if (!paciente) return res.status(404).json({ error: 'Paciente não encontrado.' });

    res.status(200).json(paciente);
  } catch (e) {
    console.error('paciente:buscarPorCpf', e);
    res.status(500).json({ error: 'Erro ao buscar paciente por CPF.' });
  }
};

module.exports = { buscarPorCpf };
