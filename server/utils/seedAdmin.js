// Run this once to create your admin login:
//   node utils/seedAdmin.js <username> <password>
// Example:
//   node utils/seedAdmin.js admin "MyStrongPassword123!"
//
// Run it again with a different password any time to reset that username's password.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seedAdmin() {
  const [, , username, password] = process.argv;

  if (!username || !password) {
    console.error('Usage: node utils/seedAdmin.js <username> <password>');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await pool.query(
      `INSERT INTO admins (username, password_hash) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE password_hash = ?`,
      [username, passwordHash, passwordHash]
    );
    console.log(`Admin "${username}" created/updated successfully.`);
  } catch (err) {
    console.error('Failed to create admin:', err.message);
  } finally {
    await pool.end();
  }
}

seedAdmin();
