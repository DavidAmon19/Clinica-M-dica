const router = require("express").Router();
const controller = require("../controllers/marcacaoController");

router.get("/marcacoes", controller.listar);

module.exports = router;
