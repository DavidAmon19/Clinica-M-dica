const express = require('express');
const cors = require('cors');
require('dotenv').config();
require('./src/jobs/npsreminderJob');

const app = express();
app.use(cors());
app.use(express.json());


