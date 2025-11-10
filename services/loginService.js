
const {compare_passwords} = require('../utils/password')
const db = require("../db/db");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require('../config/config') 

async function loginService({ username, password }) {
    const user = await db.oneOrNone('SELECT * from users where username = $1', [username])
    
    if (user) {
        const passwords_match = await compare_passwords(password, user.password_hash)
        
        if (passwords_match) {

            const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
                expiresIn: "1h",
            });
            
            await db.none('INSERT into sessions VALUES($1, $2)', [username, token])
            
            return {username, token}
        }
        else {
            throw new Error('Invalid password')
        }
    }
    else {
        throw new Error('Username not registered')
    }
}

module.exports = loginService