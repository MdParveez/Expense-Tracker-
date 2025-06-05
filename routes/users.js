const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const verifyToken = require('../middleware/verifyToken');
const sendSMS = require('../utils/sendSMS');




// 📤 PUT: Update income and send notification
router.put('/update-income', verifyToken, async (req, res) => {
    const { income } = req.body;
    const userId = req.user.id;

    if (isNaN(income) || income < 0) {
        return res.status(400).json({ message: 'Invalid income value' });
    }

    try {
        const result = await pool.query(
            'UPDATE users SET income = $1 WHERE id = $2 RETURNING name, email, phone, income',
            [income, userId]
        );

        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 📲 Send SMS notification
        await sendSMS(user.phone, `📢 Your income has been updated to ₹${income}`);

        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

module.exports = router;
