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
function loginVerification(req, res, next){
    if (!req.session.user) return res.status(401).json({error: 'Must be logged in.'});
    next();
}
function roleVerification(...roles){
    return (req, res, next) =>{
        if (!req.session.user) return res.status(401).json({error: 'Must be logged in.'});
        if (!roles.includes(req.session.user.role)) return res.status(403).json({error: 'Not allowed.'});
        next();
    }
}
module.exports = {
    hashPassword,
    verifyPassword,
    loginVerification,
    roleVerification,
};