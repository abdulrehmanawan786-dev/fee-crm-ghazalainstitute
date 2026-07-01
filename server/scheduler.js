const cron = require('node-cron');
const pool = require('./config/db');
const { sendWhatsAppTemplate } = require('./utils/whatsapp');

cron.schedule('21 12 * * *', async () => {
  console.log('Running daily fee reminders...');
  try {
    const [dueToday] = await pool.query(`
      SELECT s.id, s.name, s.phone, s.course, s.mode, p.due_date, p.amount
      FROM students s
      JOIN payments p ON p.student_id = s.id
      WHERE s.status = 'Active'
      AND s.remarks IS NULL
      AND p.paid_date IS NULL
      AND DATE(p.due_date) = CURDATE()
    `);
    for (const student of dueToday) {
      if (!student.phone) continue;
      await sendWhatsAppTemplate(student.phone, student.name, `${student.course} (${student.mode})`, student.amount || '', student.due_date);
      await pool.query(
        'INSERT INTO reminder_logs (student_id, sent_by, sent_by_role, message_type) VALUES (?, ?, ?, ?)',
        [student.id, 'system', 'auto', 'due_today']
      );
    }

    const [dueTomorrow] = await pool.query(`
      SELECT s.id, s.name, s.phone, s.course, s.mode, p.due_date, p.amount
      FROM students s
      JOIN payments p ON p.student_id = s.id
      WHERE s.status = 'Active'
      AND s.remarks IS NULL
      AND p.paid_date IS NULL
      AND DATE(p.due_date) = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
    `);
    for (const student of dueTomorrow) {
      if (!student.phone) continue;
      await sendWhatsAppTemplate(student.phone, student.name, `${student.course} (${student.mode})`, student.amount || '', student.due_date);
      await pool.query(
        'INSERT INTO reminder_logs (student_id, sent_by, sent_by_role, message_type) VALUES (?, ?, ?, ?)',
        [student.id, 'system', 'auto', 'due_tomorrow']
      );
    }

    const [overdue] = await pool.query(`
      SELECT s.id, s.name, s.phone, s.course, s.mode, p.due_date, p.amount
      FROM students s
      JOIN payments p ON p.student_id = s.id
      WHERE s.status = 'Active'
      AND s.remarks IS NULL
      AND p.paid_date IS NULL
      AND DATE(p.due_date) < CURDATE()
    `);
    for (const student of overdue) {
      if (!student.phone) continue;
      await sendWhatsAppTemplate(student.phone, student.name, `${student.course} (${student.mode})`, student.amount || '', student.due_date);
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
