const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { sendWhatsAppMessage } = require('../utils/whatsapp');

const router = express.Router();

async function sendReminders(sentBy, sentByRole) {
  try {
    // Pending students
    const [pending] = await pool.query(`
      SELECT s.id, s.name, s.phone, s.course, s.mode
      FROM students s
      WHERE s.status = 'Active'
      AND (
        SELECT COUNT(*) FROM payments p 
        WHERE p.student_id = s.id AND p.paid_date IS NULL
      ) > 0
    `);

    // Overdue students
    const [overdue] = await pool.query(`
      SELECT s.id, s.name, s.phone, s.course, s.mode
      FROM students s
      WHERE s.status = 'Active'
      AND (
        SELECT COUNT(*) FROM payments p 
        WHERE p.student_id = s.id AND p.paid_date IS NULL AND p.due_date < CURDATE()
      ) > 0
    `);

    const allStudents = [...pending, ...overdue].filter(
      (s, i, arr) => arr.findIndex(x => x.id === s.id) === i
    );

    let sent = 0;
    for (const student of allStudents) {
      if (!student.phone) continue;

      const message = `🔔 *Ghazala Institute — Fee Reminder*\n\nAssalam o Alaikum ${student.name}!\n\nAapki fee pending hai.\n📚 Course: ${student.course} (${student.mode})\n\nBrahe karam jald se jald fee jama karwayein.\n\nShukriya! 🙏\nGhazala Institute`;

      await sendWhatsAppMessage(student.phone, message);

      await pool.query(
        'INSERT INTO reminder_logs (student_id, sent_by, sent_by_role, message_type) VALUES (?, ?, ?, ?)',
        [student.id, sentBy, sentByRole, 'fee_reminder']
      );

      sent++;
    }

    return { sent, total: allStudents.length };
  } catch (err) {
    console.error('Reminder error:', err);
    throw err;
  }
}

// Manual reminder — Admin or Agent
router.post('/send', requireAuth, async (req, res) => {
  try {
    const result = await sendReminders(req.admin.username, req.admin.role);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: 'Could not send reminders.' });
  }
});

// Reminder logs
router.get('/logs', requireAuth, async (req, res) => {
  try {
    const [logs] = await pool.query(`
      SELECT rl.*, s.name as student_name, s.phone
      FROM reminder_logs rl
      JOIN students s ON s.id = rl.student_id
      ORDER BY rl.created_at DESC
      LIMIT 100
    `);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Could not load logs.' });
  }
});

module.exports = { router, sendReminders };
