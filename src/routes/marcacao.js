const router = require('express').Router();
const controller = require('../controllers/marcacaoController');

router.put('/:id', controller.marcar);
router.post('/marcacao', controller.marcar);
router.put('/marcacao/:id/confirmar', controller.confirmar);
router.put('/marcacao/:id/cancelar', controller.cancelar);
router.put('/marcacao/:id/reagendar', controller.reagendar);

module.exports = router;