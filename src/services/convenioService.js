const { queryDB } = require('../utils/db');


async function countAll() {
    const sql = `SELECT COUNT(*) AS total FROM CONVENIO`;
    const rows = await queryDB(sql);
    return rows?.[0]?.total ?? 0;
}

async function getAllPaginated({ pageSize, offset }) {
  const sql = `
    SELECT FIRST ${pageSize} SKIP ${offset}
      CON_CODIGO,
      TRIM(TRAILING FROM
        CAST(CAST(CON_NOME AS VARCHAR(100) CHARACTER SET OCTETS)
             AS VARCHAR(100) CHARACTER SET WIN1252)
      ) AS DESCRICAO,
      TRIM(TRAILING FROM
        CAST(CAST(CON_TIPO AS VARCHAR(50) CHARACTER SET OCTETS)
             AS VARCHAR(50) CHARACTER SET WIN1252)
      ) AS TIPO,
      TRIM(TRAILING FROM
        CAST(CAST(CON_BLOQ AS VARCHAR(50) CHARACTER SET OCTETS)
             AS VARCHAR(50) CHARACTER SET WIN1252)
      ) AS ATIVO  
    FROM CONVENIO
    ORDER BY CON_CODIGO
  `;
  return queryDB(sql);
}


async function getById(id) {
  const sql = `
    SELECT
      CON_CODIGO,
      TRIM(TRAILING FROM
        CAST(CAST(CON_NOME AS VARCHAR(100) CHARACTER SET OCTETS)
             AS VARCHAR(100) CHARACTER SET WIN1252)
      ) AS DESCRICAO,
      TRIM(TRAILING FROM
        CAST(CAST(CON_TIPO AS VARCHAR(50) CHARACTER SET OCTETS)
             AS VARCHAR(50) CHARACTER SET WIN1252)
      ) AS TIPO,
      TRIM(TRAILING FROM
        CAST(CAST(CON_BLOQ AS VARCHAR(50) CHARACTER SET OCTETS)
             AS VARCHAR(50) CHARACTER SET WIN1252)
      ) AS ATIVO 
    FROM CONVENIO
    WHERE CON_CODIGO = ?
  `;
  const rows = await queryDB(sql, [id]);
  return rows[0] || null;
}


async function searchByName(q, { pageSize, offset }) {
  const sql = `
    SELECT FIRST ${pageSize} SKIP ${offset}
      CON_CODIGO,
      TRIM(TRAILING FROM
        CAST(CAST(CON_NOME AS VARCHAR(100) CHARACTER SET OCTETS)
             AS VARCHAR(100) CHARACTER SET WIN1252)
      ) AS CONV_DESCRICAO
    FROM CONVENIO
    WHERE UPPER(CON_NOME) LIKE UPPER('%' || ? || '%')
    ORDER BY CONV_DESCRICAO
  `;
  return queryDB(sql, [q]);
}


module.exports = { countAll, getAllPaginated, getById, searchByName };