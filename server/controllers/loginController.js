
const loginService = require('../services/loginService')

async function loginController(req, res) {
    try {
        const { username, password } = req.body

        if (!username || !password) {
            return res.status(400).json({ message: 'All fields are required', success: false});
        }
        else {
            const {username: user, token} = await loginService({username, password})
            
            res.cookie("token", token, {
                httpOnly: true,
                secure: false,
                sameSite: "lax",
                maxAge: 3600000
            });

            return res.status(200).json({ message: 'User login successfully', user: user, success: true})
        }

    } catch (error) {
        return res.status(500).json({ message: error.message, success: false })
    }
}

module.exports = loginController