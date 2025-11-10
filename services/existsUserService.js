

const db = require('../db/db')


async function existsUserService(username) {

    const user = await db.oneOrNone('SELECT * from users where username = $1', [username])

    if (user) {
        return true
    }
    return false

}

module.exports = existsUserService