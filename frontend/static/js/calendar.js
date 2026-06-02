// calendar.js

let currentDate  = new Date();
let selectedDate = new Date();
let eventsCache  = {};
let selectedColor = '#6C9CF5';

const DAYS   = ['Нед', 'Пон', 'Вт', 'Ср', 'Чет', 'Пет', 'Съб'];
const MONTHS = [
  'Януари','Февруари','Март','Април','Май','Юни',
  'Юли','Август','Септември','Октомври','Ноември','Декември'
];

/* ══════════════════════════════════════
   КАЛЕНДАР — РЕНДЕР
   ══════════════════════════════════════ */

function renderCalendar() {
  const wrap  = document.getElementById('calendarWrap');
  const label = document.getElementById('calMonthLabel');
  if (!wrap) return;

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();

  if (label) label.textContent = `${MONTHS[month]} ${year}`;

  let html = `<div class="cal-dow-row">`;
  DAYS.forEach(d => html += `<div class="cal-dow">${d}</div>`);
  html += `</div><div class="cal-grid">`;

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();
  const today       = new Date();

  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="cal-day other-month">${daysInPrev - i}</div>`;
  }

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

  const totalCells = firstDay + daysInMonth;
  const remaining  = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let d = 1; d <= remaining; d++) {
    html += `<div class="cal-day other-month">${d}</div>`;
  }

  html += `</div>`;
  html += `
    <div class="cal-legend">
      <div class="cal-legend-item"><div class="cal-legend-dot" style="background:var(--blue)"></div>Събитие</div>
      <div class="cal-legend-item"><div class="cal-legend-dot" style="background:var(--green)"></div>Свободен час</div>
      <div class="cal-legend-item"><div class="cal-legend-dot" style="background:var(--accent)"></div>Днес</div>
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
   ЗАРЕДИ СЪБИТИЯ ОТ BACKEND
   ══════════════════════════════════════ */

async function loadEvents() {
  const list = document.getElementById('eventsList');
  if (list) list.innerHTML = '<li class="event-skeleton"></li><li class="event-skeleton"></li><li class="event-skeleton"></li>';

  try {
    const res  = await fetch('/calendar/events');
    if (!res.ok) throw new Error('Неуспешно зареждане');
    const data = await res.json();
    const events = data.events || [];

    // Попълни кеша за календара
    eventsCache = {};
    events.forEach(evt => {
      const date = new Date(evt.start);
      const key  = dateKey(date.getFullYear(), date.getMonth(), date.getDate());
      if (!eventsCache[key]) eventsCache[key] = [];
      eventsCache[key].push(evt);
    });

    renderCalendar();
    renderEventsList(events);
    loadWeekFreeSlots();
  } catch (err) {
    console.error('loadEvents:', err);
    if (list) list.innerHTML = `<li style="color:var(--text-muted);font-size:13px;padding:12px 0">Няма заредени събития.</li>`;
  }
}

function renderEventsList(events) {
  const list = document.getElementById('eventsList');
  if (!list) return;

  if (!events.length) {
    list.innerHTML = `<li class="event-item" style="cursor:default"><span style="color:var(--text-muted);font-size:13px">Няма предстоящи събития. Добави!</span></li>`;
    return;
  }

  list.innerHTML = events.slice(0, 8).map(evt => {
    const date    = new Date(evt.start);
    const timeStr = date.toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' });
    const dayStr  = date.toLocaleDateString('bg-BG', { weekday: 'short', month: 'short', day: 'numeric' });
    const color   = evt.color || '#6C9CF5';
    return `
      <li class="event-item">
        <div class="event-dot" style="background:${color}"></div>
        <div class="event-info">
          <div class="event-name">${escHtml(evt.summary || evt.title || 'Без заглавие')}</div>
          <div class="event-time">${dayStr} · ${timeStr}</div>
        </div>
      </li>`;
  }).join('');
}

/* ══════════════════════════════════════
   СВОБОДНИ ЧАСОВЕ
   ══════════════════════════════════════ */

async function loadWeekFreeSlots() {
  const slotsList = document.getElementById('slotsList');
  const slotCount = document.getElementById('slotCount');
  if (!slotsList) return;

  slotsList.innerHTML = '<li class="slot-skeleton"></li><li class="slot-skeleton"></li>';

  try {
    const res  = await fetch('/calendar/busy');
    if (!res.ok) throw new Error('Неуспешно');
    const data = await res.json();
    const busy = data.busy || [];

    // Изчисли свободните часове от заетите
    const slots = calcFreeSlots(busy);

    if (slotCount) slotCount.textContent = slots.length;

    if (!slots.length) {
      slotsList.innerHTML = `<li style="font-size:13px;color:var(--text-muted);padding:8px 0">Няма свободни часове тази седмица.</li>`;
      return;
    }

    slotsList.innerHTML = slots.slice(0, 4).map(s => {
      const start = new Date(s.start);
      const end   = new Date(s.end);
      const day   = start.toLocaleDateString('bg-BG', { weekday: 'short', month: 'short', day: 'numeric' });
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
    if (slotsList) slotsList.innerHTML = `<li style="font-size:13px;color:var(--text-muted)">Синхронизирай календара за да видиш свободни часове.</li>`;
  }
}

// Изчислява свободните часове между заетите интервали (9:00 - 21:00)
function calcFreeSlots(busyIntervals) {
  const slots = [];
  const now   = new Date();

  for (let d = 0; d < 7; d++) {
    const day      = new Date(now);
    day.setDate(now.getDate() + d);
    const dayStart = new Date(day); dayStart.setHours(9, 0, 0, 0);
    const dayEnd   = new Date(day); dayEnd.setHours(21, 0, 0, 0);

    const todayBusy = busyIntervals
      .map(b => ({ start: new Date(b.start), end: new Date(b.end) }))
      .filter(b => b.start.toDateString() === day.toDateString())
      .sort((a, b) => a.start - b.start);

    let cursor = dayStart;
    for (const busy of todayBusy) {
      if (cursor < busy.start) {
        const diff = (busy.start - cursor) / 60000;
        if (diff >= 60) {
          slots.push({ start: cursor.toISOString(), end: busy.start.toISOString() });
        }
      }
      if (busy.end > cursor) cursor = busy.end;
    }
    if (cursor < dayEnd) {
      const diff = (dayEnd - cursor) / 60000;
      if (diff >= 60) {
        slots.push({ start: cursor.toISOString(), end: dayEnd.toISOString() });
      }
    }
  }
  return slots;
}

/* ══════════════════════════════════════
   ЗАПАЗИ НОВО СЪБИТИЕ
   ══════════════════════════════════════ */

async function addEvent() {
  const title = document.getElementById('evtTitle').value.trim();
  const date  = document.getElementById('evtDate').value;
  const start = document.getElementById('evtStart').value;
  const end   = document.getElementById('evtEnd').value;
  const notes = document.getElementById('evtNotes').value.trim();

  if (!title || !date) { showToast('Моля добави заглавие и дата.', 'error'); return; }

  const startDt = new Date(`${date}T${start || '00:00'}`);
  const endDt   = new Date(`${date}T${end   || '23:59'}`);

  try {
    const res = await fetch('/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        notes,
        color: selectedColor,
        start: startDt.toISOString(),
        end:   endDt.toISOString()
      })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Грешка при запазване');
    }

    closeModal('addEventModal');
    showToast('Събитието е запазено!', 'success');
    loadEvents();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ══════════════════════════════════════
   НАМЕРИ СВОБОДЕН ЧАС (модал)
   ══════════════════════════════════════ */

async function findFreeSlots() {
  const from     = document.getElementById('slotFrom').value;
  const to       = document.getElementById('slotTo').value;
  const duration = document.getElementById('slotDuration').value;
  const results  = document.getElementById('slotsResults');

  if (!from || !to) { showToast('Моля избери период от дати.', 'error'); return; }

  results.innerHTML = `<div class="cal-loading"><div class="cal-spinner"></div> Търси се…</div>`;

  try {
    const res  = await fetch(`/calendar/busy`);
    if (!res.ok) throw new Error('Неуспешно');
    const data = await res.json();
    const busy = data.busy || [];

    const fromDt = new Date(from);
    const toDt   = new Date(to);
    toDt.setHours(23, 59);

    const allSlots = calcFreeSlots(busy).filter(s => {
      const sd = new Date(s.start);
      return sd >= fromDt && sd <= toDt;
    }).filter(s => {
      const diff = (new Date(s.end) - new Date(s.start)) / 60000;
      return diff >= parseInt(duration);
    });

    if (!allSlots.length) {
      results.innerHTML = `<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0">Не са намерени свободни часове. Опитай по-широк период.</p>`;
      return;
    }

    results.innerHTML = allSlots.map(s => {
      const start = new Date(s.start);
      const end   = new Date(s.end);
      const dur   = Math.round((end - start) / 60000);
      const label = start.toLocaleDateString('bg-BG', { weekday: 'short', month: 'short', day: 'numeric' })
                  + ' · ' + fmtTime(start) + ' – ' + fmtTime(end);
      return `
        <div class="slot-result-item" onclick="pickSlot('${s.start}','${s.end}'); closeModal('findSlotModal');">
          <div class="slot-result-check">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span class="slot-result-text">${label}</span>
          <span class="slot-result-dur">${dur} мин</span>
        </div>`;
    }).join('');
  } catch (err) {
    results.innerHTML = `<p style="color:var(--accent);font-size:13px;text-align:center;padding:20px 0">Грешка: ${escHtml(err.message)}</p>`;
  }
}

function pickSlot(start, end) {
  const d  = new Date(start);
  const e  = new Date(end);
  document.getElementById('evtDate').value  = d.toISOString().slice(0, 10);
  document.getElementById('evtStart').value = fmtTime24(d);
  document.getElementById('evtEnd').value   = fmtTime24(e);
  document.getElementById('addEventModal').classList.add('open');
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
  return date.toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' });
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

  const today = new Date().toISOString().slice(0, 10);
  ['evtDate','slotFrom','hangoutDate'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = today;
  });

  const slotTo = document.getElementById('slotTo');
  if (slotTo && !slotTo.value) {
    const next = new Date(); next.setDate(next.getDate() + 7);
    slotTo.value = next.toISOString().slice(0, 10);
  }
});