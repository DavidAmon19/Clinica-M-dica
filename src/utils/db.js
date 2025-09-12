const pool = require('../config/firebird');

function queryDB(sql, params = []) {
    return new Promise((resolve, reject) => {
        pool.get((err, db) => {
            if (err) return reject(err);
            db.query(sql, params, (qErr, result) => {
                db.detach();
                if (qErr) return reject(qErr);
                resolve(result || []);
            });
        });
    });
}

function getConnection() {
    return new Promise((resolve, reject) => {
        pool.get((err, db) => (err ? reject(err) : resolve(db)));
    })
}

module.exports = { queryDB, getConnection };
