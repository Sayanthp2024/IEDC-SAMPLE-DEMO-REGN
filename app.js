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

// ══════════════════════════════════════════════════════════
//  BOOT: check session before revealing any admin UI
// ══════════════════════════════════════════════════════════
(async function boot() {
  await ensureDefaultHash();

  if (!isAuthenticated()) {
    showLoginGate();
    // Prevent admin UI from flashing before gate is up (gate is in HTML by default)
  } else {
    // Already logged in (page refresh within same tab session)
    hideLoginGate();
    resetIdleTimer();
    renderDashboard();
  }
})();

// ── Shake keyframe (injected dynamically) ─────────────────
const _shakeStyle = document.createElement('style');
_shakeStyle.textContent = `@keyframes shake {
  0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 60%{transform:translateX(8px)} 80%{transform:translateX(-4px)}
}`;
document.head.appendChild(_shakeStyle);

/* ═══════════════════════════════════════
   EVENTFLOW — app.js  |  All logic
   ═══════════════════════════════════════ */

// ── Storage helpers ─────────────────────────────────────
const STORAGE_KEYS = { events: 'ef_events', registrations: 'ef_regs' };

function loadEvents() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.events) || '[]');
}
function saveEvents(arr) {
  localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(arr));
}
function loadRegs() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.registrations) || '[]');
}
function saveRegs(arr) {
  localStorage.setItem(STORAGE_KEYS.registrations, JSON.stringify(arr));
}

// ── UID generator ────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Toast ────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'default') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

// ── View navigation ──────────────────────────────────────
const VIEWS = ['dashboard', 'register', 'responses'];
function switchView(name) {
  VIEWS.forEach(v => {
    document.getElementById(`view-${v}`).classList.toggle('active', v === name);
    document.getElementById(`tab-${v}`).classList.toggle('active', v === name);
  });
  if (name === 'register')  renderRegisterView();
  if (name === 'responses') renderResponsesView();
  if (name === 'dashboard') renderDashboard();
}

// ── Format helpers ───────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = +h; const ampm = hr >= 12 ? 'PM' : 'AM';
  return `${hr % 12 || 12}:${m} ${ampm}`;
}
function fmtTS(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' +
         d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
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
    grid.innerHTML = '';
    grid.appendChild(empty);
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = events.map(ev => {
    const count = regs.filter(r => r.eventId === ev.id).length;
    const seatInfo = ev.seats
      ? `${count}/${ev.seats} seats`
      : `${count} registered`;
    return `
      <article class="event-card" data-id="${ev.id}">
        <span class="card-category cat-${ev.category}">${ev.category}</span>
        <div class="card-title">${escHtml(ev.title)}</div>
        <div class="card-desc">${ev.desc ? escHtml(ev.desc).slice(0, 100) + (ev.desc.length > 100 ? '…' : '') : 'No description provided.'}</div>
        <div class="card-meta">
          <span class="meta-item"><span class="meta-icon">📅</span>${fmtDate(ev.date)}</span>
          ${ev.time ? `<span class="meta-item"><span class="meta-icon">🕐</span>${fmtTime(ev.time)}</span>` : ''}
          ${ev.venue ? `<span class="meta-item"><span class="meta-icon">📍</span>${escHtml(ev.venue)}</span>` : ''}
        </div>
        <div class="card-footer">
          <span class="reg-count">✅ ${seatInfo}</span>
          <div class="card-actions">
            <button class="action-btn link-btn" onclick="copyLink('${ev.id}')" title="Copy registration link">🔗 Copy Link</button>
            <button class="action-btn" onclick="goResponses('${ev.id}')">Responses</button>
            <button class="action-btn danger" onclick="deleteEvent('${ev.id}')">Delete</button>
          </div>
        </div>
      </article>`;
  }).join('');
}

function goRegister(eventId) {
  switchView('register');
  setTimeout(() => selectEventForReg(eventId), 50);
}

// Build shareable link for the standalone register.html page
function copyLink(eventId) {
  const base = window.location.href.replace(/\/[^/]*$/, '').replace(/index\.html$/, '');
  const url  = `${base}/register.html?id=${eventId}`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Registration link copied! 🔗', 'success');
  }).catch(() => {
    // Fallback: show the URL
    prompt('Copy this registration link:', url);
  });
}

function goResponses(eventId) {
  switchView('responses');
  // auto-filter to that event
  setTimeout(() => {
    const sel = document.getElementById('filter-event');
    if (sel) { sel.value = eventId; renderResponsesTable(); }
  }, 50);
}

function deleteEvent(eventId) {
  if (!confirm('Delete this event and all its registrations?')) return;
  const events = loadEvents().filter(e => e.id !== eventId);
  const regs   = loadRegs().filter(r => r.eventId !== eventId);
  saveEvents(events);
  saveRegs(regs);
  renderDashboard();
  showToast('Event deleted', 'error');
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ══════════════════════════════════════════════════════════
// CREATE EVENT MODAL
// ══════════════════════════════════════════════════════════
function openModal() {
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-overlay').classList.add('visible');
  // set default date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('ev-date').value = today;
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('create-event-form').reset();
}

document.getElementById('openCreateModal').addEventListener('click', openModal);
document.getElementById('heroCreate').addEventListener('click', openModal);
document.getElementById('closeModal').addEventListener('click', closeModal);
document.getElementById('cancelModal').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

document.getElementById('create-event-form').addEventListener('submit', e => {
  e.preventDefault();
  const title = document.getElementById('ev-title').value.trim();
  const date  = document.getElementById('ev-date').value;
  if (!title || !date) return showToast('Title and date are required.', 'error');

  const ev = {
    id:       uid(),
    title,
    date,
    time:     document.getElementById('ev-time').value,
    venue:    document.getElementById('ev-venue').value.trim(),
    desc:     document.getElementById('ev-desc').value.trim(),
    category: document.getElementById('ev-category').value,
    seats:    document.getElementById('ev-seats').value ? +document.getElementById('ev-seats').value : null,
    createdAt: Date.now(),
  };

  const events = loadEvents();
  events.push(ev);
  saveEvents(events);
  closeModal();
  renderDashboard();
  showToast(`"${ev.title}" created! 🎉`, 'success');
});

// ══════════════════════════════════════════════════════════
// REGISTER VIEW
// ══════════════════════════════════════════════════════════
let selectedEventId = null;

function renderRegisterView() {
  const events   = loadEvents();
  const list     = document.getElementById('reg-event-list');
  const form     = document.getElementById('reg-form');
  const ph       = document.getElementById('reg-placeholder');
  const success  = document.getElementById('reg-success');

  form.classList.add('hidden');
  success.classList.add('hidden');
  ph.classList.remove('hidden');
  selectedEventId = null;

  if (events.length === 0) {
    list.innerHTML = `<p style="color:var(--text-3);font-size:0.85rem;">No events yet. <a href="#" id="go-create-link" style="color:var(--accent-3);text-decoration:none;font-weight:600;">Create one?</a></p>`;
    document.getElementById('go-create-link')?.addEventListener('click', e => {
      e.preventDefault();
      openModal();
    });
    return;
  }

  list.innerHTML = events.map(ev => `
    <div class="reg-event-item" data-id="${ev.id}" onclick="selectEventForReg('${ev.id}')">
      <div class="rei-title">${escHtml(ev.title)}</div>
      <div class="rei-date">${fmtDate(ev.date)}</div>
    </div>
  `).join('');
}

function selectEventForReg(eventId) {
  const events = loadEvents();
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;

  selectedEventId = eventId;

  // highlight item
  document.querySelectorAll('.reg-event-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.id === eventId);
  });

  // show form
  document.getElementById('reg-placeholder').classList.add('hidden');
  document.getElementById('reg-success').classList.add('hidden');
  const form = document.getElementById('reg-form');
  form.classList.remove('hidden');
  form.reset();

  const info = document.getElementById('reg-selected-info');
  info.innerHTML = `
    <div class="sei-title">${escHtml(ev.title)}</div>
    <div class="sei-meta">
      📅 ${fmtDate(ev.date)}${ev.time ? ' · 🕐 ' + fmtTime(ev.time) : ''}${ev.venue ? ' · 📍 ' + escHtml(ev.venue) : ''}
    </div>`;

  // Check seat availability
  const regs  = loadRegs();
  const count = regs.filter(r => r.eventId === eventId).length;
  if (ev.seats && count >= ev.seats) {
    document.getElementById('reg-submit').disabled = true;
    document.getElementById('reg-submit').textContent = 'Seats full 😔';
  } else {
    document.getElementById('reg-submit').disabled = false;
    document.getElementById('reg-submit').textContent = 'Register Now';
  }
}

function submitRegistration(eventId, formFields) {
  const events = loadEvents();
  const ev     = events.find(e => e.id === eventId);
  if (!ev) return { ok: false, msg: 'Event not found.' };

  const regs  = loadRegs();
  const count = regs.filter(r => r.eventId === eventId).length;
  if (ev.seats && count >= ev.seats) return { ok: false, msg: 'Sorry, seats are full!' };

  // Duplicate check by roll number
  if (regs.find(r => r.eventId === eventId && r.rollno.toLowerCase() === formFields.rollno.toLowerCase())) {
    return { ok: false, msg: 'This roll number is already registered for this event.' };
  }

  const reg = {
    id:        uid(),
    eventId,
    eventName: ev.title,
    ...formFields,
    createdAt: Date.now(),
  };
  regs.push(reg);
  saveRegs(regs);
  return { ok: true, reg, ev };
}

document.getElementById('reg-form').addEventListener('submit', e => {
  e.preventDefault();
  if (!selectedEventId) return;

  const result = submitRegistration(selectedEventId, {
    name:      document.getElementById('reg-name').value.trim(),
    className: document.getElementById('reg-class').value.trim(),
    rollno:    document.getElementById('reg-rollno').value.trim(),
    admission: document.getElementById('reg-admission').value.trim(),
    email:     document.getElementById('reg-email').value.trim().toLowerCase(),
    phone:     document.getElementById('reg-phone').value.trim(),
  });

  if (!result.ok) return showToast(result.msg, 'error');

  // Show success
  document.getElementById('reg-form').classList.add('hidden');
  document.getElementById('reg-placeholder').classList.add('hidden');
  const successEl = document.getElementById('reg-success');
  successEl.classList.remove('hidden');
  document.getElementById('reg-success-msg').textContent =
    `${result.reg.name}, you're registered for "${result.ev.title}" on ${fmtDate(result.ev.date)}. See you there!`;

  showToast('Registration successful! 🎉', 'success');
  renderDashboard();
});

document.getElementById('reg-again').addEventListener('click', () => {
  renderRegisterView();
});

// ══════════════════════════════════════════════════════════
// RESPONSES VIEW
// ══════════════════════════════════════════════════════════
function renderResponsesView() {
  const events = loadEvents();
  const sel    = document.getElementById('filter-event');

  // Rebuild event dropdown (preserve current selection)
  const prev = sel.value;
  sel.innerHTML = '<option value="all">All Events</option>';
  events.forEach(ev => {
    const opt = document.createElement('option');
    opt.value = ev.id;
    opt.textContent = ev.title;
    sel.appendChild(opt);
  });
  sel.value = events.find(e => e.id === prev) ? prev : 'all';

  renderResponsesTable();
}

function renderResponsesTable() {
  const regs     = loadRegs();
  const query    = document.getElementById('filter-search').value.toLowerCase().trim();
  const eventId  = document.getElementById('filter-event').value;

  let filtered = regs;
  if (eventId !== 'all') filtered = filtered.filter(r => r.eventId === eventId);
  if (query)             filtered = filtered.filter(r =>
    r.name.toLowerCase().includes(query) || r.email.toLowerCase().includes(query)
  );

  document.getElementById('responses-meta').textContent =
    `${filtered.length} registration${filtered.length !== 1 ? 's' : ''}`;

  const table = document.getElementById('responses-table');
  const empty = document.getElementById('empty-responses');
  const tbody = document.getElementById('responses-tbody');

  if (filtered.length === 0) {
    table.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  table.classList.remove('hidden');

  tbody.innerHTML = filtered.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escHtml(r.name)}</td>
      <td>${r.className ? escHtml(r.className) : '—'}</td>
      <td>${r.rollno ? escHtml(r.rollno) : '—'}</td>
      <td>${r.admission ? escHtml(r.admission) : '—'}</td>
      <td>${escHtml(r.email)}</td>
      <td><span class="event-pill" title="${escHtml(r.eventName)}">${escHtml(r.eventName)}</span></td>
      <td class="ts-cell">${fmtTS(r.createdAt)}</td>
      <td><button class="del-btn" title="Delete" onclick="deleteReg('${r.id}')">🗑</button></td>
    </tr>
  `).join('');
}

function deleteReg(regId) {
  if (!confirm('Remove this registration?')) return;
  const regs = loadRegs().filter(r => r.id !== regId);
  saveRegs(regs);
  renderResponsesTable();
  renderDashboard();
  showToast('Registration removed', 'error');
}

document.getElementById('filter-event').addEventListener('change', renderResponsesTable);
document.getElementById('filter-search').addEventListener('input',  renderResponsesTable);

// ══════════════════════════════════════════════════════════
// NAV TABS
// ══════════════════════════════════════════════════════════
document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});
