const express = require('express');
const router = express.Router();
const { processarAcaoWhatsapp } = require('../controllers/confirmacaoController');

router.post('/confirmar', (req, res) => {
  req.body.acao = 'confirmar';
  return processarAcaoWhatsapp(req, res);
});

router.post('/cancelar', (req, res) => {
  req.body.acao = 'cancelar';
  return processarAcaoWhatsapp(req, res);
});

router.post('/reagendar', (req, res) => {
  req.body.acao = 'reagendar';
  return processarAcaoWhatsapp(req, res);
});

module.exports = router;