 const { Pool } = require('pg');
 require('dotenv').config();

 const pool = new Pool({
     user: process.env.DB_USER,
     host: process.env.DB_HOST,
     database: process.env.DB_NAME,
     password: process.env.DB_PASSWORD,
     port: process.env.DB_PORT,
});

// module.exports = pool;

//const { Pool } = require('pg');
//require('dotenv').config();

//const pool = new Pool({
 // user: process.env.DB_USER,
 // password: process.env.DB_PASSWORD,
 // host: process.env.DB_HOST,
 // port: process.env.DB_PORT,
 // database: process.env.DB_NAME,
 // ssl: {
 //   require: process.env.DB_SSL === 'require',
 //   rejectUnauthorized: false
 // }
//});

// Test the connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('Database connected successfully at:', res.rows[0].now);
  }
});

module.exports = pool;