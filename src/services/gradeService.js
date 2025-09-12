const { queryDB } = require('../utils/db');

function weekdayName(dateISO) {
  const d = new Date(`${dateISO}T00:00:00`);
  const map = ['DOMINGO','SEGUNDA-FEIRA','TERÇA-FEIRA','QUARTA-FEIRA','QUINTA-FEIRA','SEXTA-FEIRA','SÁBADO'];
  return map[d.getDay()];
}
function toMinutes(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = String(hhmm).split(':').map(n => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}
function fromMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

async function getAgendaConfigByMedico(medicoId, local = null) {
  const params = [medicoId];
  const whereLocal = local != null ? 'AND A.AGE_LOCAL = ?' : '';
  if (whereLocal) params.push(local);

  const sql = `
  SELECT
    A.AGE_MEDICO,
    A.AGE_LOCAL,
    TRIM(TRAILING FROM
      CAST(CAST(A.AGE_INICIO AS VARCHAR(5) CHARACTER SET OCTETS)
           AS VARCHAR(5) CHARACTER SET WIN1252)
    ) AS AGE_INICIO,
    TRIM(TRAILING FROM
      CAST(CAST(A.AGE_FIM AS VARCHAR(5) CHARACTER SET OCTETS)
           AS VARCHAR(5) CHARACTER SET WIN1252)
    ) AS AGE_FIM,
    A.AGE_INT,
    TRIM(TRAILING FROM
      CAST(CAST(A.AGE_DIA AS VARCHAR(20) CHARACTER SET OCTETS)
           AS VARCHAR(20) CHARACTER SET WIN1252)
    ) AS AGE_DIA
  FROM AGENDA A
  WHERE A.AGE_MEDICO = ?
    ${whereLocal}
  ORDER BY A.AGE_DIA, A.AGE_INICIO
`;
  return queryDB(sql, params);
}

async function getOcupados(medicoId, dateISO, local = null) {
  const params = [medicoId, dateISO];
  const whereLocal = local != null ? 'AND M.MAR_LOCAL = ?' : '';
  if (whereLocal) params.push(local);

  const sql = `
    SELECT
      TRIM(TRAILING FROM
        CAST(CAST(M.MAR_HORA AS VARCHAR(10) CHARACTER SET OCTETS)
             AS VARCHAR(10) CHARACTER SET WIN1252)
      ) AS HORA
    FROM MARCACAO M
    WHERE M.MAR_MEDICO = ?
      AND M.MAR_DATA = ?
      ${whereLocal}
  `;
  const rows = await queryDB(sql, params);
  const set = new Set(rows.map(r => (r.hora || '').slice(0,5))); 
  return set;
}


async function getSlotsByMedicoData(medicoId, dateISO, local = null) {
  const agenda = await getAgendaConfigByMedico(medicoId, local);
  const dow = weekdayName(dateISO);
  const aplicaveis = agenda.filter(r => (r.age_dia || '').toUpperCase() === dow);

  const ocupados = await getOcupados(medicoId, dateISO, local);

  const slots = [];
  for (const r of aplicaveis) {
    const start = toMinutes(r.age_inicio);
    const end   = toMinutes(r.age_fim);
    const step  = Number(r.age_int) || 15;

    for (let m = start; m + step <= end; m += step) {
      const hhmm = fromMinutes(m);
      if (!ocupados.has(hhmm)) {
        slots.push({
          medico_id: medicoId,
          data: dateISO,
          hora: hhmm,
          local: r.age_local ?? null,
          fonte: 'AGENDA',
        });
      }
    }
  }
  return slots;
}

async function getSlotsByMedicoDias(medicoId, dias, local = null) {
  const out = [];
  const start = new Date();
  for (let i = 0; i < dias; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateISO = d.toISOString().slice(0,10);
    const slots = await getSlotsByMedicoData(medicoId, dateISO, local);
    if (slots.length) out.push({ data: dateISO, slots });
  }
  return out;
}

module.exports = {
  getAgendaConfigByMedico,
  getSlotsByMedicoData,
  getSlotsByMedicoDias,
};