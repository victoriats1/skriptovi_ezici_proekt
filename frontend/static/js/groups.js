// groups.js

let activeGroupId   = null;
let activeGroupData = null;
let inviteTags      = [];
let currentEmoji    = '🎉';

const EMOJIS = ['🎉','🍕','🎮','🏖️','🎬','☕','🎵','🏃','📚','🍻','🎲','🌿'];
let emojiIdx = 0;

function loadGroups() {
  fetch('/group/list')
    .then(res => res.json())
    .then(data => {
      const groups = data.groups || [];
      renderGroupList(groups);
      renderGroupsMiniList(groups);
    })
    .catch(err => console.error('loadGroups:', err));
}

function renderGroupList(groups) {
  const list = document.getElementById('groupList');
  if (!list) return;

  if (!groups.length) {
    list.innerHTML = `
      <li class="group-empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <p>Нямаш групи</p>
        <button class="btn-outline btn-sm" onclick="document.getElementById('createGroupModal').classList.add('open')">Създай първата</button>
      </li>`;
    return;
  }

  list.innerHTML = groups.map(g => {
    const memberCount = g.members ? g.members.length : 0;
    const isActive    = g.id === activeGroupId;
    return `
      <li class="group-list-item ${isActive ? 'active' : ''}" onclick="selectGroup('${g.id}')">
        <div class="group-emoji">${escHtml(g.emoji || '🎉')}</div>
        <div class="group-item-info">
          <div class="group-item-name">${escHtml(g.name)}</div>
          <div class="group-item-meta">${memberCount} ${memberCount === 1 ? 'член' : 'членове'}</div>
        </div>
      </li>`;
  }).join('');
}

function filterGroups(query) {
  document.querySelectorAll('.group-list-item').forEach(item => {
    const name = item.querySelector('.group-item-name').textContent.toLowerCase();
    item.style.display = name.includes(query.toLowerCase()) ? '' : 'none';
  });
}

async function selectGroup(groupId) {
  activeGroupId = groupId;

  document.querySelectorAll('.group-list-item').forEach(el => {
    el.classList.toggle('active', el.onclick.toString().includes(groupId));
  });

  document.getElementById('groupDetailEmpty').classList.add('hidden');
  document.getElementById('groupDetailContent').classList.remove('hidden');

  try {
    const res   = await fetch('/group/list');
    const data  = await res.json();
    const group = (data.groups || []).find(g => g.id === groupId);
    if (!group) return;

    activeGroupData = group;

    document.getElementById('detailGroupEmoji').textContent = group.emoji || '🎉';
    document.getElementById('detailGroupName').textContent  = group.name;
    const cnt = group.members ? group.members.length : 0;
    document.getElementById('detailGroupMeta').textContent  = cnt + (cnt === 1 ? ' член' : ' членове');

    switchDetailTab('members', document.querySelector('.detail-tab[data-tab="members"]'));
    loadMembers(group);
    loadHangouts();
  } catch (err) {
    showToast('Грешка при зареждане на група: ' + err.message, 'error');
  }
}

function switchDetailTab(tab, btn) {
  document.querySelectorAll('.detail-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.detail-panel').forEach(p => p.classList.add('hidden'));
  if (btn) btn.classList.add('active');
  const panel = document.getElementById('tab-' + tab);
  if (panel) panel.classList.remove('hidden');
}

function loadMembers(group) {
  const list = document.getElementById('memberList');
  if (!list) return;

  const members = group.members || [];
  if (!members.length) {
    list.innerHTML = '<li style="color:var(--text-muted);font-size:13px">Няма членове.</li>';
    return;
  }

  list.innerHTML = members.map((uid, i) => {
    const email    = group.emails ? (group.emails[i] || '') : '';
    const initials = email ? email[0].toUpperCase() : '?';
    const isOwner  = uid === group.ownerUid;
    return '<li class="member-item">' +
      '<div class="member-avatar">' + initials + '</div>' +
      '<div class="member-info"><div class="member-name">' + escHtml(email || uid) + '</div></div>' +
      '<span class="member-role ' + (isOwner ? 'member-role-owner' : '') + '">' + (isOwner ? 'Създател' : 'Член') + '</span>' +
      '<div class="member-status"></div>' +
      '</li>';
  }).join('');
}

async function createGroup() {
  const name = document.getElementById('newGroupName').value.trim();
  const desc = document.getElementById('newGroupDesc').value.trim();
  if (!name) { showToast('Моля въведи име на групата.', 'error'); return; }

  try {
    const res = await fetch('/group/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: desc, emoji: currentEmoji, emails: inviteTags })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Грешка при създаване');

    closeModal('createGroupModal');
    document.getElementById('newGroupName').value = '';
    document.getElementById('newGroupDesc').value = '';
    clearInviteTags();
    showToast('Групата е създадена!', 'success');
    loadGroups();
  } catch (err) {
    showToast('Грешка при създаване: ' + err.message, 'error');
  }
}

async function inviteMember() {
  const email = document.getElementById('singleInviteEmail').value.trim();
  if (!email || !activeGroupId) return;

  try {
    const res = await fetch('/group/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, group_id: activeGroupId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Грешка');
    closeModal('inviteMemberModal');
    document.getElementById('singleInviteEmail').value = '';
    showToast('Поканата е изпратена до ' + email, 'success');
  } catch (err) {
    showToast('Грешка при покана: ' + err.message, 'error');
  }
}

async function loadGroupSlots() {
  const from = document.getElementById('slotFilterFrom').value;
  const to   = document.getElementById('slotFilterTo').value;
  const dur  = document.getElementById('slotFilterDur').value;
  const list = document.getElementById('groupSlotsList');

  const grid = document.getElementById('availabilityGrid');
  if (grid) grid.style.display = 'none';

  if (!list || !activeGroupId) return;

  list.innerHTML = '<li class="slots-prompt"><div class="cal-loading"><div class="cal-spinner"></div> Търси свободно време…</div></li>';

  try {
    const res  = await fetch('/group/free-slots?group_id=' + activeGroupId);
    const data = await res.json();
    let slots  = data.free_slots || [];

    if (from) {
      const fromDt = new Date(from);
      slots = slots.filter(s => new Date(s.start) >= fromDt);
    }
    if (to) {
      const toDt = new Date(to);
      toDt.setHours(23, 59, 59);
      slots = slots.filter(s => new Date(s.start) <= toDt);
    }
    if (dur) {
      slots = slots.filter(s => s.duration_minutes >= parseInt(dur));
    }

    if (!slots.length) {
      list.innerHTML = '<li class="slots-prompt">Не са намерени общи свободни часове за избрания период.</li>';
      return;
    }

    list.innerHTML = slots.map(s => {
      const start  = new Date(s.start);
      const end    = new Date(s.end);
      const day    = start.toLocaleDateString('bg-BG', { weekday: 'long', month: 'short', day: 'numeric' });
      const time   = fmtTime(start) + ' - ' + fmtTime(end);
      const durMin = s.duration_minutes;
      return '<li class="slot-item" onclick="prefillHangout(\'' + s.start + '\',\'' + s.end + '\')">' +
        '<div class="slot-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></div>' +
        '<div class="slot-info">' +
          '<div class="slot-day">' + day + ' · ' + time + '</div>' +
          '<div class="slot-time">' + durMin + ' мин свободно</div>' +
        '</div></li>';
    }).join('');
  } catch (err) {
    list.innerHTML = '<li style="color:var(--text-muted);font-size:13px;padding:10px 0">Грешка при зареждане.</li>';
  }
}

function openFindSlotForGroup() {
  if (!activeGroupData) return;
  switchDetailTab('slots', document.querySelector('.detail-tab[data-tab="slots"]'));
  const today = new Date().toISOString().slice(0, 10);
  const next  = new Date(); next.setDate(next.getDate() + 14);
  document.getElementById('slotFilterFrom').value = today;
  document.getElementById('slotFilterTo').value   = next.toISOString().slice(0, 10);
  loadGroupSlots();
}

function prefillHangout(start, end) {
  const d   = new Date(start);
  const e   = new Date(end);
  const pad = n => String(n).padStart(2,'0');
  document.getElementById('hangoutDate').value  = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
  document.getElementById('hangoutStart').value = pad(d.getHours()) + ':' + pad(d.getMinutes());
  document.getElementById('hangoutEnd').value   = pad(e.getHours()) + ':' + pad(e.getMinutes());
  document.getElementById('scheduleHangoutModal').classList.add('open');
}

async function loadHangouts() {
  const list = document.getElementById('hangoutList');
  if (!list || !activeGroupId) return;

  try {
    const res      = await fetch('/group/hangouts?group_id=' + activeGroupId);
    const data     = await res.json();
    const hangouts = data.hangouts || [];

    if (!hangouts.length) {
      list.innerHTML = '<li class="hangout-empty">Няма планирани срещи.</li>';
      return;
    }

    list.innerHTML = hangouts.map(h => {
      const start = new Date(h.start);
      const end   = h.end ? new Date(h.end) : null;
      const month = start.toLocaleDateString('bg-BG', { month: 'short' }).toUpperCase();
      const day   = start.getDate();
      const time  = fmtTime(start) + (end ? ' - ' + fmtTime(end) : '');
      return '<li class="hangout-item">' +
        '<div class="hangout-date-badge">' +
          '<span class="hangout-month">' + month + '</span>' +
          '<span class="hangout-day">' + day + '</span>' +
        '</div>' +
        '<div class="hangout-info">' +
          '<div class="hangout-title">' + escHtml(h.title) + '</div>' +
          '<div class="hangout-meta"><span>' + time + '</span>' +
          (h.location ? '<span>📍 ' + escHtml(h.location) + '</span>' : '') +
          '</div>' +
        '</div></li>';
    }).join('');
  } catch (err) {
    list.innerHTML = '<li class="hangout-empty">Грешка при зареждане.</li>';
  }
}

async function scheduleHangout() {
  const title    = document.getElementById('hangoutTitle').value.trim();
  const date     = document.getElementById('hangoutDate').value;
  const start    = document.getElementById('hangoutStart').value;
  const end      = document.getElementById('hangoutEnd').value;
  const location = document.getElementById('hangoutLocation').value.trim();
  const notes    = document.getElementById('hangoutNotes').value.trim();
  const notify   = document.getElementById('hangoutNotify').checked;

  if (!title || !date || !start || !end) {
    showToast('Моля попълни заглавие, дата, начало и край.', 'error');
    return;
  }

  const startDt = new Date(date + 'T' + start + ':00');
  const endDt   = new Date(date + 'T' + end   + ':00');

  if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) {
    showToast('Невалидна дата или час.', 'error');
    return;
  }

  try {
    // 1. Запази в Google Calendar
    const calRes = await fetch('/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        notes: notes + (location ? ' | Място: ' + location : ''),
        start: startDt.toISOString(),
        end:   endDt.toISOString()
      })
    });

    const contentType = calRes.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Грешка от сървъра при запазване');
    }
    const calData = await calRes.json();
    if (!calRes.ok) throw new Error(calData.error || 'Грешка при запазване');

    // 2. Запази в Firestore
    await fetch('/group/hangouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group_id: activeGroupId,
        title,
        start:    startDt.toISOString(),
        end:      endDt.toISOString(),
        location,
        notes
      })
    });

    // 3. Изпрати известие
    if (notify && activeGroupId) {
      await fetch('/notify/hangout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: activeGroupId,
          title,
          start: startDt.toISOString()
        })
      });
    }

    closeModal('scheduleHangoutModal');
    showToast('Срещата е планирана! 🎉', 'success');
    loadHangouts();
  } catch (err) {
    showToast('Грешка при планиране: ' + err.message, 'error');
  }
}

function renderGroupsMiniList(groups) {
  const list = document.getElementById('groupsMiniList');
  if (!list) return;

  if (!groups.length) {
    list.innerHTML = '<li class="group-mini-empty">Нямаш групи. <a href="/groups">Създай</a></li>';
    return;
  }

  list.innerHTML = groups.slice(0, 5).map(g =>
    '<li><a href="/groups" class="group-mini-item">' +
    '<div class="group-mini-emoji">' + escHtml(g.emoji || '🎉') + '</div>' +
    '<span class="group-mini-name">' + escHtml(g.name) + '</span>' +
    '<span class="group-mini-count">' + (g.members || []).length + ' членове</span>' +
    '</a></li>'
  ).join('');
}

function cycleEmoji() {
  emojiIdx = (emojiIdx + 1) % EMOJIS.length;
  currentEmoji = EMOJIS[emojiIdx];
  document.getElementById('groupEmojiBtn').textContent = currentEmoji;
}

function handleInviteKey(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    addInviteTag();
  }
}

function addInviteTag() {
  const input = document.getElementById('inviteEmailInput');
  const email = input.value.trim().replace(',', '');
  if (!email || !email.includes('@')) return;
  if (inviteTags.includes(email)) { input.value = ''; return; }

  inviteTags.push(email);
  const tag = document.createElement('span');
  tag.className = 'invite-tag';
  tag.innerHTML = escHtml(email) + '<button onclick="removeInviteTag(\'' + escHtml(email) + '\', this)">×</button>';
  document.getElementById('inviteTagsWrap').insertBefore(tag, input);
  input.value = '';
}

function removeInviteTag(email, btn) {
  inviteTags = inviteTags.filter(e => e !== email);
  btn.closest('.invite-tag').remove();
}

function clearInviteTags() {
  inviteTags = [];
  const wrap = document.getElementById('inviteTagsWrap');
  if (wrap) wrap.querySelectorAll('.invite-tag').forEach(t => t.remove());
}

function openGroupSettings() {
  showToast('Настройките на групата скоро ще бъдат налични.', 'info');
}

function fmtTime(date) {
  return date.toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' });
}

function fmtTime24(date) {
  return String(date.getHours()).padStart(2,'0') + ':' + String(date.getMinutes()).padStart(2,'0');
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

document.addEventListener('DOMContentLoaded', () => {
  loadGroups();
});