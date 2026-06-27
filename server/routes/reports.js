const express = require('express');
const pool = require('../config/db');

const router = express.Router();

function defaultRange() {
  const to = new Date().toISOString().slice(0, 10);
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - 11);
  const from = fromDate.toISOString().slice(0, 10);
  return { from, to };
}

// ---- Course-wise report ----
// Students enrolled are counted by registration date falling in the range; collected/
// outstanding are counted by each payment's own due date falling in the range — the
// same due-date attribution used everywhere else in this app, so these figures always
// agree with the main dashboard for the same period.
router.get('/course-wise', async (req, res) => {
  try {
    const { from, to } = req.query.dateFrom && req.query.dateTo
      ? { from: req.query.dateFrom, to: req.query.dateTo }
      : defaultRange();

    const [rows] = await pool.query(`
      SELECT
        s.course,
        COUNT(DISTINCT CASE WHEN s.reg_date BETWEEN ? AND ? THEN s.id END) AS studentsEnrolled,
        COALESCE(SUM(CASE WHEN p.paid_date IS NOT NULL AND p.due_date BETWEEN ? AND ? THEN p.amount ELSE 0 END), 0) AS collected,
        COALESCE(SUM(CASE WHEN p.paid_date IS NULL AND p.due_date BETWEEN ? AND ? THEN p.amount ELSE 0 END), 0) AS outstanding
      FROM students s
      LEFT JOIN payments p ON p.student_id = s.id
      GROUP BY s.course
      ORDER BY s.course
    `, [from, to, from, to, from, to]);

    res.json({ from, to, rows });
  } catch (err) {
    console.error('Course-wise report error:', err);
    res.status(500).json({ error: 'Could not load course-wise report.' });
  }
});

// ---- Monthly / yearly comparison ----
router.get('/comparison', async (req, res) => {
  try {
    const granularity = req.query.granularity === 'year' ? 'year' : 'month';
    const fmt = granularity === 'year' ? '%Y' : '%Y-%m';
    const { from, to } = req.query.dateFrom && req.query.dateTo
      ? { from: req.query.dateFrom, to: req.query.dateTo }
      : defaultRange();

    const [paymentRows] = await pool.query(`
      SELECT
        DATE_FORMAT(p.due_date, '${fmt}') AS period,
        COALESCE(SUM(CASE WHEN p.paid_date IS NOT NULL THEN p.amount ELSE 0 END), 0) AS collected,
        COALESCE(SUM(CASE WHEN p.paid_date IS NULL THEN p.amount ELSE 0 END), 0) AS outstanding
      FROM payments p
      WHERE p.due_date BETWEEN ? AND ?
      GROUP BY period
      ORDER BY period
    `, [from, to]);

    const [studentRows] = await pool.query(`
      SELECT DATE_FORMAT(s.reg_date, '${fmt}') AS period, COUNT(*) AS studentsEnrolled
      FROM students s
      WHERE s.reg_date BETWEEN ? AND ?
      GROUP BY period
      ORDER BY period
    `, [from, to]);

    const byPeriod = {};
    paymentRows.forEach(r => { byPeriod[r.period] = { period: r.period, collected: r.collected, outstanding: r.outstanding, studentsEnrolled: 0 }; });
    studentRows.forEach(r => {
      if (!byPeriod[r.period]) byPeriod[r.period] = { period: r.period, collected: 0, outstanding: 0, studentsEnrolled: 0 };
      byPeriod[r.period].studentsEnrolled = r.studentsEnrolled;
    });

    const rows = Object.values(byPeriod).sort((a, b) => a.period.localeCompare(b.period));
    res.json({ from, to, granularity, rows });
  } catch (err) {
    console.error('Comparison report error:', err);
    res.status(500).json({ error: 'Could not load comparison report.' });
  }
});

// ---- Daily / weekly income summary ----
// Based on the actual paid_date (cash received), unlike the rest of the app which
// groups by due_date — an income summary is meant to answer "how much cash came in
// on this day/week", which is a different question from "what was due this month".
router.get('/income', async (req, res) => {
  try {
    const granularity = req.query.granularity === 'week' ? 'week' : 'day';
    const { from, to } = req.query.dateFrom && req.query.dateTo
      ? { from: req.query.dateFrom, to: req.query.dateTo }
      : defaultRange();

    let rows;
    if (granularity === 'day') {
      [rows] = await pool.query(`
        SELECT DATE(p.paid_date) AS period, SUM(p.amount) AS collected
        FROM payments p
        WHERE p.paid_date IS NOT NULL AND p.paid_date BETWEEN ? AND ?
        GROUP BY period
        ORDER BY period
      `, [from, to]);
    } else {
      [rows] = await pool.query(`
        SELECT
          MIN(p.paid_date) AS period,
          SUM(p.amount) AS collected
        FROM payments p
        WHERE p.paid_date IS NOT NULL AND p.paid_date BETWEEN ? AND ?
        GROUP BY YEARWEEK(p.paid_date, 1)
        ORDER BY period
      `, [from, to]);
    }

    res.json({ from, to, granularity, rows });
  } catch (err) {
    console.error('Income report error:', err);
    res.status(500).json({ error: 'Could not load income summary.' });
  }
});

module.exports = router;
