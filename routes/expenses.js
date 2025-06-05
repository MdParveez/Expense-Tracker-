const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

// 🔐 Protect all routes with authentication
router.use(authMiddleware);
const sendSMS = require('../utils/sendSMS');

// 🧾 GET expenses for logged-in user
router.get('/', async (req, res) => {
    try {
        console.log('Fetching expenses for user ID:', req.user.id);
        const result = await pool.query(
            'SELECT * FROM expenses WHERE user_id = $1 ORDER BY date DESC',
            [req.user.id]
        );
        console.log(`Found ${result.rows.length} expenses`);
        res.json(result.rows);
    } catch (err) {
        console.error('Error in GET /expenses:', err.message);
        res.status(500).send('Server Error');
    }
});

// ➕ POST a new expense for logged-in user
router.post('/', async (req, res) => {
    const { title, amount, category, date, note } = req.body;
    console.log('Adding new expense:', { title, amount, category, date });
    
    try {
        const result = await pool.query(
            'INSERT INTO expenses (title, amount, category, date, note, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [title, amount, category, date, note, req.user.id]
        );
        
        console.log('Expense added successfully, ID:', result.rows[0].id);
        
       
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error in POST /expenses:', err);
        res.status(500).send('Server Error');
    }
});

// ❌ DELETE an expense by ID (only if owned by user)
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    console.log('Deleting expense ID:', id);
    
    try {
        const result = await pool.query(
            'DELETE FROM expenses WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );
        
        if (result.rowCount === 0) {
            console.log('Expense not found or not authorized');
            return res.status(404).send('Expense not found or not authorized');
        }
        
        console.log('Expense deleted successfully');
        res.status(204).send();
    } catch (err) {
        console.error('Error in DELETE /expenses/:id:', err.message);
        res.status(500).send('Server Error');
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { title, amount, category, date, note } = req.body;
    console.log('Updating expense ID:', id);
    
    try {
        const result = await pool.query(
            'UPDATE expenses SET title = $1, amount = $2, category = $3, date = $4, note = $5 WHERE id = $6 AND user_id = $7 RETURNING *',
            [title, amount, category, date, note, id, req.user.id]
        );
        
        if (result.rows.length === 0) {
            console.log('Expense not found or not authorized for update');
            return res.status(404).send('Expense not found or not authorized');
        }
        
        console.log('Expense updated successfully');
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error in PUT /expenses/:id:', err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;