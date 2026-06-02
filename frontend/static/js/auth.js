// auth.js

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

/* ── Google вход ─────────────────────── */
async function signInWithGoogle() {
  clearAuthError();
  // Пренасочва към backend OAuth flow
  window.location.href = '/auth/login';
}

/* ── Имейл вход ─────────────────────── */
async function emailSignIn() {
  clearAuthError();
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) { showAuthError('Моля попълни всички полета.'); return; }

  try {
    const res = await fetch('/auth/email-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      window.location.href = '/dashboard';
    } else {
      showAuthError(data.error || 'Грешка при вход.');
    }
  } catch (err) {
    showAuthError('Грешка при вход. Опитай отново.');
  }
}

/* ── Имейл регистрация ──────────────── */
async function emailRegister() {
  clearAuthError();
  const name     = document.getElementById('regName').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  if (!name || !email || !password) { showAuthError('Моля попълни всички полета.'); return; }
  if (password.length < 8) { showAuthError('Паролата трябва да е поне 8 символа.'); return; }

  try {
    const res = await fetch('/auth/email-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (res.ok) {
      window.location.href = '/dashboard';
    } else {
      showAuthError(data.error || 'Грешка при регистрация.');
    }
  } catch (err) {
    showAuthError('Грешка при регистрация. Опитай отново.');
  }
}

/* ── Изход ──────────────────────────── */
function signOut() {
  window.location.href = '/auth/logout';
}

/* ── Попълни потребителски чип ───────── */
function populateUserChip() {
  fetch('/auth/me')
    .then(res => res.json())
    .then(data => {
      const nameEl   = document.getElementById('userName');
      const emailEl  = document.getElementById('userEmail');
      const avatarEl = document.getElementById('userAvatar');

      if (nameEl)   nameEl.textContent  = data.name  || data.user_id;
      if (emailEl)  emailEl.textContent = data.email || '';
      if (avatarEl) avatarEl.textContent = (data.name || '?')[0].toUpperCase();
    })
    .catch(() => {});
}

function getCurrentUser() {
  return null; // Използваме Flask session, не Firebase auth
}

/* ── Синхронизация на календар ───────── */
async function syncGoogleCalendar() {
  const btn = document.getElementById('syncCalBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Синхронизира се…'; }
  try {
    const res = await fetch('/api/calendar/sync', { method: 'POST' });
    if (!res.ok) throw new Error('Синхронизацията е неуспешна');
    showToast('Календарът е синхронизиран!', 'success');
    if (typeof loadEvents === 'function') loadEvents();
  } catch (err) {
    showToast('Грешка при синхронизация: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Синхронизирай'; }
  }
}

/* ── Инициализация ───────────────────── */
(function init() {
  const path = window.location.pathname;

  if (path.includes('dashboard') || path.includes('groups')) {
    populateUserChip();
  }

  // Задай днешната дата
  const dateEl = document.getElementById('dateToday');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('bg-BG', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
})();

/* ── Затвори модал ───────────────────── */
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

/* ── Toast съобщения ─────────────────── */
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