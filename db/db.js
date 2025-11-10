
const pgp = require('pg-promise')();
const { DB_NAME, DB_USERNAME, DB_PASSWORD } = require('../config/config')

const db = pgp({
    host: 'localhost',
    port: 5432,
    database: DB_NAME,
    user: DB_USERNAME,
    password: DB_PASSWORD
});

module.exports = db;
