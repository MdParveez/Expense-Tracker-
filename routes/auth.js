const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authMiddleware=require('../middleware/authMiddleware.js')
// Register user
router.post('/register', async (req, res) => {
    const { name, email, phone, income, password, confirmPassword } = req.body;

    if (password !== confirmPassword) return res.status(400).send("Passwords don't match");

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (name, email, phone, income, password) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email',
            [name, email, phone, income, hashedPassword]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            res.status(400).send('Email already registered');
        }

        else {
            console.error(err);
            res.status(500).send('Server error');
        }
    }
});

// Login user
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (result.rows.length === 0) return res.status(400).send('Invalid credentials');

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) return res.status(400).send('Invalid credentials');

        const token = jwt.sign({ id: user.id }, 'secretkey'); // In production, use env secret
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, income: user.income } });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, email, phone, income, is_admin FROM users WHERE id = $1',
            [req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching user info:', err);
        res.status(500).json({ message: 'Server error' });
    }


});


router.post('/fcm-token', authMiddleware, async (req, res) => {
  const { fcmToken } = req.body;
  const userId = req.user.id;
  
  try {
    await pool.query(
      'UPDATE users SET fcm_token = $1 WHERE id = $2',
      [fcmToken, userId]
    );
    
    res.status(200).json({ message: 'FCM token updated successfully' });
  } catch (err) {
    console.error('Error updating FCM token:', err);
    res.status(500).send('Server Error');
  }
});
module.exports = router;
