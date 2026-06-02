// notify.js

let unsubscribeNotifications = null;

function initNotifications() {
  const user = getCurrentUser();
  if (!user || !db) return;

  unsubscribeNotifications = db.collection('notifications')
    .where('recipientUid', '==', user.uid)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .onSnapshot(snap => {
      const notifs = [];
      snap.forEach(doc => notifs.push({ id: doc.id, ...doc.data() }));
      renderNotifications(notifs);
      updateBadge(notifs.filter(n => !n.read).length);
    }, err => {
      console.error('notifications listener:', err);
    });
}

function renderNotifications(notifs) {
  const list = document.getElementById('notifList');
  if (!list) return;

  if (!notifs.length) {
    list.innerHTML = `<li class="notif-empty">Няма нови известия</li>`;
    return;
  }

  list.innerHTML = notifs.map(n => {
    const ts  = n.createdAt ? relativeTime(n.createdAt.toDate ? n.createdAt.toDate() : new Date(n.createdAt)) : '';
    const cls = n.read ? 'notif-item' : 'notif-item unread';
    return `
      <li class="${cls}" onclick="markRead('${n.id}')">
        ${!n.read ? '<div class="notif-dot"></div>' : ''}
        <div class="notif-body">
          ${escHtml(n.message)}
          ${n.groupName ? `<br><small style="color:var(--text-muted)">Група: ${escHtml(n.groupName)}</small>` : ''}
        </div>
        <div class="notif-time">${ts}</div>
      </li>`;
  }).join('');
}

async function markRead(notifId) {
  if (!db) return;
  try {
    await db.collection('notifications').doc(notifId).update({ read: true });
  } catch (err) {
    console.error('markRead:', err);
  }
}

async function markAllNotificationsRead() {
  const user = getCurrentUser();
  if (!user || !db) return;
  try {
    const snap = await db.collection('notifications')
      .where('recipientUid', '==', user.uid)
      .where('read', '==', false)
      .get();
    const batch = db.batch();
    snap.forEach(doc => batch.update(doc.ref, { read: true }));
    await batch.commit();
    showToast('Всички известия са маркирани като прочетени.', 'success');
  } catch (err) {
    showToast('Грешка: ' + err.message, 'error');
  }
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

async function notifyCalendarChange(uid) {
  const user = getCurrentUser();
  if (!user) return;
  try {
    await fetch('/api/notify/calendar-changed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await user.getIdToken()}`
      },
      body: JSON.stringify({ uid })
    });
  } catch (err) {
    console.warn('notifyCalendarChange:', err);
  }
}

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

document.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(user => {
    if (user) initNotifications();
    else if (unsubscribeNotifications) { unsubscribeNotifications(); unsubscribeNotifications = null; }
  });
});