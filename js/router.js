import { BASE_PATH, routeUrl } from './config.js';

function pathWithoutBase(pathname = window.location.pathname) {
  const decoded = decodeURIComponent(pathname);
  if (decoded.startsWith(BASE_PATH)) return decoded.slice(BASE_PATH.length).replace(/^\/+/, '');
  return decoded.replace(/^\/+/, '');
}

export function parseRoute(pathname = window.location.pathname) {
  const clean = pathWithoutBase(pathname).replace(/\/+$/, '');
  if (!clean) return { name: 'home', path: '' };
  if (clean === 'login') return { name: 'login', path: clean, auth: true };
  if (clean === 'signup') return { name: 'signup', path: clean, auth: true };
  if (clean === 'forgot-password') return { name: 'forgot-password', path: clean, auth: true };
  if (clean === 'dashboard') return { name: 'dashboard', path: clean, protected: true };
  if (clean === 'payments') return { name: 'payments', path: clean, protected: true };
  if (clean === 'analytics') return { name: 'analytics', path: clean, protected: true };
  if (clean === 'settings') return { name: 'settings', path: clean, protected: true };
  if (clean === 'notifications') return { name: 'notifications', path: clean, protected: true };
  if (clean === 'help') return { name: 'help', path: clean };
  if (clean === 'about') return { name: 'about', path: clean };
  if (clean === 'privacy') return { name: 'privacy', path: clean };
  if (clean === 'terms') return { name: 'terms', path: clean };
  if (clean === 'admin' || clean.startsWith('admin/')) return { name: 'admin', section: clean.split('/')[1] || 'dashboard', path: clean, admin: true, protected: true };
  if (clean === 'payment/pending') return { name: 'payment-pending', path: clean };
  if (clean === 'payment/success') return { name: 'payment-success', path: clean };
  if (clean === 'payment/failed') return { name: 'payment-failed', path: clean };
  if (clean.startsWith('@')) {
    const [username, subsection] = clean.split('/');
    return { name: subsection === 'support' ? 'creator-support' : 'creator', username: username.slice(1).toLowerCase(), path: clean };
  }
  return { name: 'not-found', path: clean };
}

export function navigate(path, { replace = false } = {}) {
  const target = path.startsWith('/') ? path : routeUrl(path);
  const url = new URL(target, window.location.origin);
  if (url.origin !== window.location.origin) {
    window.location.assign(url.href);
    return;
  }
  if (window.location.pathname === url.pathname && window.location.search === url.search) {
    window.dispatchEvent(new CustomEvent('supportly-route-change', { detail: parseRoute(url.pathname) }));
    return;
  }
  window.history[replace ? 'replaceState' : 'pushState']({}, '', `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new CustomEvent('supportly-route-change', { detail: parseRoute(url.pathname) }));
}

export function absoluteRoute(path) {
  return new URL(routeUrl(path), window.location.origin).href;
}

export function isBasePathConfigured() {
  return BASE_PATH.endsWith('/');
}
