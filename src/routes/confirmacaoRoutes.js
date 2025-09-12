const express = require('express');
const router = express.Router();
const { confirmarPresenca } = require('../controllers/confirmacaoController');

router.post('/confirmar', confirmarPresenca);

module.exports = router;
