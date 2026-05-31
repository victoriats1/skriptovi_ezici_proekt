// calendar.js
// Renders the mini calendar widget, handles events CRUD, and free-slot search.

let currentDate  = new Date();
let selectedDate = new Date();
let eventsCache  = {};   // { "YYYY-MM-DD": [event, …] }
let selectedColor = '#6C9CF5';

/* ══════════════════════════════════════
   CALENDAR RENDER
   ══════════════════════════════════════ */

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

function renderCalendar() {
  const wrap = document.getElementById('calendarWrap');
  const label = document.getElementById('calMonthLabel');
  if (!wrap) return;

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();

  if (label) label.textContent = `${MONTHS[month]} ${year}`;

  // Day-of-week header
  let html = `<div class="cal-dow-row">`;
  DAYS.forEach(d => html += `<div class="cal-dow">${d}</div>`);
  html += `</div><div class="cal-grid">`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();
  const today       = new Date();

  // Previous month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="cal-day other-month">${daysInPrev - i}</div>`;
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const key    = dateKey(year, month, d);
    const hasEvt = eventsCache[key] && eventsCache[key].length > 0;
    const isSel  = selectedDate.getFullYear() === year &&
                   selectedDate.getMonth()    === month &&
                   selectedDate.getDate()     === d;
    const isToday = today.getFullYear() === year &&
                    today.getMonth()    === month &&
                    today.getDate()     === d;

    let cls = 'cal-day';
    if (isToday) cls += ' today';
    if (isSel)   cls += ' selected';
    if (hasEvt)  cls += ' has-events';

    html += `<div class="${cls}" onclick="selectDay(${year},${month},${d})">${d}</div>`;
  }

  // Next month padding
  const totalCells = firstDay + daysInMonth;
  const remaining  = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let d = 1; d <= remaining; d++) {
    html += `<div class="cal-day other-month">${d}</div>`;
  }

  html += `</div>`;

  // Legend
  html += `
    <div class="cal-legend">
      <div class="cal-legend-item"><div class="cal-legend-dot" style="background:var(--blue)"></div>Event</div>
      <div class="cal-legend-item"><div class="cal-legend-dot" style="background:var(--green)"></div>Free slot</div>
      <div class="cal-legend-item"><div class="cal-legend-dot" style="background:var(--accent)"></div>Today</div>
    </div>`;

  wrap.innerHTML = html;
}

function changeMonth(delta) {
  currentDate.setMonth(currentDate.getMonth() + delta);
  renderCalendar();
}

function selectDay(year, month, day) {
  selectedDate = new Date(year, month, day);
  renderCalendar();

  // Pre-fill event date inputs
  const pad = n => String(n).padStart(2,'0');
  const iso = `${year}-${pad(month+1)}-${pad(day)}`;
  ['evtDate','hangoutDate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = iso;
  });
}

function dateKey(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

/* ══════════════════════════════════════
   EVENTS — LOAD / RENDER
   ══════════════════════════════════════ */

async function loadEvents() {
  const user = getCurrentUser();
  if (!user || !db) return;

  const list = document.getElementById('eventsList');
  if (list) list.innerHTML = '<li class="event-skeleton"></li><li class="event-skeleton"></li><li class="event-skeleton"></li>';

  try {
    const now     = new Date();
    const inMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);

    const snap = await db.collection('events')
      .where('uid', '==', user.uid)
      .where('start', '>=', now)
      .where('start', '<=', inMonth)
      .orderBy('start')
      .limit(20)
      .get();

    eventsCache = {};
    const events = [];

    snap.forEach(doc => {
      const evt  = { id: doc.id, ...doc.data() };
      const date = evt.start.toDate ? evt.start.toDate() : new Date(evt.start);
      const key  = dateKey(date.getFullYear(), date.getMonth(), date.getDate());
      if (!eventsCache[key]) eventsCache[key] = [];
      eventsCache[key].push(evt);
      events.push({ evt, date });
    });

    renderCalendar();
    renderEventsList(events);
    loadWeekFreeSlots();
  } catch (err) {
    console.error('loadEvents:', err);
    if (list) list.innerHTML = `<li style="color:var(--text-muted);font-size:13px;padding:12px 0">Could not load events.</li>`;
  }
}

function renderEventsList(events) {
  const list = document.getElementById('eventsList');
  if (!list) return;

  if (!events.length) {
    list.innerHTML = `<li class="event-item" style="cursor:default"><span style="color:var(--text-muted);font-size:13px">No upcoming events. Add one!</span></li>`;
    return;
  }

  list.innerHTML = events.slice(0, 8).map(({ evt, date }) => {
    const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const dayStr  = date.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' });
    const color   = evt.color || '#6C9CF5';
    return `
      <li class="event-item" onclick="editEvent('${evt.id}')">
        <div class="event-dot" style="background:${color}"></div>
        <div class="event-info">
          <div class="event-name">${escHtml(evt.title)}</div>
          <div class="event-time">${dayStr} · ${timeStr}</div>
        </div>
      </li>`;
  }).join('');
}

/* ══════════════════════════════════════
   ADD / EDIT EVENT
   ══════════════════════════════════════ */

async function addEvent() {
  const user = getCurrentUser();
  if (!user || !db) return;

  const title = document.getElementById('evtTitle').value.trim();
  const date  = document.getElementById('evtDate').value;
  const start = document.getElementById('evtStart').value;
  const end   = document.getElementById('evtEnd').value;
  const notes = document.getElementById('evtNotes').value.trim();

  if (!title || !date) { showToast('Please add a title and date.', 'error'); return; }

  const startDt = new Date(`${date}T${start || '00:00'}`);
  const endDt   = new Date(`${date}T${end   || '23:59'}`);

  try {
    await db.collection('events').add({
      uid:   user.uid,
      title,
      notes,
      color: selectedColor,
      start: firebase.firestore.Timestamp.fromDate(startDt),
      end:   firebase.firestore.Timestamp.fromDate(endDt),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    closeModal('addEventModal');
    showToast('Event saved!', 'success');
    loadEvents();
    // Notify backend to check for conflicts
    notifyCalendarChange(user.uid);
  } catch (err) {
    showToast('Could not save event: ' + err.message, 'error');
  }
}

function editEvent(id) {
  // Placeholder — open edit modal or show popover
  // Full implementation would populate form with event data and allow update/delete
  showToast('Edit event: ' + id, 'info');
}

/* ══════════════════════════════════════
   FREE SLOTS — THIS WEEK
   ══════════════════════════════════════ */

async function loadWeekFreeSlots() {
  const user = getCurrentUser();
  if (!user) return;

  const slotsList = document.getElementById('slotsList');
  const slotCount = document.getElementById('slotCount');
  if (!slotsList) return;

  slotsList.innerHTML = '<li class="slot-skeleton"></li><li class="slot-skeleton"></li>';

  try {
    const res = await fetch(`/api/free-slots?uid=${user.uid}&days=7&duration=60`, {
      headers: { 'Authorization': `Bearer ${await user.getIdToken()}` }
    });
    const data = await res.json();
    const slots = data.slots || [];

    if (slotCount) slotCount.textContent = slots.length;

    if (!slots.length) {
      slotsList.innerHTML = `<li style="font-size:13px;color:var(--text-muted);padding:8px 0">No free slots found this week.</li>`;
      return;
    }

    slotsList.innerHTML = slots.slice(0, 4).map(s => {
      const start = new Date(s.start);
      const end   = new Date(s.end);
      const day   = start.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' });
      const time  = `${fmtTime(start)} – ${fmtTime(end)}`;
      return `
        <li class="slot-item" onclick="pickSlot('${s.start}','${s.end}')">
          <div class="slot-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="slot-info">
            <div class="slot-day">${day}</div>
            <div class="slot-time">${time}</div>
          </div>
        </li>`;
    }).join('');
  } catch (err) {
    if (slotsList) slotsList.innerHTML = `<li style="font-size:13px;color:var(--text-muted)">Connect your calendar to see free slots.</li>`;
  }
}

function pickSlot(start, end) {
  // Pre-fill the add event modal with this slot
  const d  = new Date(start);
  const e  = new Date(end);
  const dt = d.toISOString().slice(0, 10);
  const st = fmtTime24(d);
  const et = fmtTime24(e);
  document.getElementById('evtDate').value  = dt;
  document.getElementById('evtStart').value = st;
  document.getElementById('evtEnd').value   = et;
  document.getElementById('addEventModal').classList.add('open');
}

/* ══════════════════════════════════════
   FIND FREE SLOTS (modal search)
   ══════════════════════════════════════ */

async function findFreeSlots() {
  const user = getCurrentUser();
  if (!user) return;

  const from     = document.getElementById('slotFrom').value;
  const to       = document.getElementById('slotTo').value;
  const duration = document.getElementById('slotDuration').value;
  const groupId  = document.getElementById('slotGroup').value;
  const results  = document.getElementById('slotsResults');

  if (!from || !to) { showToast('Please pick a date range.', 'error'); return; }

  results.innerHTML = `<div class="cal-loading"><div class="cal-spinner"></div> Searching…</div>`;

  try {
    const params = new URLSearchParams({ from, to, duration, uid: user.uid });
    if (groupId) params.set('groupId', groupId);

    const res  = await fetch(`/api/free-slots?${params}`, {
      headers: { 'Authorization': `Bearer ${await user.getIdToken()}` }
    });
    const data = await res.json();
    const slots = data.slots || [];

    if (!slots.length) {
      results.innerHTML = `<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0">No common free slots found. Try a wider range.</p>`;
      return;
    }

    results.innerHTML = slots.map(s => {
      const start = new Date(s.start);
      const end   = new Date(s.end);
      const dur   = Math.round((end - start) / 60000);
      const label = start.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })
                  + ' · ' + fmtTime(start) + ' – ' + fmtTime(end);
      return `
        <div class="slot-result-item" onclick="pickSlot('${s.start}','${s.end}'); closeModal('findSlotModal');">
          <div class="slot-result-check">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span class="slot-result-text">${label}</span>
          <span class="slot-result-dur">${dur} min</span>
        </div>`;
    }).join('');
  } catch (err) {
    results.innerHTML = `<p style="color:var(--accent);font-size:13px;text-align:center;padding:20px 0">Error: ${escHtml(err.message)}</p>`;
  }
}

/* ══════════════════════════════════════
   COLOR PICKER
   ══════════════════════════════════════ */

document.addEventListener('click', e => {
  const swatch = e.target.closest('.color-swatch');
  if (!swatch) return;
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
  swatch.classList.add('active');
  selectedColor = swatch.dataset.color;
});

/* ══════════════════════════════════════
   UTILS
   ══════════════════════════════════════ */

function fmtTime(date) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function fmtTime24(date) {
  return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ══════════════════════════════════════
   INIT
   ══════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  renderCalendar();
  loadEvents();

  // Set default date/time for event form to today
  const today = new Date().toISOString().slice(0, 10);
  ['evtDate','slotFrom','hangoutDate'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = today;
  });

  // slotTo defaults to +7 days
  const slotTo = document.getElementById('slotTo');
  if (slotTo && !slotTo.value) {
    const next = new Date(); next.setDate(next.getDate() + 7);
    slotTo.value = next.toISOString().slice(0, 10);
  }
});