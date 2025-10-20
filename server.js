const express = require('express');
const cors = require('cors');
require('dotenv').config();
require('./src/jobs/reminderJob');
const confirmacaoRoutes = require('./src/routes/confirmacaoRoutes');

const app = express();
app.use(cors());
app.use(express.json());


const medicoRoutes = require('./src/routes/medico');              
const convenioRoutes = require('./src/routes/convenio');
const especialidadeRoutes = require('./src/routes/especialidade');
const forticsWebhook = require('./src/routes/forticsWebhook');
const dashboardRoutes = require('./src/routes/dashboardRoutes');

app.use('/api', express.json({limit: '2mb'}), forticsWebhook);
app.use('/api/medico', medicoRoutes);
app.use('/api/convenio', convenioRoutes);
app.use('/api/especialidade', especialidadeRoutes);    
app.use('/api', confirmacaoRoutes);
app.use('/api/dashboard', dashboardRoutes);


app.get('/', (_req, res) => res.send('API Clínica rodando'));

app.listen(3000, '0.0.0.0', () => {
  console.log('Servidor ouvindo externamente na porta 3000');
});