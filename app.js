/* ═══════════════════════════════════════════════════════════
   EVENTFLOW — SAFE STORAGE PATCH
   Fixes:
   ✔ Prevent corrupted localStorage crash
   ✔ Keeps existing events
   ✔ Auto-recovers broken JSON
   ✔ Safer rendering
   ✔ Prevents dashboard load before auth
   ═══════════════════════════════════════════════════════════ */

// ──────────────────────────────────────────────────────────
// STORAGE KEYS
// ──────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  events: 'ef_events',
  registrations: 'ef_regs'
};

// ──────────────────────────────────────────────────────────
// SAFE JSON PARSER
// ──────────────────────────────────────────────────────────
function safeJSONParse(data, fallback = []) {
  try {
    return JSON.parse(data);
  } catch (err) {
    console.error('JSON Parse Error:', err);
    return fallback;
  }
}

// ──────────────────────────────────────────────────────────
// LOAD EVENTS (SAFE)
// ──────────────────────────────────────────────────────────
function loadEvents() {
  const raw = localStorage.getItem(STORAGE_KEYS.events);

  if (!raw || raw === 'undefined' || raw === 'null') {
    return [];
  }

  const parsed = safeJSONParse(raw, []);

  // Ensure array format
  if (!Array.isArray(parsed)) {
    console.warn('Events data invalid. Reset prevented.');
    return [];
  }

  return parsed;
}

// ──────────────────────────────────────────────────────────
// SAVE EVENTS (SAFE)
// ──────────────────────────────────────────────────────────
function saveEvents(events) {
  try {
    localStorage.setItem(
      STORAGE_KEYS.events,
      JSON.stringify(events)
    );
  } catch (err) {
    console.error('Failed to save events:', err);
    showToast('Failed to save events', 'error');
  }
}

// ──────────────────────────────────────────────────────────
// LOAD REGISTRATIONS (SAFE)
// ──────────────────────────────────────────────────────────
function loadRegs() {
  const raw = localStorage.getItem(STORAGE_KEYS.registrations);

  if (!raw || raw === 'undefined' || raw === 'null') {
    return [];
  }

  const parsed = safeJSONParse(raw, []);

  if (!Array.isArray(parsed)) {
    console.warn('Registration data invalid.');
    return [];
  }

  return parsed;
}

// ──────────────────────────────────────────────────────────
// SAVE REGISTRATIONS
// ──────────────────────────────────────────────────────────
function saveRegs(regs) {
  try {
    localStorage.setItem(
      STORAGE_KEYS.registrations,
      JSON.stringify(regs)
    );
  } catch (err) {
    console.error('Failed to save registrations:', err);
    showToast('Failed to save registrations', 'error');
  }
}

// ──────────────────────────────────────────────────────────
// SAFE HTML ESCAPE
// ──────────────────────────────────────────────────────────
function escHtml(str) {
  if (str === null || str === undefined) return '';

  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ──────────────────────────────────────────────────────────
// SAFE DASHBOARD RENDER
// ──────────────────────────────────────────────────────────
function renderDashboard() {
  try {
    const events = loadEvents();
    const regs = loadRegs();

    const grid = document.getElementById('events-grid');
    const empty = document.getElementById('empty-events');
    const badge = document.getElementById('event-count-badge');

    // Prevent null errors
    if (!grid || !empty || !badge) {
      console.error('Dashboard elements missing in HTML');
      return;
    }

    badge.textContent =
      `${events.length} event${events.length !== 1 ? 's' : ''}`;

    if (events.length === 0) {
      grid.innerHTML = '';
      grid.appendChild(empty);
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');

    grid.innerHTML = events.map(ev => {

      const count =
        regs.filter(r => r.eventId === ev.id).length;

      const seatInfo = ev.seats
        ? `${count}/${ev.seats} seats`
        : `${count} registered`;

      return `
        <article class="event-card" data-id="${ev.id}">
          <span class="card-category cat-${ev.category || 'general'}">
            ${escHtml(ev.category || 'General')}
          </span>

          <div class="card-title">
            ${escHtml(ev.title || 'Untitled Event')}
          </div>

          <div class="card-desc">
            ${escHtml(ev.desc || 'No description')}
          </div>

          <div class="card-meta">

            <span class="meta-item">
              📅 ${ev.date || 'No Date'}
            </span>

            ${
              ev.time
                ? `<span class="meta-item">🕐 ${escHtml(ev.time)}</span>`
                : ''
            }

            ${
              ev.venue
                ? `<span class="meta-item">📍 ${escHtml(ev.venue)}</span>`
                : ''
            }

          </div>

          <div class="card-footer">

            <span class="reg-count">
              ✅ ${seatInfo}
            </span>

            <div class="card-actions">

              <button
                class="action-btn"
                onclick="goResponses('${ev.id}')"
              >
                Responses
              </button>

              <button
                class="action-btn danger"
                onclick="deleteEvent('${ev.id}')"
              >
                Delete
              </button>

            </div>

          </div>
        </article>
      `;
    }).join('');

  } catch (err) {
    console.error('Dashboard Render Failed:', err);
    showToast('Dashboard failed to load', 'error');
  }
}

// ──────────────────────────────────────────────────────────
// SAFE INIT
// ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  try {

    // Ensure old data survives
    const existingEvents = loadEvents();
    const existingRegs = loadRegs();

    console.log('Events Loaded:', existingEvents.length);
    console.log('Registrations Loaded:', existingRegs.length);

    // Only render after auth
    if (
      sessionStorage.getItem('ef_session') === 'authenticated'
    ) {
      renderDashboard();
    }

  } catch (err) {
    console.error('Initialization failed:', err);
  }

});