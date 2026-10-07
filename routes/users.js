const express = require('express');
const pool = require('../db');
const {hashPassword, verifyPassword} = require('../auth');
const router = express.Router();

router.post('/register', async (req, res) => {
    const {name, email, password} = req.body;
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string'){
        return res.status(400).json({error: 'Invalid input.'});
    }
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
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
    if (typeof email !== 'string' || typeof password !== 'string'){
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
        console.log('user row:', userRow[0]);
        res.json({user_id: userRow[0].user_id, role: userRow[0].role})
    }
    catch (error){
        console.error('Login Error: ', error);
        res.status(500).json({error: 'Account Login Failed'});
    }
});

module.exports = router;