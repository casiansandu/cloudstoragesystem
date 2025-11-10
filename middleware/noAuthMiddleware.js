const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('../config/config')

async function noAuthMiddleware(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
        return next()
    }

    try {
        jwt.verify(token, JWT_SECRET)
        return res.status(403).json({ error: 'Already logged in' })
    } 
    catch {
        next()
    }
}

module.exports = noAuthMiddleware
