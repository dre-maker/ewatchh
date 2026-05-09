// controllers/reportsController.js
const db = require('../config/db');

// ── GET /api/reports ─────────────────────────────────────────
// Admin/SuperAdmin: all reports | User: own reports
async function getReports(req, res) {
  try {
    const { status, category, search, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where  = [];
    let params = [];

    // Role filter: users see only their own reports
    if (req.user.role === 'user') {
      where.push('r.user_id = ?');
      params.push(req.user.id);
    }

    if (status)   { where.push('r.status = ?');         params.push(status); }
    if (category) { where.push('r.category = ?');       params.push(category); }
    if (search) {
      where.push('(u.name LIKE ? OR r.type LIKE ? OR r.description LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [rows] = await db.query(
      `SELECT r.id, r.category, r.type, r.location, r.description,
              r.status, r.created_at, r.updated_at,
              u.id AS user_id, u.name AS user_name, u.purok,
              COUNT(f.id) AS file_count
       FROM reports r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN report_files f ON f.report_id = r.id
       ${whereSQL}
       GROUP BY r.id
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [countRow] = await db.query(
      `SELECT COUNT(DISTINCT r.id) AS total
       FROM reports r
       JOIN users u ON r.user_id = u.id
       ${whereSQL}`,
      params
    );

    res.json({
      data:  rows,
      total: countRow[0].total,
      page:  parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
}

// ── GET /api/reports/:id ─────────────────────────────────────
async function getReport(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT r.*, u.name AS user_name, u.email AS user_email, u.purok
       FROM reports r JOIN users u ON r.user_id = u.id
       WHERE r.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Report not found.' });

    // Users can only view their own
    if (req.user.role === 'user' && rows[0].user_id !== req.user.id)
      return res.status(403).json({ message: 'Access denied.' });

    // Get attached files
    const [files] = await db.query(
      'SELECT id, filename, original, mimetype, size FROM report_files WHERE report_id = ?',
      [req.params.id]
    );
    rows[0].files = files;
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
}

// ── POST /api/reports ────────────────────────────────────────
async function createReport(req, res) {
  try {
    const { category, type, location, description } = req.body;
    if (!category || !type || !description)
      return res.status(400).json({ message: 'Category, type and description are required.' });

    if (req.user.role === 'user' && !req.user.verified) {
      // Re-check from DB
      const [u] = await db.query('SELECT verified FROM users WHERE id = ?', [req.user.id]);
      if (!u[0]?.verified)
        return res.status(403).json({ message: 'Account not yet verified by barangay officials.' });
    }

    const [result] = await db.query(
      'INSERT INTO reports (user_id, category, type, location, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, category, type, location || null, description]
    );

    // Save uploaded files
    if (req.files && req.files.length > 0) {
      const fileValues = req.files.map(f => [result.insertId, f.filename, f.originalname, f.mimetype, f.size]);
      await db.query(
        'INSERT INTO report_files (report_id, filename, original, mimetype, size) VALUES ?',
        [fileValues]
      );
    }

    await db.query(
      'INSERT INTO activities (user_id, action) VALUES (?, ?)',
      [req.user.id, `New report "${type}" submitted by ${req.user.name}`]
    );

    res.status(201).json({ message: 'Report submitted.', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
}

// ── PATCH /api/reports/:id/status ───────────────────────────
async function updateStatus(req, res) {
  try {
    const { status } = req.body;
    const validStatuses = ['Pending', 'In Progress', 'Done'];
    if (!validStatuses.includes(status))
      return res.status(400).json({ message: 'Invalid status.' });

    const [rows] = await db.query('SELECT * FROM reports WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Report not found.' });

    await db.query('UPDATE reports SET status = ? WHERE id = ?', [status, req.params.id]);

    await db.query(
      'INSERT INTO activities (user_id, action) VALUES (?, ?)',
      [req.user.id, `Report #${req.params.id} status → "${status}" by ${req.user.name}`]
    );

    res.json({ message: 'Status updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
}

// ── GET /api/reports/stats ───────────────────────────────────
async function getStats(req, res) {
  try {
    let where  = '';
    let params = [];
    if (req.user.role === 'user') {
      where  = 'WHERE user_id = ?';
      params = [req.user.id];
    }

    const [rows] = await db.query(
      `SELECT
         COUNT(*)                                        AS total,
         SUM(status = 'Pending')                        AS pending,
         SUM(status = 'In Progress')                    AS in_progress,
         SUM(status = 'Done')                           AS done,
         SUM(DATE(created_at) = CURDATE())              AS today
       FROM reports ${where}`,
      params
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
}

module.exports = { getReports, getReport, createReport, updateStatus, getStats };
