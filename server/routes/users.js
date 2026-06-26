const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.admin.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
}

router.get('/', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, username, role, created_at FROM admins ORDER BY created_at');
    res.json(rows);
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Could not load team members.' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (!['admin', 'agent'].includes(role)) return res.status(400).json({ error: 'Role must be admin or agent.' });

  try {
    const hash = await bcrypt.hash(password, 12);
    await pool.query('INSERT INTO admins (username, password_hash, role) VALUES (?,?,?)', [username.trim(), hash, role]);
    res.status(201).json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That username already exists.' });
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Could not create account.' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.admin.sub) return res.status(400).json({ error: 'You cannot delete the account you are currently logged in as.' });

  try {
    const [[target]] = await pool.query('SELECT * FROM admins WHERE id = ?', [id]);
    if (!target) return res.status(404).json({ error: 'Account not found.' });

    if (target.role === 'admin') {
      const [[{ c }]] = await pool.query("SELECT COUNT(*) AS c FROM admins WHERE role='admin'");
      if (c <= 1) return res.status(400).json({ error: 'Cannot delete the last remaining admin account.' });
    }

    await pool.query('DELETE FROM admins WHERE id = ?', [id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Could not delete account.' });
  }
});

module.exports = router;
