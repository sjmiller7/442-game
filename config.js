require('dotenv').config();
const config = {
    db: {
        host: 'localhost',
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_DB,
        connectTimeout: 60000
    }
};
module.exports = config;