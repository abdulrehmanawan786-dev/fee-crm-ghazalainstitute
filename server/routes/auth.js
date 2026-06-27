cat > /var/www/ghazala-fee-crm/server/routes/auth.js << 'EOF'
// const { sendWhatsAppMessage } = require('../utils/whatsapp');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const failedAttempts = new Map();
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
    // await sendWhatsAppMessage(process.env.WHATSAPP_NUMBER, `Login alert`);
    const token = jwt.sign({ sub: admin.id, username: admin.username, role: admin.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '12h',
    });
    res.json({ token, username: admin.username, role: admin.role });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

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

router.post('/forgot-password', async (req, res) => {
  try {
    const [[admin]] = await pool.query('SELECT * FROM admins WHERE username = ?', ['admin']);
    if (!admin) return res.status(404).json({ error: 'Admin not found.' });

    const token = require('crypto').randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await pool.query(
      'INSERT INTO password_reset_tokens (admin_id, token, expires_at) VALUES (?, ?, ?)',
      [admin.id, token, expiresAt]
    );

    const resetLink = `${process.env.ALLOWED_ORIGIN}/reset-password?token=${token}`;
    // await sendWhatsAppMessage(process.env.WHATSAPP_NUMBER, `Reset link: ${resetLink}`);

    res.json({ success: true, message: 'Reset link WhatsApp par bhej diya gaya!' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Could not send reset link.' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required.' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  try {
    const [[record]] = await pool.query(
      'SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > NOW()',
      [token]
    );
    if (!record) return res.status(400).json({ error: 'Invalid or expired reset link.' });

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE admins SET password_hash = ? WHERE id = ?', [newHash, record.admin_id]);
    await pool.query('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', [record.id]);

    res.json({ success: true, message: 'Password successfully changed!' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Could not reset password.' });
  }
});

module.exports = router;
EOF
