const { hash_password } = require("../utils/password");
const db = require("../db/db");

async function createUserService({ username, email, password }) {
    const check_username = await db.oneOrNone(
        'SELECT * from users where username = $1',[username]
    );
    const check_email = await db.oneOrNone(
        'SELECT * from users where email = $1',[email]
    );

    if (check_username) {
        throw new Error(`User with username ${username} already exists.`);
    } else if (check_email) {
        throw new Error(`User with email ${email} already exists.`);
    }

    const hashed_passwd = await hash_password(password)

    await db.none("INSERT into users(username, email, password_hash) VALUES($1, $2, $3)", [username, email, hashed_passwd]);
    
    return {username, email}
}

module.exports = createUserService;
