const { queryDB } = require('../utils/db');

async function countAll() {
  const sql = `SELECT COUNT(*) AS total FROM MEDICO`;
  const rows = await queryDB(sql);
  return (rows?.[0]?.total) ?? 0;
}

async function getAllPaginated({ page, pageSize, offset }) {
  const sql = `
    SELECT FIRST ${pageSize} SKIP ${offset}
      MED_CODIGO,
      CAST(MED_NOME     AS VARCHAR(100) CHARACTER SET UTF8) AS MED_NOME,
      CAST(MED_APELIDO  AS VARCHAR(60)  CHARACTER SET UTF8) AS MED_APELIDO,
      MED_ESPEC,
      CAST(MED_CRM      AS VARCHAR(10)  CHARACTER SET UTF8) AS MED_CRM,
      MED_CRMUF,
      CAST(MED_CPF      AS VARCHAR(20)  CHARACTER SET UTF8) AS MED_CPF
    FROM MEDICO
    ORDER BY MED_CODIGO
  `;
  return queryDB(sql);
}

async function getById(id) {
  const sql = `
    SELECT
      MED_CODIGO,
      CAST(MED_NOME     AS VARCHAR(100) CHARACTER SET UTF8) AS MED_NOME,
      CAST(MED_APELIDO  AS VARCHAR(60)  CHARACTER SET UTF8) AS MED_APELIDO,
      MED_ESPEC,
      CAST(MED_CRM      AS VARCHAR(10)  CHARACTER SET UTF8) AS MED_CRM,
      MED_CRMUF,
      CAST(MED_CPF      AS VARCHAR(20)  CHARACTER SET UTF8) AS MED_CPF
    FROM MEDICO
    WHERE MED_CODIGO = ?
  `;
  const rows = await queryDB(sql, [id]);
  return rows[0] || null;
}

async function getByConvenioEspecialidade(idConv, idEsp) {
  const sql = `
    SELECT DISTINCT
      M.MED_CODIGO,
      TRIM(TRAILING FROM
        CAST(CAST(M.MED_NOME AS VARCHAR(100) CHARACTER SET OCTETS)
             AS VARCHAR(100) CHARACTER SET WIN1252)
      ) AS MED_NOME,
      M.MED_ESPEC
    FROM MEDICO M
    JOIN SERVICOS_MEDICO_CONVENIO SMC ON SMC.MEDICO_ID = M.MED_CODIGO
    WHERE SMC.CONVENIO_ID = ?
      AND M.MED_ESPEC = ?
    ORDER BY MED_NOME
  `;
  return queryDB(sql, [idConv, idEsp]);
}

async function searchByName(q, { pageSize, offset, convenio = null, especialidade = null }) {
  const params = [q];
  const filters = [`UPPER(M.MED_NOME) LIKE UPPER('%' || ? || '%')`];
  if (convenio)      { filters.push(`SMC.CONVENIO_ID = ?`); params.push(convenio); }
  if (especialidade) { filters.push(`M.MED_ESPEC = ?`);     params.push(especialidade); }
  const where = filters.join(' AND ');

  const sql = `
    SELECT FIRST ${pageSize} SKIP ${offset}
      M.MED_CODIGO,
      TRIM(TRAILING FROM
        CAST(CAST(M.MED_NOME AS VARCHAR(100) CHARACTER SET OCTETS)
             AS VARCHAR(100) CHARACTER SET WIN1252)
      ) AS MED_NOME,
      M.MED_ESPEC
    FROM MEDICO M
    LEFT JOIN SERVICOS_MEDICO_CONVENIO SMC ON SMC.MEDICO_ID = M.MED_CODIGO
    WHERE ${where}
    ORDER BY MED_NOME
  `;
  return queryDB(sql, params);
}

module.exports = {
  countAll,
  getAllPaginated,
  getById,
  getByConvenioEspecialidade,
  searchByName
};
