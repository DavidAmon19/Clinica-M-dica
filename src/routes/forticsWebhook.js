const router = require('express').Router();
const { queryDB } = require('../utils/db');

router.post('/fortics/webhook', async (req, res) => {
  try {
    const body = req.body || {};
    const from = (body.platform_id || '').replace(/\D/g,'');
    const text = (body.text || '').trim().toUpperCase();
    const token = body.context_id || body.token || null; 

    if (token) {
      if (text === '1' || text === 'SIM' || text === 'CONFIRMAR') {
        await queryDB(`
          UPDATE MARCACAO
             SET MAR_CONFIRMADO = 1,   -- ajuste conforme seu campo
                 MAR_DTCONF     = CURRENT_TIMESTAMP,
                 MAR_NOTIF_TOKEN = NULL
           WHERE MAR_NOTIF_TOKEN = ?
             AND (MAR_CANCELADO IS NULL OR MAR_CANCELADO = 0)
        `, [token]);
        return res.status(200).json({ ok: true, action: 'confirmado' });
      }
      if (text === '2' || text === 'REAGENDAR') {
        return res.status(200).json({ ok: true, action: 'reagendar' });
      }
      if (text === '3' || text === 'CANCELAR' || text === 'NAO' || text === 'NÃO') {
        await queryDB(`
          UPDATE MARCACAO
             SET MAR_CANCELADO = 1,    -- ajuste conforme seu campo
                 MAR_DTCANC    = CURRENT_TIMESTAMP,
                 MAR_MOTIVO    = 'Paciente respondeu CANCELAR via WhatsApp',
                 MAR_NOTIF_TOKEN = NULL
           WHERE MAR_NOTIF_TOKEN = ?
        `, [token]);
        return res.status(200).json({ ok: true, action: 'cancelado' });
      }
      return res.status(200).json({ ok: true, action: 'ignorado' });
    }


    if (text === '1' || text === 'SIM' || text === 'CONFIRMAR') {
      await queryDB(`
        UPDATE MARCACAO
           SET MAR_CONFIRMADO = 1,
               MAR_DTCONF = CURRENT_TIMESTAMP
         WHERE REGEXP_REPLACE(MAR_CEL, '\\D', '', 1, 1, 'i') LIKE ?
           AND MAR_DATA BETWEEN CURRENT_DATE AND (CURRENT_DATE + 3)
           AND (MAR_CANCELADO IS NULL OR MAR_CANCELADO = 0)
      `, [`%${from}`]);
      return res.status(200).json({ ok: true, action: 'confirmado' });
    }

    if (text === '3' || text === 'CANCELAR' || text === 'NAO' || text === 'NÃO') {
      await queryDB(`
        UPDATE MARCACAO
           SET MAR_CANCELADO = 1,
               MAR_DTCANC = CURRENT_TIMESTAMP,
               MAR_MOTIVO = 'Paciente respondeu CANCELAR via WhatsApp'
         WHERE REGEXP_REPLACE(MAR_CEL, '\\D', '', 1, 1, 'i') LIKE ?
           AND MAR_DATA BETWEEN CURRENT_DATE AND (CURRENT_DATE + 3)
      `, [`%${from}`]);
      return res.status(200).json({ ok: true, action: 'cancelado' });
    }

    res.status(200).json({ ok: true, action: 'ignorado' });
  } catch (e) {
    console.error('forticsWebhook', e);
    res.status(200).json({ ok: true });
  }
});

module.exports = router;
