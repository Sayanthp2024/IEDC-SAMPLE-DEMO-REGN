/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   EVENTFLOW â€” app.js  |  Auth + Admin Logic
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  AUTH MODULE
//  - Password stored as SHA-256 hash in localStorage
//  - Session stored in sessionStorage (clears on tab close)
//  - Auto-lock after 15 min of inactivity
//  - 60s warning banner before auto-lock
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const AUTH = {
  SESSION_KEY:  'ef_session',
  PW_HASH_KEY:  'ef_pw_hash',
  DEFAULT_PW:   'iedc@2026',
  IDLE_MS:      15 * 60 * 1000,   // 15 minutes
  WARN_MS:      14 * 60 * 1000,   // warn at 14 min (60s before lock)
};

// â”€â”€ SHA-256 via Web Crypto API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function sha256(text) {
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// â”€â”€ Ensure a default password hash exists â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function ensureDefaultHash() {
  if (!localStorage.getItem(AUTH.PW_HASH_KEY)) {
    localStorage.setItem(AUTH.PW_HASH_KEY, await sha256(AUTH.DEFAULT_PW));
  }
}

// â”€â”€ Session check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function isAuthenticated() {
  return sessionStorage.getItem(AUTH.SESSION_KEY) === 'authenticated';
}
function setSession()    { sessionStorage.setItem(AUTH.SESSION_KEY, 'authenticated'); }
function clearSession()  { sessionStorage.removeItem(AUTH.SESSION_KEY); }

// â”€â”€ Show / hide login gate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Login form submit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.getElementById('login-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const btn  = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  const pw   = document.getElementById('login-pw').value;

  btn.disabled = true;
  btn.textContent = 'Verifyingâ€¦';

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

// â”€â”€ Password visibility toggle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.getElementById('toggle-login-pw').addEventListener('click', function() {
  const inp = document.getElementById('login-pw');
  const isText = inp.type === 'text';
  inp.type = isText ? 'password' : 'text';
  this.textContent = isText ? 'ðŸ‘' : 'ðŸ™ˆ';
});

// â”€â”€ Lock button â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  INACTIVITY AUTO-LOCK
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
  bannerEl.innerHTML = `âš ï¸ Session locking in <strong id="idle-countdown">60</strong>s due to inactivity. &nbsp;
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  CHANGE PASSWORD MODAL
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
  showToast('Password updated! ðŸ”’', 'success');
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  BOOT: check session before revealing any admin UI
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
(async function boot() {
  await ensureDefaultHash();

  if (!isAuthenticated()) {
    showLoginGate();
    // Prevent admin UI from flashing before gate is up (gate is in HTML by default)
  } else {
    // Already logged in (page refresh within same tab session)
    hideLoginGate();
    resetIdleTimer();
  }
})();

// â”€â”€ Shake keyframe (injected dynamically) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const _shakeStyle = document.createElement('style');
_shakeStyle.textContent = `@keyframes shake {
  0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 60%{transform:translateX(8px)} 80%{transform:translateX(-4px)}
}`;
document.head.appendChild(_shakeStyle);

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   FIREBASE + APP LOGIC
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

// â”€â”€ Firebase init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// â”€â”€ In-memory cache (kept in sync by Firestore listeners) â”€
let _events = [];
let _regs   = [];
function loadEvents() { return _events; }
function loadRegs()   { return _regs; }

// â”€â”€ Toast â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let toastTimer;
function showToast(msg, type = 'default') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = `toast ${type}`; el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

// â”€â”€ Format helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function fmtDate(iso) {
  if (!iso) return 'â€”';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':'); const hr = +h;
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}
function fmtTS(ts) {
  if (!ts) return 'â€”';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' +
         d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// â”€â”€ View navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    await db.collection('events').add({
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

// ——— Firestore real-time listeners ————————————————————————
function initFirestoreListeners() {
  db.collection('events').orderBy('createdAt', 'desc').onSnapshot(snap => {
    _events = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const active = document.querySelector('.view.active');
    if (!active) return;
    const v = active.id.replace('view-', '');
    if (v === 'dashboard') renderDashboard();
    if (v === 'register')  renderRegisterView();
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
        <div class="card-desc">${ev.desc ? escHtml(ev.desc).slice(0,100) + (ev.desc.length>100?'â€¦':'') : 'No description provided.'}</div>
        <div class="card-meta">
          <span class="meta-item"><span class="meta-icon">ðŸ“…</span>${fmtDate(ev.date)}</span>
          ${ev.time  ? `<span class="meta-item"><span class="meta-icon">ðŸ•</span>${fmtTime(ev.time)}</span>` : ''}
          ${ev.venue ? `<span class="meta-item"><span class="meta-icon">ðŸ“</span>${escHtml(ev.venue)}</span>` : ''}
        </div>
        <div class="card-footer">
          <span class="reg-count">âœ… ${seatInfo}</span>
          <div class="card-actions">
            <button class="action-btn link-btn" onclick="copyLink('${ev.id}')">ðŸ”— Copy Link</button>
            <button class="action-btn" onclick="goResponses('${ev.id}')">Responses</button>
            <button class="action-btn danger" onclick="deleteEvent('${ev.id}')">Delete</button>
          </div>
        </div>
      </article>`;
  }).join('');
}

function copyLink(eventId) {
  const base = window.location.href.replace(/\/[^/]*(\?.*)?$/, '').replace(/index\.html$/, '');
  const url  = `${base}/register.html?id=${eventId}`;
  navigator.clipboard.writeText(url).then(() => showToast('Link copied! ðŸ”—', 'success'))
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CREATE EVENT MODAL
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function openModal() {
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-overlay').classList.add('visible');
  document.getElementById('ev-date').value = new Date().toISOString().split('T')[0];
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

document.getElementById('create-event-form').addEventListener('submit', async e => {
  e.preventDefault();
  const title = document.getElementById('ev-title').value.trim();
  const date  = document.getElementById('ev-date').value;
  if (!title || !date) return showToast('Title and date are required.', 'error');

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Creatingâ€¦';

  try {
    await db.collection('events').add({
      title, date,
      time:      document.getElementById('ev-time').value,
      venue:     document.getElementById('ev-venue').value.trim(),
      desc:      document.getElementById('ev-desc').value.trim(),
      category:  document.getElementById('ev-category').value,
      seats:     document.getElementById('ev-seats').value ? +document.getElementById('ev-seats').value : null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    closeModal();
    showToast(`"${title}" created! ðŸŽ‰`, 'success');
  } catch(err) {
    console.error(err);
    showToast('Error creating event. Check Firebase config.', 'error');
  }
  btn.disabled = false; btn.textContent = 'Create Event';
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// REGISTER VIEW (in-app)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
let selectedEventId = null;

function renderRegisterView() {
  const events  = loadEvents();
  const list    = document.getElementById('reg-event-list');
  const form    = document.getElementById('reg-form');
  const ph      = document.getElementById('reg-placeholder');
  const success = document.getElementById('reg-success');

  form.classList.add('hidden'); success.classList.add('hidden'); ph.classList.remove('hidden');
  selectedEventId = null;

  if (events.length === 0) {
    list.innerHTML = `<p style="color:var(--text-3);font-size:0.85rem;">No events yet. <a href="#" id="go-create-link" style="color:var(--accent-3);text-decoration:none;font-weight:600;">Create one?</a></p>`;
    document.getElementById('go-create-link')?.addEventListener('click', e => { e.preventDefault(); openModal(); });
    return;
  }
  list.innerHTML = events.map(ev => `
    <div class="reg-event-item" data-id="${ev.id}" onclick="selectEventForReg('${ev.id}')">
      <div class="rei-title">${escHtml(ev.title)}</div>
      <div class="rei-date">${fmtDate(ev.date)}</div>
    </div>`).join('');
}

function selectEventForReg(eventId) {
  const ev = loadEvents().find(e => e.id === eventId);
  if (!ev) return;
  selectedEventId = eventId;
  document.querySelectorAll('.reg-event-item').forEach(el => el.classList.toggle('selected', el.dataset.id === eventId));

  document.getElementById('reg-placeholder').classList.add('hidden');
  document.getElementById('reg-success').classList.add('hidden');
  const form = document.getElementById('reg-form');
  form.classList.remove('hidden'); form.reset();

  document.getElementById('reg-selected-info').innerHTML = `
    <div class="sei-title">${escHtml(ev.title)}</div>
    <div class="sei-meta">ðŸ“… ${fmtDate(ev.date)}${ev.time?' Â· ðŸ• '+fmtTime(ev.time):''}${ev.venue?' Â· ðŸ“ '+escHtml(ev.venue):''}</div>`;

  const count = loadRegs().filter(r => r.eventId === eventId).length;
  const btn   = document.getElementById('reg-submit');
  if (ev.seats && count >= ev.seats) { btn.disabled = true; btn.textContent = 'Seats full ðŸ˜”'; }
  else { btn.disabled = false; btn.textContent = 'Register Now'; }
}

document.getElementById('reg-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!selectedEventId) return;
  const btn = document.getElementById('reg-submit');
  btn.disabled = true; btn.textContent = 'Submittingâ€¦';

  const ev     = loadEvents().find(x => x.id === selectedEventId);
  const rollno = document.getElementById('reg-rollno').value.trim().toLowerCase();

  try {
    const dup = await db.collection('registrations').where('eventId','==',selectedEventId).where('rollno','==',rollno).get();
    if (!dup.empty) { showToast('Roll number already registered.','error'); btn.disabled=false; btn.textContent='Register Now'; return; }

    const snap = await db.collection('registrations').where('eventId','==',selectedEventId).get();
    if (ev.seats && snap.size >= ev.seats) { showToast('Seats are full!','error'); btn.disabled=false; btn.textContent='Register Now'; return; }

    const name = document.getElementById('reg-name').value.trim();
    await db.collection('registrations').add({
      eventId: selectedEventId, eventName: ev.title, name,
      className: document.getElementById('reg-class').value.trim(),
      rollno,
      admission: document.getElementById('reg-admission').value.trim(),
      email:     document.getElementById('reg-email').value.trim().toLowerCase(),
      phone:     document.getElementById('reg-phone').value.trim(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    document.getElementById('reg-form').classList.add('hidden');
    document.getElementById('reg-placeholder').classList.add('hidden');
    document.getElementById('reg-success').classList.remove('hidden');
    document.getElementById('reg-success-msg').textContent =
      `${name}, you're registered for "${ev.title}" on ${fmtDate(ev.date)}. See you there!`;
    showToast('Registration successful! ðŸŽ‰', 'success');

  } catch(err) {
    console.error(err); showToast('Submission failed. Try again.','error');
    btn.disabled=false; btn.textContent='Register Now';
  }
});

document.getElementById('reg-again').addEventListener('click', () => renderRegisterView());

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// RESPONSES VIEW
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
      <td>${r.className ? escHtml(r.className) : 'â€”'}</td>
      <td>${r.rollno   ? escHtml(r.rollno.toUpperCase())  : 'â€”'}</td>
      <td>${r.admission? escHtml(r.admission) : 'â€”'}</td>
      <td>${escHtml(r.email||'')}</td>
      <td><span class="event-pill" title="${escHtml(r.eventName)}">${escHtml(r.eventName)}</span></td>
      <td class="ts-cell">${fmtTS(r.createdAt)}</td>
      <td><button class="del-btn" title="Delete" onclick="deleteReg('${r.id}')">ðŸ—‘</button></td>
    </tr>`).join('');
}

async function deleteReg(regId) {
  if (!confirm('Remove this registration?')) return;
  try {
    await db.collection('registrations').doc(regId).delete();
    showToast('Registration removed', 'error');
  } catch(err) { console.error(err); showToast('Error removing.','error'); }
}

document.getElementById('filter-event').addEventListener('change', renderResponsesTable);
document.getElementById('filter-search').addEventListener('input',  renderResponsesTable);

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// NAV TABS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// BOOT â€” called after auth unlocks the gate
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
(async function boot() {
  await ensureDefaultHash();
  if (!isAuthenticated()) {
    showLoginGate();
  } else {
    hideLoginGate();
    resetIdleTimer();
    initFirestoreListeners();
    renderDashboard();
  }
})();

// Start Firestore listeners when login succeeds (patch login handler)
const _origLogin = document.getElementById('login-form').onsubmit;
document.getElementById('login-form').addEventListener('submit', () => {
  // After a short delay, if now authenticated, start listeners
  setTimeout(() => {
    if (isAuthenticated() && _events.length === 0 && _regs.length === 0) {
      initFirestoreListeners();
    }
  }, 400);
});


