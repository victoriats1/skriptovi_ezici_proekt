// notify.js
// Real-time notifications via Firestore onSnapshot.
// Triggers when a group member changes their calendar and affects a shared plan.

let unsubscribeNotifications = null;

/* ══════════════════════════════════════
   LOAD & LISTEN
   ══════════════════════════════════════ */

function initNotifications() {
  const user = getCurrentUser();
  if (!user || !db) return;

  const notifList = document.getElementById('notifList');

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
    list.innerHTML = `<li class="notif-empty">No new alerts</li>`;
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
          ${n.groupName ? `<br><small style="color:var(--text-muted)">Group: ${escHtml(n.groupName)}</small>` : ''}
        </div>
        <div class="notif-time">${ts}</div>
      </li>`;
  }).join('');
}

/* ══════════════════════════════════════
   MARK READ
   ══════════════════════════════════════ */

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
    showToast('All notifications marked as read.', 'success');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

/* ══════════════════════════════════════
   BADGE
   ══════════════════════════════════════ */

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
   SEND NOTIFICATION (called from backend proxy)
   ══════════════════════════════════════ */

// This is a frontend helper to trigger the backend notification endpoint.
// The backend (notify_routes.py) handles the actual logic.
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
    console.warn('notifyCalendarChange silently failed:', err);
  }
}

/* ══════════════════════════════════════
   UTILS
   ══════════════════════════════════════ */

function relativeTime(date) {
  const diff = (Date.now() - date) / 1000;
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ══════════════════════════════════════
   INIT
   ══════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  // Wait for auth state before subscribing
  auth.onAuthStateChanged(user => {
    if (user) initNotifications();
    else if (unsubscribeNotifications) { unsubscribeNotifications(); unsubscribeNotifications = null; }
  });
});