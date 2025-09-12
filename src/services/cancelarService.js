const { queryDB } = require('../utils/db');


async function cancelar(idMarcacao, motivo) {
  const ag = await queryDB(`SELECT ID, HORARIO_ID FROM AGENDAMENTO WHERE ID = ?`, [idMarcacao]);
  if (!ag[0]) throw new Error('Marcação não encontrada');

  await queryDB(`UPDATE AGENDAMENTO SET STATUS = 'CANCELADO', MOTIVO = ? WHERE ID = ?`, [motivo || null, idMarcacao]);

  await queryDB(`UPDATE HORARIOS SET LIVRE = 1 WHERE ID = ?`, [ag[0].HORARIO_ID]);

  return { ok: true };
}

module.exports = { cancelar };