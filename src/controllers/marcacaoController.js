const service = require('../services/marcacaoService');

const marcar = async (req, res) => {
  try {
    const idHorario = req.params.id; 
    const {
      medico, paciente, data, hora, local,
      convenio, proc, nome, cpf, cel, email,
      usuario, origem, idapp
    } = req.body;

    if (!medico || !data || !hora) {
      return res.status(400).json({ error: 'Campos obrigatórios: medico, data, hora.' });
    }

    const marId = await service.marcar({
      medico: Number(medico),
      paciente: paciente ? Number(paciente) : 0,
      data, hora, local: local ? Number(local) : null,
      convenio: convenio ? Number(convenio) : null,
      proc: proc ? Number(proc) : null,
      nome, cpf, cel, email,
      usuario: usuario || 'BOT_WHATSAPP',
      origem: idapp || 'BOT_WHATSAPP'
    });

    res.status(200).json({ ok: true, id: marId });
  } catch (e) {
    if (e.code === 'CONFLICT') return res.status(409).json({ error: e.message });
    console.error('marcacao:marcar', e);
    res.status(500).json({ error: 'Erro ao realizar marcação.' });
  }
};

const confirmar = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    await service.confirmarMarcacao(id);
    res.status(200).json({ ok: true, message: 'Agendamento confirmado.' });
  } catch (e) {
    console.error('marcacao:confirmar', e);
    res.status(500).json({ error: 'Erro ao confirmar agendamento.' });
  }
};

const cancelar = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    await service.cancelarMarcacao(id);
    res.status(200).json({ ok: true, message: 'Agendamento cancelado.' });
  } catch (e) {
    console.error('marcacao:cancelar', e);
    res.status(500).json({ error: 'Erro ao cancelar agendamento.' });
  }
};

const reagendar = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { data, hora } = req.body;

    if (Number.isNaN(id) || !data || !hora)
      return res.status(400).json({ error: 'Parâmetros inválidos.' });

    await service.reagendarMarcacao(id, data, hora);
    res.status(200).json({ ok: true, message: 'Agendamento reagendado.' });
  } catch (e) {
    console.error('marcacao:reagendar', e);
    res.status(500).json({ error: 'Erro ao reagendar agendamento.' });
  }
};

module.exports = {
  marcar,
  confirmar,
  cancelar,
  reagendar
};
