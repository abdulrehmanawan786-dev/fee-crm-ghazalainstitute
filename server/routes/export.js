const express = require('express');
const pool = require('../config/db');
const { netTotal } = require('../utils/calculations');

const router = express.Router();

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

router.get('/csv', async (req, res) => {
  try {
    const [students] = await pool.query('SELECT * FROM students ORDER BY reg_date');
    const [payments] = await pool.query('SELECT * FROM payments');
    const byStudent = {};
    payments.forEach(p => { (byStudent[p.student_id] ||= []).push(p); });

    const headers = [
      'Name', 'Slip No', 'Phone', 'Course', 'Mode', 'Reg Date', 'Registration Fee', 'Course Fee',
      'Discount', 'Total Amount', 'Payment Mode', 'Remarks',
      'Reg Paid Date', 'Reg Method',
      'Inst1/Lumpsum Amount', 'Inst1/Lumpsum Due', 'Inst1/Lumpsum Paid', 'Inst1/Lumpsum Method',
      'Inst2 Amount', 'Inst2 Due', 'Inst2 Paid', 'Inst2 Method',
      'Total Paid', 'Balance',
    ];

    const lines = [headers.map(csvEscape).join(',')];

    students.forEach(s => {
      const sPayments = byStudent[s.id] || [];
      const reg = sPayments.find(p => p.type === 'registration');
      const inst1 = sPayments.find(p => p.type === 'installment1' || p.type === 'lumpsum');
      const inst2 = sPayments.find(p => p.type === 'installment2');
      const totalPaid = sPayments.filter(p => p.paid_date).reduce((sum, p) => sum + p.amount, 0);
      const total = netTotal(s);

      lines.push([
        s.name, s.slip_no, s.phone, s.course, s.mode, s.reg_date, s.registration_fee, s.course_fee,
        s.discount, total, s.payment_mode, s.remarks,
        reg?.paid_date || '', reg?.method || '',
        inst1?.amount || '', inst1?.due_date || '', inst1?.paid_date || '', inst1?.method || '',
        inst2?.amount || '', inst2?.due_date || '', inst2?.paid_date || '', inst2?.method || '',
        totalPaid, total - totalPaid,
      ].map(csvEscape).join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="ghazala-fees-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(lines.join('\n'));
  } catch (err) {
    console.error('CSV export error:', err);
    res.status(500).json({ error: 'Could not generate export.' });
  }
});

module.exports = router;
