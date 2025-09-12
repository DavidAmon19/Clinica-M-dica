const router = require('express').Router();
const controller = require('../controllers/localController');

router.get('/', controller.listar);

module.exports = router;
