/* ============================================================
   eWatch — Shared Utility Functions
   ============================================================ */

// ── Sidebar ──────────────────────────────────────────────────
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sbOverlay');
  const hm = document.getElementById('hamBtn');
  const open = sb.classList.toggle('is-open');
  ov.classList.toggle('is-open', open);
  if (hm) hm.classList.toggle('is-open', open);
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('is-open');
  document.getElementById('sbOverlay')?.classList.remove('is-open');
  document.getElementById('hamBtn')?.classList.remove('is-open');
}

// ── Page navigation ──────────────────────────────────────────
function goPage(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('pg-' + id)?.classList.add('active');
  if (el) el.classList.add('active');
  closeSidebar();
  document.querySelector('.main')?.scrollTo(0, 0);
}

// ── Modal ────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id)?.classList.add('is-open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('is-open'); }

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('is-open'); });
  });
});

// ── Toast ────────────────────────────────────────────────────
let _toastTimer;
function showToast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  if (!el) return;
  document.getElementById('toastMsg').textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ── Inline alerts ────────────────────────────────────────────
function showAlert(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'alert a-' + type;
  el.style.display = 'block';
  if (type !== 'ok') setTimeout(() => el.style.display = 'none', 5000);
}
function showInlineAlert(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'inline-alert ia-' + type;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 4500);
}

// ── DOM helpers ──────────────────────────────────────────────
function setText(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }

// ── Date/age ─────────────────────────────────────────────────
function calcAge(birthDate) {
  if (!birthDate) return 0;
  const bd = new Date(birthDate), t = new Date();
  let a = t.getFullYear() - bd.getFullYear();
  if (t.getMonth() - bd.getMonth() < 0 || (t.getMonth() === bd.getMonth() && t.getDate() < bd.getDate())) a--;
  return a;
}
function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('T')[0].split('-');
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m-1] + ' ' + +day + ', ' + y;
}
function todayISO() { return new Date().toISOString().split('T')[0]; }
function generateId(pfx = 'id') { return pfx + '_' + Date.now(); }

// ── Initials ─────────────────────────────────────────────────
function getInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Badge helpers ────────────────────────────────────────────
function statusBadge(s) {
  const m = { 'Pending':'b-pending', 'Done':'b-done', 'In Progress':'b-inprogress' };
  return `<span class="badge ${m[s]||'b-ind'}">${s}</span>`;
}
function purokBadge(p) {
  const m = { 'Purok Malaya':'b-ind','Purok Bagong Buhay':'b-done','Purok Maligaya':'b-emergency','Purok Masikap':'b-teal','Purok Pagkakaisa':'b-incident' };
  return `<span class="badge ${m[p]||'b-ind'}">${p||'—'}</span>`;
}

// ── Logout ───────────────────────────────────────────────────
function doLogout() { Auth.logout(); }

// ── Loading overlay ──────────────────────────────────────────
function showLoading(msg = 'Loading…') {
  let el = document.getElementById('_loading');
  if (!el) {
    el = document.createElement('div');
    el.id = '_loading';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,.7);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:var(--font);font-size:14px;font-weight:600;color:var(--text2)';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = 'flex';
}
function hideLoading() {
  const el = document.getElementById('_loading');
  if (el) el.style.display = 'none';
}
