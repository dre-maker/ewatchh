/* ============================================================
   eWatch — API Client
   Works same-origin: served by Node.js so no hardcoded URL
   ============================================================ */

const API_BASE = '/api';   // same-origin — works on any host/port

function getToken()          { return localStorage.getItem('ew_token'); }
function setToken(t)         { localStorage.setItem('ew_token', t); }
function getCurrentUser()    { try { const s=localStorage.getItem('ew_user'); return s?JSON.parse(s):null; } catch { return null; } }
function setCurrentUser(u)   { localStorage.setItem('ew_user', JSON.stringify(u)); }
function clearCurrentUser()  { localStorage.removeItem('ew_user'); localStorage.removeItem('ew_token'); }

async function apiFetch(endpoint, options = {}) {
  const token   = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token)                        headers['Authorization'] = 'Bearer ' + token;
  if (options.body instanceof FormData) delete headers['Content-Type'];

  const res  = await fetch(API_BASE + endpoint, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err  = new Error(data.message || 'Request failed');
    err.status = res.status;
    err.data   = data;
    throw err;
  }
  return data;
}

const api = {
  get:    (url)             => apiFetch(url, { method: 'GET' }),
  post:   (url, body)       => apiFetch(url, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (url, body)       => apiFetch(url, { method: 'PUT',    body: JSON.stringify(body) }),
  patch:  (url, body)       => apiFetch(url, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: (url)             => apiFetch(url, { method: 'DELETE' }),
  upload: (url, formData)   => apiFetch(url, { method: 'POST',   body: formData }),
};

/* ── AUTH ────────────────────────────────────────────────────*/
const Auth = {
  async login(emailOrPhone, password) {
    const data = await api.post('/auth/login', { email: emailOrPhone, password });
    setToken(data.token);
    setCurrentUser(data.user);
    return data.user;
  },
  async register(payload) { return api.post('/auth/register', payload); },
  async logout() {
    try { await api.post('/auth/logout', {}); } catch {}
    clearCurrentUser();
    window.location.href = '/login.html';
  },
  async me() { return api.get('/auth/me'); },
};

/* ── REPORTS ─────────────────────────────────────────────────*/
const Reports = {
  async getAll(filters = {}) {
    const p = new URLSearchParams(filters).toString();
    return api.get('/reports' + (p ? '?' + p : ''));
  },
  async getOne(id)              { return api.get('/reports/' + id); },
  async create({ category, type, location, description, files = [] }) {
    if (files.length > 0) {
      const fd = new FormData();
      fd.append('category', category); fd.append('type', type);
      fd.append('location', location || ''); fd.append('description', description);
      files.forEach(f => fd.append('files', f));
      return api.upload('/reports', fd);
    }
    return api.post('/reports', { category, type, location, description });
  },
  async updateStatus(id, status) { return api.patch('/reports/' + id + '/status', { status }); },
  async getStats()               { return api.get('/reports/stats'); },
};

/* ── CENSUS ──────────────────────────────────────────────────*/
const Census = {
  async getAll(filters = {}) {
    const p = new URLSearchParams(filters).toString();
    return api.get('/users' + (p ? '?' + p : ''));
  },
  async getSummary()     { return api.get('/users/census-summary'); },
  async getPendingVerif(){ return api.get('/users/pending-verif'); },
  async create(data)     { return api.post('/users', data); },
  async update(id, data) { return api.put('/users/' + id, data); },
  async remove(id)       { return api.delete('/users/' + id); },
  async verify(id)       { return api.post('/users/' + id + '/verify', {}); },
  async reject(id)       { return api.post('/users/' + id + '/reject', {}); },
};

/* ── ADMINS ──────────────────────────────────────────────────*/
const Admins = {
  async getAll()      { return api.get('/admins'); },
  async create(data)  { return api.post('/admins', data); },
  async toggle(id)    { return api.patch('/admins/' + id + '/toggle', {}); },
  async remove(id)    { return api.delete('/admins/' + id); },
};

/* ── ACTIVITIES ──────────────────────────────────────────────*/
const Activities = {
  async getAll(limit = 50) { return api.get('/activities?limit=' + limit); },
};

/* ── OVERVIEW ────────────────────────────────────────────────*/
const Overview = {
  async get() { return api.get('/overview'); },
};

/* ── ERROR HANDLER ───────────────────────────────────────────*/
function handleApiError(err, alertId = null) {
  const msg = err?.data?.message || err?.message || 'An error occurred.';
  if (alertId && typeof showInlineAlert === 'function') showInlineAlert(alertId, msg, 'err');
  else if (alertId && typeof showAlert === 'function') showAlert(alertId, msg, 'err');
  else if (typeof showToast === 'function') showToast(msg, 'err');
  else alert(msg);
  if (err.status === 401) { clearCurrentUser(); window.location.href = '/login.html'; }
}
