const express = require('express');
const pool = require('../db');
const {loginVerification, roleVerification} = require('../auth');
const router = express.Router();

router.use(loginVerification, roleVerification('employee'));

router.get("/", (req, res) => {
    res.render("employee");
})

module.exports = router;


