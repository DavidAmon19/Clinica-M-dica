const router = require('express').Router();
const controller = require('../controllers/gradeController');

router.get('/grade-config/:medico', controller.listarConfig);
router.get('/grade/:medico/:data', controller.listarPorMedicoData);      
router.get('/grade-agenda/:medico/:dias', controller.listarPorMedicoDias); 

module.exports = router;