const router = require('express').Router();
const controller = require('../controllers/pacienteController');

router.get('/paciente-cpf/:cpf', controller.buscarPorCpf);

module.exports = router;
