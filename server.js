// ============================================================
//  eWatch — Main Server
//  Serves the API + static frontend from one process
// ============================================================
require('dotenv').config();
const express = require('express');
const path    = require('path');
const cors    = require('cors');

const app = express();

// ── CORS (for dev with separate Live Server) ─────────────────
app.use(cors({
  origin: (origin, cb) => cb(null, true), // allow all in prod; restrict if needed
  credentials: true,
}));

// ── Body parsers ─────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Serve static frontend (public/) ─────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── API routes ───────────────────────────────────────────────
app.use('/api', require('./routes/index'));

// ── Health check ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'eWatch', version: '1.0.0', time: new Date() });
});

// ── Serve login.html for any unknown route (SPA fallback) ────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ── Global error handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(400).json({ message: 'File too large. Max 10MB.' });
  res.status(500).json({ message: err.message || 'Internal server error.' });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║       eWatch — Barangay Bancao-Bancao  ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`\n🚀  Running at:  http://localhost:${PORT}`);
  console.log(`📋  Login page:  http://localhost:${PORT}/login.html`);
  console.log(`❤️   Health:     http://localhost:${PORT}/health`);
  console.log(`📦  API base:   http://localhost:${PORT}/api\n`);
});
