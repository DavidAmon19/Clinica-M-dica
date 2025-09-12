const router = require('express').Router();
const controller = require('../controllers/cancelarController');

router.put('/cancelar', controller.cancelar);

module.exports = router;