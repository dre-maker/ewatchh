/* ============================================================
   eWatch — Configuration
   ============================================================ */

// ── API URL ──────────────────────────────────────────────────
// Change this to your server URL when deploying
const API_BASE = 'http://localhost:3000/api';

// ── App Info ─────────────────────────────────────────────────
const APP_NAME = 'eWatch';
const BARANGAY = 'Barangay Bancao-Bancao';

// ── Report Categories ────────────────────────────────────────
const REPORT_TYPES = {
  'Crime & Safety':      ['Theft','Obstruction of Property','Physical Assault','Vandalism','Illegal Gambling','Drug-Related Activity','Trespassing','Threats'],
  'Infrastructure':      ['Road Pothole / Damage','Broken Street Light','Clogged Drainage','Broken Bridge / Pathway','Illegal Construction'],
  'Environment':         ['Illegal Dumping','Stray Animals','Flooding','Pollution','Tree Hazard'],
  'Emergency':           ['Fire','Medical Emergency','Missing Person','Natural Disaster'],
  'Noise & Disturbance': ['Loud Music / Videoke','Barking Dogs','Late Night Gathering','Construction Noise'],
  'Others':              ['Neighbor Dispute','Unsanitary Conditions','Other Concern'],
};

const CATEGORY_EMOJIS = {
  'Crime & Safety':      '🚔',
  'Infrastructure':      '🏗',
  'Environment':         '🌿',
  'Emergency':           '🚨',
  'Noise & Disturbance': '📢',
  'Others':              '📋',
};

const PUROKS = [
  'Purok Malaya','Purok Bagong Buhay','Purok Maligaya','Purok Masikap','Purok Pagkakaisa',
];
