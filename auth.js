const bcrypt = require('bcrypt');
const salt_rounds = 10;

async function hashPassword(password){

    const hashedPassword = await bcrypt.hash(password, salt_rounds);
    return hashedPassword;
}

async function verifyPassword(password, hash){
    const result = await bcrypt.compare(password, hash);
    return result;
}

module.exports = {
    hashPassword,
    verifyPassword,
};