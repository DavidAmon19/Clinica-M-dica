const pool = require('../config/firebird');
const { queryDB } = require('../utils/db');

async function existeConflito({ medico, data, hora, local = null }) {
  const params = [medico, data, hora];
  const whereLocal = local != null ? 'AND M.MAR_LOCAL = ?' : '';
  if (whereLocal) params.push(local);

  const sql = `
    SELECT FIRST 1 M.MAR_CODIGO
    FROM MARCACAO M
    WHERE M.MAR_MEDICO = ?
      AND M.MAR_DATA   = ?
      AND TRIM(M.MAR_HORA) = ?
      ${whereLocal}
  `;
  const rows = await queryDB(sql, params);
  return !!rows[0];
}

async function marcar({
  medico, paciente, data, hora, local = null,
  convenio = null, proc = null,
  nome = null, cpf = null, cel = null, email = null,
  usuario = 'API', origem = 'API'
}) {
  const already = await existeConflito({ medico, data, hora, local });
  if (already) {
    const err = new Error('Horário indisponível');
    err.code = 'CONFLICT';
    throw err;
  }

  return new Promise((resolve, reject) => {
    pool.get((err, db) => {
      if (err) return reject(err);

      db.transaction(db.ISOLATION_READ_COMMITTED, (tErr, tr) => {
        if (tErr) { db.detach(); return reject(tErr); }

        const sql = `
          INSERT INTO MARCACAO (
            MAR_MEDICO, MAR_PACIENTE, MAR_DATA, MAR_HORA, MAR_LOCAL,
            MAR_CONVENIO, MAR_PROC, MAR_NOME, MAR_CPF, MAR_CEL,
            MAR_EMAIL, MAR_CADASTRO, MAR_USUARIO, MAR_ORIGEM
          ) VALUES (?,?,?,?,?,
                    ?,?,?,?,?,?,
                    CURRENT_TIMESTAMP, ?, ?)
          RETURNING MAR_CODIGO
        `;
        const params = [
          medico, paciente, data, hora, local,
          convenio, proc, nome, cpf, cel,
          email, usuario, origem
        ];

        tr.query(sql, params, (qErr, rows) => {
          if (qErr) { tr.rollback(); db.detach(); return reject(qErr); }
          tr.commit((cErr) => {
            db.detach();
            if (cErr) return reject(cErr);
            resolve(rows?.[0]?.mar_codigo);
          });
        });
      });
    });
  });
}

async function confirmarMarcacao(id) {
  const sql = `UPDATE MARCACAO SET MAR_CONFIRMACAO = 'S' WHERE MAR_CODIGO = ?`;
  await queryDB(sql, [id]);
  return true;
}

async function cancelarMarcacao(id) {
  const sql = `UPDATE MARCACAO SET MAR_CANCELADO = 'S' WHERE MAR_CODIGO = ?`;
  await queryDB(sql, [id]);
  return true;
}

async function reagendarMarcacao(id, data, hora) {
  const sql = `UPDATE MARCACAO SET MAR_DATA = ?, MAR_HORA = ? WHERE MAR_CODIGO = ?`;
  await queryDB(sql, [data, hora, id]);
  return true;
}

module.exports = {
  marcar,
  existeConflito,
  confirmarMarcacao,
  cancelarMarcacao,
  reagendarMarcacao
};
