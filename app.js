/* ═══════════════════════════════════════════════════════════
   EVENTFLOW — app.js  |  Auth + Admin Logic
   ═══════════════════════════════════════════════════════════ */

// ══════════════════════════════════════════════════════════
//  AUTH MODULE
//  - Password stored as SHA-256 hash in localStorage
//  - Session stored in sessionStorage (clears on tab close)
//  - Auto-lock after 15 min of inactivity
//  - 60s warning banner before auto-lock
// ══════════════════════════════════════════════════════════

const AUTH = {
  SESSION_KEY:  'ef_session',
  PW_HASH_KEY:  'ef_pw_hash',
  DEFAULT_PW:   'iedc@2026',
  IDLE_MS:      15 * 60 * 1000,   // 15 minutes
  WARN_MS:      14 * 60 * 1000,   // warn at 14 min (60s before lock)
};

// ── SHA-256 via Web Crypto API ────────────────────────────
async function sha256(text) {
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Ensure a default password hash exists ────────────────
async function ensureDefaultHash() {
  if (!localStorage.getItem(AUTH.PW_HASH_KEY)) {
    localStorage.setItem(AUTH.PW_HASH_KEY, await sha256(AUTH.DEFAULT_PW));
  }
}

// ── Session check ─────────────────────────────────────────
function isAuthenticated() {
  return sessionStorage.getItem(AUTH.SESSION_KEY) === 'authenticated';
}
function setSession()    { sessionStorage.setItem(AUTH.SESSION_KEY, 'authenticated'); }
function clearSession()  { sessionStorage.removeItem(AUTH.SESSION_KEY); }

// ── Show / hide login gate ────────────────────────────────
function showLoginGate() {
  document.getElementById('login-gate').style.display = 'flex';
  document.getElementById('login-pw').value = '';
  document.getElementById('login-error').classList.add('hidden');
  setTimeout(() => document.getElementById('login-pw').focus(), 100);
}
function hideLoginGate() {
  const gate = document.getElementById('login-gate');
  gate.style.opacity = '0';
  gate.style.transition = 'opacity 0.3s ease';
  setTimeout(() => { gate.style.display = 'none'; gate.style.opacity = ''; gate.style.transition = ''; }, 300);
}

// ── Login form submit ─────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const btn  = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  const pw   = document.getElementById('login-pw').value;

  btn.disabled = true;
  btn.textContent = 'Verifying…';

  const hash    = await sha256(pw);
  const stored  = localStorage.getItem(AUTH.PW_HASH_KEY);

  if (hash === stored) {
    setSession();
    hideLoginGate();
    resetIdleTimer();
    errEl.classList.add('hidden');
    initFirestoreListeners();
    renderDashboard();
  } else {
    errEl.classList.remove('hidden');
    document.getElementById('login-pw').value = '';
    document.getElementById('login-pw').focus();
    // Brief shake animation
    const input = document.getElementById('login-pw');
    input.style.animation = 'none';
    input.offsetHeight; // reflow
    input.style.animation = 'shake 0.4s ease';
  }

  btn.disabled = false;
  btn.textContent = 'Unlock Dashboard';
});

// ── Password visibility toggle ────────────────────────────
document.getElementById('toggle-login-pw').addEventListener('click', function() {
  const inp = document.getElementById('login-pw');
  const isText = inp.type === 'text';
  inp.type = isText ? 'password' : 'text';
  this.textContent = isText ? '👁' : '🙈';
});

// ── Lock button ───────────────────────────────────────────
document.getElementById('lockBtn').addEventListener('click', function() {
  lock('Locked by admin.');
});

function lock(reason) {
  clearSession();
  clearIdleTimers();
  removeBanner();
  showLoginGate();
  if (reason) {
    // Brief delay so the gate is visible before toast
    setTimeout(() => showToast(reason, 'error'), 400);
  }
}

// ══════════════════════════════════════════════════════════
//  INACTIVITY AUTO-LOCK
// ══════════════════════════════════════════════════════════
let idleWarnTimer, idleLockTimer, bannerEl;

function resetIdleTimer() {
  clearIdleTimers();
  removeBanner();
  idleWarnTimer = setTimeout(showInactivityWarning, AUTH.WARN_MS);
  idleLockTimer = setTimeout(() => lock('Session expired due to inactivity.'), AUTH.IDLE_MS);
}

function clearIdleTimers() {
  clearTimeout(idleWarnTimer);
  clearTimeout(idleLockTimer);
}

function removeBanner() {
  if (bannerEl) { bannerEl.remove(); bannerEl = null; }
}

function showInactivityWarning() {
  removeBanner();
  bannerEl = document.createElement('div');
  bannerEl.className = 'inactivity-banner';
  let secs = 60;
  bannerEl.innerHTML = `⚠️ Session locking in <strong id="idle-countdown">60</strong>s due to inactivity. &nbsp;
    <button id="idle-stay">Stay logged in</button>`;
  document.body.prepend(bannerEl);

  const countdown = document.getElementById('idle-countdown');
  const ticker = setInterval(() => {
    secs--;
    if (countdown) countdown.textContent = secs;
    if (secs <= 0) clearInterval(ticker);
  }, 1000);

  document.getElementById('idle-stay').addEventListener('click', () => {
    clearInterval(ticker);
    resetIdleTimer();
  });
}

// Reset idle timer on user activity
['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(ev => {
  document.addEventListener(ev, () => { if (isAuthenticated()) resetIdleTimer(); }, { passive: true });
});

// ══════════════════════════════════════════════════════════
//  CHANGE PASSWORD MODAL
// ══════════════════════════════════════════════════════════
document.getElementById('openChangePwModal').addEventListener('click', () => {
  document.getElementById('changepw-modal-overlay').classList.remove('hidden');
  document.getElementById('changepw-form').reset();
  document.getElementById('cpw-error').classList.add('hidden');
});
document.getElementById('closeChangePwModal').addEventListener('click', closeChangePw);
document.getElementById('cancelChangePw').addEventListener('click', closeChangePw);
document.getElementById('changepw-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('changepw-modal-overlay')) closeChangePw();
});

function closeChangePw() {
  document.getElementById('changepw-modal-overlay').classList.add('hidden');
  document.getElementById('changepw-form').reset();
}

document.getElementById('changepw-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const errEl   = document.getElementById('cpw-error');
  const current = document.getElementById('cpw-current').value;
  const newPw   = document.getElementById('cpw-new').value;
  const confirm = document.getElementById('cpw-confirm').value;

  const currentHash = await sha256(current);
  const stored      = localStorage.getItem(AUTH.PW_HASH_KEY);

  if (currentHash !== stored) {
    errEl.textContent = 'Current password is incorrect.';
    errEl.classList.remove('hidden'); return;
  }
  if (newPw !== confirm) {
    errEl.textContent = 'New passwords do not match.';
    errEl.classList.remove('hidden'); return;
  }
  if (newPw.length < 6) {
    errEl.textContent = 'Password must be at least 6 characters.';
    errEl.classList.remove('hidden'); return;
  }

  localStorage.setItem(AUTH.PW_HASH_KEY, await sha256(newPw));
  closeChangePw();
  showToast('Password updated! 🔒', 'success');
});

// ── Shake keyframe (injected dynamically) ─────────────────
const _shakeStyle = document.createElement('style');
_shakeStyle.textContent = `@keyframes shake {
  0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 60%{transform:translateX(8px)} 80%{transform:translateX(-4px)}
}`;
document.head.appendChild(_shakeStyle);

/* ═══════════════════════════════════════════════════════════
   FIREBASE + APP LOGIC
   ═══════════════════════════════════════════════════════════ */

// ── Firebase init ──────────────────────────────────────────
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ── In-memory cache (kept in sync by Firestore listeners) ──
let _events = [];
let _regs   = [];
function loadEvents() { return _events; }
function loadRegs()   { return _regs; }

// ── Toast ──────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'default') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = `toast ${type}`; el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

// ── Format helpers ─────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':'); const hr = +h;
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}
function fmtTS(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' +
         d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── View navigation ────────────────────────────────────────
const VIEWS = ['dashboard', 'responses'];
function switchView(name) {
  VIEWS.forEach(v => {
    const viewEl = document.getElementById(`view-${v}`);
    const tabEl  = document.getElementById(`tab-${v}`);
    if (viewEl) viewEl.classList.toggle('active', v === name);
    if (tabEl)  tabEl.classList.toggle('active', v === name);
  });
  if (name === 'responses') renderResponsesView();
  if (name === 'dashboard') renderDashboard();
}

// ══════════════════════════════════════════════════════════
// FORM BUILDER
// ══════════════════════════════════════════════════════════
let _customFields = [];   // Array of { id, type, label, required, options[] }
let _fieldCounter  = 0;

const FIELD_TYPES = {
  text:     'Short answer',
  paragraph:'Paragraph',
  choice:   'Multiple choice',
  checkbox: 'Checkboxes',
  dropdown: 'Dropdown',
  number:   'Number',
};

function fbUid() { return 'cf_' + (++_fieldCounter); }

function addField(type = 'text') {
  const id  = fbUid();
  const field = { id, type, label: '', required: false, options: ['Option 1'] };
  _customFields.push(field);
  renderFieldCard(field);
}

function renderFieldCard(field) {
  const list = document.getElementById('custom-fields-list');
  const card = document.createElement('div');
  card.className = 'fb-field-card';
  card.dataset.fieldId = field.id;
  card.innerHTML = buildCardHTML(field);
  list.appendChild(card);
  bindCardEvents(card, field);
}

function buildCardHTML(field) {
  const typeOpts = Object.entries(FIELD_TYPES)
    .map(([v, l]) => `<option value="${v}" ${v===field.type?'selected':''}>${l}</option>`).join('');
  const optionsHTML = needsOptions(field.type) ? buildOptionsHTML(field) : '';
  return `
    <div class="fb-field-top">
      <input class="fb-field-label-input" type="text" placeholder="Question" value="${escHtml(field.label)}" data-role="label" />
      <select class="fb-type-select" data-role="type">${typeOpts}</select>
      <button type="button" class="fb-remove-btn" data-role="remove" title="Remove">✕</button>
    </div>
    <div class="fb-options-wrap">${optionsHTML}</div>
    <div class="fb-field-bottom">
      <label class="fb-required-toggle">
        <div class="toggle-switch${field.required?' on':''}" data-role="reqswitch"></div>
        Required
      </label>
    </div>`;
}

function buildOptionsHTML(field) {
  const rows = (field.options||['Option 1']).map((opt, i) => `
    <div class="fb-option-row">
      <input class="fb-option-input" type="text" value="${escHtml(opt)}" placeholder="Option ${i+1}" data-role="option" data-idx="${i}" />
      <button type="button" class="fb-option-del" data-role="optdel" data-idx="${i}" title="Remove option">✕</button>
    </div>`).join('');
  return `${rows}<button type="button" class="fb-add-option" data-role="addoption">+ Add option</button>`;
}

function needsOptions(type) { return ['choice','checkbox','dropdown'].includes(type); }

function bindCardEvents(card, field) {
  // Label change
  card.querySelector('[data-role="label"]').addEventListener('input', e => { field.label = e.target.value; });

  // Type change
  card.querySelector('[data-role="type"]').addEventListener('change', e => {
    field.type = e.target.value;
    if (needsOptions(field.type) && (!field.options || !field.options.length)) field.options = ['Option 1'];
    card.innerHTML = buildCardHTML(field);
    bindCardEvents(card, field);
  });

  // Required toggle
  card.querySelector('[data-role="reqswitch"]').addEventListener('click', el => {
    field.required = !field.required;
    el.target.classList.toggle('on', field.required);
  });

  // Remove card
  card.querySelector('[data-role="remove"]').addEventListener('click', () => {
    _customFields = _customFields.filter(f => f.id !== field.id);
    card.remove();
  });

  // Options (if applicable)
  if (needsOptions(field.type)) {
    // Option text change
    card.querySelectorAll('[data-role="option"]').forEach(inp => {
      inp.addEventListener('input', e => {
        field.options[+e.target.dataset.idx] = e.target.value;
      });
    });
    // Delete option
    card.querySelectorAll('[data-role="optdel"]').forEach(btn => {
      btn.addEventListener('click', e => {
        const idx = +e.currentTarget.dataset.idx;
        if (field.options.length <= 1) return;
        field.options.splice(idx, 1);
        card.querySelector('.fb-options-wrap').innerHTML = buildOptionsHTML(field);
        bindCardEvents(card, field);
      });
    });
    // Add option
    card.querySelector('[data-role="addoption"]').addEventListener('click', () => {
      field.options.push(`Option ${field.options.length + 1}`);
      card.querySelector('.fb-options-wrap').innerHTML = buildOptionsHTML(field);
      bindCardEvents(card, field);
    });
  }
}

document.getElementById('addFieldBtn').addEventListener('click', () => addField('text'));

function openModal() {
  _customFields = [];
  _fieldCounter  = 0;
  document.getElementById('custom-fields-list').innerHTML = '';
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-overlay').classList.add('visible');
  document.getElementById('ev-date').value = new Date().toISOString().split('T')[0];
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('create-event-form').reset();
  document.getElementById('custom-fields-list').innerHTML = '';
  _customFields = [];
}
document.getElementById('openCreateModal').addEventListener('click', openModal);
document.getElementById('heroCreate').addEventListener('click', openModal);
document.getElementById('closeModal').addEventListener('click', closeModal);
document.getElementById('cancelModal').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

document.getElementById('create-event-form').addEventListener('submit', async e => {
  e.preventDefault();
  const title = document.getElementById('ev-title').value.trim();
  const date  = document.getElementById('ev-date').value;
  if (!title || !date) return showToast('Title and date are required.', 'error');

  // Validate custom fields
  for (const f of _customFields) {
    if (!f.label.trim()) return showToast('All questions must have a label.', 'error');
    if (needsOptions(f.type) && f.options.some(o => !o.trim())) return showToast('All options must have text.', 'error');
  }

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Creating…';

  try {
    const newDocRef = db.collection('events').doc();
    await newDocRef.set({
      id:           newDocRef.id,
      title, date,
      time:         document.getElementById('ev-time').value,
      venue:        document.getElementById('ev-venue').value.trim(),
      desc:         document.getElementById('ev-desc').value.trim(),
      category:     document.getElementById('ev-category').value,
      seats:        document.getElementById('ev-seats').value ? +document.getElementById('ev-seats').value : null,
      customFields: _customFields.map(f => ({ id: f.id, type: f.type, label: f.label.trim(), required: f.required, options: f.options||[] })),
      createdAt:    firebase.firestore.FieldValue.serverTimestamp(),
    });
    closeModal();
    showToast(`"${title}" created! 🎉`, 'success');
  } catch(err) {
    console.error(err);
    showToast('Error creating event. Check Firebase config.', 'error');
  }
  btn.disabled = false; btn.textContent = 'Create Event';
});

// ── Firestore real-time listeners ─────────────────────────
function initFirestoreListeners() {
  db.collection('events').orderBy('createdAt', 'desc').onSnapshot(snap => {
    _events = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const active = document.querySelector('.view.active');
    if (!active) return;
    const v = active.id.replace('view-', '');
    if (v === 'dashboard') renderDashboard();
    if (v === 'responses') renderResponsesView();
  }, err => {
    console.error('Firestore events error:', err);
    showToast('Could not load events. Check Firebase config.', 'error');
  });

  db.collection('registrations').orderBy('createdAt', 'desc').onSnapshot(snap => {
    _regs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const active = document.querySelector('.view.active');
    if (!active) return;
    const v = active.id.replace('view-', '');
    if (v === 'dashboard') renderDashboard();
    if (v === 'responses') renderResponsesView();
  }, err => console.error('Firestore regs error:', err));
}

// ══════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════
function renderDashboard() {
  const events = loadEvents();
  const regs   = loadRegs();
  const grid   = document.getElementById('events-grid');
  const empty  = document.getElementById('empty-events');
  const badge  = document.getElementById('event-count-badge');

  badge.textContent = `${events.length} event${events.length !== 1 ? 's' : ''}`;

  if (events.length === 0) {
    grid.innerHTML = ''; grid.appendChild(empty); empty.classList.remove('hidden'); return;
  }
  empty.classList.add('hidden');
  grid.innerHTML = events.map(ev => {
    const count    = regs.filter(r => r.eventId === ev.id).length;
    const seatInfo = ev.seats ? `${count}/${ev.seats} seats` : `${count} registered`;
    return `
      <article class="event-card" data-id="${ev.id}">
        <span class="card-category cat-${ev.category}">${ev.category}</span>
        <div class="card-title">${escHtml(ev.title)}</div>
        <div class="card-desc">${ev.desc ? escHtml(ev.desc).slice(0,100) + (ev.desc.length>100?'…':'') : 'No description provided.'}</div>
        <div class="card-meta">
          <span class="meta-item"><span class="meta-icon">📅</span>${fmtDate(ev.date)}</span>
          ${ev.time  ? `<span class="meta-item"><span class="meta-icon">🕐</span>${fmtTime(ev.time)}</span>` : ''}
          ${ev.venue ? `<span class="meta-item"><span class="meta-icon">📍</span>${escHtml(ev.venue)}</span>` : ''}
        </div>
        <div class="card-footer">
          <span class="reg-count">✅ ${seatInfo}</span>
          <div class="card-actions">
            <button class="action-btn link-btn" onclick="openLink('${ev.id}')">↗️ Open</button>
            <button class="action-btn link-btn" onclick="copyLink('${ev.id}')">🔗 Copy</button>
            <button class="action-btn" onclick="goResponses('${ev.id}')">Responses</button>
            <button class="action-btn danger" onclick="deleteEvent('${ev.id}')">Delete</button>
          </div>
        </div>
      </article>`;
  }).join('');
}

function openLink(eventId) {
  const base = window.location.href.replace(/\/[^/]*(\?.*)?$/, '').replace(/index\.html$/, '');
  const url  = `${base}/register.html?id=${eventId}`;
  window.open(url, '_blank');
}

function copyLink(eventId) {
  const base = window.location.href.replace(/\/[^/]*(\?.*)?$/, '').replace(/index\.html$/, '');
  const url  = `${base}/register.html?id=${eventId}`;
  navigator.clipboard.writeText(url).then(() => showToast('Link copied! 🔗', 'success'))
    .catch(() => prompt('Copy this link:', url));
}

function goResponses(eventId) {
  switchView('responses');
  setTimeout(() => {
    const sel = document.getElementById('filter-event');
    if (sel) { sel.value = eventId; renderResponsesTable(); }
  }, 50);
}

async function deleteEvent(eventId) {
  if (!confirm('Delete this event and all its registrations?')) return;
  try {
    const snap  = await db.collection('registrations').where('eventId','==',eventId).get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(db.collection('events').doc(eventId));
    await batch.commit();
    showToast('Event deleted', 'error');
  } catch(err) { console.error(err); showToast('Error deleting event.', 'error'); }
}

// ══════════════════════════════════════════════════════════
// RESPONSES VIEW
// ══════════════════════════════════════════════════════════
function renderResponsesView() {
  const events = loadEvents();
  const sel    = document.getElementById('filter-event');
  const prev   = sel.value;
  sel.innerHTML = '<option value="all">All Events</option>';
  events.forEach(ev => {
    const opt = document.createElement('option');
    opt.value = ev.id; opt.textContent = ev.title; sel.appendChild(opt);
  });
  sel.value = events.find(e => e.id === prev) ? prev : 'all';
  renderResponsesTable();
}

function renderResponsesTable() {
  const regs    = loadRegs();
  const query   = document.getElementById('filter-search').value.toLowerCase().trim();
  const eventId = document.getElementById('filter-event').value;

  let filtered = regs;
  if (eventId !== 'all') filtered = filtered.filter(r => r.eventId === eventId);
  if (query)             filtered = filtered.filter(r =>
    r.name.toLowerCase().includes(query) || (r.email||'').toLowerCase().includes(query) || (r.rollno||'').toLowerCase().includes(query)
  );

  document.getElementById('responses-meta').textContent = `${filtered.length} registration${filtered.length!==1?'s':''}`;
  const table = document.getElementById('responses-table');
  const empty = document.getElementById('empty-responses');
  const tbody = document.getElementById('responses-tbody');

  if (filtered.length === 0) { table.classList.add('hidden'); empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden'); table.classList.remove('hidden');

  tbody.innerHTML = filtered.map((r, i) => `
    <tr>
      <td>${i+1}</td>
      <td>${escHtml(r.name)}</td>
      <td>${r.className ? escHtml(r.className) : '—'}</td>
      <td>${r.rollno   ? escHtml(r.rollno.toUpperCase())  : '—'}</td>
      <td>${r.admission ? escHtml(r.admission) : '—'}</td>
      <td>${escHtml(r.email||'')}</td>
      <td><span class="event-pill" title="${escHtml(r.eventName)}">${escHtml(r.eventName)}</span></td>
      <td class="ts-cell">${fmtTS(r.createdAt)}</td>
      <td><button class="del-btn" title="Delete" onclick="deleteReg('${r.id}')">🗑️</button></td>
    </tr>`).join('');
}

async function deleteReg(regId) {
  if (!confirm('Remove this registration?')) return;
  try {
    await db.collection('registrations').doc(regId).delete();
    showToast('Registration removed', 'error');
  } catch(err) { console.error(err); showToast('Error removing.','error'); }
}

function exportExcel() {
  const regs = loadRegs();
  const eventId = document.getElementById('filter-event').value;
  const query = document.getElementById('filter-search').value.toLowerCase().trim();

  let filtered = regs;
  if (eventId !== 'all') filtered = filtered.filter(r => r.eventId === eventId);
  if (query) filtered = filtered.filter(r =>
    r.name.toLowerCase().includes(query) || (r.email||'').toLowerCase().includes(query) || (r.rollno||'').toLowerCase().includes(query)
  );

  if (filtered.length === 0) return showToast('No data to export', 'error');

  // Format data for Excel
  const data = filtered.map((r, i) => {
    const row = {
      'S.No': i + 1,
      'Name': r.name,
      'Class/Semester': r.className || '',
      'Roll No': r.rollno ? r.rollno.toUpperCase() : '',
      'Admission No': r.admission || '',
      'Email': r.email || '',
      'Phone': r.phone || '',
      'Event Name': r.eventName,
      'Registered At': r.createdAt ? new Date(r.createdAt.toDate ? r.createdAt.toDate() : r.createdAt).toLocaleString('en-IN') : ''
    };

    // Add any custom field answers dynamically
    if (r.answers) {
      // Find the event to get the custom field labels
      const ev = loadEvents().find(e => e.id === r.eventId);
      if (ev && ev.customFields) {
        ev.customFields.forEach(cf => {
          if (r.answers[cf.id] !== undefined) {
            row[cf.label] = r.answers[cf.id];
          }
        });
      } else {
        // Fallback if event is deleted but registration remains
        Object.keys(r.answers).forEach(k => {
          row[`Custom Field (${k})`] = r.answers[k];
        });
      }
    }
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Registrations");

  let filename = "IEDC_Registrations.xlsx";
  if (eventId !== 'all') {
    const ev = loadEvents().find(e => e.id === eventId);
    if (ev) filename = `${ev.title.replace(/[^a-z0-9]/gi, '_')}_Registrations.xlsx`;
  }

  XLSX.writeFile(wb, filename);
}

document.getElementById('filter-event').addEventListener('change', renderResponsesTable);
document.getElementById('filter-search').addEventListener('input',  renderResponsesTable);
document.getElementById('exportExcelBtn').addEventListener('click', exportExcel);

// ══════════════════════════════════════════════════════════
// NAV TABS
// ══════════════════════════════════════════════════════════
document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// ══════════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════════
(async function boot() {
  await ensureDefaultHash();
  if (!isAuthenticated()) {
    showLoginGate();
  } else {
    hideLoginGate();
    resetIdleTimer();
    initFirestoreListeners();
  }
})();

// Start Firestore listeners when login succeeds (patch login handler)
document.getElementById('login-form').addEventListener('submit', () => {
  // After a short delay, if now authenticated, start listeners
  setTimeout(() => {
    if (isAuthenticated() && _events.length === 0 && _regs.length === 0) {
      initFirestoreListeners();
    }
  }, 400);
});
