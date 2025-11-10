
const loginService = require('../services/loginService')

async function loginController(req, res) {
    try {
        const { username, password } = req.body

        if (!username || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        else {
            const user = await loginService({username, password})

            return res.status(200).json({ message: 'User login successfully', user })
        }

    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
}

module.exports = loginController