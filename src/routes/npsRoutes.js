const express = require('express');
const controller = require('../controllers/npsContoller');

const router = express.Router();

router.get('/nps/atendimento', controller.buscarAtendimentoPorTelefone);

module.exports = router;
