const verifyJWT = require('../services/verifyJWT')

async function verifyAuthMiddleware(req, res, next) {
    
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token' })

  try {
    const { username } = await verifyJWT(token)

    req.user = username
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid session' })
  }

}

module.exports = verifyAuthMiddleware
