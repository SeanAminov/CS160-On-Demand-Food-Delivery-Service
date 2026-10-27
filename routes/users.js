const express = require('express');
const pool = require('../db');
const {hashPassword, verifyPassword, loginVerification} = require('../auth');
const {checkAddress, splitAddress} = require('../address');
const router = express.Router();

router.post('/register', async (req, res) => {
    const {name, email, password, confirmPassword} = req.body || {};
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || typeof confirmPassword !== 'string' || !name.trim() || !email.trim() || !password || !confirmPassword){
        return res.status(400).json({error: 'Invalid input.'});
    }
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    // Letters (accents are fine), spaces, periods, apostrophes, and hyphens.
    // This keeps HTML out of the employee pages that show customer names.
    const nameRegex = /^[\p{L} .'-]+$/u;
    if (normalizedName.length > 100){
        return res.status(400).json({error: 'Name must be 100 characters or less.'})
    }
    if (!nameRegex.test(normalizedName)){
        return res.status(400).json({error: 'Name can only use letters, spaces, periods, apostrophes, and hyphens.'})
    }
    if (normalizedEmail.length > 255){
        return res.status(400).json({error: 'Email must be 255 characters or less.'})
    }
    if (password !== confirmPassword){
        return res.status(400).json({error: 'Passwords do not match.'})
    }
    if (password.length < 8){
        return res.status(400).json({error: 'Password must be at least 8 characters.'})
    }
    if (password.length > 72){
        return res.status(400).json({error: 'Password must be 72 characters or less.'})
    }
    if (!emailRegex.test(normalizedEmail)){
        return res.status(400).json({error: 'Invalid email format.'})
    }
    try {
        const [exists] = await pool.query(
            'SELECT user_id FROM Users WHERE email = ?', [normalizedEmail]
        );
        if (exists.length > 0){
            return res.status(409).json({error: 'Email already in use.'})        
        }
        const hashedPassword = await hashPassword(password);
        await pool.query(
            'INSERT INTO Users (name, email, password_hash) VALUES (?, ?, ?)', [normalizedName, normalizedEmail, hashedPassword]

        );
        res.status(201).json({message: 'Account created.' })
    }
    catch(error){
        if (error.code === 'ER_DUP_ENTRY'){
            return res.status(409).json({error: 'Email already in use.'})
        }
        console.error('Registering Error: ', error);
        res.status(500).json({error: 'Account Creation Failed'});
    }
});

router.post('/login', async (req, res) => {
    const {email, password} = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password){
        return res.status(400).json({error: 'Invalid input.'});
    }
    const normalizedEmail = email.trim().toLowerCase();
    try{
        const [userRow] = await pool.query(
            'SELECT user_id, name, password_hash, role FROM Users WHERE email = ?', [normalizedEmail]
        );
        if ((userRow.length === 0) || !(await verifyPassword(password, userRow[0].password_hash))){
            return res.status(401).json({error: 'Incorrect email or password'});
        }
        const user = userRow[0];
        req.session.regenerate((err) => {
            if (err){
                return res.status(500).json({error: 'Login Failed'});
            }
            req.session.user = {
                user_id: user.user_id,
                name: user.name,
                role: user.role
            };
            req.session.save((err) =>{
                if (err){
                    return res.status(500).json({error: 'Login Failed'});
                }
                res.json({user_id: user.user_id, role: user.role})
            });
        });
    }
    catch (error){
        console.error('Login Error: ', error);
        res.status(500).json({error: 'Account Login Failed'});
    }
});

router.post('/logout', (req, res)=> {
    req.session.destroy((err) => {
        if (err){
            return res.status(500).json({error: 'Failed to logout.'})
        }
        res.clearCookie('connect.sid');
        return res.json({message: 'Logged Out'})
    });
});

router.get('/profile', (req, res) =>{
    if (!req.session.user){
        return res.status(401).send('Please log in first.');
    }
    const userID = req.session.user.user_id;
    const name = req.session.user.name;
    const role = req.session.user.role;
    res.json({userID, name, role});
});

// The delivery address saved on the logged in user's account
router.get('/profile/address', loginVerification, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT address FROM Users WHERE user_id = ?', [req.session.user.user_id]
        );
        // Both are null if they haven't saved one yet. parts fills in the boxes on the page.
        const address = rows.length > 0 ? rows[0].address : null;
        res.json({address, parts: splitAddress(address)});
    }
    catch(error){
        console.error('Address Error: ', error);
        res.status(500).json({error: 'Could not load your address.'});
    }
});

// Saves a new delivery address, as long as it's one we deliver to
router.put('/profile/address', loginVerification, async (req, res) => {
    const location = await checkAddress(req.body);
    if (location.error){
        return res.status(location.status).json({error: location.error});
    }
    try {
        await pool.query(
            'UPDATE Users SET address = ? WHERE user_id = ?', [location.address, req.session.user.user_id]
        );
        res.json({message: 'Address saved.', address: location.address, parts: location.parts});
    }
    catch(error){
        console.error('Address Error: ', error);
        res.status(500).json({error: 'Could not save your address.'});
    }
});

module.exports = router;