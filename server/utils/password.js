const bcrypt = require('bcrypt')
const salt_rounds = 10

async function hash_password(password) {
    const hash = await bcrypt.hash(password, salt_rounds);
    return hash
}

async function compare_passwords(password, hashed_password){
    const result = await bcrypt.compare(password, hashed_password)
    return result
}

module.exports.hash_password = hash_password
module.exports.compare_passwords = compare_passwords