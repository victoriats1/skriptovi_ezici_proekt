// auth.js
// Handles Firebase authentication: Google OAuth and email/password.

/* ── Helpers ─────────────────────────── */

function showAuthError(msg) {
  const el = document.getElementById('authError');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearAuthError() {
  const el = document.getElementById('authError');
  if (el) el.classList.add('hidden');
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
  clearAuthError();
}

/* ── Sign-in / Sign-up ──────────────── */

async function signInWithGoogle() {
  clearAuthError();
  try {
    await auth.signInWithPopup(googleProvider);
    window.location.href = 'dashboard.html';
  } catch (err) {
    showAuthError(err.message);
  }
}

async function emailSignIn() {
  clearAuthError();
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) { showAuthError('Please fill in all fields.'); return; }
  try {
    await auth.signInWithEmailAndPassword(email, password);
    window.location.href = 'dashboard.html';
  } catch (err) {
    showAuthError(friendlyError(err.code));
  }
}

async function emailRegister() {
  clearAuthError();
  const name     = document.getElementById('regName').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  if (!name || !email || !password) { showAuthError('Please fill in all fields.'); return; }
  if (password.length < 8) { showAuthError('Password must be at least 8 characters.'); return; }
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });
    // Create Firestore user record
    if (db) {
      await db.collection('users').doc(cred.user.uid).set({
        displayName: name,
        email:       email,
        photoURL:    '',
        createdAt:   firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    window.location.href = 'dashboard.html';
  } catch (err) {
    showAuthError(friendlyError(err.code));
  }
}

function signOut() {
  auth.signOut().then(() => { window.location.href = 'index.html'; });
}

/* ── Auth state observer ────────────── */
// Called on pages that require auth (dashboard, groups).
function requireAuth() {
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = 'index.html';
      return;
    }
    populateUserChip(user);
  });
}

// Called on index page — redirect already-authed users.
function redirectIfAuthed() {
  auth.onAuthStateChanged(user => {
    if (user) window.location.href = 'dashboard.html';
  });
}

function populateUserChip(user) {
  const nameEl   = document.getElementById('userName');
  const emailEl  = document.getElementById('userEmail');
  const avatarEl = document.getElementById('userAvatar');

  if (nameEl)  nameEl.textContent  = user.displayName || user.email;
  if (emailEl) emailEl.textContent = user.email;

  if (avatarEl) {
    if (user.photoURL) {
      avatarEl.innerHTML = `<img src="${user.photoURL}" alt="avatar"/>`;
    } else {
      avatarEl.textContent = (user.displayName || user.email || '?')[0].toUpperCase();
    }
  }
}

function getCurrentUser() {
  return auth.currentUser;
}

/* ── Error code → human text ────────── */
function friendlyError(code) {
  const map = {
    'auth/user-not-found':       'No account found with that email.',
    'auth/wrong-password':       'Incorrect password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password':        'Password is too weak.',
    'auth/invalid-email':        'Invalid email address.',
    'auth/too-many-requests':    'Too many attempts. Please try again later.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

/* ── Sync Google Calendar (OAuth token) ── */
async function syncGoogleCalendar() {
  const btn = document.getElementById('syncCalBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Syncing…'; }
  try {
    // Re-authenticate with Google to get a fresh access token
    const result = await auth.currentUser.reauthenticateWithPopup(googleProvider);
    const token  = result.credential.accessToken;
    // Send token to backend
    const res = await fetch('/api/calendar/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    if (!res.ok) throw new Error('Sync failed');
    showToast('Calendar synced!', 'success');
    if (typeof loadEvents === 'function') loadEvents();
  } catch (err) {
    showToast('Could not sync calendar: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Sync Calendar'; }
  }
}

/* ── Init per-page ──────────────────── */
(function init() {
  const path = window.location.pathname;
  if (path.includes('dashboard') || path.includes('groups')) {
    requireAuth();
  } else if (path.includes('index') || path === '/' || path.endsWith('/')) {
    redirectIfAuthed();
  }

  // Set today's date on topbar
  const dateEl = document.getElementById('dateToday');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
})();

/* ── Shared modal helpers ────────────── */
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

/* ── Toast helper ───────────────────── */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = {
    success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    info:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${icons[type] || ''}<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 280);
  }, 3500);
}