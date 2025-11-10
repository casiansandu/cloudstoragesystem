
const createUserService = require('../services/createUserService')
const createUserFileSpace = require('../services/createUserFileSpaceService')

async function registerController(req, res) {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
          return res.status(400).json({ message: 'All fields are required' });
        }
        else {
          const user = await createUserService({ username, email, password });
          const folder = await createUserFileSpace({username})

          return res.status(201).json({ message: 'User registered successfully', user, folder });
        }

    } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = registerController