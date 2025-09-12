const router = require('express').Router();
const medicoController = require('../controllers/medicoController');

router.get('/', medicoController.listarTodos);
router.get('/search', medicoController.search);
router.get('/:id', medicoController.listarPorId);

module.exports = router;
