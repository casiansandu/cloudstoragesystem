const path = require('path')
const fs = require('node:fs').promises
const { FILESYSTEM_ROOT } = require('../config/config')

async function checkFolderExists(req, res, next) {
  try {
    const username = req.user
    const { folderPath } = req.body

    if (!folderPath) {
      return res.status(400).json({ error: 'folderPath is required' })
    }

    const userSpace = `/${username}`

    const locationInUserSpace = path.join(userSpace, folderPath)

    const locationInFileSystem = path.join(FILESYSTEM_ROOT, locationInUserSpace)
    
    const folderParentDir = path.dirname(locationInFileSystem)

    try {
      const statParent = await fs.stat(folderParentDir)
      if (!statParent.isDirectory()) {
        return res.status(400).json({ error: `${path.dirname(folderPath)} is not a directory` })
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(400).json({ error: `${path.dirname(folderPath)} does not exist` })
      }
      return res.status(500).json({ error: 'Server error checking parent folder' })
    }

    try {
      const statFolder = await fs.stat(locationInFileSystem)
      if (statFolder.isDirectory()) {
        return res.status(400).json({ error: `Folder ${folderPath} already exists!` })
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        return res.status(500).json({ error: 'Server error checking folder' })
      }
    }

    next()
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Unexpected server error' })
  }
}

module.exports = checkFolderExists
