const { queryDB } = require('../utils/db');

async function listAll() {
  const sql = `
    SELECT
      L.LOC_CODIGO,
      TRIM(TRAILING FROM
        CAST(CAST(L.LOC_NOME AS VARCHAR(100) CHARACTER SET OCTETS)
             AS VARCHAR(100) CHARACTER SET WIN1252)
      ) AS LOC_NOME,
      TRIM(TRAILING FROM
        CAST(CAST(L.LOC_ENDERECO AS VARCHAR(500) CHARACTER SET OCTETS)
             AS VARCHAR(500) CHARACTER SET WIN1252)
      ) AS LOC_ENDERECO
    FROM LOCAL L
    ORDER BY L.LOC_CODIGO
  `;
  return queryDB(sql);
}

module.exports = { listAll };
