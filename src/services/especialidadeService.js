const { queryDB } = require('../utils/db');

async function countAll() {
  const sql = `SELECT COUNT(*) AS total FROM ESPECIALIDADE`;
  const rows = await queryDB(sql);
  return rows?.[0]?.total ?? 0;
}

async function getAllPaginated({pageSize, offset}) {
  const sql = `
  SELECT FIRST ${pageSize} SKIP ${offset}
      ESP_CODIGO,
      TRIM(TRAILING FROM
        CAST(CAST(ESP_NOME AS VARCHAR(100) CHARACTER SET OCTETS)
             AS VARCHAR(100) CHARACTER SET WIN1252)
      ) AS DESCRICAO,
      TRIM(TRAILING FROM
        CAST(CAST(ESP_CBO AS VARCHAR(50) CHARACTER SET OCTETS)
             AS VARCHAR(50) CHARACTER SET WIN1252)
      ) AS Profissional,
      TRIM(TRAILING FROM
        CAST(CAST(ESP_ATIVO AS VARCHAR(50) CHARACTER SET OCTETS)
             AS VARCHAR(50) CHARACTER SET WIN1252)
      ) AS ATIVO  
    FROM ESPECIALIDADE
    ORDER BY ESP_CODIGO
  `;
  return queryDB(sql);
}

async function getById(id) {
  const sql = `
  SELECT
      ESP_CODIGO,
      TRIM(TRAILING FROM
        CAST(CAST(ESP_NOME AS VARCHAR(100) CHARACTER SET OCTETS)
             AS VARCHAR(100) CHARACTER SET WIN1252)
      ) AS DESCRICAO,
      TRIM(TRAILING FROM
        CAST(CAST(ESP_CBO AS VARCHAR(50) CHARACTER SET OCTETS)
             AS VARCHAR(50) CHARACTER SET WIN1252)
      ) AS Profissional,
      TRIM(TRAILING FROM
        CAST(CAST(ESP_ATIVO AS VARCHAR(50) CHARACTER SET OCTETS)
             AS VARCHAR(50) CHARACTER SET WIN1252)
      ) AS ATIVO  
    FROM ESPECIALIDADE
    WHERE ESP_CODIGO = ?`;
  const rows = await queryDB(sql, [id]);
  return rows[0] || null;
}

async function getByConvenio(idConv) {
  const sql = `
    SELECT DISTINCT
      E.ESP_CODIGO,
      TRIM(TRAILING FROM
        CAST(CAST(E.ESP_NOME AS VARCHAR(100) CHARACTER SET OCTETS)
             AS VARCHAR(100) CHARACTER SET WIN1252)
      ) AS ESP_NOME
    FROM ESPECIALIDADE E
    JOIN MEDICO M ON M.MED_ESPEC = E.ESP_CODIGO
    JOIN SERVICOS_MEDICO_CONVENIO SMC ON SMC.MEDICO_ID = M.MED_CODIGO
    WHERE SMC.CONVENIO_ID = ?
    ORDER BY ESP_NOME
  `;
  return queryDB(sql, [idConv]);
}

async function searchByName(q, { pageSize, offset }) {
  const sql = `
    SELECT FIRST ${pageSize} SKIP ${offset}
      E.ESP_CODIGO,
      TRIM(TRAILING FROM
        CAST(CAST(E.ESP_NOME AS VARCHAR(100) CHARACTER SET OCTETS)
             AS VARCHAR(100) CHARACTER SET WIN1252)
      ) AS ESP_NOME
    FROM ESPECIALIDADE E
    WHERE UPPER(E.ESP_NOME) LIKE UPPER('%' || ? || '%')
    ORDER BY ESP_NOME
  `;
  return queryDB(sql, [q]);
}
module.exports = { countAll,getAllPaginated, getById, getByConvenio,searchByName };
