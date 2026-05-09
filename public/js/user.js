/* ============================================================
   eWatch — User Dashboard Logic (Real API)
   ============================================================ */

let _selectedCat  = 'Crime & Safety';
let _uploadedFiles = [];
let _chartInst     = null;

/* ── INIT ── */
async function initUser() {
  const user = getCurrentUser();
  if (!user || !getToken()) { location.href = 'login.html'; return; }
  if (user.role !== 'user') { location.href = 'login.html'; return; }

  // Refresh from DB
  try {
    const fresh = await Auth.me();
    setCurrentUser(fresh);
    renderProfile(fresh);
  } catch { renderProfile(user); }

  buildCatGrid();
  populateTypes(_selectedCat);
  await renderUserAll();
}

function renderProfile(u) {
  setText('topAv',    getInitials(u.name));
  setText('sideAv',   getInitials(u.name));
  setText('sideName',  u.name);
  setText('welcomeName', 'Hi, ' + u.name.split(' ')[0] + ' 👋');

  const verifEl = document.getElementById('sideVerif');
  if (verifEl) {
    verifEl.textContent = u.verified ? '✓ Verified' : '⏳ Pending verification';
    verifEl.className   = 'u-prof-badge ' + (u.verified ? 'verified' : 'unverified');
  }
  const banner = document.getElementById('verifyBanner');
  if (banner) banner.style.display = u.verified ? 'none' : 'flex';
}

/* ── PAGE NAV ── */
function goUserPage(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('pg-' + id)?.classList.add('active');
  if (el) el.classList.add('active');
  closeSidebar();
  if (id === 'overview') setTimeout(buildUserChart, 80);
  document.querySelector('.main')?.scrollTo(0, 0);
}

/* ── RENDER ALL ── */
async function renderUserAll() {
  await Promise.all([
    renderUserStats(),
    renderUserRecent(),
    renderUserHistory(),
    buildUserChart(),
    buildUserInfo(),
  ]);
}

/* ── STATS ── */
async function renderUserStats() {
  try {
    const s = await Reports.getStats();
    setText('u-total', s.total        || 0);
    setText('u-pend',  s.pending      || 0);
    setText('u-prog',  s.in_progress  || 0);
    setText('u-done',  s.done         || 0);
  } catch {}
}

/* ── CHART ── */
async function buildUserChart() {
  const canvas = document.getElementById('uChart');
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
          borderColor:     ['#d97706','#2563eb','#059669'],
          borderWidth: 2, hoverOffset: 6,
        }],
      },
      options: { cutout:'70%', responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } } },
    });
  } catch {}
}

/* ── RECENT REPORTS ── */
async function renderUserRecent() {
  const el = document.getElementById('u-recentR');
  if (!el) return;
  try {
    const result = await Reports.getAll({ limit: 5 });
    const list   = result.data || [];
    if (!list.length) {
      el.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--text3);font-size:13px">No reports yet. Submit your first report!</div>';
      return;
    }
    const dot = s => s==='Done'?'var(--green)':s==='Pending'?'var(--amber)':'var(--blue)';
    el.innerHTML = list.map(r => `
      <div class="act-item">
        <div class="act-dot" style="background:${dot(r.status)}"></div>
        <div style="flex:1;min-width:0">
          <div class="act-txt">${r.type}</div>
          <div class="act-time">${r.location||''} · ${formatDate(r.created_at)} · ${statusBadge(r.status)}</div>
        </div>
      </div>`).join('');
  } catch {}
}

/* ── MY REPORTS TABLE ── */
async function renderUserHistory() {
  const q  = document.getElementById('hSrch')?.value?.toLowerCase() || '';
  const hs = document.getElementById('hSt')?.value || '';
  const filters = {};
  if (hs) filters.status = hs;
  if (q)  filters.search = q;

  const tb = document.getElementById('histTbody');
  const em = document.getElementById('hEmpty');
  const cn = document.getElementById('hCnt');
  if (!tb) return;

  try {
    const result = await Reports.getAll({ ...filters, limit: 200 });
    const list   = result.data || [];
    if (cn) cn.textContent = list.length + ' report' + (list.length!==1?'s':'');
    if (!list.length) { tb.innerHTML=''; if(em) em.style.display='block'; return; }
    if (em) em.style.display='none';

    tb.innerHTML = list.map((r, i) => `<tr>
      <td style="font-family:var(--mono);font-size:11px;color:var(--text3)">${String(i+1).padStart(2,'0')}</td>
      <td class="nm" style="min-width:130px">
        <div>${r.type}</div><div style="font-size:11px;color:var(--text2)">${r.category}</div>
      </td>
      <td style="min-width:100px;font-size:12.5px">${r.location||'—'}</td>
      <td style="min-width:160px;font-size:12.5px">${(r.description||'').length>55?r.description.slice(0,55)+'…':r.description}</td>
      <td style="min-width:70px">${r.file_count>0?`<span class="badge b-ind">📎 ${r.file_count}</span>`:'<span style="color:var(--text3);font-size:12px">—</span>'}</td>
      <td style="min-width:90px">${statusBadge(r.status)}</td>
      <td style="min-width:90px;font-size:12px">${formatDate(r.created_at)}</td>
    </tr>`).join('');
  } catch (err) { console.error(err); }
}

/* ── CATEGORY GRID ── */
function buildCatGrid() {
  const el = document.getElementById('catGrid');
  if (!el) return;
  el.innerHTML = Object.keys(REPORT_TYPES).map((k, i) => `
    <div class="cat-btn ${i===0?'sel':''}" onclick="selectCat('${k}',this)">
      <span class="cat-emoji">${CATEGORY_EMOJIS[k]||'📋'}</span>${k}
    </div>`).join('');
}

function selectCat(cat, el) {
  _selectedCat = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('sel'));
  el.classList.add('sel');
  populateTypes(cat);
}

function populateTypes(cat) {
  const types = REPORT_TYPES[cat] || [];
  const sel   = document.getElementById('repType');
  const hint  = document.getElementById('typeHint');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Select type --</option>' + types.map(t => `<option>${t}</option>`).join('');
  if (hint) hint.style.display = 'none';
  sel.onchange = () => {
    if (hint && sel.value) { hint.style.display='block'; hint.textContent='📌 Reporting: '+sel.value; }
    else if (hint) hint.style.display='none';
  };
}

/* ── FILE UPLOAD ── */
function onDragOver(e)  { e.preventDefault(); document.getElementById('uploadZone').style.borderColor='var(--indigo)'; }
function onDragLeave()  { document.getElementById('uploadZone').style.borderColor=''; }
function onDrop(e)      { e.preventDefault(); onDragLeave(); handleFiles(e.dataTransfer.files); }

function handleFiles(files) {
  Array.from(files).forEach(f => {
    if (f.size > 10*1024*1024)                                      { showToast(f.name+' exceeds 10MB.','err'); return; }
    if (!f.type.startsWith('image/')&&!f.type.startsWith('video/')) { showToast('Only photos/videos allowed.','err'); return; }
    if (_uploadedFiles.length >= 5)                                  { showToast('Maximum 5 files.','err'); return; }
    _uploadedFiles.push(f);
  });
  renderFilePreviews();
}

function renderFilePreviews() {
  const grid = document.getElementById('previewGrid');
  const prev = document.getElementById('filePreview');
  if (!grid) return;
  if (!_uploadedFiles.length) { if(prev) prev.style.display='none'; return; }
  if (prev) prev.style.display = 'block';
  grid.innerHTML = _uploadedFiles.map((f, i) => `
    <div style="display:flex;flex-direction:column;align-items:center">
      <div class="prev-item">
        ${f.type.startsWith('image/')?`<img src="${URL.createObjectURL(f)}" alt="${f.name}">`:'<span style="font-size:22px">🎥</span>'}
        <div class="prev-rm" onclick="removeFile(${i})">✕</div>
      </div>
      <div class="prev-name">${f.name}</div>
    </div>`).join('');
}

function removeFile(i) { _uploadedFiles.splice(i,1); renderFilePreviews(); }

/* ── SUBMIT REPORT ── */
async function submitReport() {
  const user = getCurrentUser();
  if (!user?.verified) {
    showInlineAlert('fErr','Your account is pending verification. You cannot submit reports yet.','err');
    return;
  }
  const type = document.getElementById('repType').value;
  const loc  = document.getElementById('repLoc').value;
  const desc = document.getElementById('repDesc').value.trim();
  if (!type) { showInlineAlert('fErr','Please select a specific report type.','err'); return; }
  if (!loc)  { showInlineAlert('fErr','Please select a location/purok.','err'); return; }
  if (!desc) { showInlineAlert('fErr','Please describe your report.','err'); return; }

  const btn = document.querySelector('.btn-submit');
  if (btn) { btn.disabled=true; btn.textContent='Submitting…'; }

  try {
    await Reports.create({
      category:    _selectedCat,
      type, location: loc, description: desc,
      files: _uploadedFiles,
    });

    // Reset form
    document.getElementById('repType').value = '';
    document.getElementById('repLoc').value  = '';
    document.getElementById('repDesc').value = '';
    const hint = document.getElementById('typeHint');
    if (hint) hint.style.display = 'none';
    const fileInput = document.getElementById('fileInp');
    if (fileInput) fileInput.value = '';
    _uploadedFiles = [];
    renderFilePreviews();

    showInlineAlert('fOk','Report submitted! Barangay officials will review it shortly.','ok');
    showToast('Report submitted! ✓');
    await renderUserAll();
  } catch (err) {
    handleApiError(err, 'fErr');
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='✉ Submit Report'; }
  }
}

/* ── ACCOUNT INFO ── */
async function buildUserInfo() {
  const u  = getCurrentUser();
  const el = document.getElementById('acctInfo');
  if (!el || !u) return;
  el.innerHTML = `
    <div class="info-row"><div class="info-lbl">Name</div>   <div class="info-val">${u.name}</div></div>
    <div class="info-row"><div class="info-lbl">Email</div>  <div class="info-val">${u.email}</div></div>
    <div class="info-row"><div class="info-lbl">Mobile</div> <div class="info-val">${u.phone||'—'}</div></div>
    <div class="info-row"><div class="info-lbl">Purok</div>  <div class="info-val">${u.purok||'—'}</div></div>
    <div class="info-row"><div class="info-lbl">Gender</div> <div class="info-val">${u.gender||'—'}</div></div>
    <div class="info-row"><div class="info-lbl">Role</div>   <div class="info-val"><span class="badge b-ind">Resident</span></div></div>
    <div class="info-row"><div class="info-lbl">Status</div> <div class="info-val">${u.verified
      ?'<span class="badge b-done">✓ Verified</span>'
      :'<span class="badge b-pending">⏳ Pending verification</span>'
    }</div></div>`;
}

document.addEventListener('DOMContentLoaded', initUser);
