const { queryDB } = require('../utils/db');

async function getByConvenioMedico(idConv, idMedico) {
    const sql = `
    SELECT *
    FROM SERVICOS_MEDICO_CONVENIO
    WHERE CONVENIO_ID = ?
      AND MEDICO_ID = ?
  `;
    return queryDB(sql, [idConv, idMedico]);
}

module.exports = { getByConvenioMedico };