require('dotenv').config();
require('./scheduler');
const express = require('express');
const cors = require('cors');
const path = require('path');

const { requireAuth } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const { router: reminderRoutes } = require('./routes/reminders');
const dashboardRoutes = require('./routes/dashboard');
const usersRoutes = require('./routes/users');
const imageRoutes = require('./routes/images');
const exportRoutes = require('./routes/export');

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));

// Uploaded photos are served as static files, but only to logged-in requests —
// the browser must send the Authorization header, which <img> tags can't do by
// default, so the frontend fetches images as blobs via authenticated requests
// rather than using a plain <img src="..."> URL.
app.use('/uploads', requireAuth, express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/students', requireAuth, studentRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/users', requireAuth, usersRoutes);
app.use('/api/images', requireAuth, imageRoutes);
app.use('/api/export', requireAuth, exportRoutes);
app.use('/api/reminders', requireAuth, reminderRoutes);
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`Ghazala Fee CRM server listening on port ${PORT}`));
