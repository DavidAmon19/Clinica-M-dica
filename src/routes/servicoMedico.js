const router = require('express').Router();
const controller = require('../controllers/servicoMedicoController');

router.get('/servico-medico/:id_conv/:id_medico', controller.listar);

module.exports = router;