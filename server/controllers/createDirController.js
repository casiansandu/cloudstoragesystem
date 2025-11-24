
const verifyAuthMiddleware = require('../middleware/authMiddleware')
const checkFolderExistsMiddleware = require('../middleware/checkFolderExistsMW')
const jwt = require('jsonwebtoken')
const fs = require('node:fs').promises
const { FILESYSTEM_ROOT } = require('../config/config')


async function createDirController(req, res) {
    
    const usernameSpace = `/${req.user}`
    const folderPath = req.body.folderPath
    try {
        await fs.mkdir(FILESYSTEM_ROOT + usernameSpace + folderPath, { recursive: false })
    } 
    catch (error) {
        console.error(error)
        return res.status(400).json({ error: error.message })
    }

    return res.status(200).json({ message: `Successfully created directory ${folderPath}` })
    
    
}

module.exports = createDirController