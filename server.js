const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

require('dotenv').config();
app.use(express.json());

// Add cache control headers to prevent caching
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Serve static files with cache busting
app.use(express.static('public', {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/ml', require('./routes/ml'));
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
