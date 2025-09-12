const Firebird = require('node-firebird');
require('dotenv').config();

const options = {
    host: process.env.FB_HOST,
    port: Number(process.env.FB_PORT),
    database: process.env.FB_DATABASE,
    user: process.env.FB_USER,
    password: process.env.FB_PASSWORD,
    lowercase_keys: true,
    pageSize: 4096,
    charset: 'UTF8'
};

const pool = Firebird.pool(10, options);
module.exports = pool;
