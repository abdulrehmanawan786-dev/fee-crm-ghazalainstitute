const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Simple in-memory brute-force guard: 5 failed attempts per username locks it out
// for 15 minutes. Resets on server restart — fine for a single-admin internal tool,
// but if you need it to survive restarts, move this into a database table instead.
const failedAttempts = new Map(); // username -> { count, lockedUntil }
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? fwd.split(',')[0].trim() : req.socket.remoteAddress) || 'unknown';
}

async function logLogin(username, success, req) {
  try {
    await pool.query(
      'INSERT INTO login_history (username, success, ip_address, user_agent) VALUES (?,?,?,?)',
      [username, success, clientIp(req), (req.headers['user-agent'] || '').slice(0, 255)]
    );
  } catch (err) {
    console.error('Could not log login attempt:', err.message);
  }
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const record = failedAttempts.get(username);
  if (record && record.lockedUntil && record.lockedUntil > Date.now()) {
    const minutesLeft = Math.ceil((record.lockedUntil - Date.now()) / 60000);
    return res.status(429).json({ error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM admins WHERE username = ?', [username]);
    const admin = rows[0];

    const valid = admin && (await bcrypt.compare(password, admin.password_hash));
    if (!valid) {
      const next = record ? record.count + 1 : 1;
      failedAttempts.set(username, {
        count: next,
        lockedUntil: next >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : null,
      });
      await logLogin(username, false, req);
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    failedAttempts.delete(username);
    await logLogin(username, true, req);
    const token = jwt.sign({ sub: admin.id, username: admin.username, role: admin.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '12h',
    });
    res.json({ token, username: admin.username, role: admin.role });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Change your own password. Requires the current password to confirm it's really you.
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }

  try {
    const [[admin]] = await pool.query('SELECT * FROM admins WHERE id = ?', [req.admin.sub]);
    if (!admin) return res.status(404).json({ error: 'Account not found.' });

    const valid = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE admins SET password_hash = ? WHERE id = ?', [newHash, admin.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Could not change password.' });
  }
});

// Last 50 login attempts for the currently logged-in username.
router.get('/login-history', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT username, success, ip_address, user_agent, created_at FROM login_history WHERE username = ? ORDER BY created_at DESC LIMIT 50',
      [req.admin.username]
    );
    res.json(rows);
  } catch (err) {
    console.error('Login history error:', err);
    res.status(500).json({ error: 'Could not load login history.' });
  }
});

module.exports = router;
