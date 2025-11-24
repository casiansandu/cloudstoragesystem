
const logoutService = require('../services/logoutService') 

async function logoutController(req, res) {
    try {
        const username = req.user

        if (username){
            const user = await logoutService(username)
            if (user) {
                return res.status(200).json({ message: 'Logged out successfully', user})
            }
            else {
                return res.status(400).json({ message : 'Error logging out'})
            }
        } else { 
            return res.status(400).json({ message: "Username required"})
        }
    }
    catch (error) {
        return res.status(500).json({ message : error.message})
    }
}

module.exports = logoutController