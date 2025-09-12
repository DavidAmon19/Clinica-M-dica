const { queryDB } = require('../utils/db');

function onlyDigits(s) {
  return (s || '').replace(/\D/g, '');
}

async function getByCpf(cpfRaw) {
  const cpf = onlyDigits(cpfRaw);

  const sql = `
    SELECT
      PAC_CODIGO,
      TRIM(TRAILING FROM
        CAST(CAST(PAC_NOME AS VARCHAR(120) CHARACTER SET OCTETS)
             AS VARCHAR(120) CHARACTER SET WIN1252)
      ) AS PAC_NOME,
      TRIM(TRAILING FROM
        CAST(CAST(PAC_DOC AS VARCHAR(20) CHARACTER SET OCTETS)
             AS VARCHAR(20) CHARACTER SET WIN1252)
      ) AS PAC_CPF,
      TRIM(TRAILING FROM
        CAST(CAST(PAC_CELULAR AS VARCHAR(20) CHARACTER SET OCTETS)
             AS VARCHAR(20) CHARACTER SET WIN1252)
      ) AS CELULAR
    FROM PACIENTE
    WHERE REPLACE(REPLACE(REPLACE(PAC_CPF, '.', ''), '-', ''), ' ', '') = ?
       OR PAC_DOC = ?
    ROWS 1
  `;
  const rows = await queryDB(sql, [cpf, cpf]);
  return rows[0] || null;
}

module.exports = { getByCpf };
