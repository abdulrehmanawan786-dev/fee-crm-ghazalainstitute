const express = require('express');
const pool = require('../config/db');

const router = express.Router();

router.get('/:studentId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM student_comments WHERE student_id = ? ORDER BY created_at DESC',
      [req.params.studentId]
    );
    res.json(rows);
  } catch (err) {
    console.error('List comments error:', err);
    res.status(500).json({ error: 'Could not load comments.' });
  }
});

router.post('/:studentId', async (req, res) => {
  const { comment } = req.body;
  if (!comment || !comment.trim()) return res.status(400).json({ error: 'Comment text is required.' });
  try {
    await pool.query(
      'INSERT INTO student_comments (student_id, comment_text, created_by) VALUES (?, ?, ?)',
      [req.params.studentId, comment.trim(), req.admin.username]
    );
    const [rows] = await pool.query(
      'SELECT * FROM student_comments WHERE student_id = ? ORDER BY created_at DESC',
      [req.params.studentId]
    );
    res.status(201).json(rows);
  } catch (err) {
    console.error('Add comment error:', err);
    res.status(500).json({ error: 'Could not save comment.' });
  }
});

router.delete('/comment/:commentId', async (req, res) => {
  try {
    await pool.query('DELETE FROM student_comments WHERE id = ?', [req.params.commentId]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ error: 'Could not delete comment.' });
  }
});

module.exports = router;
