const express = require('express');
const router = express.Router();
const { 
  getMetrics, 
  getConfirmations, 
  getCharts, 
  getProcedures,
  resetStatusAgendamento 
} = require('../controllers/dashboarController');

router.get('/metrics', getMetrics);

router.get('/confirmations', getConfirmations);

router.get('/charts', getCharts);

router.get('/procedures', getProcedures);

router.post('/reset-status', resetStatusAgendamento);

module.exports = router;