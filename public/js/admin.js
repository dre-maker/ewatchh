/* ============================================================
   eWatch — Admin & Super Admin Dashboard (Real API)
   ============================================================ */

let _editResIdx  = -1;   // -1 = add new
let _editResId   = null; // DB id when editing
let _chartInst   = null;

/* ── INIT ── */
async function initDashboard() {
  const user = getCurrentUser();
  if (!user || !getToken()) { location.href = 'login.html'; return; }

  const page = location.pathname.split('/').pop();
  if (page === 'superadmin.html' && user.role !== 'super-admin') { location.href = 'login.html'; return; }
  if (page === 'admin.html'      && !['admin','super-admin'].includes(user.role)) { location.href = 'login.html'; return; }

  setText('topAv', getInitials(user.name));
  autoCalcAge();

  // Refresh user info from server
  try { const fresh = await Auth.me(); setCurrentUser(fresh); } catch {}

  await renderAll();
  setTimeout(buildChart, 100);
}

function autoCalcAge() {
  const bd = document.getElementById('mRBD');
  if (!bd) return;
  bd.addEventListener('change', () => {
    const a = calcAge(bd.value);
    const ageEl = document.getElementById('mRA');
    const srEl  = document.getElementById('mRSr');
    if (ageEl) ageEl.value = a;
    if (srEl)  srEl.value  = a >= 60 ? '1' : '0';
  });
}

/* ── BADGES ── */
async function updateBadges() {
  try {
    const [rStats, unv] = await Promise.all([
      Reports.getStats(),
      Census.getPendingVerif(),
    ]);
    setText('pendBadge',  rStats.pending  || 0);
    setText('verifBadge', Array.isArray(unv) ? unv.length : 0);
  } catch {}
}

/* ── RENDER ALL ── */
async function renderAll() {
  await updateBadges();
  await Promise.all([
    renderOverview(),
    renderCensus(),
    renderReports(),
    renderVerif(),
    renderActivities(),
  ]);
  if (typeof renderAdmins === 'function') await renderAdmins();
}

/* ── OVERVIEW ── */
async function renderOverview() {
  try {
    const ov = await Overview.get();
    const r  = ov.reports;
    // Admin overview stats (admin.html uses these IDs as big numbers)
    setText('ov-res',  ov.residents?.total_residents || 0);
    setText('ov-rep',  r?.total_reports || 0);
    setText('ov-pend', r?.pending || 0);
    setText('ov-done', r?.done || 0);
    // Super admin overview (superadmin.html uses ov-resN etc. as numbers, ov-res etc. as trend pills)
    setText('ov-resN',      ov.residents?.total_residents || 0);
    setText('ov-repN',      r?.total_reports || 0);
    setText('ov-admN',      ov.admins?.active_admins || 0);
    setText('ov-pendN',     r?.pending || 0);
    // Only set trend labels if those elements exist (superadmin only)
    if (document.getElementById('ov-adm-trend')) {
      setText('ov-res',       (ov.residents?.total_residents||0) + ' total');
      setText('ov-rep',       (r?.total_reports||0) + ' total');
      setText('ov-adm-trend', (ov.admins?.active_admins||0) + ' active');
      setText('ov-pend',      (r?.pending||0) + ' open');
    }

    // Top list
    const tl = document.getElementById('topList');
    if (tl && ov.top_reporters?.length) {
      const max = ov.top_reporters[0].report_count || 1;
      tl.innerHTML = ov.top_reporters.map((x, i) => `
        <div class="top-item">
          <div class="rank">${i+1}</div>
          <div class="top-name">${x.name}</div>
          <div class="top-bar"><div class="top-fill" style="width:${Math.round(x.report_count/max*100)}%"></div></div>
          <div class="top-cnt">${x.report_count}</div>
        </div>`).join('');
    } else if (tl) {
      tl.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:.5rem 0">No reports yet.</div>';
    }

    // Recent reports
    const rr = document.getElementById('recentR');
    if (rr) {
      rr.innerHTML = (ov.recent_reports || []).map(rep => `
        <div class="act-item">
          <div class="act-dot" style="background:${rep.status==='Done'?'var(--green)':rep.status==='Pending'?'var(--amber)':'var(--blue)'}"></div>
          <div>
            <div class="act-txt">${rep.user_name} — ${rep.type}</div>
            <div class="act-time">${formatDate(rep.created_at)} · ${statusBadge(rep.status)}</div>
          </div>
        </div>`).join('') || '<div style="color:var(--text3);font-size:13px;padding:.5rem 0">No reports yet.</div>';
    }

    // Recent activities
    const ra = document.getElementById('recentA');
    if (ra) {
      ra.innerHTML = (ov.recent_activities || []).map(a => `
        <div class="act-item">
          <div class="act-dot"></div>
          <div>
            <div class="act-txt">${a.action}</div>
            <div class="act-time">${formatDate(a.created_at)}</div>
          </div>
        </div>`).join('') || '<div style="color:var(--text3);font-size:13px;padding:.5rem 0">No activities yet.</div>';
    }
  } catch (err) { console.error('Overview error', err); }
}

/* ── CHART ── */
async function buildChart() {
  const canvas = document.getElementById('ovChart');
  if (!canvas) return;
  try {
    const s = await Reports.getStats();
    if (_chartInst) _chartInst.destroy();
    _chartInst = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Pending','In Progress','Done'],
        datasets: [{
          data: [s.pending||.001, s.in_progress||.001, s.done||.001],
          backgroundColor: ['rgba(217,119,6,.82)','rgba(37,99,235,.82)','rgba(5,150,105,.82)'],
          borderColor: ['#d97706','#2563eb','#059669'],
          borderWidth: 2, hoverOffset: 6,
        }],
      },
      options: { cutout:'70%', responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } } },
    });
  } catch {}
}

/* ── CENSUS ── */
async function renderCensus() {
  try {
    const q   = document.getElementById('cSrch')?.value?.toLowerCase() || '';
    const fp  = document.getElementById('cPk')?.value || '';
    const fg  = document.getElementById('cGn')?.value || '';
    const ft  = document.getElementById('cTg')?.value || '';

    const filters = {};
    if (fp) filters.purok  = fp;
    if (fg) filters.gender = fg;
    if (ft) filters.tag    = ft;
    if (q)  filters.search = q;

    const [result, summary] = await Promise.all([
      Census.getAll(filters),
      Census.getSummary(),
    ]);

    const list = result.data || result;
    const s    = summary;
    const pct  = (n, d) => d ? Math.round(n/d*100)+'%' : '0%';

    setText('cc-total',  s.total||0);  setText('cc-male',   s.male||0);
    setText('cc-female', s.female||0); setText('cc-senior', s.senior||0); setText('cc-pwd', s.pwd||0);
    setText('cc-mpct',   pct(s.male,s.total));   setText('cc-fpct',   pct(s.female,s.total));
    setText('cc-srpct',  pct(s.senior,s.total)); setText('cc-pwdpct', pct(s.pwd,s.total));

    const cntEl = document.getElementById('cCnt');
    if (cntEl) cntEl.textContent = (list.length||0) + ' resident' + (list.length!==1?'s':'');

    const tb = document.getElementById('censusTbody');
    const em = document.getElementById('cEmpty');
    if (!tb) return;
    if (!list.length) { tb.innerHTML=''; if(em) em.style.display='block'; return; }
    if (em) em.style.display='none';

    tb.innerHTML = list.map(r => {
      const isSr = r.is_senior || r.age >= 60;
      return `<tr>
        <td class="nm">${r.name}</td>
        <td>${purokBadge(r.purok)}</td>
        <td style="font-family:var(--mono)">${r.age||'—'}</td>
        <td>${r.gender?`<span class="badge ${r.gender==='Male'?'b-male':'b-female'}">${r.gender}</span>`:'—'}</td>
        <td style="font-size:12px">${formatDate(r.birth_date)}</td>
        <td>
          ${isSr?'<span class="badge b-emergency" style="margin-right:3px">Senior</span>':''}
          ${r.is_pwd?'<span class="badge b-teal">PWD</span>':''}
        </td>
        <td style="display:flex;gap:6px">
          <button class="btn btn-warn"   onclick="openResModal('edit','${r.id}','${r.name}','${r.purok||''}','${r.birth_date||''}','${r.age||''}','${r.gender||''}','${r.is_senior?1:0}','${r.is_pwd?1:0}','${r.phone||''}')">✏</button>
          <button class="btn btn-danger" onclick="delResident('${r.id}','${r.name}')">✕</button>
        </td>
      </tr>`;
    }).join('');
  } catch (err) { console.error('Census error', err); }
}

/* ── REPORTS ── */
async function renderReports() {
  try {
    const q  = document.getElementById('rSrch')?.value?.toLowerCase() || '';
    const rs = document.getElementById('rSt')?.value || '';
    const rc = document.getElementById('rCt')?.value || '';
    const filters = {};
    if (rs) filters.status   = rs;
    if (rc) filters.category = rc;
    if (q)  filters.search   = q;

    const result = await Reports.getAll(filters);
    const list   = result.data || [];

    const cnt = document.getElementById('rCnt');
    if (cnt) cnt.textContent = (result.total||list.length) + ' report' + (list.length!==1?'s':'');

    const tb = document.getElementById('reportsTbody');
    const em = document.getElementById('rEmpty');
    if (!tb) return;
    if (!list.length) { tb.innerHTML=''; if(em) em.style.display='block'; return; }
    if (em) em.style.display='none';

    tb.innerHTML = list.map((r, i) => `<tr>
      <td style="font-family:var(--mono);font-size:11px;color:var(--text3)">${String(i+1).padStart(2,'0')}</td>
      <td class="nm" style="min-width:130px">
        <div>${r.type}</div>
        <div style="font-size:11px;color:var(--text2)">${r.category}</div>
      </td>
      <td style="min-width:120px">${r.user_name}</td>
      <td style="min-width:100px;font-size:12.5px">${r.location||'—'}</td>
      <td style="min-width:160px;font-size:12.5px">${(r.description||'').length>55?(r.description).slice(0,55)+'…':r.description}</td>
      <td style="min-width:90px;font-size:12px">${formatDate(r.created_at)}</td>
      <td style="min-width:90px">${statusBadge(r.status)}</td>
      <td style="min-width:160px;display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-info"   onclick="viewReport('${r.id}')">👁 View</button>
        <button class="btn btn-warn"   onclick="cycleStatus('${r.id}','${r.status}')">↻ Update</button>
      </td>
    </tr>`).join('');
  } catch (err) { console.error('Reports error', err); }
}

const STATUS_ORDER = ['Pending','In Progress','Done'];
async function cycleStatus(id, current) {
  const next = STATUS_ORDER[(STATUS_ORDER.indexOf(current)+1) % 3];
  try {
    await Reports.updateStatus(id, next);
    showToast(`Status → "${next}"`);
    await renderAll(); setTimeout(buildChart, 100);
  } catch (err) { handleApiError(err); }
}

/* ── VIEW REPORT MODAL ── */
async function viewReport(id) {
  try {
    const r = await Reports.getOne(id);
    const el = document.getElementById('viewReportBody');
    if (!el) return;

    const statusColors = { 'Pending':'b-pending', 'In Progress':'b-inprogress', 'Done':'b-done' };
    const filesHtml = r.files && r.files.length
      ? r.files.map(f => `
          <a href="/api/uploads/${f.filename}" target="_blank"
             style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:var(--bg);border:1.5px solid var(--border);border-radius:8px;font-size:12px;color:var(--indigo);text-decoration:none;font-weight:600">
            📎 ${f.original}
          </a>`).join('')
      : '<span style="color:var(--text3);font-size:13px">No attachments</span>';

    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:18px;font-weight:800;color:var(--text)">${r.type}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:2px">${r.category}</div>
        </div>
        <span class="badge ${statusColors[r.status]||'b-ind'}" style="font-size:13px;padding:5px 14px">${r.status}</span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:1rem">
        <div style="background:var(--bg);border-radius:8px;padding:12px">
          <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Reported by</div>
          <div style="font-size:14px;font-weight:600;color:var(--text)">${r.user_name}</div>
          <div style="font-size:12px;color:var(--text2)">${r.user_email||''}</div>
        </div>
        <div style="background:var(--bg);border-radius:8px;padding:12px">
          <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Location</div>
          <div style="font-size:14px;font-weight:600;color:var(--text)">${r.location||'—'}</div>
          <div style="font-size:12px;color:var(--text2)">${r.purok||''}</div>
        </div>
        <div style="background:var(--bg);border-radius:8px;padding:12px">
          <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Date submitted</div>
          <div style="font-size:14px;font-weight:600;color:var(--text)">${formatDate(r.created_at)}</div>
        </div>
        <div style="background:var(--bg);border-radius:8px;padding:12px">
          <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Report ID</div>
          <div style="font-size:14px;font-weight:600;color:var(--text);font-family:var(--mono)">#${String(r.id).padStart(4,'0')}</div>
        </div>
      </div>

      <div style="background:var(--bg);border-radius:8px;padding:14px;margin-bottom:1rem">
        <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Description</div>
        <div style="font-size:14px;color:var(--text);line-height:1.6">${r.description}</div>
      </div>

      <div style="margin-bottom:1rem">
        <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Attachments</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">${filesHtml}</div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:1rem;border-top:1px solid var(--border)">
        <button class="btn btn-green"  onclick="cycleStatusFromModal('${r.id}','${r.status}','Pending')">Set Pending</button>
        <button class="btn btn-info"   onclick="cycleStatusFromModal('${r.id}','${r.status}','In Progress')">Set In Progress</button>
        <button class="btn btn-warn"   onclick="cycleStatusFromModal('${r.id}','${r.status}','Done')">Set Done</button>
        <button class="btn btn-cancel" onclick="closeModal('viewReportModal')" style="margin-left:auto">Close</button>
      </div>`;

    openModal('viewReportModal');
  } catch (err) { handleApiError(err); }
}

async function cycleStatusFromModal(id, current, newStatus) {
  try {
    await Reports.updateStatus(id, newStatus);
    showToast(`Status → "${newStatus}"`);
    closeModal('viewReportModal');
    await renderAll(); setTimeout(buildChart, 100);
  } catch (err) { handleApiError(err); }
}

/* ── VERIFICATIONS ── */
async function renderVerif() {
  try {
    const unv = await Census.getPendingVerif();
    const tb  = document.getElementById('verifTbody');
    const em  = document.getElementById('vEmpty');
    if (!tb) return;
    if (!unv.length) { tb.innerHTML=''; if(em) em.style.display='block'; return; }
    if (em) em.style.display='none';

    tb.innerHTML = unv.map(u => `<tr>
      <td class="nm">${u.name}</td>
      <td style="font-size:12.5px">${u.email}</td>
      <td style="font-size:12.5px">${u.phone||'—'}</td>
      <td>${purokBadge(u.purok)}</td>
      <td style="font-size:12px">${formatDate(u.created_at)}</td>
      <td><span class="pending-tag">⏳ Pending</span></td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-green"  id="vbtn_${u.id}" onclick="verifyUser('${u.id}','${u.name}')">✓ Verify &amp; Email</button>
        <button class="btn btn-danger" onclick="rejectUser('${u.id}','${u.name}')">✕ Reject</button>
      </td>
    </tr>`).join('');
  } catch (err) { console.error('Verif error', err); }
}

async function verifyUser(id, name) {
  const btn = document.getElementById('vbtn_' + id);
  if (btn) { btn.disabled=true; btn.textContent='Sending…'; }
  try {
    const res = await Census.verify(id);
    showToast(`✓ "${name}" verified! ${res.emailSent?'Email sent.':''}`, 'ok');
    await renderAll();
  } catch (err) { handleApiError(err); if(btn){btn.disabled=false;btn.textContent='✓ Verify & Email';} }
}

async function rejectUser(id, name) {
  if (!confirm(`Reject and remove "${name}"'s account registration?`)) return;
  try {
    await Census.reject(id);
    showToast(`"${name}" rejected.`, 'err');
    await renderAll();
  } catch (err) { handleApiError(err); }
}

/* ── ACTIVITIES ── */
async function renderActivities() {
  try {
    const acts = await Activities.getAll(20);
    const el   = document.getElementById('actList');
    if (!el) return;
    el.innerHTML = acts.map(a => `
      <div class="act-item">
        <div class="act-dot"></div>
        <div>
          <div class="act-txt">${a.action}</div>
          <div class="act-time">${formatDate(a.created_at)}</div>
        </div>
      </div>`).join('');
  } catch {}
}

/* ── RESIDENT MODAL ── */
function openResModal(mode, id, name, purok, birth, age, gender, senior, pwd, phone) {
  _editResId = (mode === 'edit') ? id : null;
  setText('resModalTitle', mode === 'edit' ? 'Edit Resident' : 'Add Resident');
  document.getElementById('mRN').value   = name   || '';
  document.getElementById('mRP').value   = purok  || '';
  document.getElementById('mRBD').value  = birth  || '';
  document.getElementById('mRA').value   = age    || '';
  document.getElementById('mRG').value   = gender || '';
  document.getElementById('mRSr').value  = senior || '0';
  document.getElementById('mRPWD').value = pwd    || '0';
  const phEl = document.getElementById('mRPhone');
  if (phEl) phEl.value = (phone||'').replace(/^09/, '');
  openModal('resModal');
}

async function saveResident() {
  const name   = document.getElementById('mRN').value.trim();
  const purok  = document.getElementById('mRP').value;
  if (!name || !purok) { showToast('Name and purok are required.', 'err'); return; }

  const birth  = document.getElementById('mRBD').value;
  const age    = parseInt(document.getElementById('mRA').value) || null;
  const gender = document.getElementById('mRG').value;
  const senior = document.getElementById('mRSr').value  === '1';
  const pwd    = document.getElementById('mRPWD').value === '1';
  const rawPh  = document.getElementById('mRPhone')?.value || '';
  const phone  = rawPh ? '09' + rawPh : null;

  const payload = { name, purok, birth_date: birth||null, age, gender:gender||null, is_senior:senior, is_pwd:pwd, phone };

  try {
    if (_editResId) {
      await Census.update(_editResId, payload);
      showToast(`"${name}" updated!`);
    } else {
      await Census.create(payload);
      showToast(`"${name}" added!`);
    }
    closeModal('resModal');
    await renderAll();
  } catch (err) { handleApiError(err); }
}

async function delResident(id, name) {
  if (!confirm(`Remove "${name}" from the census?`)) return;
  try {
    await Census.remove(id);
    showToast('Resident removed.', 'err');
    await renderAll();
  } catch (err) { handleApiError(err); }
}

/* ── SUPER ADMIN: Admins ── */
async function renderAdmins() {
  try {
    const el   = document.getElementById('adminGrid');
    if (!el) return;
    const list = await Admins.getAll();
    el.innerHTML = list.map(a => `
      <div class="admin-card">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:.75rem">
          <div class="admin-av">${getInitials(a.name)}</div>
          <div>
            <div class="admin-name">${a.name}</div>
            <div class="admin-email">${a.email}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:.5rem">
          <span class="badge b-ind">${a.role}</span>
          <span class="badge ${a.status==='active'?'b-active':'b-inactive'}">${a.status==='active'?'Active':'Inactive'}</span>
        </div>
        <div class="admin-foot">
          <button class="btn btn-warn"   onclick="toggleAdmin('${a.id}','${a.name}')">${a.status==='active'?'Deactivate':'Activate'}</button>
          <button class="btn btn-danger" onclick="delAdmin('${a.id}','${a.name}')">✕ Delete</button>
        </div>
      </div>`).join('');
  } catch (err) { console.error('Admins error', err); }
}

function openAdmModal() { openModal('admModal'); }

async function saveAdmin() {
  const name  = document.getElementById('mAN').value.trim();
  const email = document.getElementById('mAE').value.trim();
  const role  = document.getElementById('mAR').value;
  if (!name || !email) { showToast('Name and email required.', 'err'); return; }
  try {
    const res = await Admins.create({ name, email, role });
    document.getElementById('mAN').value = '';
    document.getElementById('mAE').value = '';
    closeModal('admModal');
    showToast(`Admin "${name}" added! Default password: admin123`);
    await renderAdmins();
  } catch (err) { handleApiError(err); }
}

async function toggleAdmin(id, name) {
  try {
    const res = await Admins.toggle(id);
    showToast(`Admin ${res.status}.`);
    await renderAdmins();
  } catch (err) { handleApiError(err); }
}

async function delAdmin(id, name) {
  if (!confirm(`Delete admin "${name}"?`)) return;
  try {
    await Admins.remove(id);
    showToast('Admin deleted.', 'err');
    await renderAdmins();
  } catch (err) { handleApiError(err); }
}

document.addEventListener('DOMContentLoaded', initDashboard);