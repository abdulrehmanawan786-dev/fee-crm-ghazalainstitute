// Run this once to create your admin login:
//   node utils/seedAdmin.js <username> <password> [role]
// Examples:
//   node utils/seedAdmin.js admin "MyStrongPassword123!"
//   node utils/seedAdmin.js agent1 "AnotherPassword456!" agent
//
// role defaults to "admin" if not given. Valid roles: admin, agent.
// Run it again with a different password any time to reset that username's password.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seedAdmin() {
  const [, , username, password, role = 'admin'] = process.argv;

  if (!username || !password) {
    console.error('Usage: node utils/seedAdmin.js <username> <password> [role]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }
  if (!['admin', 'agent'].includes(role)) {
    console.error('Role must be "admin" or "agent".');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await pool.query(
      `INSERT INTO admins (username, password_hash, role) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE password_hash = ?, role = ?`,
      [username, passwordHash, role, passwordHash, role]
    );
    console.log(`Account "${username}" (role: ${role}) created/updated successfully.`);
  } catch (err) {
    console.error('Failed to create account:', err.message);
  } finally {
    await pool.end();
  }
}

seedAdmin();
