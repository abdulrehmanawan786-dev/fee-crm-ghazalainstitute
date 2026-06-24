const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const router = express.Router();

// Simple in-memory brute-force guard: 5 failed attempts per username locks it out
// for 15 minutes. Resets on server restart — fine for a single-admin internal tool,
// but if you need it to survive restarts, move this into a database table instead.
const failedAttempts = new Map(); // username -> { count, lockedUntil }
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

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
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    failedAttempts.delete(username);
    const token = jwt.sign({ sub: admin.id, username: admin.username }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '12h',
    });
    res.json({ token, username: admin.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

module.exports = router;
