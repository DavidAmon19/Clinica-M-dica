const { queryDB } = require('../utils/db');

async function getAtendimentoByTelefone(telefone) {

  const telefoneNumeros = telefone.replace(/\D/g, '');

  const sql = `
    SELECT
        M.MOV_CODIGO,
        M.MOV_DATA,

        TRIM(CAST(CAST(P.PAC_NOME AS VARCHAR(120) CHARACTER SET OCTETS)
            AS VARCHAR(120) CHARACTER SET WIN1252)) AS PACIENTE_NOME,

        TRIM(CAST(CAST(P.PAC_CELULAR AS VARCHAR(20) CHARACTER SET OCTETS)
            AS VARCHAR(20) CHARACTER SET WIN1252)) AS PACIENTE_CELULAR,

        TRIM(CAST(CAST(D.MED_NOME AS VARCHAR(120) CHARACTER SET OCTETS)
            AS VARCHAR(120) CHARACTER SET WIN1252)) AS MEDICO_NOME,

        TRIM(CAST(CAST(E.ESP_NOME AS VARCHAR(120) CHARACTER SET OCTETS)
            AS VARCHAR(120) CHARACTER SET WIN1252)) AS ESPECIALIDADE_NOME

    FROM MOV M
    INNER JOIN PACIENTE P ON P.PAC_CODIGO = M.MOV_PACIENTE
    LEFT JOIN MEDICO D ON D.MED_CODIGO = M.MOV_MEDICO
    LEFT JOIN ESPECIALIDADE E ON E.ESP_CODIGO = M.MOV_ESP

    WHERE
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(P.PAC_CELULAR, '(', ''),
          ')', ''),
        '-', ''),
      ' ', '') = ?

    ORDER BY M.MOV_DATA DESC
    ROWS 1
  `;

  const rows = await queryDB(sql, [telefoneNumeros]);
  return rows[0] || null;
}


module.exports = {
  getAtendimentoByTelefone
};
