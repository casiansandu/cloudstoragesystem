
const db = require('../db/db')

async function logoutService(username) {

    await db.none('DELETE from sessions where username = $1', [username])

    return {username}
    
}

module.exports = logoutService