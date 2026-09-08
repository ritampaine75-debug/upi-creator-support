import { initializeOptionalAppCheck } from './firebase.js';
import {
  auth,
  createEmailAccount,
  initializeAuth,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  subscribeAuth,
} from './auth.js';
import {
  createReport,
  getAdminProfile,
  getCreator,
  getCreatorAnalytics,
  getCreatorByUsername,
  getPayment,
  getUserRecord,
  getPath,
  markAllNotificationsRead,
  markNotificationRead,
  reviewPayment,
  saveCreatorProfile,
  subscribeCreatorPayments,
  listenToNotifications,
  submitPayment,
} from './database.js';
import { loadAnalytics, trackPublicProfileView } from './analytics.js';
import { markEverythingRead, markOneRead, subscribeNotifications, unreadNotifications } from './notifications.js';
import { absoluteRoute, navigate, parseRoute } from './router.js';
import { renderUpiQr } from './qr.js';
import {
  avatarClass,
  copyText,
  debounce,
  escapeHtml,
  formatCompactINR,
  formatDate,
  formatINR,
  friendlyFirebaseError,
  initials,
  parseQuery,
  safeExternalUrl,
  statusBadge,
  statusLabel,
} from './utils.js';
import {
  sanitizeImageFile,
  sanitizeText,
  validateAmount,
  validateName,
  validateUpiId,
  validateUsername,
  validateUtr,
  validateYoutubeUrl,
} from './security.js';
import { BASE_PATH, SUPPORTLY_NAME, routeUrl } from './config.js';

const state = {
  route: parseRoute(),
  authReady: false,
  authError: '',
  user: null,
  userProfile: null,
  creator: null,
  publicCreator: null,
  publicCreatorStatus: 'idle',
  publicCreatorError: '',
  payments: [],
  paymentsStatus: 'idle',
  paymentsError: '',
  analytics: null,
  analyticsStatus: 'idle',
  analyticsError: '',
  notifications: [],
  notificationsError: '',
  admin: null,
  adminStatus: 'idle',
  adminError: '',
  adminData: null,
  modal: null,
  support: {
    step: 1,
    amount: 100,
    custom: false,
    supporterName: '',
    message: '',
    utr: '',
    busy: false,
    error: '',
    showQr: false,
  },
  paymentFilters: { status: 'all', search: '', min: '', max: '', sort: 'newest' },
  avatarDraft: '',
  subscriptions: { payments: null, notifications: null },
  lastPayment: null,
  authBusy: false,
  formError: '',
};

const pageMeta = {
  home: { label: 'Home', kicker: 'Support creators directly with UPI' },
  dashboard: { label: 'Overview', kicker: 'Good morning' },
  payments: { label: 'Payments', kicker: 'Payment review' },
  analytics: { label: 'Analytics', kicker: 'Your audience at a glance' },
  settings: { label: 'Settings', kicker: 'Creator profile' },
  notifications: { label: 'Notifications', kicker: 'Stay in the loop' },
  help: { label: 'Help center', kicker: 'Supportly guide' },
  about: { label: 'About', kicker: 'A simpler way to support creators' },
  privacy: { label: 'Privacy', kicker: 'Your information matters' },
  terms: { label: 'Terms', kicker: 'Using Supportly responsibly' },
  creator: { label: 'Public page', kicker: 'Creator support' },
  'creator-support': { label: 'Support', kicker: 'Direct UPI support' },
  'payment-pending': { label: 'Payment status', kicker: 'Submission received' },
  'payment-success': { label: 'Payment status', kicker: 'Verification update' },
  'payment-failed': { label: 'Payment status', kicker: 'Payment update' },
  admin: { label: 'Admin', kicker: 'Operations' },
  login: { label: 'Sign in', kicker: 'Welcome back' },
  signup: { label: 'Create account', kicker: 'Start your creator page' },
  'forgot-password': { label: 'Reset password', kicker: 'Account recovery' },
  'not-found': { label: 'Not found', kicker: 'That page is unavailable' },
};

function icon(name, className = '') {
  return `<svg class="icon ${className}" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
}

function avatarMarkup(person = {}, size = 'avatar-sm') {
  const label = initials(person.displayName || person.name || person.supporter || 'Creator');
  const className = avatarClass(person.uid || person.displayName || person.name || label);
  const source = safeImageSource(person.avatar || person.photoURL || '');
  if (source) return `<span class="avatar ${size} avatar-image"><img src="${escapeHtml(source)}" alt="" /></span>`;
  return `<span class="avatar ${size} ${className}">${escapeHtml(label)}</span>`;
}

function safeImageSource(value) {
  const source = String(value || '');
  if (source.startsWith('data:image/jpeg;base64,') || source.startsWith('data:image/png;base64,') || source.startsWith('data:image/webp;base64,')) return source;
  if (/^https:\/\//i.test(source)) return source;
  return '';
}

function isAuthRoute(route = state.route) {
  return ['login', 'signup', 'forgot-password'].includes(route.name);
}

function isMinimalRoute(route = state.route) {
  if (isAuthRoute(route) || route.name === 'home' || route.name === 'not-found') return true;
  if (['creator', 'creator-support', 'payment-pending', 'payment-success', 'payment-failed'].includes(route.name) && !state.user) return true;
  return false;
}

function renderPageHeader({ title, subtitle, kicker, actions = '' }) {
  return `<div class="page-header"><div><div class="page-kicker">${icon('spark')}<span>${escapeHtml(kicker)}</span></div><h1 class="page-title">${escapeHtml(title)}</h1><p class="page-subtitle">${escapeHtml(subtitle)}</p></div>${actions ? `<div class="header-actions">${actions}</div>` : ''}</div>`;
}

function renderLoading(title = 'Loading your workspace…') {
  return `<div class="loading-state"><div class="loading-header"><span class="skeleton skeleton-kicker"></span><span class="skeleton skeleton-title"></span><span class="skeleton skeleton-subtitle"></span></div><div class="skeleton-grid"><span class="skeleton skeleton-card skeleton-card-wide"></span><span class="skeleton skeleton-card"></span></div><div class="skeleton-grid skeleton-grid-stats"><span class="skeleton skeleton-card"></span><span class="skeleton skeleton-card"></span><span class="skeleton skeleton-card"></span><span class="skeleton skeleton-card"></span></div><p class="loading-label">${escapeHtml(title)}</p></div>`;
}

function renderErrorState(title, message, action = '') {
  return `<section class="panel error-state"><div class="error-state-icon">${icon('info')}</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p>${action}</section>`;
}

function renderEmptyState(title, message, action = '') {
  return `<div class="empty-state"><div><div class="empty-state-icon">${icon('wallet')}</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p>${action ? `<div class="empty-state-action">${action}</div>` : ''}</div></div>`;
}

function renderShellState() {
  const route = state.route;
  const meta = pageMeta[route.name] || pageMeta.home;
  document.body.classList.toggle('auth-route', isAuthRoute(route));
  document.body.classList.toggle('minimal-route', isMinimalRoute(route));
  document.body.classList.toggle('has-sidebar', !isMinimalRoute(route));
  const breadcrumbs = document.getElementById('breadcrumbs');
  if (breadcrumbs) breadcrumbs.innerHTML = `<span>${escapeHtml(route.admin ? 'Admin' : 'Workspace')}</span><span class="breadcrumb-slash">/</span><strong>${escapeHtml(meta.label)}</strong>`;
  updateDocumentMeta(route);
  updateShellUser();
  updateActiveNavigation();
}

function updateDocumentMeta(route) {
  const creator = state.publicCreator;
  const title = creator && ['creator', 'creator-support'].includes(route.name) ? `${creator.displayName} — Support on ${SUPPORTLY_NAME}` : `${pageMeta[route.name]?.label || 'Support'} — ${SUPPORTLY_NAME}`;
  document.title = title;
  const description = creator && ['creator', 'creator-support'].includes(route.name) ? `Support ${creator.displayName} directly with UPI on ${SUPPORTLY_NAME}.` : 'Support creators directly with UPI on Supportly.';
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
  meta.content = description;
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
  canonical.href = new URL(route.name === 'creator' || route.name === 'creator-support' ? routeUrl(`@${creator?.username || route.username || ''}`) : routeUrl(route.path || ''), window.location.origin).href;
}

function updateShellUser() {
  const profile = state.creator || state.userProfile || state.user;
  const displayName = profile?.displayName || state.user?.displayName || 'Creator';
  const email = state.user?.email || 'Not signed in';
  const username = state.creator?.username || 'creator';
  document.querySelectorAll('[data-user-name]').forEach((element) => { element.textContent = displayName; });
  document.querySelectorAll('[data-user-email]').forEach((element) => { element.textContent = email; });
  document.querySelectorAll('[data-user-handle]').forEach((element) => { element.textContent = `@${username}`; });
  document.querySelectorAll('[data-user-avatar]').forEach((element) => {
    const text = initials(displayName);
    const source = safeImageSource(profile?.avatar || profile?.photoURL || '');
    if (source) {
      element.innerHTML = `<img src="${escapeHtml(source)}" alt="" />`;
      element.classList.add('avatar-image');
    } else {
      element.textContent = text;
      element.classList.remove('avatar-image');
    }
  });
  document.querySelectorAll('[data-creator-route]').forEach((element) => {
    const target = state.creator?.username ? `@${state.creator.username}` : 'settings/';
    element.setAttribute('href', routeUrl(target));
    element.dataset.route = target;
  });
  const pending = state.payments.filter((payment) => payment.status === 'PENDING').length;
  const unread = state.notifications.filter((notification) => notification.read !== true).length;
  const paymentCount = document.getElementById('sidebar-payment-count');
  const notificationCount = document.getElementById('sidebar-notification-count');
  const notificationDot = document.getElementById('header-notification-dot');
  if (paymentCount) { paymentCount.hidden = pending === 0; paymentCount.textContent = String(pending); }
  if (notificationCount) { notificationCount.hidden = unread === 0; notificationCount.textContent = String(unread); }
  if (notificationDot) notificationDot.hidden = unread === 0;
}

function activeRouteName(route) {
  if (route.name === 'creator' || route.name === 'creator-support') return 'public';
  if (route.name === 'admin') return 'admin';
  return route.name;
}

function updateActiveNavigation() {
  const active = activeRouteName(state.route);
  document.querySelectorAll('[data-route]').forEach((element) => {
    const raw = element.dataset.route || '';
    if (raw && !raw.startsWith('http')) element.setAttribute('href', routeUrl(raw));
    const normalized = raw.replace(/^\/+/, '').replace(/\/+$/, '');
    const target = normalized.startsWith('@') ? 'public' : normalized.split('/')[0] || 'home';
    element.classList.toggle('is-active', target === active || (active === 'dashboard' && target === 'dashboard'));
  });
}

function renderApp() {
  if (!document.getElementById('page-view')) return;
  renderShellState();
  prepareDataLoad();
  const pageView = document.getElementById('page-view');
  pageView.innerHTML = renderRoute(state.route);
  if (state.route.name === 'creator-support' && state.support.step === 3) {
    window.setTimeout(() => hydrateQr(), 0);
  }
  if (state.route.name === 'settings' && state.avatarDraft) {
    const preview = document.querySelector('[data-avatar-preview]');
    if (preview) preview.innerHTML = `<img src="${escapeHtml(state.avatarDraft)}" alt="Profile preview" />`;
  }
}

function prepareDataLoad() {
  const route = state.route;
  if (state.user && ['dashboard', 'analytics'].includes(route.name) && state.analyticsStatus === 'idle') {
    state.analyticsStatus = 'loading';
    loadAnalytics(state.user.uid).then((value) => { state.analytics = value; state.analyticsStatus = 'ready'; renderApp(); }).catch((error) => { state.analyticsStatus = 'error'; state.analyticsError = friendlyFirebaseError(error); renderApp(); });
  }
  if (route.name === 'creator' || route.name === 'creator-support') {
    const username = route.username || '';
    if (state.publicCreatorStatus === 'idle' || state.publicCreator?.username !== username) {
      state.publicCreatorStatus = 'loading';
      state.publicCreatorError = '';
      getCreatorByUsername(username).then((creator) => {
        state.publicCreator = creator;
        state.publicCreatorStatus = creator ? 'ready' : 'not-found';
        if (creator) trackPublicProfileView(creator.uid, creator.username);
        renderApp();
      }).catch((error) => { state.publicCreatorStatus = 'error'; state.publicCreatorError = friendlyFirebaseError(error); renderApp(); });
    }
  }
  if (route.admin && state.adminStatus === 'idle' && state.user) {
    state.adminStatus = 'loading';
    getAdminProfile(state.user.uid).then((admin) => {
      state.admin = admin;
      state.adminStatus = admin?.isActive ? 'ready' : 'unauthorized';
      if (state.adminStatus === 'ready') loadAdminData(route.section);
      else renderApp();
    }).catch((error) => { state.adminStatus = 'error'; state.adminError = friendlyFirebaseError(error); renderApp(); });
  }
  if (route.admin && state.adminStatus === 'ready' && !state.adminData) loadAdminData(route.section);
}

async function loadAdminData(section = 'dashboard') {
  state.adminData = { section, status: 'loading' };
  renderApp();
  try {
    const [payments, users, creators, reports, logs] = await Promise.all([
      getPath('payments'), getPath('users'), getPath('creators'), getPath('reports'), getPath('adminAuditLogs'),
    ]);
    state.adminData = { section, status: 'ready', payments: payments || {}, users: users || {}, creators: creators || {}, reports: reports || {}, logs: logs || {} };
  } catch (error) {
    state.adminData = { section, status: 'error', error: friendlyFirebaseError(error) };
  }
  renderApp();
}

function renderRoute(route) {
  if (route.protected && !state.authReady) return renderLoading('Checking your secure session…');
  if (route.protected && !state.user) return renderLoading('Redirecting to sign in…');
  if (route.admin) return renderAdminRoute(route);
  switch (route.name) {
    case 'home': return state.user ? renderDashboardPage() : renderLandingPage();
    case 'dashboard': return renderDashboardPage();
    case 'payments': return renderPaymentsPage();
    case 'analytics': return renderAnalyticsPage();
    case 'settings': return renderSettingsPage();
    case 'notifications': return renderNotificationsPage();
    case 'help': return renderHelpPage();
    case 'about': return renderAboutPage();
    case 'privacy': return renderLegalPage('Privacy Policy', 'How Supportly handles information', privacyContent());
    case 'terms': return renderLegalPage('Terms of Service', 'Use Supportly with care and honesty', termsContent());
    case 'creator': return renderCreatorPage(false);
    case 'creator-support': return renderCreatorPage(true);
    case 'payment-pending': return renderPaymentStatusPage('pending');
    case 'payment-success': return renderPaymentStatusPage('success');
    case 'payment-failed': return renderPaymentStatusPage('failed');
    case 'login': return renderLoginPage();
    case 'signup': return renderSignupPage();
    case 'forgot-password': return renderForgotPasswordPage();
    case 'not-found': return renderNotFoundPage();
    default: return renderLandingPage();
  }
}

function renderLandingPage() {
  return `<div class="auth-shell marketing-shell"><section class="auth-brand"><div class="brand-lockup"><div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div><div><div class="brand-name">supportly</div><div class="brand-caption">creator support</div></div></div><div class="marketing-copy"><span class="page-kicker">${icon('lightning')} Direct creator support</span><h1>Support creators<br /><em>directly with UPI.</em></h1><p>A focused space for YouTubers, builders, teachers, artists, and every creator making something worth sharing.</p><div class="header-actions"><a class="primary-button" href="login/" data-route="login/">Sign in ${icon('arrow-right')}</a><a class="secondary-button" href="signup/" data-route="signup/">Create your page</a></div></div><div class="auth-trust-row">${icon('shield')}<span>Direct UPI handoff · Creator-controlled verification · No bank details collected</span></div></section><section class="marketing-preview"><div class="marketing-preview-top"><span>Creator workspace</span><span class="profile-badge">${icon('check-circle')} Live</span></div><div class="marketing-dashboard-card"><div class="welcome-card"><div class="welcome-content"><div class="welcome-eyebrow">${icon('check-circle')}<span>Your page is ready</span></div><h2>Keep doing work<br />worth supporting.</h2><p>Share one simple link with your audience and receive support directly through UPI.</p></div></div><div class="marketing-stat-row"><div><span>Verified support</span><strong>₹18,240</strong></div><div><span>Pending review</span><strong>8</strong></div><div><span>Page views</span><strong>1,204</strong></div></div></div><p class="marketing-note">A calm, transparent workflow from support intent to verified payment.</p></section></div>`;
}

function renderDashboardPage() {
  const payments = state.payments;
  const verified = payments.filter((payment) => payment.status === 'VERIFIED');
  const pending = payments.filter((payment) => payment.status === 'PENDING');
  const rejected = payments.filter((payment) => payment.status === 'REJECTED');
  const analytics = state.analytics || {};
  const verifiedAmount = Number(analytics.verifiedAmount ?? verified.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
  const profileViews = Number(analytics.profileViews || analytics.supportPageViews || 0);
  const pendingCount = Number(analytics.pendingPaymentCount ?? pending.length);
  const creatorName = state.creator?.displayName || state.user?.displayName || 'Creator';
  const creatorUsername = state.creator?.username || 'creator';
  if (state.analyticsStatus === 'loading' && !state.analytics) return renderLoading('Loading your creator metrics…');
  return `${renderPageHeader({ title: 'Overview', subtitle: 'Here is what is happening on your creator page today.', kicker: `${pageMeta.dashboard.kicker}, ${creatorName.split(' ')[0]}`, actions: `<a class="secondary-button" href="${routeUrl(`@${creatorUsername}`)}" data-route="@${creatorUsername}">${icon('external')}View public page</a><button class="primary-button" data-action="share-page">${icon('share')}Share page</button>` })}
    <div class="overview-grid"><section class="welcome-card"><span class="welcome-orb" aria-hidden="true"></span><div class="welcome-content"><div class="welcome-eyebrow">${icon('check-circle')}<span>${state.creator?.isPublic === false ? 'Your page is private' : 'Your page is live'}</span></div><h2>Keep doing work<br />worth supporting.</h2><p>Support goes directly to your UPI account. Review every submission before calling it verified.</p><a class="primary-button" href="${routeUrl(`@${creatorUsername}`)}" data-route="@${creatorUsername}">View my page ${icon('arrow-right')}</a></div></section><section class="progress-card"><div class="card-topline"><div><h2 class="card-title">Getting started</h2><p class="card-caption">${state.creator ? 'Your public profile is connected' : 'Finish your creator profile'}</p></div><strong class="progress-percent">${state.creator ? '100%' : '24%'}</strong></div><div class="progress-track" aria-label="Profile completion"><div class="progress-fill" style="width:${state.creator ? '100%' : '24%'}"></div></div><div class="progress-list"><div class="progress-row"><span class="progress-label"><span class="mini-status ${state.creator ? 'done' : 'next'}"></span>Creator profile</span><span>${state.creator ? 'Done' : 'Next'}</span></div><div class="progress-row"><span class="progress-label"><span class="mini-status ${state.creator?.youtube?.channelUrl ? 'done' : 'next'}"></span>YouTube channel</span><span>${state.creator?.youtube?.channelUrl ? 'Done' : 'Add'}</span></div><div class="progress-row"><span class="progress-label"><span class="mini-status ${state.creator?.payment?.upiId ? 'done' : 'next'}"></span>UPI account</span><span>${state.creator?.payment?.upiId ? 'Done' : 'Add'}</span></div></div></section></div>
    <div class="stats-grid"><article class="stat-card"><div class="stat-header"><span class="stat-label">Verified support</span><span class="stat-icon green">${icon('wallet')}</span></div><strong class="stat-value">${formatCompactINR(verifiedAmount)}</strong><span class="stat-note">${verified.length ? `${verified.length} verified record${verified.length === 1 ? '' : 's'}` : 'No verified support yet'}</span></article><article class="stat-card"><div class="stat-header"><span class="stat-label">Verified payments</span><span class="stat-icon">${icon('check-circle')}</span></div><strong class="stat-value">${Number(analytics.verifiedPayments ?? verified.length)}</strong><span class="stat-note">Server-confirmed only</span></article><article class="stat-card"><div class="stat-header"><span class="stat-label">Pending submissions</span><span class="stat-icon amber">${icon('clock')}</span></div><strong class="stat-value">${pendingCount}</strong><span class="stat-note">Awaiting review</span></article><article class="stat-card"><div class="stat-header"><span class="stat-label">Profile views</span><span class="stat-icon blue">${icon('eye')}</span></div><strong class="stat-value">${profileViews.toLocaleString('en-IN')}</strong><span class="stat-note">Tracked by trusted analytics</span></article></div>
    <div class="dashboard-columns"><section class="panel"><div class="panel-heading"><div><h2>Recent payment submissions</h2><p>Review status before sharing a supporter update.</p></div><a class="panel-link" href="payments/" data-route="payments/">View all ${icon('arrow-right')}</a></div>${state.paymentsStatus === 'loading' ? renderMiniLoadingRows() : state.paymentsStatus === 'error' ? renderErrorState('Payments could not load', state.paymentsError, `<button class="secondary-button" data-action="retry-payments">${icon('refresh')}Try again</button>`) : payments.length ? `<div class="payment-list"><div class="payment-row payment-row-head"><div>Supporter</div><div>Amount</div><div>Submitted</div><div>Status</div><div></div></div>${payments.slice(0, 4).map(renderMiniPaymentRow).join('')}</div>` : renderEmptyState('No payment submissions yet', 'Share your public page to start receiving support.', `<a class="primary-button button-small" href="${routeUrl(`@${creatorUsername}`)}" data-route="@${creatorUsername}">${icon('share')}View share link</a>`)}<div class="trust-note">${icon('shield')}<span>A UTR is a review signal, not automatic proof of payment. Only mark a submission verified after your permitted verification process.</span></div></section><section class="panel"><div class="panel-heading"><div><h2>Quick actions</h2><p>Shortcuts for your daily workflow.</p></div></div><div class="quick-actions"><a class="quick-action" href="${routeUrl(`@${creatorUsername}`)}" data-route="@${creatorUsername}"><span class="quick-action-icon">${icon('external')}</span><span class="quick-action-copy"><strong>View your page</strong><span>See the supporter experience</span></span>${icon('arrow-right')}</a><button class="quick-action" data-action="share-page"><span class="quick-action-icon green">${icon('share')}</span><span class="quick-action-copy"><strong>Share your page</strong><span>Copy your short support link</span></span>${icon('arrow-right')}</button><a class="quick-action" href="settings/" data-route="settings/"><span class="quick-action-icon amber">${icon('settings')}</span><span class="quick-action-copy"><strong>Edit profile</strong><span>Update your creator details</span></span>${icon('arrow-right')}</a><a class="quick-action" href="payments/" data-route="payments/"><span class="quick-action-icon">${icon('wallet')}</span><span class="quick-action-copy"><strong>Review payments</strong><span>${pendingCount} submission${pendingCount === 1 ? '' : 's'} need attention</span></span>${icon('arrow-right')}</a></div></section></div>`;
}

function renderMiniLoadingRows() {
  return `<div class="payment-list mini-loading-list"><div class="payment-row payment-row-head"><div>Supporter</div><div>Amount</div><div>Submitted</div><div>Status</div><div></div></div>${[1, 2, 3].map(() => `<div class="payment-row"><span class="skeleton mini-skeleton-person"></span><span class="skeleton mini-skeleton-line"></span><span class="skeleton mini-skeleton-line"></span><span class="skeleton mini-skeleton-status"></span><span></span></div>`).join('')}</div>`;
}

function renderMiniPaymentRow(payment) {
  return `<div class="payment-row"><div class="payment-person">${avatarMarkup({ displayName: payment.supporter, uid: payment.id }, 'avatar-sm')}<div class="payment-person-info"><strong>${escapeHtml(payment.supporterName || payment.supporter || 'Anonymous supporter')}</strong><span>${escapeHtml(payment.message || 'No message')}</span></div></div><div class="payment-amount">${formatINR(payment.amount)}</div><div class="payment-date">${formatDate(payment.createdAt, 'Recently')}</div>${statusBadge(String(payment.status || '').toUpperCase())}<button class="payment-more" aria-label="Open payment details" data-action="open-payment" data-payment-id="${escapeHtml(payment.id)}">${icon('more')}</button></div>`;
}

function renderPaymentsPage() {
  if (state.paymentsStatus === 'loading') return renderLoading('Loading payment history…');
  if (state.paymentsStatus === 'error') return `${renderPageHeader({ title: 'Payments', subtitle: 'Review submitted transaction details.', kicker: 'Payment review' })}${renderErrorState('Payment history could not load', state.paymentsError, `<button class="secondary-button" data-action="retry-payments">${icon('refresh')}Try again</button>`)}`;
  const payments = filterPayments(state.payments);
  const filters = [['all', 'All'], ['PENDING', 'Pending'], ['VERIFIED', 'Verified'], ['REJECTED', 'Rejected'], ['FLAGGED', 'Flagged']];
  return `${renderPageHeader({ title: 'Payments', subtitle: 'Review submitted transaction details and keep your records clear.', kicker: 'Payment review', actions: `<button class="secondary-button" data-action="export-payments">${icon('download')}Export CSV</button>` })}<section class="panel table-card"><div class="table-toolbar"><div class="filter-tabs" role="tablist" aria-label="Payment status filters">${filters.map(([value, label]) => `<button class="filter-tab ${state.paymentFilters.status === value ? 'is-active' : ''}" data-action="filter-payments" data-filter="${value}" role="tab" aria-selected="${state.paymentFilters.status === value}">${label}${value === 'PENDING' ? ` <span>(${state.payments.filter((payment) => String(payment.status).toUpperCase() === 'PENDING').length})</span>` : ''}</button>`).join('')}</div><select class="sort-select" aria-label="Sort payments" data-action="sort-payments"><option value="newest" ${state.paymentFilters.sort === 'newest' ? 'selected' : ''}>Newest first</option><option value="oldest" ${state.paymentFilters.sort === 'oldest' ? 'selected' : ''}>Oldest first</option><option value="highest" ${state.paymentFilters.sort === 'highest' ? 'selected' : ''}>Highest amount</option><option value="lowest" ${state.paymentFilters.sort === 'lowest' ? 'selected' : ''}>Lowest amount</option></select></div><div class="payment-filter-row"><label class="filter-search">${icon('search')}<input type="search" placeholder="Search supporter, payment ID, or UTR" value="${escapeHtml(state.paymentFilters.search)}" data-action="payment-search" /></label><label class="filter-number"><span>Min ₹</span><input type="number" min="0" value="${escapeHtml(state.paymentFilters.min)}" data-action="payment-min" /></label><label class="filter-number"><span>Max ₹</span><input type="number" min="0" value="${escapeHtml(state.paymentFilters.max)}" data-action="payment-max" /></label><button class="ghost-button button-small" data-action="clear-payment-filters">${icon('refresh')}Clear</button></div>${payments.length ? `<div class="payments-table-wrap"><table class="payments-table"><thead><tr><th>Supporter</th><th>Amount</th><th>UTR / transaction ID</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead><tbody>${payments.map(renderTablePaymentRow).join('')}</tbody></table></div><div class="table-footer"><span>Showing ${payments.length} of ${state.payments.length} submissions</span><div class="pagination"><button class="is-active" aria-label="Page 1" data-action="pagination-info">1</button></div></div>` : renderEmptyState('No matching submissions', 'Try changing your filters or share your public page to receive support.')}</section>`;
}

function filterPayments(items) {
  const { status, search, min, max, sort } = state.paymentFilters;
  let result = [...items];
  if (status !== 'all') result = result.filter((payment) => String(payment.status).toUpperCase() === status);
  const term = search.trim().toLowerCase();
  if (term) result = result.filter((payment) => [payment.id, payment.supporterName, payment.message, payment.utr].some((value) => String(value || '').toLowerCase().includes(term)));
  if (min) result = result.filter((payment) => Number(payment.amount) >= Number(min));
  if (max) result = result.filter((payment) => Number(payment.amount) <= Number(max));
  if (sort === 'oldest') result.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
  if (sort === 'highest') result.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
  if (sort === 'lowest') result.sort((a, b) => Number(a.amount || 0) - Number(b.amount || 0));
  return result;
}

function renderTablePaymentRow(payment) {
  const status = String(payment.status || '').toUpperCase();
  return `<tr><td><div class="table-person">${avatarMarkup({ displayName: payment.supporterName || 'Anonymous supporter', uid: payment.id }, 'avatar-sm')}<div><strong>${escapeHtml(payment.supporterName || 'Anonymous supporter')}</strong><span>${escapeHtml(payment.id)}</span></div></div></td><td class="table-amount">${formatINR(payment.amount)}</td><td><span class="masked-utr">${escapeHtml(maskUtr(payment.utr))}</span></td><td>${escapeHtml(formatDate(payment.createdAt, 'Recently'))}</td><td>${statusBadge(status)}</td><td><button class="table-action" data-action="open-payment" data-payment-id="${escapeHtml(payment.id)}">Review</button></td></tr>`;
}

function maskUtr(utr) {
  const value = String(utr || '');
  return value.length > 4 ? `•••• ${value.slice(-4)}` : '••••';
}

function renderAnalyticsPage() {
  if (state.analyticsStatus === 'loading') return renderLoading('Loading your analytics…');
  if (state.analyticsStatus === 'error') return `${renderPageHeader({ title: 'Analytics', subtitle: 'Understand your audience and support flow.', kicker: 'Your audience at a glance' })}${renderErrorState('Analytics could not load', state.analyticsError, `<button class="secondary-button" data-action="retry-analytics">${icon('refresh')}Try again</button>`)}`;
  const a = state.analytics || {};
  const views = Number(a.profileViews || a.supportPageViews || 0);
  const attempts = Number(a.supportAttempts || 0);
  const submitted = Number(a.submittedPayments || state.payments.length || 0);
  const verified = Number(a.verifiedPayments || state.payments.filter((payment) => String(payment.status).toUpperCase() === 'VERIFIED').length || 0);
  const pending = Number(a.pendingPaymentCount || state.payments.filter((payment) => String(payment.status).toUpperCase() === 'PENDING').length || 0);
  const rejected = Number(a.rejectedPayments || state.payments.filter((payment) => String(payment.status).toUpperCase() === 'REJECTED').length || 0);
  const verifiedAmount = Number(a.verifiedAmount || 0);
  const totalSubmittedAmount = Number(a.totalSubmittedAmount || state.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
  return `${renderPageHeader({ title: 'Analytics', subtitle: 'Understand the difference between interest, submissions, and verified support.', kicker: 'Your audience at a glance', actions: `<button class="secondary-button" data-action="refresh-analytics">${icon('refresh')}Refresh</button>` })}<div class="stats-grid"><article class="stat-card"><div class="stat-header"><span class="stat-label">Profile views</span><span class="stat-icon blue">${icon('eye')}</span></div><strong class="stat-value">${views.toLocaleString('en-IN')}</strong><span class="stat-note">Trusted analytics</span></article><article class="stat-card"><div class="stat-header"><span class="stat-label">Support attempts</span><span class="stat-icon amber">${icon('arrow-up')}</span></div><strong class="stat-value">${attempts.toLocaleString('en-IN')}</strong><span class="stat-note">UPI flow starts</span></article><article class="stat-card"><div class="stat-header"><span class="stat-label">Submitted payments</span><span class="stat-icon">${icon('file')}</span></div><strong class="stat-value">${submitted}</strong><span class="stat-note">Includes pending review</span></article><article class="stat-card"><div class="stat-header"><span class="stat-label">Verified amount</span><span class="stat-icon green">${icon('wallet')}</span></div><strong class="stat-value">${formatCompactINR(verifiedAmount)}</strong><span class="stat-note">Server-confirmed only</span></article></div><div class="analytics-grid" style="margin-top:20px"><section class="panel chart-card"><div class="panel-heading"><div><h2>Payment status overview</h2><p>Current server-confirmed payment states.</p></div></div><div class="analytics-bars"><div class="analytics-bar-row"><span>Verified</span><strong>${verified}</strong><div><i class="bar-green" style="width:${barWidth(verified, submitted)}"></i></div></div><div class="analytics-bar-row"><span>Pending</span><strong>${pending}</strong><div><i class="bar-amber" style="width:${barWidth(pending, submitted)}"></i></div></div><div class="analytics-bar-row"><span>Rejected</span><strong>${rejected}</strong><div><i class="bar-red" style="width:${barWidth(rejected, submitted)}"></i></div></div></div><div class="chart-summary"><div><span>Verified amount</span><strong>${formatINR(verifiedAmount)}</strong></div><div><span>Total submitted amount</span><strong>${formatINR(totalSubmittedAmount)}</strong></div></div></section><div class="analytics-side"><section class="panel breakdown-card"><div class="panel-heading"><div><h2>Conversion funnel</h2><p>Keep this distinction clear.</p></div></div><div class="breakdown-item"><span class="breakdown-dot purple"></span><span>Support attempts</span><strong>${attempts}</strong><div class="breakdown-bar"><span class="purple" style="width:${barWidth(attempts, Math.max(attempts, 1))}"></span></div></div><div class="breakdown-item"><span class="breakdown-dot amber"></span><span>Submitted payments</span><strong>${submitted}</strong><div class="breakdown-bar"><span class="amber" style="width:${barWidth(submitted, Math.max(attempts, 1))}"></span></div></div><div class="breakdown-item"><span class="breakdown-dot green"></span><span>Verified payments</span><strong>${verified}</strong><div class="breakdown-bar"><span class="green" style="width:${barWidth(verified, Math.max(submitted, 1))}"></span></div></div></section><section class="panel insight-card"><div><div class="insight-icon">${icon('spark')}</div><h3>Build trust with clarity</h3><p>Support attempts, submitted payments, and verified payments are different signals. Keep them separate when you talk to your audience.</p></div><a class="panel-link" href="help/" data-route="help/">Read the guide ${icon('arrow-right')}</a></section></div></div>`;
}

function barWidth(value, total) {
  return `${Math.min(100, Math.max(value ? 8 : 0, (Number(value || 0) / Math.max(Number(total || 1), 1)) * 100))}%`;
}

function renderSettingsPage() {
  if (state.creator === null && state.user && state.analyticsStatus === 'idle') {
    // A new authenticated account can still open settings while its creator page is being set up.
  }
  const creator = state.creator || {};
  const youtube = creator.youtube || {};
  const payment = creator.payment || {};
  const amounts = Array.isArray(creator.supportAmounts) && creator.supportAmounts.length ? creator.supportAmounts : [20, 50, 100, 200];
  return `${renderPageHeader({ title: 'Settings', subtitle: 'Keep your public profile and support preferences up to date.', kicker: 'Creator profile' })}<div class="settings-layout"><nav class="settings-tabs" aria-label="Settings sections"><a class="settings-tab is-active" href="#profile">${icon('users')}Profile</a><a class="settings-tab" href="#support-amounts">${icon('wallet')}Support amounts</a><a class="settings-tab" href="#privacy-safety">${icon('shield')}Privacy & safety</a></nav><div class="settings-content"><section class="panel settings-card" id="profile"><div class="settings-card-heading"><div><h2>Public profile</h2><p>This information appears on your public support page.</p></div>${creator.isPublic === false ? '<span class="status-badge pending">Private</span>' : '<span class="profile-badge">'+icon('check-circle')+' Live</span>'}</div><div class="profile-edit-row"><div class="avatar avatar-lg avatar-purple" data-avatar-preview>${safeImageSource(state.avatarDraft || creator.avatar) ? `<img src="${escapeHtml(state.avatarDraft || creator.avatar)}" alt="Profile preview" />` : escapeHtml(initials(creator.displayName || state.user?.displayName || 'Creator'))}</div><div class="profile-edit-copy"><strong>Profile photo</strong><span>JPG, PNG, or WebP. Compressed to 512px.</span></div><label class="secondary-button button-small file-button">${icon('camera')}Change photo<input type="file" accept="image/jpeg,image/png,image/webp" data-action="avatar-file" /></label></div><form id="profile-form"><div class="form-grid"><label class="form-field"><span class="form-label">Display name <span class="required">*</span></span><input class="form-control" name="displayName" required maxlength="80" value="${escapeHtml(creator.displayName || state.user?.displayName || '')}" /></label><label class="form-field"><span class="form-label">Username <span class="required">*</span></span><input class="form-control" name="username" required pattern="[a-z0-9_-]{3,24}" value="${escapeHtml(creator.username || '')}" /><p class="form-helper">Your page: ${escapeHtml(routeUrl(`@${creator.username || 'username'}`))}</p></label><label class="form-field full"><span class="form-label">Short bio <span class="optional">Optional</span></span><textarea class="form-control" name="bio" maxlength="160">${escapeHtml(creator.bio || '')}</textarea></label><label class="form-field"><span class="form-label">YouTube channel name</span><input class="form-control" name="youtubeChannelName" maxlength="80" value="${escapeHtml(youtube.channelName || '')}" /></label><label class="form-field"><span class="form-label">YouTube channel URL</span><input class="form-control" name="youtubeChannelUrl" type="url" value="${escapeHtml(youtube.channelUrl || '')}" /></label><label class="form-field"><span class="form-label">YouTube channel ID <span class="optional">Optional</span></span><input class="form-control" name="youtubeChannelId" maxlength="80" value="${escapeHtml(youtube.channelId || '')}" /></label><label class="form-field"><span class="form-label">Creator UPI ID <span class="required">*</span></span><input class="form-control" name="upiId" required value="${escapeHtml(payment.upiId || '')}" /><p class="form-helper">Payments go directly to this UPI ID. Never enter bank details here.</p></label><label class="form-field full"><span class="form-label">Thank-you message <span class="optional">Optional</span></span><textarea class="form-control" name="thankYouMessage" maxlength="120">${escapeHtml(creator.thankYouMessage || '')}</textarea></label></div><div class="settings-footer"><button type="button" class="ghost-button" data-action="discard-settings">Discard</button><button class="primary-button" type="submit">Save changes</button></div></form></section><section class="panel settings-card" id="support-amounts"><div class="settings-card-heading"><div><h2>Support preferences</h2><p>Choose suggested INR amounts for your page.</p></div></div><div class="amount-settings">${[0, 1, 2, 3].map((index) => `<label class="amount-setting"><span>₹</span><input name="supportAmount${index}" data-support-amount value="${escapeHtml(amounts[index] || '')}" type="number" min="20" max="5000" aria-label="Suggested support amount ${index + 1}" /></label>`).join('')}</div><div class="setting-note">${icon('shield')}<span>Supporters can choose a custom amount within the safe range. A UPI handoff never creates a platform wallet or payout balance.</span></div></section><section class="panel settings-card" id="privacy-safety"><div class="settings-card-heading"><div><h2>Page visibility and privacy</h2><p>Choose what supporters can see on your public page.</p></div></div><div class="toggle-row"><div class="toggle-copy"><strong>Publish your creator page</strong><span>When off, your page cannot be opened by supporters.</span></div><label class="toggle"><input type="checkbox" name="isPublic" data-public-toggle ${creator.isPublic !== false ? 'checked' : ''} /><span class="toggle-track"></span></label></div><div class="toggle-row"><div class="toggle-copy"><strong>Show verified support messages</strong><span>Only approved messages are shown; UTRs are never public.</span></div><label class="toggle"><input type="checkbox" name="showRecentSupport" data-show-support-toggle ${creator.showRecentSupport !== false ? 'checked' : ''} /><span class="toggle-track"></span></label></div></section></div></div>`;
}

function renderNotificationsPage() {
  const notifications = state.notifications;
  return `${renderPageHeader({ title: 'Notifications', subtitle: 'Payment and account updates stay in one place.', kicker: 'Stay in the loop', actions: notifications.some((item) => !item.read) ? `<button class="secondary-button" data-action="mark-all-read">${icon('check')}Mark all as read</button>` : '' })}<section class="panel notification-panel">${state.notificationsError ? renderErrorState('Notifications could not load', state.notificationsError) : notifications.length ? `<div class="notification-list">${notifications.map(renderNotification).join('')}</div>` : renderEmptyState('You are all caught up', 'New support submissions, review updates, and account events will appear here.')}</section>`;
}

function renderNotification(notification) {
  const type = String(notification.type || 'system');
  const iconName = type.includes('payment') ? 'wallet' : type.includes('account') ? 'users' : 'bell';
  return `<article class="notification-row ${notification.read ? '' : 'unread'}"><span class="notification-icon">${icon(iconName)}</span><div class="notification-copy"><strong>${escapeHtml(notification.title || 'Supportly update')}</strong><p>${escapeHtml(notification.message || '')}</p><span>${escapeHtml(formatDate(notification.createdAt, 'Recently'))}</span></div>${notification.read ? '<span class="notification-read-label">Read</span>' : `<button class="table-action" data-action="mark-notification-read" data-notification-id="${escapeHtml(notification.id)}">Mark read</button>`}</article>`;
}

function renderCreatorPage(supportMode) {
  if (state.publicCreatorStatus === 'loading' || state.publicCreatorStatus === 'idle') return renderLoading('Loading creator page…');
  if (state.publicCreatorStatus === 'error') return renderErrorState('Creator page could not load', state.publicCreatorError, `<button class="secondary-button" data-action="retry-public-creator">${icon('refresh')}Try again</button>`);
  if (state.publicCreatorStatus === 'not-found' || !state.publicCreator) return renderNotFoundPage('Creator page not found', 'This username is not published or does not exist.');
  const creator = state.publicCreator;
  if (creator.isPublic === false && creator.uid !== state.user?.uid) return renderNotFoundPage('This page is private', 'The creator has not published this support page.');
  if (supportMode) return renderSupportFlowPage(creator);
  const supportAmounts = Array.isArray(creator.supportAmounts) && creator.supportAmounts.length ? creator.supportAmounts : [20, 50, 100, 200];
  const youtubeUrl = safeExternalUrl(creator.youtube?.channelUrl || '');
  const publicUrl = routeUrl(`@${creator.username}`);
  return `<div class="public-page-wrap"><div class="public-page-toolbar"><div class="public-url">${icon('external')}<span>Creator page</span><strong>${escapeHtml(publicUrl)}</strong></div><div class="header-actions">${state.user?.uid === creator.uid ? `<a class="secondary-button" href="dashboard/" data-route="dashboard/">${icon('arrow-left')}Dashboard</a>` : ''}<button class="primary-button" data-action="share-creator-page">${icon('share')}Share page</button></div></div><div class="public-preview-grid"><section class="public-profile-card"><div class="public-profile-inner"><div class="profile-badge">${icon('check-circle')} Creator page</div>${avatarMarkup({ displayName: creator.displayName, avatar: creator.avatar, uid: creator.uid }, 'avatar-lg')}<h1>${escapeHtml(creator.displayName || creator.username)}</h1><p class="profile-role">YouTube creator · @${escapeHtml(creator.username)}</p><p class="profile-bio">${escapeHtml(creator.bio || 'Sharing work, ideas, and useful things with the internet.')}</p>${youtubeUrl ? `<a class="youtube-button" href="${escapeHtml(youtubeUrl)}" target="_blank" rel="noopener noreferrer">${icon('youtube')}Visit YouTube channel ${icon('external', 'icon-xs')}</a>` : ''}<div class="profile-divider"></div><div class="support-heading"><h2>Support my work</h2><p>Choose an amount to continue securely with UPI.</p></div><div class="amount-grid" role="group" aria-label="Support amount">${supportAmounts.slice(0, 6).map((amount) => `<button class="amount-button" data-action="start-public-support" data-amount="${escapeHtml(amount)}">${formatINR(amount)}</button>`).join('')}</div><a class="primary-button support-button" href="${routeUrl(`@${creator.username}/support`)}" data-route="@${creator.username}/support">Support with UPI ${icon('arrow-right')}</a><div class="upi-disclaimer">${icon('lock')}<span>No bank details required. The creator receives the payment directly.</span></div><div class="recent-support"><h3>Verified support</h3><div class="support-privacy-message">${icon('shield')}<span>Support messages are shown only after review. UTRs and private transaction details are never public.</span></div></div><div class="public-powered">Powered by ${SUPPORTLY_NAME} · Payments are made directly to the creator's UPI ID.</div></div></section><div class="public-side-column"><section class="page-info-card"><h2>Support ${escapeHtml(creator.displayName)}</h2><p>Choose an amount, pay directly through a UPI app, then share your UTR for review.</p><div class="info-list"><div class="info-list-row"><span>Support currency</span><strong>INR only</strong></div><div class="info-list-row"><span>Payment method</span><strong>Direct UPI</strong></div><div class="info-list-row"><span>Verification</span><strong>Creator review</strong></div></div></section><section class="security-card"><div class="security-header"><span class="security-icon">${icon('shield')}</span><h2>Trust, by design</h2></div><p>A submitted UTR stays pending until the creator or an authorized reviewer checks it.</p><div class="security-points"><div class="security-point">${icon('check-circle')}No bank details collected</div><div class="security-point">${icon('check-circle')}UTRs stay private</div><div class="security-point">${icon('check-circle')}Pending until reviewed</div></div><button class="ghost-button button-wide" data-action="report-creator" data-target-id="${escapeHtml(creator.uid)}" data-target-type="creator">${icon('flag')}Report this page</button></section></div></div></div>`;
}

function renderSupportFlowPage(creator) {
  const support = state.support;
  const amount = Number(support.amount || 0);
  const upiId = creator.payment?.upiId || '';
  if (support.step === 1) {
    const amounts = Array.isArray(creator.supportAmounts) && creator.supportAmounts.length ? creator.supportAmounts : [20, 50, 100, 200];
    return `<div class="support-flow-wrap"><div class="support-flow-header"><a class="back-link" href="${routeUrl(`@${creator.username}`)}" data-route="@${creator.username}">${icon('arrow-left')}Back to creator page</a><span class="profile-badge">${icon('shield')} Direct UPI support</span></div><section class="panel support-flow-card"><div class="support-flow-creator">${avatarMarkup({ displayName: creator.displayName, avatar: creator.avatar, uid: creator.uid }, 'avatar-md')}<div><strong>${escapeHtml(creator.displayName)}</strong><span>@${escapeHtml(creator.username)}</span></div></div><div class="support-flow-heading"><span class="modal-eyebrow">Step 1 of 4</span><h1>Choose an amount</h1><p>Your support will go directly to the creator's UPI account.</p></div><div class="amount-grid">${amounts.slice(0, 6).map((item) => `<button class="amount-button ${!support.custom && Number(item) === amount ? 'is-selected' : ''}" data-action="select-support-amount" data-amount="${escapeHtml(item)}">${formatINR(item)}</button>`).join('')}</div><button class="custom-amount-button ${support.custom ? 'is-selected' : ''}" data-action="toggle-support-custom">${icon('plus')}Enter a custom amount</button><div class="custom-amount-input-wrap ${support.custom ? 'is-visible' : ''}"><span>₹</span><input id="support-custom-amount" type="number" min="20" max="5000" value="${support.custom ? escapeHtml(amount) : ''}" placeholder="20 – 5,000" aria-label="Custom amount" /></div><button class="primary-button button-wide" data-action="continue-support-details">Continue with ${formatINR(amount)} ${icon('arrow-right')}</button><div class="payment-safety">${icon('shield')}<span>No wallet, payout, card, or bank details. UPI payment is direct to the creator.</span></div></section></div>`;
  }
  if (support.step === 2) return `<div class="support-flow-wrap"><div class="support-flow-header"><button class="back-link" data-action="support-back">${icon('arrow-left')}Back</button><span class="profile-badge">${icon('shield')} Direct UPI support</span></div><section class="panel support-flow-card"><div class="support-flow-creator">${avatarMarkup({ displayName: creator.displayName, avatar: creator.avatar, uid: creator.uid }, 'avatar-md')}<div><strong>${escapeHtml(creator.displayName)}</strong><span>Supporting with ${formatINR(amount)}</span></div></div><div class="support-flow-heading"><span class="modal-eyebrow">Step 2 of 4</span><h1>Add a note</h1><p>Both fields are optional. Your UTR is requested after the UPI payment.</p></div><form id="supporter-details-form" class="modal-form"><label class="form-field"><span class="form-label">Your name <span class="optional">Optional</span></span><input class="form-control" name="supporterName" maxlength="60" value="${escapeHtml(support.supporterName)}" placeholder="How should the creator thank you?" /></label><label class="form-field"><span class="form-label">Message <span class="optional">Optional</span></span><textarea class="form-control" name="message" maxlength="180" placeholder="Leave a short note">${escapeHtml(support.message)}</textarea></label><button class="primary-button button-wide" type="submit">Continue to payment ${icon('arrow-right')}</button></form><div class="payment-safety">${icon('lock')}<span>Your name and message are shared with the creator for review. Payment status remains pending until verification.</span></div></section></div>`;
  if (support.step === 3) {
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(creator.displayName)}&am=${encodeURIComponent(amount.toFixed(2))}&cu=INR`;
    return `<div class="support-flow-wrap"><div class="support-flow-header"><button class="back-link" data-action="support-back">${icon('arrow-left')}Back</button><span class="profile-badge">${icon('lock')} Secure handoff</span></div><section class="panel support-flow-card"><div class="support-flow-heading"><span class="modal-eyebrow">Step 3 of 4</span><h1>Pay with UPI</h1><p>Open your preferred UPI app and send exactly ${formatINR(amount)} to ${escapeHtml(creator.displayName)}.</p></div><div class="modal-amount-summary"><span>Support amount</span><strong>${formatINR(amount)}</strong></div><div class="upi-recipient"><span class="upi-symbol">U</span><div><strong>${escapeHtml(creator.displayName)}</strong><span>Receiving directly in the creator's UPI account</span></div></div><div class="upi-id-row"><span>UPI ID</span><strong>${escapeHtml(upiId || 'Not configured')}</strong><button class="copy-button" aria-label="Copy UPI ID" data-action="copy-upi" data-upi-id="${escapeHtml(upiId)}">${icon('copy')}</button></div>${upiId ? `<div class="qr-panel"><canvas id="upi-qr" width="220" height="220" aria-label="UPI QR code"></canvas><p>Scan with a UPI app if the button cannot open one.</p></div>` : renderErrorState('Creator payment details are not ready', 'The creator has not configured a UPI ID yet. Please try again later.') }<div class="modal-action-row"><button class="secondary-button" data-action="show-support-qr">${icon('qr')}${support.showQr ? 'QR shown above' : 'Show QR'}</button><a class="primary-button" href="${escapeHtml(upiUri)}" data-action="open-upi">${icon('external')}Open UPI app</a></div><button class="ghost-button button-wide" data-action="support-paid">I have completed the payment ${icon('arrow-right')}</button><div class="payment-safety">${icon('info')}<span>Returning here does not verify the payment. You will be asked for the UTR so the creator can review it.</span></div></section></div>`;
  }
  if (support.step === 4) return `<div class="support-flow-wrap"><div class="support-flow-header"><button class="back-link" data-action="support-back">${icon('arrow-left')}Back</button><span class="profile-badge">${icon('clock')} Review required</span></div><section class="panel support-flow-card"><div class="support-flow-heading"><span class="modal-eyebrow">Step 4 of 4</span><h1>Submit your transaction reference</h1><p>Enter the UTR from your UPI app. This starts a review; it does not automatically prove payment.</p></div><div class="modal-amount-summary"><span>Supporting ${escapeHtml(creator.displayName)}</span><strong>${formatINR(amount)}</strong></div><form id="utr-form" class="modal-form"><label class="form-field"><span class="form-label">UTR / transaction ID <span class="required">*</span></span><input class="form-control" name="utr" required minlength="6" maxlength="40" autocomplete="off" value="${escapeHtml(support.utr)}" placeholder="Enter the reference from your UPI app" /><p class="form-helper">The UTR is kept private and checked for duplicate submissions.</p></label><button class="primary-button button-wide" type="submit">Submit for review ${icon('arrow-right')}</button></form><div class="payment-safety">${icon('shield')}<span>Status will be <strong>Pending</strong> until the creator or authorized reviewer verifies the transaction.</span></div></section></div>`;
  return renderPaymentSubmittedPage(state.lastPayment || {});
}

function renderPaymentSubmittedPage(payment) {
  return `<div class="support-flow-wrap"><section class="panel success-panel support-success-card"><div class="success-icon">${icon('check-circle')}</div><h1>Payment submitted</h1><p>Your transaction details were sent for review. The status is not verified yet.</p><div class="support-id-card"><span>Support ID</span><strong>${escapeHtml(payment.id || 'Pending')}</strong></div><div class="pending-message">${icon('clock')}<span><strong>Pending verification.</strong> A submitted UTR does not itself prove that money was received.</span></div><a class="primary-button button-wide" href="${routeUrl('payment/pending/')}" data-route="payment/pending/">View payment status ${icon('arrow-right')}</a><a class="ghost-button button-wide" href="${routeUrl(`@${state.publicCreator?.username || ''}`)}" data-route="@${state.publicCreator ? `@${state.publicCreator.username}` : ''}">Return to creator page</a></div></section></div>`;
}

function renderPaymentStatusPage(kind) {
  const query = parseQuery();
  const payment = state.lastPayment || readLastPayment() || {};
  const status = kind === 'failed' ? 'FAILED' : String(payment.status || 'PENDING').toUpperCase();
  const title = kind === 'failed' ? 'Payment could not be completed' : status === 'VERIFIED' || kind === 'success' ? 'Payment status update' : 'Payment submitted';
  const message = kind === 'failed' ? 'No payment was recorded by Supportly. You can return to the creator page and try again.' : status === 'VERIFIED' ? 'Your support has been verified by the creator or an authorized reviewer.' : status === 'REJECTED' ? 'The creator could not verify this submission. Contact them if you believe this is an error.' : 'Your submission is pending review. A UTR entry is not automatic proof of payment.';
  const badge = kind === 'failed' ? statusBadge('REJECTED') : statusBadge(status === 'VERIFIED' ? 'VERIFIED' : status === 'REJECTED' ? 'REJECTED' : 'PENDING');
  return `<div class="support-flow-wrap"><section class="panel payment-status-card"><div class="status-hero-icon ${status === 'VERIFIED' ? 'is-success' : status === 'REJECTED' || kind === 'failed' ? 'is-error' : 'is-pending'}">${icon(status === 'VERIFIED' ? 'check-circle' : status === 'REJECTED' || kind === 'failed' ? 'close' : 'clock')}</div><div class="modal-eyebrow">Payment status</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><div class="payment-status-summary">${payment.id ? `<div><span>Support ID</span><strong>${escapeHtml(payment.id)}</strong></div>` : ''}${payment.amount ? `<div><span>Amount</span><strong>${formatINR(payment.amount)}</strong></div>` : ''}<div><span>Status</span>${badge}</div></div><div class="payment-safety">${icon('shield')}<span>Supportly never marks a payment verified only because a UTR was submitted. Status changes come from authorized review.</span></div><div class="modal-action-row"><a class="primary-button" href="dashboard/" data-route="dashboard/">Go to dashboard</a>${payment.creatorUsername ? `<a class="secondary-button" href="${routeUrl(`@${payment.creatorUsername}`)}" data-route="@${payment.creatorUsername}">Creator page</a>` : `<a class="secondary-button" href="/" data-route="">Supportly home</a>`}</div></section></div>`;
}

function readLastPayment() {
  try { return JSON.parse(sessionStorage.getItem('supportly:lastPayment') || 'null'); } catch { return null; }
}

function renderAdminRoute(route) {
  if (state.adminStatus === 'loading' || state.adminStatus === 'idle') return renderLoading('Checking admin authorization…');
  if (state.adminStatus === 'unauthorized') return renderErrorState('Admin access required', 'This account is not authorized to view the admin workspace.', `<a class="secondary-button" href="dashboard/" data-route="dashboard/">${icon('arrow-left')}Back to dashboard</a>`);
  if (state.adminStatus === 'error') return renderErrorState('Admin workspace unavailable', state.adminError);
  if (state.adminData?.status === 'loading') return renderLoading('Loading admin workspace…');
  if (state.adminData?.status === 'error') return renderErrorState('Admin data could not load', state.adminData.error, `<button class="secondary-button" data-action="retry-admin">${icon('refresh')}Try again</button>`);
  const section = route.section || 'dashboard';
  const data = state.adminData || { payments: {}, users: {}, creators: {}, reports: {}, logs: {} };
  const paymentList = Object.entries(data.payments || {}).map(([id, item]) => ({ id, ...item })).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  const sectionLinks = [['dashboard', 'Overview', 'server'], ['users', 'Users', 'users'], ['creators', 'Creators', 'spark'], ['payments', 'Payments', 'wallet'], ['reports', 'Reports', 'report'], ['logs', 'Audit logs', 'file'], ['settings', 'Settings', 'settings']];
  let content = '';
  if (section === 'users') content = renderAdminUsers(data.users);
  else if (section === 'creators') content = renderAdminCreators(data.creators);
  else if (section === 'payments') content = renderAdminPayments(paymentList);
  else if (section === 'reports') content = renderAdminReports(data.reports);
  else if (section === 'logs') content = renderAdminLogs(data.logs);
  else if (section === 'settings') content = renderAdminSettings();
  else content = renderAdminOverview(data, paymentList);
  return `<div class="admin-layout"><aside class="admin-subnav"><div class="admin-subnav-title">${icon('shield')}Admin console</div>${sectionLinks.map(([key, label, iconName]) => `<a class="admin-subnav-link ${section === key ? 'is-active' : ''}" href="${routeUrl(key === 'dashboard' ? 'admin/' : `admin/${key}/`)}" data-route="${key === 'dashboard' ? 'admin/' : `admin/${key}/`}">${icon(iconName)}<span>${label}</span></a>`).join('')}<div class="admin-subnav-note">${icon('lock')}<span>Admin authorization is checked against Firebase, not local UI state.</span></div></aside><div class="admin-main">${content}</div></div>`;
}

function renderAdminOverview(data, payments) {
  const verified = payments.filter((item) => String(item.status).toLowerCase() === 'verified');
  const pending = payments.filter((item) => String(item.status).toLowerCase() === 'pending');
  const rejected = payments.filter((item) => String(item.status).toLowerCase() === 'rejected');
  const amount = verified.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return `${renderPageHeader({ title: 'Admin overview', subtitle: 'Review platform activity and sensitive operations.', kicker: 'Operations' })}<div class="stats-grid"><article class="stat-card"><div class="stat-header"><span class="stat-label">Total users</span><span class="stat-icon blue">${icon('users')}</span></div><strong class="stat-value">${Object.keys(data.users || {}).length}</strong></article><article class="stat-card"><div class="stat-header"><span class="stat-label">Creators</span><span class="stat-icon">${icon('spark')}</span></div><strong class="stat-value">${Object.keys(data.creators || {}).length}</strong></article><article class="stat-card"><div class="stat-header"><span class="stat-label">Pending payments</span><span class="stat-icon amber">${icon('clock')}</span></div><strong class="stat-value">${pending.length}</strong></article><article class="stat-card"><div class="stat-header"><span class="stat-label">Verified amount</span><span class="stat-icon green">${icon('wallet')}</span></div><strong class="stat-value">${formatCompactINR(amount)}</strong></article></div><div class="dashboard-columns"><section class="panel"><div class="panel-heading"><div><h2>Payment queue</h2><p>Review only after checking the submitted information.</p></div><a class="panel-link" href="${routeUrl('admin/payments/')}" data-route="admin/payments/">Open queue ${icon('arrow-right')}</a></div>${payments.length ? `<div class="payment-list">${payments.slice(0, 5).map(renderMiniPaymentRow).join('')}</div>` : renderEmptyState('No payment records', 'New submissions will appear here.')}</section><section class="panel"><div class="panel-heading"><div><h2>Audit posture</h2><p>Every sensitive status change is logged.</p></div></div><div class="security-points"><div class="security-point">${icon('check-circle')}Creator and admin ownership checks</div><div class="security-point">${icon('check-circle')}Verified fields written by trusted functions</div><div class="security-point">${icon('check-circle')}UTR stays private</div><div class="security-point">${icon('check-circle')}Rejected and flagged states retained</div></div></section></div>`;
}

function renderAdminUsers(users) {
  const list = Object.entries(users || {}).map(([uid, user]) => ({ uid, ...user }));
  return `${renderPageHeader({ title: 'Users', subtitle: 'Authenticated Supportly accounts.', kicker: 'Admin console' })}<section class="panel table-card"><div class="payments-table-wrap"><table class="payments-table"><thead><tr><th>User</th><th>Role</th><th>Provider</th><th>Updated</th></tr></thead><tbody>${list.length ? list.map((user) => `<tr><td><div class="table-person">${avatarMarkup(user, 'avatar-sm')}<div><strong>${escapeHtml(user.displayName || 'Unnamed')}</strong><span>${escapeHtml(user.email || user.uid)}</span></div></div></td><td>${escapeHtml(user.role || 'creator')}</td><td>${escapeHtml(user.provider || '—')}</td><td>${escapeHtml(formatDate(user.updatedAt))}</td></tr>`).join('') : `<tr><td colspan="4">${renderEmptyState('No user records', 'User profiles will appear after sign-in.')}</td></tr>`}</tbody></table></div></section>`;
}

function renderAdminCreators(creators) {
  const list = Object.entries(creators || {}).map(([uid, creator]) => ({ uid, ...creator }));
  return `${renderPageHeader({ title: 'Creators', subtitle: 'Published creator profiles and their public settings.', kicker: 'Admin console' })}<section class="panel table-card"><div class="payments-table-wrap"><table class="payments-table"><thead><tr><th>Creator</th><th>Username</th><th>Visibility</th><th>UPI currency</th><th>Updated</th></tr></thead><tbody>${list.length ? list.map((creator) => `<tr><td><div class="table-person">${avatarMarkup(creator, 'avatar-sm')}<div><strong>${escapeHtml(creator.displayName || 'Unnamed')}</strong><span>${escapeHtml(creator.uid)}</span></div></div></td><td>@${escapeHtml(creator.username || '—')}</td><td>${creator.isPublic === false ? statusBadge('REJECTED') : statusBadge('VERIFIED')}</td><td>${escapeHtml(creator.payment?.currency || 'INR')}</td><td>${escapeHtml(formatDate(creator.updatedAt))}</td></tr>`).join('') : `<tr><td colspan="5">${renderEmptyState('No creator profiles', 'Creator profiles will appear after onboarding.')}</td></tr>`}</tbody></table></div></section>`;
}

function renderAdminPayments(payments) {
  return `${renderPageHeader({ title: 'Payment review', subtitle: 'Verify, reject, or flag submissions with an audit trail.', kicker: 'Admin console' })}<section class="panel table-card"><div class="payments-table-wrap"><table class="payments-table"><thead><tr><th>Payment</th><th>Creator</th><th>Amount</th><th>UTR</th><th>Status</th><th>Action</th></tr></thead><tbody>${payments.length ? payments.map((payment) => `<tr><td><strong>${escapeHtml(payment.id)}</strong><br /><span>${escapeHtml(payment.supporterName || 'Anonymous')}</span></td><td>${escapeHtml(payment.creatorId || '—')}</td><td class="table-amount">${formatINR(payment.amount)}</td><td><span class="masked-utr">${escapeHtml(maskUtr(payment.utr))}</span></td><td>${statusBadge(String(payment.status || '').toUpperCase())}</td><td><button class="table-action" data-action="open-payment" data-payment-id="${escapeHtml(payment.id)}">Review</button></td></tr>`).join('') : `<tr><td colspan="6">${renderEmptyState('No payment submissions', 'There are no records to review.')}</td></tr>`}</tbody></table></div></section>`;
}

function renderAdminReports(reports) {
  const list = Object.entries(reports || {}).map(([id, item]) => ({ id, ...item }));
  return `${renderPageHeader({ title: 'Reports', subtitle: 'Review reports about creators, profiles, or payments.', kicker: 'Admin console' })}<section class="panel table-card"><div class="payments-table-wrap"><table class="payments-table"><thead><tr><th>Report</th><th>Target</th><th>Reason</th><th>Status</th><th>Created</th></tr></thead><tbody>${list.length ? list.map((report) => `<tr><td>${escapeHtml(report.id)}</td><td>${escapeHtml(report.targetId || '—')}</td><td>${escapeHtml(report.reason || 'Other')}</td><td>${statusBadge(String(report.status || 'OPEN') === 'OPEN' ? 'PENDING' : 'VERIFIED')}</td><td>${escapeHtml(formatDate(report.createdAt))}</td></tr>`).join('') : `<tr><td colspan="5">${renderEmptyState('No reports', 'Reports from supporters will appear here.')}</td></tr>`}</tbody></table></div></section>`;
}

function renderAdminLogs(logs) {
  const list = Object.entries(logs || {}).map(([id, item]) => ({ id, ...item })).sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
  return `${renderPageHeader({ title: 'Audit logs', subtitle: 'Sensitive admin operations are retained for accountability.', kicker: 'Admin console' })}<section class="panel table-card"><div class="payments-table-wrap"><table class="payments-table"><thead><tr><th>Action</th><th>Target</th><th>Admin</th><th>Timestamp</th></tr></thead><tbody>${list.length ? list.map((log) => `<tr><td>${escapeHtml(log.action || '—')}</td><td>${escapeHtml(log.targetId || '—')}</td><td>${escapeHtml(log.adminId || '—')}</td><td>${escapeHtml(formatDate(log.timestamp))}</td></tr>`).join('') : `<tr><td colspan="4">${renderEmptyState('No audit logs', 'Sensitive operations will be listed here.')}</td></tr>`}</tbody></table></div></section>`;
}

function renderAdminSettings() {
  return `${renderPageHeader({ title: 'Admin settings', subtitle: 'Configuration that should be changed deliberately.', kicker: 'Admin console' })}<section class="panel settings-card"><div class="settings-card-heading"><div><h2>Production safeguards</h2><p>Keep trusted operations and Firebase Console configuration aligned.</p></div></div><div class="security-points"><div class="security-point">${icon('check-circle')}Realtime Database rules deny public reads and writes</div><div class="security-point">${icon('check-circle')}Cloud Functions own payment verification</div><div class="security-point">${icon('check-circle')}App Check is configured when a reCAPTCHA key is supplied</div><div class="security-point">${icon('check-circle')}No service-account credentials ship to the browser</div></div><div class="setting-note">${icon('info')}<span>Admin membership is read from /admins/{uid}. Grant access only through a trusted administrative process.</span></div></section>`;
}

function renderNotFoundPage(title = 'Page not found', message = 'The link you opened does not point to a Supportly page.') {
  return `<div class="auth-shell"><section class="auth-card empty-auth-card"><div class="empty-state-icon">${icon('search')}</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><div class="header-actions"><a class="primary-button" href="${routeUrl(state.user ? 'dashboard/' : 'login/') }" data-route="${state.user ? 'dashboard/' : 'login/'}">${icon('arrow-left')}${state.user ? 'Back to dashboard' : 'Go to sign in'}</a></div></section></div>`;
}

function renderHelpPage() {
  return `${renderPageHeader({ title: 'Help center', subtitle: 'A clear path from creator page to reviewed support.', kicker: 'Supportly guide' })}<div class="help-grid"><section class="panel guide-card"><div class="guide-number">01</div><h2>Create your page</h2><p>Add your display name, username, YouTube channel, UPI ID, support amounts, and thank-you message. Publish only when the payment destination is correct.</p><a href="settings/" data-route="settings/" class="panel-link">Open settings ${icon('arrow-right')}</a></section><section class="panel guide-card"><div class="guide-number">02</div><h2>Share one link</h2><p>Put your short support link in descriptions, pinned comments, and community posts. Visitors can view the page without an account.</p><button class="panel-link" data-action="share-page">Share your page ${icon('arrow-right')}</button></section><section class="panel guide-card"><div class="guide-number">03</div><h2>Review submissions</h2><p>Supporters pay directly in their UPI app, return with a UTR, and remain pending until you or an authorized reviewer checks it.</p><a href="payments/" data-route="payments/" class="panel-link">Open payments ${icon('arrow-right')}</a></section></div><section class="panel trust-note trust-note-large">${icon('shield')}<span>Never request bank account numbers, IFSC codes, card details, or net-banking credentials. Supportly is a direct UPI handoff and review workflow.</span></section>`;
}

function renderAboutPage() {
  return `${renderPageHeader({ title: 'About Supportly', subtitle: 'A simpler support layer for the people who make the internet useful.', kicker: 'Built for creators' })}<section class="panel prose-card"><h2>Support should feel direct.</h2><p>Supportly is designed for YouTubers, streamers, educators, developers, artists, and independent creators who want a simple way for their audience to say thank you with UPI.</p><div class="prose-columns"><div><h3>For creators</h3><p>Create a focused page, connect your UPI ID, share your link, and review submissions in one calm workspace.</p></div><div><h3>For supporters</h3><p>Choose an amount, continue in a UPI app, and share a transaction reference without creating a complicated wallet account.</p></div></div><div class="setting-note">${icon('info')}<span>Submitting a UTR does not itself guarantee verification. The creator or an authorized reviewer must review it.</span></div></section>`;
}

function renderLegalPage(title, subtitle, content) {
  return `${renderPageHeader({ title, subtitle, kicker: pageMeta[state.route.name]?.kicker || 'Supportly' })}<section class="panel prose-card">${content}</section>`;
}

function privacyContent() { return `<h2>Privacy at a glance</h2><p>Supportly should collect only the information required to provide creator pages, authentication, payment-submission review, abuse prevention, and support notifications.</p><h3>Payment information</h3><p>UPI payments are sent directly to the creator. Supportly does not request bank account details, card numbers, IFSC codes, or net-banking credentials. UTRs are private and must not appear on public creator pages.</p><h3>Data control</h3><p>Creators can update their profile information. Authentication and database access are protected by Firebase rules and trusted functions. Replace this starter policy with counsel-reviewed terms before production launch.</p>`; }
function termsContent() { return `<h2>Use Supportly honestly</h2><p>Creators are responsible for the accuracy of their public profile and UPI ID. Supporters are responsible for making sure they are paying the intended creator before opening a UPI app.</p><h3>Verification</h3><p>A submitted transaction reference remains pending until an authorized reviewer checks it. Supportly does not promise instant verification or fraud-proof payments.</p><h3>Community safety</h3><p>Do not use Supportly to impersonate a creator, request prohibited personal information, or abuse supporters. Reports may be reviewed by administrators.</p>`; }

function renderAuthBrand() { return `<a class="auth-brand-lockup" href="${routeUrl('')}">${icon('arrow-left')}<span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span><span><strong>supportly</strong><small>creator support</small></span></a>`; }

function renderLoginPage() {
  return `<div class="auth-shell"><section class="auth-card"><div class="auth-card-top">${renderAuthBrand()}<span class="profile-badge">${icon('shield')} Secure sign in</span></div><div class="auth-heading"><h1>Welcome back.</h1><p>Sign in to manage your creator page and payment reviews.</p></div><button class="google-button" data-action="google-sign-in">${icon('google')}Continue with Google</button><div class="auth-divider"><span>or continue with email</span></div><form id="login-form" class="auth-form"><div class="form-error" data-form-error role="alert">${escapeHtml(state.formError)}</div><label class="form-field"><span class="form-label">Email</span><input class="form-control" type="email" name="email" autocomplete="email" required placeholder="you@example.com" /></label><label class="form-field"><span class="form-label">Password</span><input class="form-control" type="password" name="password" autocomplete="current-password" required minlength="6" placeholder="Your password" /></label><button class="primary-button button-wide" type="submit">Sign in ${icon('arrow-right')}</button></form><div class="auth-links"><a href="forgot-password/" data-route="forgot-password/">Forgot password?</a><span>New to Supportly? <a href="signup/" data-route="signup/">Create an account</a></span></div><p class="auth-legal">By continuing, you agree to the <a href="terms/" data-route="terms/">Terms</a> and <a href="privacy/" data-route="privacy/">Privacy Policy</a>.</p></section></div>`;
}

function renderSignupPage() {
  return `<div class="auth-shell"><section class="auth-card"><div class="auth-card-top">${renderAuthBrand()}<span class="profile-badge">${icon('spark')} For creators</span></div><div class="auth-heading"><h1>Create your creator account.</h1><p>Start with a page your audience can trust.</p></div><button class="google-button" data-action="google-sign-in">${icon('google')}Continue with Google</button><div class="auth-divider"><span>or sign up with email</span></div><form id="signup-form" class="auth-form"><div class="form-error" data-form-error role="alert">${escapeHtml(state.formError)}</div><label class="form-field"><span class="form-label">Display name <span class="required">*</span></span><input class="form-control" type="text" name="displayName" required maxlength="80" autocomplete="name" placeholder="Ritam Paine" /></label><label class="form-field"><span class="form-label">Email <span class="required">*</span></span><input class="form-control" type="email" name="email" autocomplete="email" required placeholder="you@example.com" /></label><label class="form-field"><span class="form-label">Password <span class="required">*</span></span><input class="form-control" type="password" name="password" autocomplete="new-password" required minlength="6" placeholder="At least 6 characters" /></label><label class="form-field"><span class="form-label">Username <span class="required">*</span></span><input class="form-control" type="text" name="username" required pattern="[a-z0-9_-]{3,24}" placeholder="yourname" /><p class="form-helper">Lowercase letters, numbers, underscores, or hyphens.</p></label><button class="primary-button button-wide" type="submit">Create account ${icon('arrow-right')}</button></form><div class="auth-links"><span>Already have an account? <a href="login/" data-route="login/">Sign in</a></span></div></section></div>`;
}

function renderForgotPasswordPage() {
  return `<div class="auth-shell"><section class="auth-card"><div class="auth-card-top">${renderAuthBrand()}<span class="profile-badge">${icon('lock')} Account recovery</span></div><div class="auth-heading"><h1>Reset your password.</h1><p>We will send a secure reset link to your account email.</p></div><form id="forgot-password-form" class="auth-form"><div class="form-error" data-form-error role="alert">${escapeHtml(state.formError)}</div><label class="form-field"><span class="form-label">Email</span><input class="form-control" type="email" name="email" autocomplete="email" required placeholder="you@example.com" /></label><button class="primary-button button-wide" type="submit">Send reset link ${icon('arrow-right')}</button></form><div class="auth-links"><a href="login/" data-route="login/">${icon('arrow-left')} Back to sign in</a></div></section></div>`;
}

function setupEvents() {
  document.addEventListener('click', handleClick);
  document.addEventListener('submit', handleSubmit);
  document.addEventListener('change', handleChange);
  document.addEventListener('input', handleInput);
  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('supportly-route-change', (event) => {
    state.route = event.detail || parseRoute();
    resetTransientRouteState();
    closeProfileMenu();
    renderApp();
  });
  window.addEventListener('popstate', () => {
    state.route = parseRoute();
    resetTransientRouteState();
    renderApp();
  });
  window.addEventListener('online', () => showToast('Back online', 'You can continue using Supportly.', 'success'));
  window.addEventListener('offline', () => showToast('You are offline', 'Payment submissions cannot succeed while offline.', 'error'));
}

function resetTransientRouteState() {
  if (state.route.name === 'creator-support' && state.publicCreator?.username !== state.route.username) {
    state.publicCreator = null;
    state.publicCreatorStatus = 'idle';
    state.support = { step: 1, amount: 100, custom: false, supporterName: '', message: '', utr: '', busy: false, error: '', showQr: false };
  }
  if (state.route.name !== 'creator-support') state.formError = '';
}

function handleClick(event) {
  const routeTarget = event.target.closest('[data-route]');
  if (routeTarget) {
    event.preventDefault();
    const target = routeTarget.dataset.route || routeTarget.getAttribute('href') || '';
    if (target) navigate(target);
    return;
  }
  const actionTarget = event.target.closest('[data-action]');
  if (!actionTarget) return;
  const action = actionTarget.dataset.action;
  if (action === 'open-sidebar') return openSidebar();
  if (action === 'close-sidebar') return closeSidebar();
  if (action === 'toggle-profile-menu') return toggleProfileMenu();
  if (action === 'sign-out') return handleSignOut();
  if (action === 'google-sign-in') return handleGoogleSignIn(actionTarget);
  if (action === 'share-page') return shareCreatorPage();
  if (action === 'share-creator-page') return shareCreatorPage(state.publicCreator);
  if (action === 'copy-link') return handleCopyCreatorLink();
  if (action === 'copy-upi') return handleCopyUpi(actionTarget.dataset.upiId);
  if (action === 'select-support-amount') { state.support.amount = Number(actionTarget.dataset.amount); state.support.custom = false; state.support.error = ''; return renderApp(); }
  if (action === 'toggle-support-custom') { state.support.custom = !state.support.custom; return renderApp(); }
  if (action === 'continue-support-details') return continueSupportDetails();
  if (action === 'support-back') { state.support.step = Math.max(1, state.support.step - 1); state.support.error = ''; return renderApp(); }
  if (action === 'start-public-support') { state.support.amount = Number(actionTarget.dataset.amount); state.support.custom = false; return navigate(`@${state.publicCreator?.username || state.route.username}/support`); }
  if (action === 'open-upi') { showToast('UPI handoff started', 'Complete the payment in your UPI app, then return here.'); return; }
  if (action === 'show-support-qr') { state.support.showQr = true; return hydrateQr(); }
  if (action === 'support-paid') { state.support.step = 4; return renderApp(); }
  if (action === 'open-payment') return openPaymentModal(actionTarget.dataset.paymentId);
  if (action === 'close-modal') return closeModal();
  if (action === 'backdrop-close' && event.target === actionTarget) return closeModal();
  if (action === 'verify-payment') return reviewPaymentFromUi(actionTarget.dataset.paymentId, 'verified');
  if (action === 'open-reject') return openRejectModal(actionTarget.dataset.paymentId);
  if (action === 'reject-payment') return reviewPaymentFromUi(actionTarget.dataset.paymentId, 'rejected', document.getElementById('reject-reason')?.value);
  if (action === 'flag-payment') return reviewPaymentFromUi(actionTarget.dataset.paymentId, 'flagged');
  if (action === 'filter-payments') { state.paymentFilters.status = actionTarget.dataset.filter; return renderApp(); }
  if (action === 'clear-payment-filters') { state.paymentFilters = { status: 'all', search: '', min: '', max: '', sort: 'newest' }; return renderApp(); }
  if (action === 'export-payments') return exportPayments();
  if (action === 'retry-payments') return retryPayments();
  if (action === 'pagination-info') return showToast('All records loaded', 'Pagination will appear automatically as your payment history grows.', 'info');
  if (action === 'retry-analytics' || action === 'refresh-analytics') { state.analyticsStatus = 'idle'; return renderApp(); }
  if (action === 'retry-public-creator') { state.publicCreatorStatus = 'idle'; return renderApp(); }
  if (action === 'retry-admin') { state.adminStatus = 'idle'; state.adminData = null; return renderApp(); }
  if (action === 'mark-notification-read') return handleMarkNotification(actionTarget.dataset.notificationId);
  if (action === 'mark-all-read') return handleMarkAllRead();
  if (action === 'discard-settings') return renderApp();
  if (action === 'show-report') return openReportModal(actionTarget.dataset.targetId, actionTarget.dataset.targetType);
  if (action === 'report-creator') {
    if (!state.user) return navigate(`login/?next=${encodeURIComponent(state.route.path || '')}`);
    return openReportModal(actionTarget.dataset.targetId, actionTarget.dataset.targetType);
  }
  if (action === 'close-modal') return closeModal();
}

async function handleSubmit(event) {
  const form = event.target;
  event.preventDefault();
  if (form.id === 'login-form') return handleLogin(form);
  if (form.id === 'signup-form') return handleSignup(form);
  if (form.id === 'forgot-password-form') return handleForgotPassword(form);
  if (form.id === 'supporter-details-form') {
    const data = new FormData(form);
    state.support.supporterName = sanitizeText(data.get('supporterName'), 60);
    state.support.message = sanitizeText(data.get('message'), 180);
    state.support.step = 3;
    return renderApp();
  }
  if (form.id === 'utr-form') return handleUtrSubmit(form);
  if (form.id === 'profile-form') return handleProfileSave(form);
  if (form.id === 'report-form') return handleReportSubmit(form);
}

async function handleChange(event) {
  const input = event.target;
  if (input.dataset.action === 'avatar-file') {
    try {
      state.avatarDraft = await sanitizeImageFile(input.files?.[0]);
      renderApp();
      showToast('Image ready', 'Your compressed profile photo will be saved with the profile.');
    } catch (error) { showToast('Image not saved', error.message, 'error'); }
  }
  if (input.matches('[data-action="sort-payments"]')) { state.paymentFilters.sort = input.value; renderApp(); }
  if (input.matches('[data-public-toggle]') || input.matches('[data-show-support-toggle]')) {
    // Settings values are read when the profile form is saved; this keeps the toggle responsive without a write per click.
  }
}

const updatePaymentSearch = debounce((value) => { state.paymentFilters.search = value; renderApp(); }, 240);
function handleInput(event) {
  const input = event.target;
  if (input.matches('[data-action="payment-search"]')) updatePaymentSearch(input.value);
  if (input.matches('[data-action="payment-min"]')) { state.paymentFilters.min = input.value; renderApp(); }
  if (input.matches('[data-action="payment-max"]')) { state.paymentFilters.max = input.value; renderApp(); }
  if (input.id === 'support-custom-amount') {
    const amount = Number(input.value);
    if (Number.isFinite(amount)) { state.support.amount = amount; const button = document.querySelector('[data-action="continue-support-details"]'); if (button) button.innerHTML = `Continue with ${formatINR(amount)} ${icon('arrow-right')}`; }
  }
}

function handleKeydown(event) {
  if (event.key === 'Enter' && event.target.matches('[data-action="search"]')) {
    const term = event.target.value.trim();
    if (term) { state.paymentFilters.search = term; navigate('payments/'); }
    return;
  }
  if (event.key === 'Escape') {
    closeProfileMenu();
    if (state.modal) closeModal();
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    document.querySelector('[data-action="search"]')?.focus();
  }
}

async function handleUser(user) {
  state.user = user;
  state.authReady = true;
  state.formError = '';
  if (user) {
    try {
      state.userProfile = await getUserRecord(user.uid);
      state.creator = await getCreator(user.uid);
      startUserSubscriptions(user.uid);
    } catch (error) {
      state.authError = friendlyFirebaseError(error);
    }
    if (isAuthRoute(state.route) || state.route.name === 'home') return navigate(state.creator ? 'dashboard/' : 'settings/', { replace: true });
  } else {
    stopUserSubscriptions();
    state.userProfile = null;
    state.creator = null;
    if (state.route.protected) return navigate(`login/?next=${encodeURIComponent(`/${state.route.path}/`)}`, { replace: true });
  }
  renderApp();
}

function startUserSubscriptions(uid) {
  if (!state.subscriptions.payments) {
    state.paymentsStatus = 'loading';
    state.subscriptions.payments = subscribeCreatorPayments(uid, (payments) => { state.payments = payments; state.paymentsStatus = 'ready'; renderApp(); }, (error) => { state.paymentsStatus = 'error'; state.paymentsError = friendlyFirebaseError(error); renderApp(); });
  }
  if (!state.subscriptions.notifications) state.subscriptions.notifications = subscribeNotifications(uid, (notifications) => { state.notifications = notifications; renderApp(); }, (error) => { state.notificationsError = friendlyFirebaseError(error); renderApp(); });
}

function stopUserSubscriptions() {
  state.subscriptions.payments?.();
  state.subscriptions.notifications?.();
  state.subscriptions = { payments: null, notifications: null };
  state.payments = [];
  state.notifications = [];
  state.paymentsStatus = 'idle';
}

async function handleLogin(form) {
  state.authBusy = true;
  clearFormError(form);
  setFormBusy(form, true);
  try {
    await signInWithEmail(new FormData(form).get('email'), new FormData(form).get('password'));
    showToast('Signed in', 'Welcome back to Supportly.');
    const next = parseQuery().next;
    navigate(next ? decodeURIComponent(next).replace(/^\//, '') : 'dashboard/');
  } catch (error) { setFormError(form, friendlyFirebaseError(error)); } finally { state.authBusy = false; setFormBusy(form, false); }
}

async function handleSignup(form) {
  state.authBusy = true;
  clearFormError(form);
  setFormBusy(form, true);
  const data = new FormData(form);
  const name = validateName(data.get('displayName'), 'Display name');
  const username = validateUsername(data.get('username'));
  if (!name.valid || !username.valid) { setFormError(form, name.valid ? username.message : name.message); setFormBusy(form, false); return; }
  try {
    await createEmailAccount({ email: data.get('email'), password: data.get('password'), displayName: name.value });
    showToast('Account created', 'Finish your creator profile before publishing it.');
    navigate('settings/');
  } catch (error) { setFormError(form, friendlyFirebaseError(error)); } finally { state.authBusy = false; setFormBusy(form, false); }
}

async function handleGoogleSignIn(button) {
  button.disabled = true;
  state.formError = '';
  try {
    await signInWithGoogle();
    showToast('Signed in with Google', 'Your Supportly workspace is ready.');
    navigate('dashboard/');
  } catch (error) {
    const message = error?.code === 'auth/operation-not-allowed' ? 'Google Sign-In is currently unavailable. Please enable Google authentication in Firebase Console.' : friendlyFirebaseError(error);
    showToast('Google Sign-In unavailable', message, 'error');
    document.querySelector('[data-form-error]')?.replaceChildren(document.createTextNode(message));
  } finally { button.disabled = false; }
}

async function handleForgotPassword(form) {
  clearFormError(form);
  setFormBusy(form, true);
  try { await sendPasswordReset(new FormData(form).get('email')); showToast('Reset email sent', 'Check your inbox for a secure password reset link.'); form.reset(); } catch (error) { setFormError(form, friendlyFirebaseError(error)); } finally { setFormBusy(form, false); }
}

async function handleSignOut() {
  try { await signOut(); closeProfileMenu(); showToast('Signed out', 'Your Supportly session has ended.'); navigate('login/', { replace: true }); } catch (error) { showToast('Could not sign out', friendlyFirebaseError(error), 'error'); }
}

function defaultCreatorPayload({ uid, displayName = 'Creator', username = '', upiId = '' }) {
  return { uid, username, displayName, bio: '', avatar: '', youtube: { channelId: '', channelName: '', channelUrl: '' }, payment: { upiId, currency: 'INR' }, supportAmounts: [20, 50, 100, 200], thankYouMessage: 'Thank you for supporting my work!', isPublic: false, showRecentSupport: true };
}

async function handleProfileSave(form) {
  if (!state.user) return navigate('login/');
  clearFormError(form);
  const data = new FormData(form);
  const name = validateName(data.get('displayName'), 'Display name');
  const username = validateUsername(data.get('username'));
  const upi = validateUpiId(data.get('upiId'));
  const youtube = validateYoutubeUrl(data.get('youtubeChannelUrl'));
  if (!name.valid || !username.valid || !upi.valid || !youtube.valid) return showToast('Check your profile details', [name, username, upi, youtube].find((item) => !item.valid)?.message || 'Check the form fields.', 'error');
  const amounts = [...document.querySelectorAll('[data-support-amount]')].map((input) => validateAmount(input.value)).filter((item) => item.valid).map((item) => item.value);
  if (amounts.length < 1) return showToast('Add a support amount', 'Add at least one amount between ₹20 and ₹5,000.', 'error');
  const payload = {
    ...defaultCreatorPayload({ uid: state.user.uid, displayName: name.value, username: username.value, upiId: upi.value }),
    bio: sanitizeText(data.get('bio'), 160),
    avatar: state.avatarDraft || state.creator?.avatar || '',
    youtube: { channelId: sanitizeText(data.get('youtubeChannelId'), 80), channelName: sanitizeText(data.get('youtubeChannelName'), 80), channelUrl: youtube.value },
    payment: { upiId: upi.value, currency: 'INR' },
    supportAmounts: amounts,
    thankYouMessage: sanitizeText(data.get('thankYouMessage'), 120),
    isPublic: document.querySelector('[data-public-toggle]')?.checked ?? true,
    showRecentSupport: document.querySelector('[data-show-support-toggle]')?.checked ?? true,
  };
  setFormBusy(form, true);
  try {
    const saved = await saveCreatorProfile(payload);
    state.creator = { ...payload, ...(saved || {}), uid: state.user.uid };
    state.avatarDraft = '';
    showToast('Profile saved', 'Your creator page settings are up to date.');
    renderApp();
  } catch (error) { showToast('Profile could not be saved', friendlyFirebaseError(error), 'error'); } finally { setFormBusy(form, false); }
}

function continueSupportDetails() {
  const input = document.getElementById('support-custom-amount');
  if (state.support.custom && input) state.support.amount = Number(input.value);
  const amount = validateAmount(state.support.amount);
  if (!amount.valid) return showToast('Choose a valid amount', amount.message, 'error');
  if (!state.publicCreator?.payment?.upiId) return showToast('UPI is not configured', 'This creator has not configured a UPI ID yet.', 'error');
  state.support.amount = amount.value;
  state.support.step = 2;
  renderApp();
}

async function handleUtrSubmit(form) {
  if (state.support.busy || !state.publicCreator) return;
  const value = new FormData(form).get('utr');
  const utr = validateUtr(value);
  if (!utr.valid) return showToast('Check the UTR', utr.message, 'error');
  state.support.busy = true;
  setFormBusy(form, true);
  try {
    const result = await submitPayment({ creatorId: state.publicCreator.uid, creatorUsername: state.publicCreator.username, amount: state.support.amount, currency: 'INR', supporterName: state.support.supporterName, message: state.support.message, utr: utr.raw });
    state.lastPayment = { id: result.paymentId, creatorUsername: state.publicCreator.username, creatorName: state.publicCreator.displayName, amount: state.support.amount, status: 'pending', createdAt: Date.now() };
    sessionStorage.setItem('supportly:lastPayment', JSON.stringify(state.lastPayment));
    state.support.busy = false;
    state.support.step = 5;
    showToast('Payment submitted', 'Your support is pending verification.');
    navigate(`payment/pending/?id=${encodeURIComponent(result.paymentId)}`);
  } catch (error) { state.support.busy = false; showToast('Payment could not be submitted', friendlyFirebaseError(error), 'error'); setFormBusy(form, false); }
}

function openPaymentModal(paymentId) {
  const payment = state.payments.find((item) => item.id === paymentId) || (state.adminData?.payments?.[paymentId] ? { id: paymentId, ...state.adminData.payments[paymentId] } : null);
  if (!payment) return showToast('Payment unavailable', 'This payment record could not be found.', 'error');
  state.modal = { type: 'payment', paymentId, payment };
  renderModal();
}

function renderModal() {
  const root = document.getElementById('modal-root');
  if (!root) return;
  if (!state.modal) { root.innerHTML = ''; return; }
  if (state.modal.type === 'payment') {
    const payment = state.payments.find((item) => item.id === state.modal.paymentId) || state.modal.payment;
    root.innerHTML = renderPaymentModal(payment);
  }
  if (state.modal.type === 'reject') root.innerHTML = renderRejectModal(state.modal.paymentId);
  if (state.modal.type === 'report') root.innerHTML = renderReportModal(state.modal.targetId, state.modal.targetType);
}

function renderPaymentModal(payment) {
  const status = String(payment.status || '').toUpperCase();
  const canReview = ['PENDING', 'FLAGGED'].includes(status) && (state.route.admin || state.user?.uid === payment.creatorId);
  return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal-card wide" role="dialog" aria-modal="true" aria-labelledby="payment-detail-title"><button class="icon-button modal-close" aria-label="Close" data-action="close-modal">${icon('close')}</button><div class="modal-header"><div class="modal-eyebrow">Payment detail · ${escapeHtml(payment.id)}</div><h2 id="payment-detail-title">${escapeHtml(payment.supporterName || 'Anonymous supporter')}</h2><p>Review submitted information and keep the server-confirmed status accurate.</p></div><div class="modal-amount-summary"><span>Submitted support</span><strong>${formatINR(payment.amount)}</strong></div><div class="info-list"><div class="info-list-row"><span>Current status</span><strong>${statusBadge(status)}</strong></div><div class="info-list-row"><span>UTR / transaction ID</span><strong class="masked-utr">${escapeHtml(maskUtr(payment.utr))}</strong></div><div class="info-list-row"><span>Submitted</span><strong>${escapeHtml(formatDate(payment.createdAt, 'Recently'))}</strong></div><div class="info-list-row"><span>Message</span><strong>${escapeHtml(payment.message || 'No message')}</strong></div>${payment.verifiedAt ? `<div class="info-list-row"><span>Reviewed</span><strong>${escapeHtml(formatDate(payment.verifiedAt))} by ${escapeHtml(payment.verifiedBy || 'authorized reviewer')}</strong></div>` : ''}${payment.rejectionReason ? `<div class="info-list-row"><span>Review note</span><strong>${escapeHtml(payment.rejectionReason)}</strong></div>` : ''}</div>${canReview ? `<div class="modal-action-row"><button class="danger-button" data-action="open-reject" data-payment-id="${escapeHtml(payment.id)}">${icon('close')}Reject</button><button class="secondary-button" data-action="flag-payment" data-payment-id="${escapeHtml(payment.id)}">${icon('flag')}Flag</button><button class="primary-button" data-action="verify-payment" data-payment-id="${escapeHtml(payment.id)}">${icon('check')}Verify</button></div>` : `<div class="payment-safety">${icon(status === 'VERIFIED' ? 'check-circle' : 'flag')}<span>${status === 'VERIFIED' ? 'This payment was marked verified through an authorized review action.' : 'This submission is not available for a normal review action in its current state.'}</span></div>`}${state.route.name === 'admin' ? `<button class="ghost-button button-wide" data-action="show-report" data-target-id="${escapeHtml(payment.id)}" data-target-type="payment">${icon('flag')}Report or flag this payment</button>` : ''}</section></div>`;
}

function openRejectModal(paymentId) { state.modal = { type: 'reject', paymentId }; renderModal(); }
function renderRejectModal(paymentId) { return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="reject-title"><button class="icon-button modal-close" aria-label="Close" data-action="close-modal">${icon('close')}</button><div class="modal-header"><div class="modal-eyebrow">Review action</div><h2 id="reject-title">Reject this payment?</h2><p>A rejection reason is required and will be shared only where appropriate.</p></div><label class="form-field"><span class="form-label">Rejection reason <span class="required">*</span></span><textarea class="form-control" id="reject-reason" maxlength="240" placeholder="Explain what could not be verified"></textarea></label><div class="modal-action-row"><button class="secondary-button" data-action="close-modal">Cancel</button><button class="danger-button" data-action="reject-payment" data-payment-id="${escapeHtml(paymentId)}">${icon('close')}Reject payment</button></div></section></div>`; }
function openReportModal(targetId, targetType) { state.modal = { type: 'report', targetId, targetType }; renderModal(); }
function renderReportModal(targetId, targetType) { return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="report-title"><button class="icon-button modal-close" aria-label="Close" data-action="close-modal">${icon('close')}</button><div class="modal-header"><div class="modal-eyebrow">Safety report</div><h2 id="report-title">Report this ${escapeHtml(targetType || 'item')}</h2><p>Reports help the admin team review suspicious or abusive activity.</p></div><form id="report-form" class="modal-form"><input type="hidden" name="targetId" value="${escapeHtml(targetId)}" /><input type="hidden" name="targetType" value="${escapeHtml(targetType)}" /><label class="form-field"><span class="form-label">Reason</span><select class="form-select" name="reason"><option>Suspicious payment request</option><option>Fake creator</option><option>Abusive content</option><option>Other</option></select></label><label class="form-field"><span class="form-label">Description</span><textarea class="form-control" name="description" maxlength="500" placeholder="Add context for the review"></textarea></label><button class="primary-button button-wide" type="submit">Submit report ${icon('arrow-right')}</button></form></section></div>`; }

async function reviewPaymentFromUi(paymentId, status, rejectionReason = '') {
  if (status === 'rejected' && !sanitizeText(rejectionReason, 240)) return showToast('Reason required', 'Add a rejection reason before rejecting a payment.', 'error');
  const button = document.querySelector(`[data-action="${status === 'verified' ? 'verify-payment' : status === 'flagged' ? 'flag-payment' : 'reject-payment'}"][data-payment-id="${CSS.escape(paymentId)}"]`);
  if (button) button.disabled = true;
  try {
    await reviewPayment({ paymentId, status, rejectionReason: sanitizeText(rejectionReason, 240) });
    showToast(status === 'verified' ? 'Payment verified' : status === 'rejected' ? 'Payment rejected' : 'Payment flagged', 'The trusted review service recorded the status change.');
    closeModal();
  } catch (error) { showToast('Review action failed', friendlyFirebaseError(error), 'error'); if (button) button.disabled = false; }
}

async function handleReportSubmit(form) {
  const data = new FormData(form);
  try { await createReport({ targetId: sanitizeText(data.get('targetId'), 120), targetType: sanitizeText(data.get('targetType'), 30), reason: sanitizeText(data.get('reason'), 80), description: sanitizeText(data.get('description'), 500) }); showToast('Report submitted', 'The admin team can now review the report.'); closeModal(); } catch (error) { showToast('Report could not be submitted', friendlyFirebaseError(error), 'error'); }
}

async function handleMarkNotification(id) { if (!state.user) return; try { await markOneRead(state.user.uid, id); } catch (error) { showToast('Could not update notification', friendlyFirebaseError(error), 'error'); } }
async function handleMarkAllRead() { if (!state.user) return; try { await markEverythingRead(state.user.uid, state.notifications); showToast('Notifications cleared', 'All notifications are marked as read.'); } catch (error) { showToast('Could not update notifications', friendlyFirebaseError(error), 'error'); } }

async function shareCreatorPage(creator = state.creator) {
  const username = creator?.username || state.publicCreator?.username;
  if (!username) return showToast('Finish your profile first', 'Add a username in Settings before sharing your page.', 'error');
  const url = new URL(routeUrl(`@${username}`), window.location.origin).href;
  const data = { title: `Support ${creator?.displayName || state.creator?.displayName || 'this creator'}`, text: `Support ${creator?.displayName || 'this creator'} on UPI`, url };
  try { if (navigator.share) { await navigator.share(data); return; } } catch (error) { if (error?.name === 'AbortError') return; }
  await copyText(url); showToast('Link copied', 'Your creator support link is ready to share.');
}

async function handleCopyCreatorLink() { const username = state.publicCreator?.username || state.creator?.username; if (!username) return showToast('Username required', 'Add a username in Settings first.', 'error'); await copyText(new URL(routeUrl(`@${username}`), window.location.origin).href); showToast('Link copied', 'Your public creator link is on the clipboard.'); }
async function handleCopyUpi(upiId) { if (!upiId) return showToast('UPI ID unavailable', 'The creator has not configured a UPI ID.', 'error'); await copyText(upiId); showToast('UPI ID copied', 'Paste it into your preferred UPI app.'); }

function exportPayments() {
  const rows = filterPayments(state.payments);
  const csv = [['paymentId', 'supporterName', 'amount', 'currency', 'status', 'submittedAt', 'utrMasked'], ...rows.map((item) => [item.id, item.supporterName || '', item.amount, item.currency || 'INR', item.status, formatDate(item.createdAt), maskUtr(item.utr)])].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'supportly-payments.csv'; link.click(); URL.revokeObjectURL(link.href);
  showToast('CSV exported', 'The export includes masked UTR values only.');
}

function retryPayments() { state.paymentsStatus = 'idle'; if (state.user) { state.subscriptions.payments?.(); state.subscriptions.payments = null; startUserSubscriptions(state.user.uid); } renderApp(); }

function renderModalIfAny() { renderModal(); }
function closeModal() { state.modal = null; renderModalIfAny(); }
function toggleProfileMenu() { const menu = document.getElementById('profile-menu'); if (!menu) return; menu.hidden = !menu.hidden; }
function closeProfileMenu() { const menu = document.getElementById('profile-menu'); if (menu) menu.hidden = true; }
function openSidebar() { document.getElementById('sidebar')?.classList.add('is-open'); document.getElementById('sidebar-scrim')?.classList.add('is-visible'); }
function closeSidebar() { document.getElementById('sidebar')?.classList.remove('is-open'); document.getElementById('sidebar-scrim')?.classList.remove('is-visible'); }
function setFormBusy(form, busy) { form.querySelectorAll('button[type="submit"]').forEach((button) => { button.disabled = busy; button.dataset.originalText ||= button.innerHTML; button.innerHTML = busy ? `${icon('refresh')}Please wait…` : button.dataset.originalText; }); }
function setFormError(form, message) { const element = form.querySelector('[data-form-error]'); if (element) element.textContent = message; else showToast('Could not continue', message, 'error'); }
function clearFormError(form) { const element = form.querySelector('[data-form-error]'); if (element) element.textContent = ''; }

function hydrateQr() {
  const canvas = document.getElementById('upi-qr');
  const creator = state.publicCreator;
  if (!canvas || !creator?.payment?.upiId) return;
  const uri = `upi://pay?pa=${encodeURIComponent(creator.payment.upiId)}&pn=${encodeURIComponent(creator.displayName)}&am=${encodeURIComponent(Number(state.support.amount).toFixed(2))}&cu=INR`;
  renderUpiQr(canvas, uri).then((success) => { if (!success) { const parent = canvas.parentElement; if (parent) parent.insertAdjacentHTML('beforeend', `<button class="secondary-button button-small" data-action="copy-upi" data-upi-id="${escapeHtml(creator.payment.upiId)}">${icon('copy')}Copy UPI ID instead</button>`); } });
}

function showToast(title, message, type = 'success') {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const toast = document.createElement('div'); toast.className = `toast ${type}`; toast.innerHTML = `<span class="toast-icon">${icon(type === 'error' ? 'close' : type === 'success' ? 'check-circle' : 'info')}</span><span class="toast-copy"><strong></strong><span></span></span>`; toast.querySelector('strong').textContent = title; toast.querySelector('.toast-copy span').textContent = message; region.appendChild(toast); window.setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(7px)'; window.setTimeout(() => toast.remove(), 180); }, 4200);
}

async function start() {
  setupEvents();
  if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    navigator.serviceWorker.register(`${BASE_PATH}sw.js`, { scope: BASE_PATH }).catch(() => {});
  }
  renderApp();
  try { await initializeOptionalAppCheck(); await initializeAuth(); } catch (error) { state.authError = friendlyFirebaseError(error); state.authReady = true; renderApp(); }
  subscribeAuth(handleUser);
  renderApp();
}

start();
