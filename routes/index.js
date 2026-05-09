// routes/index.js — All API routes
const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const router   = express.Router();

const { authenticate, requireAdmin, requireSuperAdmin } = require('../middleware/auth');
const authCtrl       = require('../controllers/authController');
const reportsCtrl    = require('../controllers/reportsController');
const usersCtrl      = require('../controllers/usersController');
const activitiesCtrl = require('../controllers/activitiesController');
const db             = require('../config/db');
const bcrypt         = require('bcryptjs');

// ── File upload config ────────────────────────────────────────
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = Date.now() + '-' + Math.round(Math.random() * 1e6) + ext;
    cb(null, name);
  },
});
const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,video/mp4').split(',');
const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    allowedTypes.includes(file.mimetype) ? cb(null, true) : cb(new Error('File type not allowed.'));
  },
});

// ────────────────────────────────────────────────────────────
// AUTH ROUTES
// ────────────────────────────────────────────────────────────
router.post('/auth/login',    authCtrl.login);
router.post('/auth/register', authCtrl.register);
router.post('/auth/logout',   authenticate, authCtrl.logout);
router.get ('/auth/me',       authenticate, authCtrl.me);

// ────────────────────────────────────────────────────────────
// REPORTS ROUTES
// ────────────────────────────────────────────────────────────
router.get ('/reports/stats',          authenticate, reportsCtrl.getStats);
router.get ('/reports',                authenticate, reportsCtrl.getReports);
router.get ('/reports/:id',            authenticate, reportsCtrl.getReport);
router.post('/reports',                authenticate, upload.array('files', 5), reportsCtrl.createReport);
router.patch('/reports/:id/status',   authenticate, requireAdmin, reportsCtrl.updateStatus);

// Serve uploaded files
router.get('/uploads/:filename', authenticate, (req, res) => {
  const file = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(file)) return res.status(404).json({ message: 'File not found.' });
  res.sendFile(path.resolve(file));
});

// ────────────────────────────────────────────────────────────
// CENSUS / USERS ROUTES
// ────────────────────────────────────────────────────────────
router.get ('/users',                    authenticate, requireAdmin, usersCtrl.getUsers);
router.get ('/users/census-summary',     authenticate, requireAdmin, usersCtrl.getCensusSummary);
router.get ('/users/pending-verif',      authenticate, requireAdmin, usersCtrl.getPendingVerif);
router.post('/users',                    authenticate, requireAdmin, usersCtrl.createUser);
router.put ('/users/:id',                authenticate, requireAdmin, usersCtrl.updateUser);
router.delete('/users/:id',             authenticate, requireAdmin, usersCtrl.deleteUser);
router.post('/users/:id/verify',        authenticate, requireAdmin, usersCtrl.verifyUser);
router.post('/users/:id/reject',        authenticate, requireAdmin, usersCtrl.rejectUser);

// ────────────────────────────────────────────────────────────
// ACTIVITIES
// ────────────────────────────────────────────────────────────
router.get('/activities', authenticate, requireAdmin, activitiesCtrl.getActivities);

// ────────────────────────────────────────────────────────────
// ADMIN MANAGEMENT (Super Admin only)
// ────────────────────────────────────────────────────────────
router.get('/admins', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, email, role, status, created_at
       FROM users WHERE role IN ('admin','super-admin')
       ORDER BY role DESC, name ASC`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

router.post('/admins', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { name, email, role = 'admin' } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'Name and email required.' });
    const hash = await bcrypt.hash('admin123', 10);
    const [r] = await db.query(
      'INSERT INTO users (name, email, password_hash, role, status, verified) VALUES (?, ?, ?, ?, "active", 1)',
      [name, email, hash, role]
    );
    await db.query('INSERT INTO activities (user_id, action) VALUES (?, ?)',
      [req.user.id, `Admin "${name}" added by ${req.user.name}`]);
    res.status(201).json({ message: 'Admin added. Default password: admin123', id: r.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email already registered.' });
    res.status(500).json({ message: 'Server error.' });
  }
});

router.patch('/admins/:id/toggle', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Admin not found.' });
    const newStatus = rows[0].status === 'active' ? 'inactive' : 'active';
    await db.query('UPDATE users SET status = ? WHERE id = ?', [newStatus, req.params.id]);
    await db.query('INSERT INTO activities (user_id, action) VALUES (?, ?)',
      [req.user.id, `Admin "${rows[0].name}" set to ${newStatus}`]);
    res.json({ message: `Admin ${newStatus}.`, status: newStatus });
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

router.delete('/admins/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT name FROM users WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Admin not found.' });
    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    await db.query('INSERT INTO activities (user_id, action) VALUES (?, ?)',
      [req.user.id, `Admin "${rows[0].name}" deleted by ${req.user.name}`]);
    res.json({ message: 'Admin deleted.' });
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

// ────────────────────────────────────────────────────────────
// OVERVIEW STATS (admin+)
// ────────────────────────────────────────────────────────────
router.get('/overview', authenticate, requireAdmin, async (req, res) => {
  try {
    const [[repStats]] = await db.query(`
      SELECT
        COUNT(*)                          AS total_reports,
        SUM(status='Pending')             AS pending,
        SUM(status='In Progress')         AS in_progress,
        SUM(status='Done')                AS done,
        SUM(DATE(created_at)=CURDATE())   AS today
      FROM reports`);

    const [[resStats]] = await db.query(`
      SELECT COUNT(*) AS total_residents FROM users WHERE role='user'`);

    const [[admStats]] = await db.query(`
      SELECT COUNT(*) AS active_admins FROM users
      WHERE role IN ('admin','super-admin') AND status='active'`);

    const [[unifStats]] = await db.query(`
      SELECT COUNT(*) AS pending_verif FROM users
      WHERE role='user' AND verified=0`);

    // Top reported residents
    const [topRes] = await db.query(`
      SELECT u.name, COUNT(r.id) AS report_count
      FROM reports r JOIN users u ON r.user_id = u.id
      GROUP BY u.id ORDER BY report_count DESC LIMIT 5`);

    // Recent reports
    const [recentReps] = await db.query(`
      SELECT r.id, r.type, r.category, r.status, r.created_at, u.name AS user_name
      FROM reports r JOIN users u ON r.user_id = u.id
      ORDER BY r.created_at DESC LIMIT 5`);

    // Recent activities
    const [recentActs] = await db.query(`
      SELECT a.action, a.created_at, u.name AS user_name
      FROM activities a LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC LIMIT 8`);

    res.json({
      reports:            repStats,
      residents:          resStats,
      admins:             admStats,
      verifications:      unifStats,
      top_reporters:      topRes,
      recent_reports:     recentReps,
      recent_activities:  recentActs,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
