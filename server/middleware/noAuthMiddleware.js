const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('../config/config')

async function noAuthMiddleware(req, res, next) {
    const token = req.cookies.token

    if (!token) {
        return next()
    }

    try {
        jwt.verify(token, JWT_SECRET)
        return res.status(403).json({ message: 'Already logged in', success: false})
    } 
    catch {
        next()
    }
}

module.exports = noAuthMiddleware
