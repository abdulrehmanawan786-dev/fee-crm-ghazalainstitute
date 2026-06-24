const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// All figures are grouped by each payment's own due_date — never by whichever date
// someone happened to click "mark paid" — so a payment's month bucket never moves
// after the fact. This mirrors the original artifact's logic, now done in plain SQL.

router.get('/', async (req, res) => {
  try {
    const month = req.query.month; // 'YYYY-MM'
    if (!month) return res.status(400).json({ error: 'month query param is required.' });

    const [[collectedRow]] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM payments
       WHERE DATE_FORMAT(due_date,'%Y-%m')=? AND paid_date IS NOT NULL`, [month]);

    const [[outstandingRow]] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM payments
       WHERE DATE_FORMAT(due_date,'%Y-%m')=? AND paid_date IS NULL`, [month]);

    const [[regFeeRow]] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM payments
       WHERE type='registration' AND DATE_FORMAT(due_date,'%Y-%m')=? AND paid_date IS NOT NULL`, [month]);

    const [[inst1Row]] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS cnt FROM payments
       WHERE type='installment1' AND DATE_FORMAT(due_date,'%Y-%m')=? AND paid_date IS NULL`, [month]);

    const [[inst2Row]] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS cnt FROM payments
       WHERE type='installment2' AND DATE_FORMAT(due_date,'%Y-%m')=? AND paid_date IS NULL`, [month]);

    const [studentsRows] = await pool.query(
      `SELECT id, course FROM students WHERE DATE_FORMAT(reg_date,'%Y-%m')=?`, [month]);
    const byCourse = {};
    studentsRows.forEach(s => { byCourse[s.course] = (byCourse[s.course] || 0) + 1; });

    const [collectedIds] = await pool.query(
      `SELECT DISTINCT student_id FROM payments WHERE DATE_FORMAT(due_date,'%Y-%m')=? AND paid_date IS NOT NULL`, [month]);
    const [outstandingIds] = await pool.query(
      `SELECT DISTINCT student_id FROM payments WHERE DATE_FORMAT(due_date,'%Y-%m')=? AND paid_date IS NULL`, [month]);
    const [regFeeIds] = await pool.query(
      `SELECT DISTINCT student_id FROM payments WHERE type='registration' AND DATE_FORMAT(due_date,'%Y-%m')=? AND paid_date IS NOT NULL`, [month]);
    const [inst1Ids] = await pool.query(
      `SELECT DISTINCT student_id FROM payments WHERE type='installment1' AND DATE_FORMAT(due_date,'%Y-%m')=? AND paid_date IS NULL`, [month]);
    const [inst2Ids] = await pool.query(
      `SELECT DISTINCT student_id FROM payments WHERE type='installment2' AND DATE_FORMAT(due_date,'%Y-%m')=? AND paid_date IS NULL`, [month]);

    res.json({
      studentCount: studentsRows.length,
      studentIds: studentsRows.map(s => s.id),
      byCourse,
      collection: collectedRow.total,
      collectedIds: collectedIds.map(r => r.student_id),
      outstanding: outstandingRow.total,
      outstandingIds: outstandingIds.map(r => r.student_id),
      regFee: regFeeRow.total,
      regFeeIds: regFeeIds.map(r => r.student_id),
      inst1Outstanding: inst1Row.total,
      inst1Count: inst1Row.cnt,
      inst1Ids: inst1Ids.map(r => r.student_id),
      inst2Outstanding: inst2Row.total,
      inst2Count: inst2Row.cnt,
      inst2Ids: inst2Ids.map(r => r.student_id),
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Could not load dashboard stats.' });
  }
});

// Overdue right now (independent of month) — excludes Drop/Refund students.
router.get('/overdue', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [rows] = await pool.query(
      `SELECT DISTINCT p.student_id FROM payments p
       JOIN students s ON s.id = p.student_id
       WHERE p.paid_date IS NULL AND p.due_date < ? AND s.remarks IS NULL`, [today]);
    res.json({ ids: rows.map(r => r.student_id) });
  } catch (err) {
    console.error('Overdue error:', err);
    res.status(500).json({ error: 'Could not load overdue list.' });
  }
});

// Students with zero uploaded photos.
router.get('/pending-images', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id FROM students s
       LEFT JOIN (SELECT student_id, COUNT(*) c FROM student_images GROUP BY student_id) img
       ON img.student_id = s.id
       WHERE img.c IS NULL OR img.c = 0`);
    res.json({ ids: rows.map(r => r.id) });
  } catch (err) {
    console.error('Pending images error:', err);
    res.status(500).json({ error: 'Could not load pending-image list.' });
  }
});

// Fetch a specific set of students by id — used by the dashboard drill-down panels.
router.post('/by-ids', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.json([]);
    const [rows] = await pool.query(
      `SELECT s.*, COALESCE(img.c, 0) AS imageCount
       FROM students s
       LEFT JOIN (SELECT student_id, COUNT(*) c FROM student_images GROUP BY student_id) img ON img.student_id = s.id
       WHERE s.id IN (${ids.map(() => '?').join(',')})
       ORDER BY s.reg_date ASC`,
      ids
    );
    const [payments] = await pool.query(`SELECT * FROM payments WHERE student_id IN (${ids.map(() => '?').join(',')})`, ids);
    const byStudent = {};
    payments.forEach(p => { (byStudent[p.student_id] ||= []).push(p); });
    res.json(rows.map(r => ({ ...r, payments: byStudent[r.id] || [] })));
  } catch (err) {
    console.error('By-ids error:', err);
    res.status(500).json({ error: 'Could not load students.' });
  }
});

module.exports = router;
