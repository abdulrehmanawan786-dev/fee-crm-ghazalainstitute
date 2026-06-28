const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { sendWhatsAppMessage } = require('../utils/whatsapp');
const router = express.Router();

async function sendReminders(sentBy, sentByRole) {
  try {
    const [students] = await pool.query(`
      SELECT DISTINCT s.id, s.name, s.phone, s.course, s.mode, 
             p.amount, p.due_date, p.type
      FROM students s
      JOIN payments p ON p.student_id = s.id
      WHERE s.status = 'Active'
      AND s.remarks IS NULL
      AND p.paid_date IS NULL
      AND (
        MONTH(p.due_date) = MONTH(CURDATE()) AND YEAR(p.due_date) = YEAR(CURDATE())
        OR p.due_date < CURDATE()
      )
      ORDER BY p.due_date ASC
    `);

    let sent = 0;
    for (const student of students) {
      if (!student.phone) continue;

      const message = `Dear ${student.name},\n\nThis is a friendly reminder from Ghazala Institute regarding your upcoming fee payment.\n\n📚 Course: ${student.course} (${student.mode})\n💰 Amount Due: Rs. ${student.amount}\n📅 Due Date: ${student.due_date}\n\nKindly ensure your payment is submitted before the due date to avoid any inconvenience.\n\nFor any queries, please contact our administration.\n\nThank you for being a part of Ghazala Institute.\n\nWarm regards,\nGhazala Institute`;

      await sendWhatsAppMessage(student.phone, message);
      await pool.query(
        'INSERT INTO reminder_logs (student_id, sent_by, sent_by_role, message_type) VALUES (?, ?, ?, ?)',
        [student.id, sentBy, sentByRole, 'fee_reminder']
      );
      sent++;
    }
    return { sent, total: students.length };
  } catch (err) {
    console.error('Reminder error:', err);
    throw err;
  }
}
// Single student reminder — for one SPECIFIC payment only (registration, installment1,
// installment2, or lumpsum), never for every outstanding payment on the student.
router.post('/send/:studentId', requireAuth, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { type } = req.query;
    if (!type) return res.status(400).json({ error: 'Payment type is required.' });

    const [[student]] = await pool.query(`
      SELECT s.id, s.name, s.phone, s.course, s.mode, p.amount, p.due_date, p.type
      FROM students s
      JOIN payments p ON p.student_id = s.id
      WHERE s.id = ?
      AND p.type = ?
      AND p.paid_date IS NULL
    `, [studentId, type]);

    if (!student) return res.status(404).json({ error: 'No outstanding payment of this type found for this student.' });
    if (!student.phone) return res.status(400).json({ error: 'This student has no phone number on file.' });

    const message = `Dear ${student.name},\n\nThis is a friendly reminder from Ghazala Institute regarding your upcoming fee payment.\n\n📚 Course: ${student.course} (${student.mode})\n💰 Amount Due: Rs. ${student.amount}\n📅 Due Date: ${student.due_date}\n\nKindly ensure your payment is submitted before the due date to avoid any inconvenience.\n\nFor any queries, please contact our administration.\n\nThank you for being a part of Ghazala Institute.\n\nWarm regards,\nGhazala Institute`;
    await sendWhatsAppMessage(student.phone, message);
    await pool.query(
      'INSERT INTO reminder_logs (student_id, sent_by, sent_by_role, message_type) VALUES (?, ?, ?, ?)',
      [student.id, req.admin.username, req.admin.role, `fee_reminder_${type}`]
    );
    res.json({ success: true, sent: 1 });
  } catch (err) {
    console.error('Single reminder error:', err);
    res.status(500).json({ error: 'Could not send reminder.' });
  }
});
router.post('/send', requireAuth, async (req, res) => {
  try {
    const result = await sendReminders(req.admin.username, req.admin.role);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: 'Could not send reminders.' });
  }
});

router.get('/logs', requireAuth, async (req, res) => {
  try {
    const [logs] = await pool.query(`
      SELECT rl.*, s.name as student_name, s.phone, s.course
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
