// middleware/adminMiddleware.js
const pool = require('../db');

/**
 * Middleware to check if user has admin privileges
 * Must be used after the auth middleware that sets req.user
 */
const adminMiddleware = async (req, res, next) => {
    try {
        // Make sure we have a user from the auth middleware
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Check if the user has admin rights in the database
        const result = await pool.query(
            'SELECT is_admin FROM users WHERE id = $1',
            [req.user.id]
        );

        // If no user found or not an admin
        if (result.rows.length === 0 || !result.rows[0].is_admin) {
            return res.status(403).json({ 
                message: 'Admin privileges required for this operation'
            });
        }

        // User is an admin, proceed
        next();
    } catch (err) {
        console.error('Admin verification error:', err);
        res.status(500).json({ message: 'Server error during admin verification' });
    }
};

module.exports = adminMiddleware;