
const getAllUsers = require('../services/getAllUsersService')

async function getAllUsersController(req, res) {
    try {
        
        const users = await getAllUsers()
        return res.status(200).json({users})

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

module.exports = getAllUsersController