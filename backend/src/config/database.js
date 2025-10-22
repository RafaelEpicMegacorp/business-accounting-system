const { Pool } = require('pg');

// Support both DATABASE_URL (production) and individual DB_ variables (local)
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      // Connection pool settings for Railway PostgreSQL
      max: 5,                     // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,   // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return error after 10 seconds if connection can't be established
      allowExitOnIdle: false      // Don't let node exit while clients are checked out
    }
  : {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      // Same pool settings for local development
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: false
    };

const pool = new Pool(poolConfig);

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully');
  }
});

module.exports = pool;
