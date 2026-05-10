/* ============================================================
   eWatch — Login Page Logic (Real API)
   ============================================================ */

function switchTab(tab, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
  (btn || document.querySelectorAll('.tab')[tab === 'login' ? 0 : 1]).classList.add('active');
  document.getElementById('p-' + tab).classList.add('active');
  ['le','ls','re','rs'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
}

function togglePwd(inputId, btn) {
  const f = document.getElementById(inputId);
  f.type = f.type === 'password' ? 'text' : 'password';
  btn.textContent = f.type === 'password' ? '👁' : '🙈';
}

function fillDemo(email, password) {
  document.getElementById('li').value = email;
  document.getElementById('lp').value = password;
}

function calcAgeField() {
  const v = document.getElementById('rBD').value;
  if (!v) return;
  document.getElementById('rAG').value = calcAge(v);
}

/* ── LOGIN ── */
async function doLogin() {
  const inp = document.getElementById('li').value.trim();
  const pw  = document.getElementById('lp').value;
  if (!inp || !pw) { showAlert('le', 'Please fill in all fields.', 'err'); return; }

  const btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.textContent = 'Signing in…';

  try {
    const user = await Auth.login(inp, pw);
    showAlert('ls', `Welcome, ${user.name}! Redirecting…`, 'ok');
    setTimeout(() => {
      if      (user.role === 'super-admin') location.href = '/superadmin.html';
      else if (user.role === 'admin')       location.href = '/admin.html';
      else                                  location.href = '/user.html';
    }, 700);
  } catch (err) {
    showAlert('le', err.data?.message || 'Invalid credentials.', 'err');
    btn.disabled = false; btn.textContent = 'Sign In →';
  }
}

/* ── REGISTER ── */
async function doRegister() {
  const name   = document.getElementById('rN').value.trim();
  const email  = document.getElementById('rEM').value.trim();
  const pw     = document.getElementById('rPW').value;
  const phone  = document.getElementById('rPH').value.trim();
  const purok  = document.getElementById('rPK').value;
  const birth  = document.getElementById('rBD').value;
  const age    = parseInt(document.getElementById('rAG').value) || null;

  if (!name || !email || !pw) { showAlert('re', 'Please fill in all required fields.', 'err'); return; }
  if (pw.length < 6)          { showAlert('re', 'Password must be at least 6 characters.', 'err'); return; }

  const btn = document.getElementById('regBtn');
  btn.disabled = true; btn.textContent = 'Creating account…';

  try {
    await Auth.register({ name, email, phone: phone ? '09' + phone : null, password: pw, purok, birth_date: birth || null, age });
    showAlert('rs', `Account created! A confirmation email has been sent to ${email}. Awaiting barangay verification.`, 'ok');
    setTimeout(() => switchTab('login', null), 3500);
  } catch (err) {
    showAlert('re', err.data?.message || 'Registration failed. Please try again.', 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'Create Account →';
  }
}

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', () => {
  // Redirect if already logged in
  const user = getCurrentUser();
  if (user && getToken()) {
    if      (user.role === 'super-admin') location.href = '/superadmin.html';
    else if (user.role === 'admin')       location.href = '/admin.html';
    else                                  location.href = '/user.html';
  }
});