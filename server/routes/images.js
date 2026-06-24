const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');
const pool = require('../config/db');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${uuid()}${path.extname(file.originalname) || '.jpg'}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB per file
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed.'));
    cb(null, true);
  },
});

router.get('/:studentId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, filename, uploaded_at FROM student_images WHERE student_id = ? ORDER BY uploaded_at',
      [req.params.studentId]
    );
    res.json(rows);
  } catch (err) {
    console.error('List images error:', err);
    res.status(500).json({ error: 'Could not load images.' });
  }
});

router.post('/:studentId', upload.array('images', 10), async (req, res) => {
  try {
    const studentId = req.params.studentId;
    for (const file of req.files) {
      await pool.query('INSERT INTO student_images (student_id, filename) VALUES (?, ?)', [studentId, file.filename]);
    }
    const [rows] = await pool.query(
      'SELECT id, filename, uploaded_at FROM student_images WHERE student_id = ? ORDER BY uploaded_at',
      [studentId]
    );
    res.status(201).json(rows);
  } catch (err) {
    console.error('Upload images error:', err);
    res.status(500).json({ error: 'Could not upload images.' });
  }
});

router.delete('/image/:imageId', async (req, res) => {
  try {
    const [[image]] = await pool.query('SELECT * FROM student_images WHERE id = ?', [req.params.imageId]);
    if (!image) return res.status(404).json({ error: 'Image not found.' });
    await pool.query('DELETE FROM student_images WHERE id = ?', [req.params.imageId]);
    const filePath = path.join(uploadDir, image.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete image error:', err);
    res.status(500).json({ error: 'Could not delete image.' });
  }
});

module.exports = router;
