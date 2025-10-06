const express = require('express');
const router = express.Router();
const { 
  getMetrics, 
  getConfirmations, 
  getCharts, 
  getProcedures,
  resetStatusAgendamento,
  getConfirmedWithValidSend 
} = require('../controllers/dashboarController');

router.get('/metrics', getMetrics);

router.get('/confirmations', getConfirmations);

router.get('/confirmations/validadas', getConfirmedWithValidSend);


router.get('/charts', getCharts);

router.get('/procedures', getProcedures);

router.post('/reset-status', resetStatusAgendamento);

module.exports = router;