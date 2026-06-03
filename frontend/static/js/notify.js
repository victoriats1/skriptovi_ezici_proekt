// notify.js

let unsubscribeNotifications = null;

/* ══════════════════════════════════════
   ИЗВЕСТИЯ
   ══════════════════════════════════════ */

async function loadNotifications() {
  const list      = document.getElementById('notifList');
  const listModal = document.getElementById('notifListModal');
  const badge     = document.getElementById('navBadge');

  try {
    const res  = await fetch('/notify/my');
    const data = await res.json();
    const notifs = data.notifications || [];

    updateBadge(notifs.length);
    renderNotifications(notifs, list);
    renderNotifications(notifs, listModal);
  } catch (err) {
    console.error('loadNotifications:', err);
  }
}

function renderNotifications(notifs, list) {
  if (!list) return;

  if (!notifs.length) {
    list.innerHTML = `<li class="notif-empty">Няма нови известия</li>`;
    return;
  }

  list.innerHTML = notifs.map(n => {
    const ts = n.created_at ? relativeTime(new Date(n.created_at)) : '';
    return `
      <li class="notif-item unread" onclick="markRead('${n.id}')">
        <div class="notif-dot"></div>
        <div class="notif-body">${escHtml(n.message)}</div>
        <div class="notif-time">${ts}</div>
      </li>`;
  }).join('');
}

async function markRead(notifId) {
  try {
    await fetch(`/notify/${notifId}/read`, { method: 'POST' });
    loadNotifications();
  } catch (err) {
    console.error('markRead:', err);
  }
}

async function markAllNotificationsRead() {
  const list = document.getElementById('notifList');
  if (!list) return;
  const items = list.querySelectorAll('.notif-item');
  for (const item of items) {
    const onclick = item.getAttribute('onclick');
    if (onclick) {
      const id = onclick.match(/'([^']+)'/)?.[1];
      if (id) await markRead(id);
    }
  }
  showToast('Всички известия са маркирани като прочетени.', 'success');
}

function updateBadge(count) {
  const badge = document.getElementById('navBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 9 ? '9+' : count;
    badge.style.display = 'inline';
  } else {
    badge.style.display = 'none';
  }
}

/* ══════════════════════════════════════
   ПОКАНИ
   ══════════════════════════════════════ */

async function loadInvites() {
  const list = document.getElementById('invitesList');
  const section = document.getElementById('invitesSection');
  if (!list) return;

  try {
    const res  = await fetch('/group/invites');
    const data = await res.json();
    const invites = data.invites || [];

    if (!invites.length) {
      if (section) section.style.display = 'none';
      return;
    }

    if (section) section.style.display = 'block';

    list.innerHTML = invites.map(inv => `
      <li class="invite-item">
        <div class="invite-info">
          <span class="invite-from">${escHtml(inv.from_email)}</span>
          <span class="invite-text"> те кани в група</span>
        </div>
        <button class="btn-primary btn-sm" onclick="acceptInvite('${inv.invite_id}')">Приеми</button>
      </li>`).join('');
  } catch (err) {
    console.error('loadInvites:', err);
  }
}

async function acceptInvite(inviteId) {
  try {
    const res = await fetch(`/group/invite/${inviteId}/accept`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Грешка');
    showToast('Поканата е приета! Вече си в групата.', 'success');
    loadInvites();
  } catch (err) {
    showToast('Грешка: ' + err.message, 'error');
  }
}

/* ══════════════════════════════════════
   UTILS
   ══════════════════════════════════════ */

function relativeTime(date) {
  const diff = (Date.now() - date) / 1000;
  if (diff < 60)    return 'Току що';
  if (diff < 3600)  return `преди ${Math.floor(diff / 60)} мин`;
  if (diff < 86400) return `преди ${Math.floor(diff / 3600)} ч`;
  return date.toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ══════════════════════════════════════
   INIT
   ══════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  loadNotifications();
  loadInvites();
  // Опресни на всеки 30 секунди
  setInterval(() => {
    loadNotifications();
    loadInvites();
  }, 30000);
});