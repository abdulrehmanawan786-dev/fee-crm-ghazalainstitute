const express = require('express');
const { v4: uuid } = require('uuid');
const pool = require('../config/db');
const { netTotal, splitInstallments, lumpsumAmount } = require('../utils/calculations');

const router = express.Router();

// ---- helpers ----

async function loadStudentWithPayments(studentId) {
  const [[student]] = await pool.query('SELECT * FROM students WHERE id = ?', [studentId]);
  if (!student) return null;
  const [payments] = await pool.query('SELECT * FROM payments WHERE student_id = ?', [studentId]);
  const [[imgRow]] = await pool.query('SELECT COUNT(*) AS c FROM student_images WHERE student_id = ?', [studentId]);
  return { ...student, payments, imageCount: imgRow.c };
}

// ---- list (supports month / search / course / mode / status / date range) ----

router.get('/', async (req, res) => {
  try {
    const { month, search, course, mode, status, enrollStatus, dateFrom, dateTo } = req.query;
    let where = ['1=1'];
    let params = [];

    if (search) {
      where.push('(s.name LIKE ? OR s.phone LIKE ? OR s.slip_no LIKE ? OR s.course LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
      if (dateFrom && dateTo) {
        where.push('s.reg_date BETWEEN ? AND ?');
        params.push(dateFrom, dateTo);
      }
    } else if (dateFrom && dateTo) {
      where.push('s.reg_date BETWEEN ? AND ?');
      params.push(dateFrom, dateTo);
    } else if (month) {
      where.push("DATE_FORMAT(s.reg_date, '%Y-%m') = ?");
      params.push(month);
    }

    if (course && course !== 'All') { where.push('s.course = ?'); params.push(course); }
    if (mode && mode !== 'All') { where.push('s.mode = ?'); params.push(mode); }
    if (enrollStatus && enrollStatus !== 'All') { where.push('s.status = ?'); params.push(enrollStatus); }

    const [rows] = await pool.query(
      `SELECT s.*, COALESCE(img.c, 0) AS imageCount
       FROM students s
       LEFT JOIN (SELECT student_id, COUNT(*) c FROM student_images GROUP BY student_id) img ON img.student_id = s.id
       WHERE ${where.join(' AND ')}
       ORDER BY s.reg_date ASC`,
      params
    );

    if (rows.length === 0) return res.json([]);

    const ids = rows.map(r => r.id);
    const [payments] = await pool.query(`SELECT * FROM payments WHERE student_id IN (${ids.map(() => '?').join(',')})`, ids);
    const byStudent = {};
    payments.forEach(p => { (byStudent[p.student_id] ||= []).push(p); });

    let result = rows.map(r => ({ ...r, payments: byStudent[r.id] || [] }));

    // Status filter requires computed status, so it's applied in JS after the join.
    if (status && status !== 'All') {
      result = result.filter(s => computeStatus(s) === status);
    }

    res.json(result);
  } catch (err) {
    console.error('List students error:', err);
    res.status(500).json({ error: 'Could not load students.' });
  }
});

function computeStatus(student) {
  if (student.remarks === 'Drop') return 'drop';
  if (student.remarks === 'Refund') return 'refund';
  const balance = netTotal(student) - student.payments
    .filter(p => p.paid_date)
    .reduce((sum, p) => sum + p.amount, 0);
  if (balance <= 0) return 'paid';
  const today = new Date().toISOString().slice(0, 10);
  const overdue = student.payments.some(p => !p.paid_date && p.due_date && p.due_date < today);
  return overdue ? 'overdue' : 'pending';
}

// ---- single student detail ----

router.get('/:id', async (req, res) => {
  try {
    const student = await loadStudentWithPayments(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    res.json(student);
  } catch (err) {
    console.error('Get student error:', err);
    res.status(500).json({ error: 'Could not load student.' });
  }
});

// ---- create ----

router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const d = req.body;
    if (!d.name || !d.name.trim()) return res.status(400).json({ error: 'Student name is required.' });
    if (d.paymentMode === 'lumpsum' && !d.lumpsumDate) return res.status(400).json({ error: 'Lumpsum due date is required.' });
    if (d.paymentMode !== 'lumpsum' && (!d.inst1Date || !d.inst2Date)) {
      return res.status(400).json({ error: 'Both installment dates are required, or switch to lumpsum.' });
    }

    const id = uuid();
    const studentRow = {
      id,
      registration_fee: Number(d.registrationFee) || 0,
      course_fee: Number(d.courseFee) || 0,
      discount: Number(d.discount) || 0,
    };
    const today = new Date().toISOString().slice(0, 10);

    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO students (id, name, slip_no, phone, course, mode, status, course_fee, registration_fee, reg_date, discount, payment_mode, remarks)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, d.name.trim(), d.slipNo || null, d.phone || null, d.course, d.mode || 'Onsite', d.status || 'Active',
        studentRow.course_fee, studentRow.registration_fee, d.regDate, studentRow.discount,
        d.paymentMode || 'installment', d.remarks || null]
    );

    const fullStudent = { registration_fee: studentRow.registration_fee, course_fee: studentRow.course_fee, discount: studentRow.discount };

    await conn.query(
      `INSERT INTO payments (student_id, type, amount, due_date, paid_date, method) VALUES (?,?,?,?,?,?)`,
      [id, 'registration', studentRow.registration_fee, d.regDate, d.regPaid ? today : null, d.regPaid ? (d.regMethod || 'Cash') : null]
    );

    if (d.paymentMode === 'lumpsum') {
      const amount = lumpsumAmount(fullStudent);
      await conn.query(
        `INSERT INTO payments (student_id, type, amount, due_date, paid_date, method) VALUES (?,?,?,?,?,?)`,
        [id, 'lumpsum', amount, d.lumpsumDate, d.lumpsumPaid ? today : null, d.lumpsumPaid ? (d.lumpsumMethod || 'Cash') : null]
      );
    } else {
      const { inst1, inst2 } = splitInstallments(fullStudent);
      await conn.query(
        `INSERT INTO payments (student_id, type, amount, due_date, paid_date, method) VALUES (?,?,?,?,?,?)`,
        [id, 'installment1', inst1, d.inst1Date, d.inst1Paid ? today : null, d.inst1Paid ? (d.inst1Method || 'Cash') : null]
      );
      await conn.query(
        `INSERT INTO payments (student_id, type, amount, due_date, paid_date, method) VALUES (?,?,?,?,?,?)`,
        [id, 'installment2', inst2, d.inst2Date, d.inst2Paid ? today : null, d.inst2Paid ? (d.inst2Method || 'Cash') : null]
      );
    }

    await conn.commit();
    const created = await loadStudentWithPayments(id);
    res.status(201).json(created);
  } catch (err) {
    await conn.rollback();
    console.error('Create student error:', err);
    res.status(500).json({ error: 'Could not create student.' });
  } finally {
    conn.release();
  }
});

// ---- update ----

router.put('/:id', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const d = req.body;
    const id = req.params.id;
    const [[existing]] = await conn.query('SELECT * FROM students WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Student not found.' });

    await conn.beginTransaction();

    await conn.query(
      `UPDATE students SET name=?, slip_no=?, phone=?, course=?, mode=?, status=?, course_fee=?, registration_fee=?, reg_date=?, discount=?, payment_mode=?, remarks=?
       WHERE id=?`,
      [d.name.trim(), d.slipNo || null, d.phone || null, d.course, d.mode || 'Onsite', d.status || 'Active',
        Number(d.courseFee) || 0, Number(d.registrationFee) || 0, d.regDate, Number(d.discount) || 0,
        d.paymentMode || 'installment', d.remarks || null, id]
    );

    const fullStudent = { registration_fee: Number(d.registrationFee) || 0, course_fee: Number(d.courseFee) || 0, discount: Number(d.discount) || 0 };

    // Registration row: update amount/due date, never touch paid_date/method here —
    // use the dedicated pay/unpay endpoints to change paid status.
    await conn.query(`UPDATE payments SET amount=?, due_date=? WHERE student_id=? AND type='registration'`,
      [fullStudent.registration_fee, d.regDate, id]);

    if (d.paymentMode === 'lumpsum') {
      const amount = lumpsumAmount(fullStudent);
      const [[lumpRow]] = await conn.query(`SELECT id FROM payments WHERE student_id=? AND type='lumpsum'`, [id]);
      if (lumpRow) {
        await conn.query(`UPDATE payments SET amount=?, due_date=? WHERE id=?`, [amount, d.lumpsumDate, lumpRow.id]);
      } else {
        await conn.query(`DELETE FROM payments WHERE student_id=? AND type IN ('installment1','installment2')`, [id]);
        await conn.query(`INSERT INTO payments (student_id, type, amount, due_date) VALUES (?, 'lumpsum', ?, ?)`, [id, amount, d.lumpsumDate]);
      }
    } else {
      const { inst1, inst2 } = splitInstallments(fullStudent);
      const [[lumpRow]] = await conn.query(`SELECT id FROM payments WHERE student_id=? AND type='lumpsum'`, [id]);
      if (lumpRow) await conn.query(`DELETE FROM payments WHERE id=?`, [lumpRow.id]);

      const [[i1]] = await conn.query(`SELECT id FROM payments WHERE student_id=? AND type='installment1'`, [id]);
      const [[i2]] = await conn.query(`SELECT id FROM payments WHERE student_id=? AND type='installment2'`, [id]);
      if (i1) await conn.query(`UPDATE payments SET amount=?, due_date=? WHERE id=?`, [inst1, d.inst1Date, i1.id]);
      else await conn.query(`INSERT INTO payments (student_id, type, amount, due_date) VALUES (?, 'installment1', ?, ?)`, [id, inst1, d.inst1Date]);
      if (i2) await conn.query(`UPDATE payments SET amount=?, due_date=? WHERE id=?`, [inst2, d.inst2Date, i2.id]);
      else await conn.query(`INSERT INTO payments (student_id, type, amount, due_date) VALUES (?, 'installment2', ?, ?)`, [id, inst2, d.inst2Date]);
    }

    await conn.commit();
    const updated = await loadStudentWithPayments(id);
    res.json(updated);
  } catch (err) {
    await conn.rollback();
    console.error('Update student error:', err);
    res.status(500).json({ error: 'Could not update student.' });
  } finally {
    conn.release();
  }
});

// ---- delete ----

router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM students WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Student not found.' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete student error:', err);
    res.status(500).json({ error: 'Could not delete student.' });
  }
});

// ---- mark a payment paid / unpaid ----

router.post('/:id/payments/:type/pay', async (req, res) => {
  try {
    const { id, type } = req.params;
    const { method } = req.body;
    const today = new Date().toISOString().slice(0, 10);

    const [[payment]] = await pool.query('SELECT * FROM payments WHERE student_id=? AND type=?', [id, type]);
    if (!payment) return res.status(404).json({ error: 'Payment record not found.' });

    const wasOverdue = !!(payment.due_date && payment.due_date < today);
    await pool.query('UPDATE payments SET paid_date=?, method=?, was_overdue=? WHERE id=?', [today, method || 'Cash', wasOverdue, payment.id]);
    res.json(await loadStudentWithPayments(id));
  } catch (err) {
    console.error('Mark paid error:', err);
    res.status(500).json({ error: 'Could not update payment.' });
  }
});

router.post('/:id/payments/:type/unpay', async (req, res) => {
  try {
    const { id, type } = req.params;
    await pool.query(
      `UPDATE payments SET paid_date=NULL, method=NULL, was_overdue=FALSE WHERE student_id=? AND type=?`,
      [id, type]
    );
    res.json(await loadStudentWithPayments(id));
  } catch (err) {
    console.error('Unmark paid error:', err);
    res.status(500).json({ error: 'Could not update payment.' });
  }
});

module.exports = router;
