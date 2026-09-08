export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatINR(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

export function formatCompactINR(value) {
  const amount = Number(value || 0);
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}k`;
  return formatINR(amount);
}

export function formatDate(value, fallback = '—') {
  const timestamp = Number(value);
  if (!timestamp || !Number.isFinite(timestamp)) return fallback;
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
}

export function initials(value = 'Creator') {
  const result = String(value).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return result || 'CR';
}

export function avatarClass(value = '') {
  const classes = ['avatar-purple', 'avatar-teal', 'avatar-orange', 'avatar-blue', 'avatar-plum'];
  const total = [...String(value)].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return classes[total % classes.length];
}

export function statusClass(status = '') {
  return String(status).toLowerCase();
}

export function statusLabel(status = '') {
  return { VERIFIED: 'Verified', PENDING: 'Pending', REJECTED: 'Rejected', FLAGGED: 'Flagged', CANCELLED: 'Cancelled' }[status] || status;
}

export function statusBadge(status, icon = false) {
  const symbol = icon ? '<span class="status-symbol"></span>' : '';
  return `<span class="status-badge ${statusClass(status)}">${symbol}${escapeHtml(statusLabel(status))}</span>`;
}

export function parseQuery() {
  return Object.fromEntries(new URLSearchParams(window.location.search).entries());
}

export function friendlyFirebaseError(error) {
  const code = error?.code || '';
  const messages = {
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/invalid-login-credentials': 'The email or password is incorrect.',
    'auth/user-not-found': 'No account was found with that email address.',
    'auth/wrong-password': 'The email or password is incorrect.',
    'auth/email-already-in-use': 'An account already exists with this email address.',
    'auth/weak-password': 'Choose a stronger password with at least six characters.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/popup-closed-by-user': 'The Google sign-in window was closed before completion.',
    'auth/popup-blocked': 'Your browser blocked the sign-in popup. We will try a redirect instead.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase Console.',
    'auth/account-exists-with-different-credential': 'An account already exists with another sign-in method.',
    'auth/network-request-failed': 'Network connection failed. Check your connection and try again.',
    'auth/too-many-requests': 'Too many attempts. Please wait a little and try again.',
    'auth/requires-recent-login': 'For your security, sign in again before making this change.',
    'database/permission-denied': 'You do not have permission to perform that action.',
    'functions/permission-denied': 'You do not have permission to perform that action.',
    'functions/not-found': 'The trusted server operation is not deployed yet. See the production setup guide.',
    'functions/unavailable': 'The server is temporarily unavailable. Please try again shortly.',
    'functions/resource-exhausted': 'Too many requests. Please try again later.',
    'functions/invalid-argument': 'Check your profile details and try again.',
    'functions/internal': 'The profile service is unavailable. Please try again.',
    'functions/failed-precondition': 'This action cannot be completed in the current state.',
    'functions/already-exists': 'This transaction reference has already been submitted.',
    'auth/requires-login': 'Please sign in before saving your creator profile.',
    'database/username-taken': 'That username is already taken. Choose another one.',
  };
  if (messages[code]) return messages[code];
  if (String(error?.message || '').toLowerCase().includes('google')) return 'Google Sign-In is currently unavailable. Please enable Google authentication in Firebase Console.';
  return 'Something went wrong. Please try again.';
}

export function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  }
}

export function debounce(callback, wait = 250) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), wait);
  };
}

export function safeExternalUrl(value, allowedHosts = ['youtube.com', 'www.youtube.com', 'youtu.be']) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    if (!allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) return '';
    return url.href;
  } catch {
    return '';
  }
}
