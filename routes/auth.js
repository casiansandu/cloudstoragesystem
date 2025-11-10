
const express = require('express')
const registerController = require('../controllers/registerController')
const loginController = require('../controllers/loginController')
const logoutController = require('../controllers/logoutController')
const authMiddleware = require('../middleware/authMiddleware')
const noAuthMiddleware = require('../middleware/noAuthMiddleware')
const router = express.Router()

router.post('/register', noAuthMiddleware, registerController)
router.post('/login', noAuthMiddleware, loginController)
router.post('/logout', authMiddleware, logoutController)

module.exports = router