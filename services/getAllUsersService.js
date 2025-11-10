
const db = require("../db/db");

async function getAllUsersService() {
    const users = await db.multi('SELECT * from users')
    return users
}

module.exports = getAllUsersService