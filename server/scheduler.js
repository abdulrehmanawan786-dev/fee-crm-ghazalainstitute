const cron = require('node-cron');
const pool = require('./config/db');
const { sendWhatsAppMessage } = require('./utils/whatsapp');

// Daily at 9:00 AM Pakistan time
cron.schedule('15 21 * * *', async () => {
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
      await sendWhatsAppMessage(student.phone,
        `Dear ${student.name},\n\nThis is a friendly reminder from Ghazala Institute regarding your upcoming fee payment.\nCourse: ${student.course} (${student.mode})\nAmount Due: Rs. ${student.amount || ''}\nDue Date: ${student.due_date}\n\nKindly ensure your payment is submitted before the due date to avoid any inconvenience.\nFor any queries, please contact our administration.\nThank you for being a part of Ghazala Institute.\n\nWarm regards,\nGhazala Institute`
      );
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
      await sendWhatsAppMessage(student.phone,
        `Dear ${student.name},\n\nThis is a friendly reminder from Ghazala Institute regarding your upcoming fee payment.\nCourse: ${student.course} (${student.mode})\nAmount Due: Rs. ${student.amount || ''}\nDue Date: ${student.due_date}\n\nKindly ensure your payment is submitted before the due date to avoid any inconvenience.\nFor any queries, please contact our administration.\nThank you for being a part of Ghazala Institute.\n\nWarm regards,\nGhazala Institute`
      );
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
      await sendWhatsAppMessage(student.phone,
        `Dear ${student.name},\n\nThis is a reminder from Ghazala Institute that your fee payment is now overdue.\n\nCourse: ${student.course} (${student.mode})\nAmount Due: Rs. ${student.amount || ''}\nDue Date: ${student.due_date}\n\nKindly ensure your payment is submitted as soon as possible to avoid any inconvenience.\n\nFor any queries, please contact our administration.\n\nThank you for being a part of Ghazala Institute.\n\nWarm regards,\nGhazala Institute`
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
