// controllers/activitiesController.js
const db = require('../config/db');

async function getActivities(req, res) {
  try {
    const { limit = 50 } = req.query;
    const [rows] = await db.query(
      `SELECT a.id, a.action, a.created_at, u.name AS user_name
       FROM activities a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT ?`,
      [parseInt(limit)]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
}

module.exports = { getActivities };

// ─────────────────────────────────────────────────────────────
// controllers/adminsController.js  (Super Admin only)
// ─────────────────────────────────────────────────────────────
