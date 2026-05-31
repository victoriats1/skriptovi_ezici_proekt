// groups.js
// Full groups management: create, invite, list members, view free slots, schedule hangouts.

let activeGroupId   = null;
let activeGroupData = null;
let inviteTags      = [];
let currentEmoji    = '🎉';

const EMOJIS = ['🎉','🍕','🎮','🏖️','🎬','☕','🎵','🏃','📚','🍻','🎲','🌿'];
let emojiIdx = 0;

/* ══════════════════════════════════════
   LOAD GROUPS
   ══════════════════════════════════════ */

function loadGroups() {
  const user = getCurrentUser();
  if (!user || !db) return;

  db.collection('groups')
    .where('members', 'array-contains', user.uid)
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      const groups = [];
      snap.forEach(doc => groups.push({ id: doc.id, ...doc.data() }));
      renderGroupList(groups);
      renderGroupsMiniList(groups);
    }, err => console.error('groups listener:', err));
}

function renderGroupList(groups) {
  const list = document.getElementById('groupList');
  if (!list) return;

  if (!groups.length) {
    list.innerHTML = `
      <li class="group-empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <p>No groups yet</p>
        <button class="btn-outline btn-sm" onclick="document.getElementById('createGroupModal').classList.add('open')">Create your first</button>
      </li>`;
    return;
  }

  list.innerHTML = groups.map(g => {
    const memberCount = g.memberDetails ? g.memberDetails.length : (g.members ? g.members.length : 0);
    const isActive    = g.id === activeGroupId;
    return `
      <li class="group-list-item ${isActive ? 'active' : ''}" onclick="selectGroup('${g.id}')">
        <div class="group-emoji">${escHtml(g.emoji || '🎉')}</div>
        <div class="group-item-info">
          <div class="group-item-name">${escHtml(g.name)}</div>
          <div class="group-item-meta">${memberCount} member${memberCount !== 1 ? 's' : ''}</div>
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

/* ══════════════════════════════════════
   SELECT GROUP
   ══════════════════════════════════════ */

async function selectGroup(groupId) {
  activeGroupId = groupId;

  // Update active state in list
  document.querySelectorAll('.group-list-item').forEach(el => {
    el.classList.toggle('active', el.onclick.toString().includes(groupId));
  });

  document.getElementById('groupDetailEmpty').classList.add('hidden');
  document.getElementById('groupDetailContent').classList.remove('hidden');

  try {
    const doc = await db.collection('groups').doc(groupId).get();
    if (!doc.exists) return;
    activeGroupData = { id: doc.id, ...doc.data() };

    document.getElementById('detailGroupEmoji').textContent  = activeGroupData.emoji || '🎉';
    document.getElementById('detailGroupName').textContent   = activeGroupData.name;
    const cnt = activeGroupData.members ? activeGroupData.members.length : 0;
    document.getElementById('detailGroupMeta').textContent   = `${cnt} member${cnt !== 1 ? 's' : ''}`;

    switchDetailTab('members', document.querySelector('.detail-tab[data-tab="members"]'));
    loadMembers();
    loadHangouts();
  } catch (err) {
    showToast('Could not load group: ' + err.message, 'error');
  }
}

/* ══════════════════════════════════════
   TABS
   ══════════════════════════════════════ */

function switchDetailTab(tab, btn) {
  document.querySelectorAll('.detail-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.detail-panel').forEach(p => p.classList.add('hidden'));
  if (btn) btn.classList.add('active');
  const panel = document.getElementById(`tab-${tab}`);
  if (panel) panel.classList.remove('hidden');
}

/* ══════════════════════════════════════
   MEMBERS
   ══════════════════════════════════════ */

async function loadMembers() {
  if (!activeGroupData || !db) return;
  const list = document.getElementById('memberList');
  if (!list) return;

  const uids = activeGroupData.members || [];
  if (!uids.length) { list.innerHTML = `<li style="color:var(--text-muted);font-size:13px">No members yet.</li>`; return; }

  list.innerHTML = uids.map(() => `<li class="member-item"><div style="height:36px;width:200px;background:var(--bg-input);border-radius:6px"></div></li>`).join('');

  try {
    const promises = uids.map(uid => db.collection('users').doc(uid).get());
    const docs = await Promise.all(promises);
    const currentUser = getCurrentUser();

    list.innerHTML = docs.map(d => {
      const u    = d.data() || {};
      const name = u.displayName || u.email || d.id;
      const isOwner = d.id === activeGroupData.ownerUid;
      const isSelf  = d.id === currentUser?.uid;
      const initials = name[0].toUpperCase();
      const photo = u.photoURL
        ? `<img src="${u.photoURL}" alt="${escHtml(name)}" />`
        : initials;

      return `
        <li class="member-item">
          <div class="member-avatar">${photo}</div>
          <div class="member-info">
            <div class="member-name">${escHtml(name)} ${isSelf ? '<span style="color:var(--text-muted);font-size:11px">(you)</span>' : ''}</div>
            <div class="member-email">${escHtml(u.email || '')}</div>
          </div>
          <span class="member-role ${isOwner ? 'member-role-owner' : ''}">${isOwner ? 'Owner' : 'Member'}</span>
          <div class="member-status"></div>
        </li>`;
    }).join('');
  } catch (err) {
    list.innerHTML = `<li style="color:var(--text-muted);font-size:13px">Error loading members.</li>`;
  }
}

/* ══════════════════════════════════════
   CREATE GROUP
   ══════════════════════════════════════ */

async function createGroup() {
  const user = getCurrentUser();
  if (!user || !db) return;

  const name = document.getElementById('newGroupName').value.trim();
  const desc = document.getElementById('newGroupDesc').value.trim();
  if (!name) { showToast('Please enter a group name.', 'error'); return; }

  try {
    const docRef = await db.collection('groups').add({
      name,
      description: desc,
      emoji:       currentEmoji,
      ownerUid:    user.uid,
      members:     [user.uid],
      invites:     inviteTags,
      createdAt:   firebase.firestore.FieldValue.serverTimestamp()
    });

    // Send invites via backend
    if (inviteTags.length) {
      const token = await user.getIdToken();
      await fetch('/api/groups/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ groupId: docRef.id, emails: inviteTags })
      });
    }

    closeModal('createGroupModal');
    document.getElementById('newGroupName').value = '';
    document.getElementById('newGroupDesc').value = '';
    clearInviteTags();
    showToast(`Group "${name}" created!`, 'success');
    selectGroup(docRef.id);
  } catch (err) {
    showToast('Could not create group: ' + err.message, 'error');
  }
}

/* ══════════════════════════════════════
   INVITE
   ══════════════════════════════════════ */

async function inviteMember() {
  const user  = getCurrentUser();
  const email = document.getElementById('singleInviteEmail').value.trim();
  if (!email || !activeGroupId) return;

  try {
    const token = await user.getIdToken();
    const res = await fetch('/api/groups/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ groupId: activeGroupId, emails: [email] })
    });
    if (!res.ok) throw new Error('Invite failed');
    closeModal('inviteMemberModal');
    document.getElementById('singleInviteEmail').value = '';
    showToast(`Invite sent to ${email}`, 'success');
  } catch (err) {
    showToast('Could not send invite: ' + err.message, 'error');
  }
}

/* ══════════════════════════════════════
   FREE SLOTS FOR GROUP
   ══════════════════════════════════════ */

async function loadGroupSlots() {
  const user = getCurrentUser();
  if (!user || !activeGroupId) return;

  const from = document.getElementById('slotFilterFrom').value;
  const to   = document.getElementById('slotFilterTo').value;
  const dur  = document.getElementById('slotFilterDur').value;
  const list = document.getElementById('groupSlotsList');
  if (!list) return;

  list.innerHTML = `<li class="slots-prompt"><div class="cal-loading"><div class="cal-spinner"></div> Finding free time…</div></li>`;

  try {
    const params = new URLSearchParams({ groupId: activeGroupId, from, to, duration: dur });
    const res  = await fetch(`/api/free-slots?${params}`, {
      headers: { 'Authorization': `Bearer ${await user.getIdToken()}` }
    });
    const data = await res.json();
    const slots = data.slots || [];

    if (!slots.length) {
      list.innerHTML = `<li class="slots-prompt">No common free slots found. Try a wider range or shorter duration.</li>`;
      return;
    }

    list.innerHTML = slots.map(s => {
      const start = new Date(s.start);
      const end   = new Date(s.end);
      const day   = start.toLocaleDateString('en-GB', { weekday: 'long', month: 'short', day: 'numeric' });
      const time  = `${fmtTime(start)} – ${fmtTime(end)}`;
      const dur   = Math.round((end - start) / 60000);
      const who   = s.availableFor ? `All ${s.availableFor} members free` : 'Common free time';
      return `
        <li class="slot-item" onclick="prefillHangout('${s.start}','${s.end}')">
          <div class="slot-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div class="slot-info">
            <div class="slot-day">${day} · ${time}</div>
            <div class="slot-time">${who} · ${dur} min window</div>
          </div>
        </li>`;
    }).join('');
  } catch (err) {
    list.innerHTML = `<li style="color:var(--text-muted);font-size:13px;padding:10px 0">Set a date range above to search.</li>`;
  }
}

function openFindSlotForGroup() {
  if (!activeGroupData) return;
  switchDetailTab('slots', document.querySelector('.detail-tab[data-tab="slots"]'));
  const today = new Date().toISOString().slice(0, 10);
  const next  = new Date(); next.setDate(next.getDate() + 14);
  document.getElementById('slotFilterFrom').value = today;
  document.getElementById('slotFilterTo').value   = next.toISOString().slice(0, 10);
}

function prefillHangout(start, end) {
  const d = new Date(start);
  const e = new Date(end);
  document.getElementById('hangoutDate').value  = d.toISOString().slice(0, 10);
  document.getElementById('hangoutStart').value = fmtTime24(d);
  document.getElementById('hangoutEnd').value   = fmtTime24(e);
  document.getElementById('scheduleHangoutModal').classList.add('open');
}

/* ══════════════════════════════════════
   HANGOUTS
   ══════════════════════════════════════ */

async function loadHangouts() {
  if (!activeGroupId || !db) return;
  const list = document.getElementById('hangoutList');
  if (!list) return;

  const now = new Date();
  const snap = await db.collection('hangouts')
    .where('groupId', '==', activeGroupId)
    .where('start', '>=', firebase.firestore.Timestamp.fromDate(now))
    .orderBy('start')
    .limit(10)
    .get();

  const hangouts = [];
  snap.forEach(d => hangouts.push({ id: d.id, ...d.data() }));

  if (!hangouts.length) {
    list.innerHTML = `<li class="hangout-empty">No hangouts scheduled yet.</li>`;
    return;
  }

  list.innerHTML = hangouts.map(h => {
    const start = h.start.toDate ? h.start.toDate() : new Date(h.start);
    const end   = h.end   ? (h.end.toDate ? h.end.toDate() : new Date(h.end)) : null;
    const month = start.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
    const day   = start.getDate();
    const time  = fmtTime(start) + (end ? ` – ${fmtTime(end)}` : '');
    return `
      <li class="hangout-item">
        <div class="hangout-date-badge">
          <span class="hangout-month">${month}</span>
          <span class="hangout-day">${day}</span>
        </div>
        <div class="hangout-info">
          <div class="hangout-title">${escHtml(h.title)}</div>
          <div class="hangout-meta">
            <span>${time}</span>
            ${h.location ? `<span>📍 ${escHtml(h.location)}</span>` : ''}
          </div>
        </div>
      </li>`;
  }).join('');
}

async function scheduleHangout() {
  const user = getCurrentUser();
  if (!user || !activeGroupId || !db) return;

  const title    = document.getElementById('hangoutTitle').value.trim();
  const date     = document.getElementById('hangoutDate').value;
  const start    = document.getElementById('hangoutStart').value;
  const end      = document.getElementById('hangoutEnd').value;
  const location = document.getElementById('hangoutLocation').value.trim();
  const notes    = document.getElementById('hangoutNotes').value.trim();
  const notify   = document.getElementById('hangoutNotify').checked;

  if (!title || !date) { showToast('Please add a title and date.', 'error'); return; }

  const startDt = new Date(`${date}T${start || '00:00'}`);
  const endDt   = end ? new Date(`${date}T${end}`) : null;

  try {
    const docRef = await db.collection('hangouts').add({
      groupId:   activeGroupId,
      groupName: activeGroupData?.name || '',
      title, location, notes,
      start:     firebase.firestore.Timestamp.fromDate(startDt),
      end:       endDt ? firebase.firestore.Timestamp.fromDate(endDt) : null,
      createdBy: user.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (notify) {
      const token = await user.getIdToken();
      await fetch('/api/notify/hangout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ hangoutId: docRef.id, groupId: activeGroupId })
      });
    }

    closeModal('scheduleHangoutModal');
    showToast('Hangout scheduled! 🎉', 'success');
    loadHangouts();
  } catch (err) {
    showToast('Could not schedule hangout: ' + err.message, 'error');
  }
}

/* ══════════════════════════════════════
   GROUPS MINI (dashboard widget)
   ══════════════════════════════════════ */

function renderGroupsMiniList(groups) {
  const list = document.getElementById('groupsMiniList');
  if (!list) return;

  if (!groups.length) {
    list.innerHTML = `<li class="group-mini-empty">No groups yet. <a href="groups.html">Create one</a></li>`;
    return;
  }

  list.innerHTML = groups.slice(0, 5).map(g => `
    <li>
      <a href="groups.html" class="group-mini-item">
        <div class="group-mini-emoji">${escHtml(g.emoji || '🎉')}</div>
        <span class="group-mini-name">${escHtml(g.name)}</span>
        <span class="group-mini-count">${(g.members || []).length} members</span>
      </a>
    </li>`).join('');
}

/* ══════════════════════════════════════
   EMOJI PICKER
   ══════════════════════════════════════ */

function cycleEmoji() {
  emojiIdx = (emojiIdx + 1) % EMOJIS.length;
  currentEmoji = EMOJIS[emojiIdx];
  document.getElementById('groupEmojiBtn').textContent = currentEmoji;
}

/* ══════════════════════════════════════
   INVITE TAGS INPUT
   ══════════════════════════════════════ */

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
  tag.innerHTML = `${escHtml(email)}<button onclick="removeInviteTag('${escHtml(email)}', this)">×</button>`;
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
  showToast('Group settings coming soon.', 'info');
}

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
  auth.onAuthStateChanged(user => {
    if (user) loadGroups();
  });
});