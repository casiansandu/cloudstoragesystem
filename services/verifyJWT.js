
const db = require('../db/db')
const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('../config/config')

async function verifyJWT(token) {
    
    try {
        const user = await db.one('SELECT username from sessions where token = $1', [token])
    }
    catch {
        throw new Error('User not logged in')
    }
    
    let payload
    try {
        payload = jwt.verify(token, JWT_SECRET)
    } 
    catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' })
        } else {
            return res.status(401).json({ error: 'Invalid token' })
        }
    }

    return {id: payload.id, username: payload.username}
}

module.exports = verifyJWT