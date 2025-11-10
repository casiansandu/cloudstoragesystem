
const fs = require('node:fs').promises

async function createUserFileSpace({ username }) {
  const folderName = `./FileSpace/${username}/`

  await fs.mkdir(folderName, { recursive: true })

  return folderName
}

module.exports = createUserFileSpace
