// routes/categories.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Get all categories (for all users)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, type FROM categories ORDER BY type, name'
        );
        
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Add new category (admin only)
router.post('/', [authMiddleware, adminMiddleware], async (req, res) => {
    const { name, type } = req.body;
    
    try {
        const result = await pool.query(
            'INSERT INTO categories (name, type) VALUES ($1, $2) RETURNING *',
            [name, type]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        
        // Duplicate category error
        if (err.code === '23505') {
            return res.status(400).json({ msg: 'Category already exists' });
        }
        
        res.status(500).send('Server Error');
    }
});

// Update category (admin only)
router.put('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    const { id } = req.params;
    const { name, type } = req.body;
    
    try {
        const result = await pool.query(
            'UPDATE categories SET name = $1, type = $2 WHERE id = $3 RETURNING *',
            [name, type, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ msg: 'Category not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Delete category (admin only)
router.delete('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await pool.query(
            'DELETE FROM categories WHERE id = $1 RETURNING *',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ msg: 'Category not found' });
        }
        
        res.json({ msg: 'Category removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;