const router = require('express').Router();
const controller = require('../controllers/convenioController');

router.get('/', controller.listarTodos);
router.get('/search', controller.search);
router.get('/:id', controller.listarPorId);

module.exports = router;
