
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).send('Access denied');

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, 'secretkey'); // use env in production
        req.user = decoded; // { id: ... }
        next();
    } catch (err) {
        res.status(403).send('Invalid token');
    }
};

module.exports = authMiddleware;
