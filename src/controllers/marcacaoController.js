const service = require("../services/marcacaoService");

console.log("RODANDO A PARTIR DE:", __dirname);


const listar = async (req, res) => {
  try {
    const { dataInicial, dataFinal } = req.query;

    const marcacoes = await service.listarMarcacoes({
      dataInicial: dataInicial || null,
      dataFinal: dataFinal || null
    });

    res.status(200).json({
      ok: true,
      total: marcacoes.length,
      data: marcacoes
    });
  } catch (e) {
    console.error("marcacao:listar", e);
    res.status(500).json({ error: "Erro ao buscar marcações." });
  }
};

module.exports = {
  listar
};
