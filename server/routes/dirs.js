

const router = require('express').Router()
const createDirController = require('../controllers/createDirController')
const authMiddleware = require('../middleware/authMiddleware')
const checkFolderExists = require('../middleware/checkFolderExistsMW')

router.post('/create', authMiddleware, checkFolderExists, createDirController)

module.exports = router