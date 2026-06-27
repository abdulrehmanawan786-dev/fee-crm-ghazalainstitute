const cron = require('node-cron');
const pool = require('./config/db');
const { sendWhatsAppMessage } = require('./utils/whatsapp');

// Daily at 9:00 AM Pakistan time
cron.schedule('0 13 * * *', async () => {
  console.log('Running daily fee reminders...');
  try {
    // Due today — payments.paid_date IS NULL means unpaid; there is no stored
    // "status" column on payments (paid/pending/overdue is always computed from
    // paid_date/due_date), and the students column is "status", not "enroll_status".
    const [dueToday] = await pool.query(`
      SELECT s.id, s.name, s.phone, s.course, s.mode, p.due_date
      FROM students s
      JOIN payments p ON p.student_id = s.id
      WHERE s.status = 'Active'
      AND s.remarks IS NULL
      AND p.paid_date IS NULL
      AND DATE(p.due_date) = CURDATE()
    `);

    for (const student of dueToday) {
      if (!student.phone) continue;
      await sendWhatsAppMessage(student.phone,
        `🔔 *Ghazala Institute — Fee Reminder*\n\nAssalam o Alaikum ${student.name}!\n\nAaj aapki fee due hai.\n📚 Course: ${student.course} (${student.mode})\n\nBrahe karam aaj fee jama karwayein.\n\nShukriya! 🙏\nGhazala Institute`
      );
      await pool.query(
        'INSERT INTO reminder_logs (student_id, sent_by, sent_by_role, message_type) VALUES (?, ?, ?, ?)',
        [student.id, 'system', 'auto', 'due_today']
      );
    }

    // Due tomorrow
    const [dueTomorrow] = await pool.query(`
      SELECT s.id, s.name, s.phone, s.course, s.mode, p.due_date
      FROM students s
      JOIN payments p ON p.student_id = s.id
      WHERE s.status = 'Active'
      AND s.remarks IS NULL
      AND p.paid_date IS NULL
      AND DATE(p.due_date) = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
    `);

    for (const student of dueTomorrow) {
      if (!student.phone) continue;
      await sendWhatsAppMessage(student.phone,
        `🔔 *Ghazala Institute — Fee Reminder*\n\nAssalam o Alaikum ${student.name}!\n\nKal aapki fee due hai.\n📚 Course: ${student.course} (${student.mode})\n\nBrahe karam kal fee jama karwayein.\n\nShukriya! 🙏\nGhazala Institute`
      );
      await pool.query(
        'INSERT INTO reminder_logs (student_id, sent_by, sent_by_role, message_type) VALUES (?, ?, ?, ?)',
        [student.id, 'system', 'auto', 'due_tomorrow']
      );
    }

    // Overdue
    const [overdue] = await pool.query(`
      SELECT s.id, s.name, s.phone, s.course, s.mode, p.due_date
      FROM students s
      JOIN payments p ON p.student_id = s.id
      WHERE s.status = 'Active'
      AND s.remarks IS NULL
      AND p.paid_date IS NULL
      AND DATE(p.due_date) < CURDATE()
    `);

    for (const student of overdue) {
      if (!student.phone) continue;
      await sendWhatsAppMessage(student.phone,
        `⚠️ *Ghazala Institute — Overdue Fee Alert*\n\nAssalam o Alaikum ${student.name}!\n\nAapki fee overdue ho gayi hai.\n📚 Course: ${student.course} (${student.mode})\n\nForan fee jama karwayein warna registration cancel ho sakti hai.\n\nShukriya! 🙏\nGhazala Institute`
      );
      await pool.query(
        'INSERT INTO reminder_logs (student_id, sent_by, sent_by_role, message_type) VALUES (?, ?, ?, ?)',
        [student.id, 'system', 'auto', 'overdue']
      );
    }

    console.log(`Reminders sent: ${dueToday.length + dueTomorrow.length + overdue.length}`);
  } catch (err) {
    console.error('Scheduler error:', err);
  }
}, {
  timezone: 'Asia/Karachi'
});

console.log('Reminder scheduler started');
