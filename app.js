/*
 * Supportly static prototype
 *
 * This file intentionally keeps the build dependency-free so the interface can
 * be hosted on any static server, including GitHub Pages. Replace the demo
 * state and action handlers with trusted server-side/Firebase operations before
 * accepting real payment or identity data.
 */

const pageView = document.getElementById('page-view');
const modalRoot = document.getElementById('modal-root');
const toastRegion = document.getElementById('toast-region');
const sidebar = document.getElementById('sidebar');
const sidebarScrim = document.getElementById('sidebar-scrim');

const initialPayments = [
  {
    id: 'PAY_8F42A1',
    supporter: 'Rahul Sharma',
    initials: 'RS',
    avatar: 'avatar-teal',
    amount: 100,
    date: 'Today, 10:42 AM',
    shortDate: 'Today, 10:42 AM',
    utr: '•••• 8294',
    status: 'VERIFIED',
    message: 'Keep creating! Your tutorials are great.',
  },
  {
    id: 'PAY_7B19D3',
    supporter: 'Aditi Sen',
    initials: 'AS',
    avatar: 'avatar-orange',
    amount: 50,
    date: 'Today, 09:18 AM',
    shortDate: 'Today, 09:18 AM',
    utr: '•••• 4107',
    status: 'VERIFIED',
    message: 'The clean coding videos helped a lot.',
  },
  {
    id: 'PAY_5C28E7',
    supporter: 'Kabir Roy',
    initials: 'KR',
    avatar: 'avatar-blue',
    amount: 200,
    date: 'Yesterday, 06:26 PM',
    shortDate: 'Yesterday, 06:26 PM',
    utr: '•••• 9920',
    status: 'PENDING',
    message: 'Looking forward to the next build-along.',
  },
  {
    id: 'PAY_4A16F0',
    supporter: 'Anonymous supporter',
    initials: 'AN',
    avatar: 'avatar-plum',
    amount: 500,
    date: '12 Aug 2026',
    shortDate: '12 Aug 2026',
    utr: '•••• 3381',
    status: 'FLAGGED',
    message: 'Thanks for making web development feel approachable.',
  },
  {
    id: 'PAY_2D91BC',
    supporter: 'Neha Das',
    initials: 'ND',
    avatar: 'avatar-purple',
    amount: 100,
    date: '11 Aug 2026',
    shortDate: '11 Aug 2026',
    utr: '•••• 7642',
    status: 'VERIFIED',
    message: 'Your accessibility series was exactly what I needed.',
  },
  {
    id: 'PAY_1C08EE',
    supporter: 'Studio K',
    initials: 'SK',
    avatar: 'avatar-teal',
    amount: 20,
    date: '10 Aug 2026',
    shortDate: '10 Aug 2026',
    utr: '•••• 1058',
    status: 'REJECTED',
    message: 'Thank you for sharing what you learn.',
    rejectionReason: 'The transaction details could not be matched during review.',
  },
];

const state = {
  view: readHashView(),
  filter: 'all',
  sort: 'newest',
  customAmount: false,
  selectedAmount: 100,
  modal: null,
  profile: {
    displayName: 'Ritam Paine',
    username: 'ritam',
    bio: 'I make videos about technology and web development.',
    youtubeChannelName: 'Ritam Paine',
    youtubeUrl: 'https://www.youtube.com/@RitamPaine',
    upiId: 'ritam@upi',
    thankYouMessage: 'Thank you for supporting my channel!',
  },
  metrics: {
    verifiedAmount: 18240,
    verifiedPayments: 14,
    pendingSubmissions: 8,
    supporters: 12,
    pageViews: 1204,
  },
  payments: initialPayments.map((payment) => ({ ...payment })),
};

const viewMeta = {
  overview: { label: 'Overview', kicker: 'Good morning, Ritam' },
  payments: { label: 'Payments', kicker: 'Payment review' },
  analytics: { label: 'Analytics', kicker: 'Your audience at a glance' },
  settings: { label: 'Settings', kicker: 'Creator profile' },
  public: { label: 'Public page', kicker: 'Live page preview' },
};

function readHashView() {
  const value = window.location.hash.replace('#', '').trim();
  return Object.prototype.hasOwnProperty.call(viewMeta, value) ? value : 'overview';
}

function icon(name, className = '') {
  return `<svg class="icon ${className}" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatINR(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function formatCompactINR(value) {
  const amount = Number(value || 0);
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}k`;
  return formatINR(amount);
}

function statusClass(status) {
  return String(status || '').toLowerCase();
}

function statusLabel(status) {
  const labels = {
    VERIFIED: 'Verified',
    PENDING: 'Pending',
    REJECTED: 'Rejected',
    FLAGGED: 'Flagged',
  };
  return labels[status] || status;
}

function statusBadge(status, large = false) {
  return `<span class="status-badge ${statusClass(status)}${large ? ' large' : ''}">${escapeHtml(statusLabel(status))}</span>`;
}

function currentPendingCount() {
  return state.metrics.pendingSubmissions;
}

function renderApp() {
  const meta = viewMeta[state.view] || viewMeta.overview;
  document.getElementById('breadcrumbs').innerHTML = `<span>Workspace</span><span class="breadcrumb-slash">/</span><strong>${escapeHtml(meta.label)}</strong>`;
  pageView.innerHTML = renderView();

  document.querySelectorAll('[data-view]').forEach((element) => {
    element.classList.toggle('is-active', element.dataset.view === state.view);
  });

  if (state.view === 'public' && state.customAmount) {
    const input = document.getElementById('public-custom-amount');
    if (input) window.setTimeout(() => input.focus(), 0);
  }
}

function renderView() {
  switch (state.view) {
    case 'payments':
      return renderPaymentsPage();
    case 'analytics':
      return renderAnalyticsPage();
    case 'settings':
      return renderSettingsPage();
    case 'public':
      return renderPublicPage();
    case 'overview':
    default:
      return renderOverviewPage();
  }
}

function renderPageHeader({ title, subtitle, kicker, actions = '' }) {
  return `
    <div class="page-header">
      <div>
        <div class="page-kicker">${icon('spark')}<span>${escapeHtml(kicker)}</span></div>
        <h1 class="page-title">${escapeHtml(title)}</h1>
        <p class="page-subtitle">${escapeHtml(subtitle)}</p>
      </div>
      ${actions ? `<div class="header-actions">${actions}</div>` : ''}
    </div>
  `;
}

function renderOverviewPage() {
  const verifiedAmount = state.metrics.verifiedAmount;
  const verifiedPayments = state.metrics.verifiedPayments;
  const newPending = state.payments.filter((payment) => payment.isNew && payment.status === 'PENDING').length;
  const pending = currentPendingCount() + newPending;

  return `
    ${renderPageHeader({
      title: 'Overview',
      subtitle: 'Here is what is happening on your creator page today.',
      kicker: 'Good morning, Ritam',
      actions: `<button class="secondary-button" data-view="public">${icon('external')}View public page</button><button class="primary-button" data-action="share-page">${icon('share')}Share page</button>`,
    })}

    <div class="overview-grid">
      <section class="welcome-card">
        <span class="welcome-orb" aria-hidden="true"></span>
        <div class="welcome-content">
          <div class="welcome-eyebrow">${icon('check-circle')}<span>Your page is live</span></div>
          <h2>Keep doing work<br />worth supporting.</h2>
          <p>Your audience can now send support directly to your UPI account. Review every submission before calling it verified.</p>
          <button class="primary-button" data-view="public">View my page ${icon('arrow-right')}</button>
        </div>
      </section>

      <section class="progress-card">
        <div class="card-topline"><div><h2 class="card-title">Getting started</h2><p class="card-caption">2 of 3 steps complete</p></div><strong class="progress-percent">82%</strong></div>
        <div class="progress-track" aria-label="82 percent complete"><div class="progress-fill"></div></div>
        <div class="progress-list">
          <div class="progress-row"><span class="progress-label"><span class="mini-status done"></span>Publish your page</span><span>Done</span></div>
          <div class="progress-row"><span class="progress-label"><span class="mini-status done"></span>Share your link</span><span>Done</span></div>
          <div class="progress-row"><span class="progress-label"><span class="mini-status next"></span>Review first support</span><span>Next</span></div>
        </div>
      </section>
    </div>

    <div class="stats-grid">
      <article class="stat-card"><div class="stat-header"><span class="stat-label">Verified support</span><span class="stat-icon green">${icon('wallet')}</span></div><strong class="stat-value">${formatCompactINR(verifiedAmount)}</strong><span class="stat-note positive">${icon('arrow-up')} 18.6% this month</span></article>
      <article class="stat-card"><div class="stat-header"><span class="stat-label">Verified payments</span><span class="stat-icon">${icon('check-circle')}</span></div><strong class="stat-value">${verifiedPayments}</strong><span class="stat-note positive">${icon('arrow-up')} 4 this month</span></article>
      <article class="stat-card"><div class="stat-header"><span class="stat-label">Pending submissions</span><span class="stat-icon amber">${icon('clock')}</span></div><strong class="stat-value">${pending}</strong><span class="stat-note">Awaiting your review</span></article>
      <article class="stat-card"><div class="stat-header"><span class="stat-label">Page views</span><span class="stat-icon blue">${icon('eye')}</span></div><strong class="stat-value">${state.metrics.pageViews.toLocaleString('en-IN')}</strong><span class="stat-note positive">${icon('arrow-up')} 12.4% this month</span></article>
    </div>

    <div class="dashboard-columns">
      <section class="panel">
        <div class="panel-heading"><div><h2>Recent payment submissions</h2><p>Review status before sharing a supporter update.</p></div><button class="panel-link" data-view="payments">View all ${icon('arrow-right')}</button></div>
        <div class="payment-list">
          <div class="payment-row payment-row-head"><div>Supporter</div><div>Amount</div><div>Submitted</div><div>Status</div><div></div></div>
          ${state.payments.slice(0, 4).map(renderMiniPaymentRow).join('')}
        </div>
        <div class="trust-note">${icon('shield')}<span>A UTR is a review signal, not automatic proof of payment. Only mark a submission verified after your permitted verification process.</span></div>
      </section>

      <section class="panel">
        <div class="panel-heading"><div><h2>Quick actions</h2><p>Shortcuts for your daily workflow.</p></div></div>
        <div class="quick-actions">
          <button class="quick-action" data-view="public"><span class="quick-action-icon">${icon('external')}</span><span class="quick-action-copy"><strong>View your page</strong><span>See the supporter experience</span></span>${icon('arrow-right')}</button>
          <button class="quick-action" data-action="share-page"><span class="quick-action-icon green">${icon('share')}</span><span class="quick-action-copy"><strong>Share your page</strong><span>Copy your short support link</span></span>${icon('arrow-right')}</button>
          <button class="quick-action" data-view="settings"><span class="quick-action-icon amber">${icon('settings')}</span><span class="quick-action-copy"><strong>Edit profile</strong><span>Update your creator details</span></span>${icon('arrow-right')}</button>
          <button class="quick-action" data-view="payments"><span class="quick-action-icon">${icon('wallet')}</span><span class="quick-action-copy"><strong>Review payments</strong><span>${pending} submission${pending === 1 ? '' : 's'} need attention</span></span>${icon('arrow-right')}</button>
        </div>
      </section>
    </div>
  `;
}

function renderMiniPaymentRow(payment) {
  return `
    <div class="payment-row">
      <div class="payment-person"><div class="avatar avatar-sm ${escapeHtml(payment.avatar)}">${escapeHtml(payment.initials)}</div><div class="payment-person-info"><strong>${escapeHtml(payment.supporter)}</strong><span>${escapeHtml(payment.message || 'No message')}</span></div></div>
      <div class="payment-amount">${formatINR(payment.amount)}</div>
      <div class="payment-date">${escapeHtml(payment.shortDate || payment.date)}</div>
      ${statusBadge(payment.status)}
      <button class="payment-more" aria-label="Open payment details" data-action="open-payment" data-payment-id="${escapeHtml(payment.id)}">${icon('more')}</button>
    </div>
  `;
}

function renderPaymentsPage() {
  const filtered = getFilteredPayments();
  const filters = [
    ['all', 'All'],
    ['PENDING', 'Pending'],
    ['VERIFIED', 'Verified'],
    ['REJECTED', 'Rejected'],
    ['FLAGGED', 'Flagged'],
  ];

  return `
    ${renderPageHeader({
      title: 'Payments',
      subtitle: 'Review submitted transaction details and keep your records clear.',
      kicker: 'Payment review',
      actions: `<button class="secondary-button" data-action="export-payments">${icon('file')}Export CSV</button>`,
    })}
    <section class="panel table-card">
      <div class="table-toolbar"><div class="filter-tabs" role="tablist" aria-label="Payment status filters">${filters.map(([value, label]) => `<button class="filter-tab ${state.filter === value ? 'is-active' : ''}" data-action="filter-payments" data-filter="${value}" role="tab" aria-selected="${state.filter === value}">${label}${value === 'PENDING' ? ` <span>(${currentPendingCount()})</span>` : ''}</button>`).join('')}</div><select class="sort-select" aria-label="Sort payments" data-action="sort-payments"><option value="newest" ${state.sort === 'newest' ? 'selected' : ''}>Newest first</option><option value="oldest" ${state.sort === 'oldest' ? 'selected' : ''}>Oldest first</option><option value="highest" ${state.sort === 'highest' ? 'selected' : ''}>Highest amount</option><option value="lowest" ${state.sort === 'lowest' ? 'selected' : ''}>Lowest amount</option></select></div>
      ${filtered.length ? `<div class="payments-table-wrap"><table class="payments-table"><thead><tr><th>Supporter</th><th>Amount</th><th>UTR / transaction ID</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead><tbody>${filtered.map(renderTablePaymentRow).join('')}</tbody></table></div><div class="table-footer"><span>Showing ${filtered.length} of ${state.payments.length} submissions</span><div class="pagination"><button class="is-active" aria-label="Page 1">1</button><button aria-label="Next page">${icon('arrow-right')}</button></div></div>` : renderEmptyPayments()}
    </section>
  `;
}

function getFilteredPayments() {
  let payments = [...state.payments];
  if (state.filter !== 'all') payments = payments.filter((payment) => payment.status === state.filter);
  if (state.sort === 'highest') payments.sort((a, b) => b.amount - a.amount);
  if (state.sort === 'lowest') payments.sort((a, b) => a.amount - b.amount);
  if (state.sort === 'oldest') payments.reverse();
  return payments;
}

function renderTablePaymentRow(payment) {
  return `<tr>
    <td><div class="table-person"><div class="avatar avatar-sm ${escapeHtml(payment.avatar)}">${escapeHtml(payment.initials)}</div><div><strong>${escapeHtml(payment.supporter)}</strong><span>${escapeHtml(payment.id)}</span></div></div></td>
    <td class="table-amount">${formatINR(payment.amount)}</td>
    <td><span class="masked-utr">${escapeHtml(payment.utr)}</span></td>
    <td>${escapeHtml(payment.date)}</td>
    <td>${statusBadge(payment.status)}</td>
    <td><button class="table-action" data-action="open-payment" data-payment-id="${escapeHtml(payment.id)}">Review</button></td>
  </tr>`;
}

function renderEmptyPayments() {
  return `<div class="empty-state"><div><div class="empty-state-icon">${icon('wallet')}</div><h3>No ${state.filter === 'all' ? '' : statusLabel(state.filter).toLowerCase() + ' '}submissions</h3><p>There are no payment submissions in this view yet. Share your public page to start receiving support.</p></div></div>`;
}

function renderAnalyticsPage() {
  return `
    ${renderPageHeader({
      title: 'Analytics',
      subtitle: 'Understand the difference between interest, submissions, and verified support.',
      kicker: 'Your audience at a glance',
      actions: `<button class="secondary-button" data-action="analytics-period">Last 30 days ${icon('arrow-right')}</button>`,
    })}
    <div class="stats-grid">
      <article class="stat-card"><div class="stat-header"><span class="stat-label">Profile views</span><span class="stat-icon blue">${icon('eye')}</span></div><strong class="stat-value">1,204</strong><span class="stat-note positive">${icon('arrow-up')} 12.4% vs last month</span></article>
      <article class="stat-card"><div class="stat-header"><span class="stat-label">Support attempts</span><span class="stat-icon amber">${icon('arrow-up')}</span></div><strong class="stat-value">86</strong><span class="stat-note positive">${icon('arrow-up')} 8.2% vs last month</span></article>
      <article class="stat-card"><div class="stat-header"><span class="stat-label">Submitted payments</span><span class="stat-icon">${icon('file')}</span></div><strong class="stat-value">22</strong><span class="stat-note">18.2% of attempts</span></article>
      <article class="stat-card"><div class="stat-header"><span class="stat-label">Verified amount</span><span class="stat-icon green">${icon('wallet')}</span></div><strong class="stat-value">${formatCompactINR(state.metrics.verifiedAmount)}</strong><span class="stat-note positive">${icon('arrow-up')} 18.6% this month</span></article>
    </div>
    <div class="analytics-grid" style="margin-top: 20px;">
      <section class="panel chart-card"><div class="panel-heading"><div><h2>Page activity</h2><p>Views and verified payments over the last 30 days.</p></div><div class="chart-legend"><span class="legend-item"><span class="legend-dot purple"></span>Page views</span><span class="legend-item"><span class="legend-dot green"></span>Verified</span></div></div><div class="chart-area"><div class="chart-grid-lines"><span></span><span></span><span></span><span></span><span></span></div><div class="chart-y-labels"><span>80</span><span>60</span><span>40</span><span>20</span><span>0</span></div><svg class="chart-svg" viewBox="0 0 600 175" preserveAspectRatio="none" aria-label="Page activity line chart"><defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#6b6de7" stop-opacity=".19"/><stop offset="1" stop-color="#6b6de7" stop-opacity="0"/></linearGradient></defs><path d="M0 145 C40 134, 55 139, 84 116 S125 122, 149 101 S190 126, 218 95 S255 107, 286 80 S332 101, 355 70 S398 84, 428 52 S467 75, 491 43 S544 64, 600 18 L600 175 L0 175 Z" fill="url(#chart-fill)" stroke="none"/><path d="M0 145 C40 134, 55 139, 84 116 S125 122, 149 101 S190 126, 218 95 S255 107, 286 80 S332 101, 355 70 S398 84, 428 52 S467 75, 491 43 S544 64, 600 18" fill="none" stroke="#6567df" stroke-width="3" stroke-linecap="round"/><path d="M0 163 C48 158, 59 155, 84 152 S124 160, 149 144 S191 150, 218 141 S255 151, 286 132 S332 144, 355 124 S399 139, 428 115 S468 127, 491 109 S544 118, 600 96" fill="none" stroke="#59b798" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="2 0"/></svg><div class="chart-x-labels"><span>Aug 09</span><span>Aug 16</span><span>Aug 23</span><span>Aug 30</span><span>Sep 06</span></div></div></section>
      <div class="analytics-side"><section class="panel breakdown-card"><div class="panel-heading"><div><h2>Conversion funnel</h2><p>Keep this distinction clear.</p></div></div><div class="breakdown-item"><span class="breakdown-dot purple"></span><span>Support attempts</span><strong>86</strong><div class="breakdown-bar"><span class="purple"></span></div></div><div class="breakdown-item"><span class="breakdown-dot amber"></span><span>Submitted payments</span><strong>22</strong><div class="breakdown-bar"><span class="amber"></span></div></div><div class="breakdown-item"><span class="breakdown-dot green"></span><span>Verified payments</span><strong>14</strong><div class="breakdown-bar"><span class="green"></span></div></div></section><section class="panel insight-card"><div><div class="insight-icon">${icon('spark')}</div><h3>Your link is gaining momentum</h3><p>Views are up this month. Add your support link to your video descriptions and pinned comments to make the next step obvious.</p></div><button class="panel-link" data-action="share-page">Share page ${icon('arrow-right')}</button></section></div>
    </div>
  `;
}

function renderSettingsPage() {
  return `
    ${renderPageHeader({ title: 'Settings', subtitle: 'Keep your public profile and support preferences up to date.', kicker: 'Creator profile' })}
    <div class="settings-layout">
      <nav class="settings-tabs" aria-label="Settings sections"><button class="settings-tab is-active">${icon('users')}Profile</button><button class="settings-tab">${icon('wallet')}Support amounts</button><button class="settings-tab">${icon('shield')}Privacy & safety</button></nav>
      <div class="settings-content">
        <section class="panel settings-card"><div class="settings-card-heading"><div><h2>Public profile</h2><p>This information appears on your public support page.</p></div><span class="profile-badge">${icon('check-circle')} Live</span></div><div class="profile-edit-row"><div class="avatar avatar-lg avatar-purple">RP</div><div class="profile-edit-copy"><strong>Profile photo</strong><span>JPG or PNG. Recommended 256 × 256.</span></div><button class="secondary-button button-small" data-action="change-avatar">Change photo</button></div><form id="profile-form"><div class="form-grid"><label class="form-field"><span class="form-label">Display name <span class="required">*</span></span><input class="form-control" name="displayName" required value="${escapeHtml(state.profile.displayName)}" /></label><label class="form-field"><span class="form-label">Username <span class="required">*</span></span><input class="form-control" name="username" required pattern="[a-z0-9_-]+" value="${escapeHtml(state.profile.username)}" /><p class="form-helper">Your page: supportly.example/@${escapeHtml(state.profile.username)}</p></label><label class="form-field full"><span class="form-label">Short bio <span class="optional">Optional</span></span><textarea class="form-control" name="bio" maxlength="160">${escapeHtml(state.profile.bio)}</textarea><p class="form-helper">A clear one-line description helps supporters know what you make.</p></label><label class="form-field"><span class="form-label">YouTube channel name</span><input class="form-control" name="youtubeChannelName" value="${escapeHtml(state.profile.youtubeChannelName)}" /></label><label class="form-field"><span class="form-label">YouTube channel URL</span><input class="form-control" name="youtubeUrl" type="url" value="${escapeHtml(state.profile.youtubeUrl)}" /></label></div><div class="settings-footer"><button type="button" class="ghost-button" data-action="discard-settings">Discard</button><button class="primary-button" type="submit">Save changes</button></div></form></section>
        <section class="panel settings-card"><div class="settings-card-heading"><div><h2>Support preferences</h2><p>Payments go directly to your UPI ID. Never share bank credentials here.</p></div></div><div class="form-grid"><label class="form-field full"><span class="form-label">Creator UPI ID <span class="required">*</span></span><input class="form-control" name="upiId" value="${escapeHtml(state.profile.upiId)}" /><p class="form-helper">Future payment handoffs will use this ID. Verify it carefully before publishing.</p></label><label class="form-field full"><span class="form-label">Thank-you message <span class="optional">Optional</span></span><textarea class="form-control" name="thankYouMessage" maxlength="120">${escapeHtml(state.profile.thankYouMessage)}</textarea></label></div><div class="amount-settings"><label class="amount-setting"><span>₹</span><input value="20" aria-label="Suggested amount 1" /></label><label class="amount-setting"><span>₹</span><input value="50" aria-label="Suggested amount 2" /></label><label class="amount-setting"><span>₹</span><input value="100" aria-label="Suggested amount 3" /></label><label class="amount-setting"><span>₹</span><input value="200" aria-label="Suggested amount 4" /></label></div><div class="setting-note">${icon('shield')}<span>For production, UPI changes and sensitive verification actions must be validated by trusted server-side logic. This static build stores no real payment information.</span></div></section>
        <section class="panel settings-card"><div class="settings-card-heading"><div><h2>Page visibility</h2><p>Choose what supporters can see on your public page.</p></div></div><div class="toggle-row"><div class="toggle-copy"><strong>Show recent verified support</strong><span>Only approved messages are shown. UTRs are never public.</span></div><label class="toggle"><input type="checkbox" checked /><span class="toggle-track"></span></label></div><div class="toggle-row"><div class="toggle-copy"><strong>Allow custom support amount</strong><span>Supporters can enter an amount within your limits.</span></div><label class="toggle"><input type="checkbox" checked /><span class="toggle-track"></span></label></div></section>
      </div>
    </div>
  `;
}

function renderPublicPage() {
  const publicLink = `https://supportly.example/@${state.profile.username}`;
  const amountButtons = [20, 50, 100, 200].map((amount) => `<button class="amount-button ${!state.customAmount && state.selectedAmount === amount ? 'is-selected' : ''}" data-action="select-public-amount" data-amount="${amount}">${formatINR(amount)}</button>`).join('');
  return `
    ${renderPageHeader({ title: 'Public page', subtitle: 'This is the experience your supporters will see.', kicker: 'Live page preview', actions: `<button class="secondary-button" data-action="copy-link">${icon('copy')}Copy link</button><button class="primary-button" data-action="share-page">${icon('share')}Share page</button>` })}
    <div class="public-page-wrap">
      <div class="public-page-toolbar"><div class="public-url">${icon('external')}<span>Your page</span><strong>${escapeHtml(publicLink)}</strong></div><span class="profile-badge">${icon('check-circle')} Published</span></div>
      <div class="public-preview-grid">
        <section class="public-profile-card">
          <div class="public-profile-inner">
            <div class="profile-badge">${icon('check-circle')} Creator page</div>
            <div class="avatar avatar-lg avatar-purple">RP</div>
            <h1>${escapeHtml(state.profile.displayName)}</h1>
            <p class="profile-role">YouTube creator · @${escapeHtml(state.profile.username)}</p>
            <p class="profile-bio">${escapeHtml(state.profile.bio)}</p>
            <a class="youtube-button" href="${escapeHtml(state.profile.youtubeUrl)}" target="_blank" rel="noreferrer">${icon('youtube')}Visit YouTube channel ${icon('external', 'icon-xs')}</a>
            <div class="profile-divider"></div>
            <div class="support-heading"><h2>Support my work</h2><p>Choose an amount to continue securely with UPI.</p></div>
            <div class="amount-grid" role="group" aria-label="Support amount">${amountButtons}</div>
            <button class="custom-amount-button ${state.customAmount ? 'is-selected' : ''}" data-action="toggle-custom-amount">${icon('plus')}Enter a custom amount</button>
            <div class="custom-amount-input-wrap ${state.customAmount ? 'is-visible' : ''}"><span>₹</span><input id="public-custom-amount" type="number" min="20" max="5000" step="1" value="${state.customAmount ? escapeHtml(state.selectedAmount) : ''}" placeholder="Enter amount" aria-label="Custom support amount" /></div>
            <button class="primary-button support-button" data-action="start-support">Support ${formatINR(state.selectedAmount)}</button>
            <div class="upi-disclaimer">${icon('lock')}<span>Securely continue with UPI · No bank details required.</span></div>
            <div class="recent-support"><h3>Recent verified support</h3><div class="support-quote-list"><div class="support-quote"><div class="avatar avatar-sm avatar-teal">RS</div><div class="support-quote-copy"><p>“Keep creating! Your tutorials are great.”</p><span>Rahul · ${formatINR(100)}</span></div></div><div class="support-quote"><div class="avatar avatar-sm avatar-orange">AS</div><div class="support-quote-copy"><p>“The clean coding videos helped a lot.”</p><span>Aditi · ${formatINR(50)}</span></div></div></div></div>
            <div class="public-powered">Powered by supportly · Payments are made directly to the creator's UPI ID.</div>
          </div>
        </section>
        <div class="public-side-column"><section class="page-info-card"><h2>Share your short link</h2><p>Add this to your video descriptions, pinned comments, and community posts.</p><div class="public-link-box"><span>${escapeHtml(publicLink)}</span><button class="copy-button" aria-label="Copy public link" data-action="copy-link">${icon('copy')}</button></div><div class="info-list"><div class="info-list-row"><span>Page status</span><strong>Published</strong></div><div class="info-list-row"><span>Support currency</span><strong>INR only</strong></div><div class="info-list-row"><span>Payment method</span><strong>UPI direct</strong></div></div></section><section class="security-card"><div class="security-header"><span class="security-icon">${icon('shield')}</span><h2>Trust, by design</h2></div><p>Your supporters see a simple handoff. You remain in control of verification.</p><div class="security-points"><div class="security-point">${icon('check-circle')}No bank details collected</div><div class="security-point">${icon('check-circle')}UTRs stay private</div><div class="security-point">${icon('check-circle')}Pending until reviewed</div></div></section></div>
      </div>
    </div>
  `;
}

function getSupportAmountFromPublic() {
  if (!state.customAmount) return state.selectedAmount;
  const value = Number(document.getElementById('public-custom-amount')?.value || state.selectedAmount);
  if (!Number.isFinite(value) || value < 20 || value > 5000) return null;
  return Math.round(value);
}

function renderStepper(step) {
  const labels = ['Amount', 'Pay with UPI', 'Confirm', 'Submitted'];
  return `<div class="stepper">${labels.map((label, index) => { const number = index + 1; const className = number < step ? 'is-done' : number === step ? 'is-active' : ''; return `<div class="step-item ${className}"><span class="step-number">${number < step ? icon('check', 'icon-xs') : number}</span><span>${label}</span></div>${number < labels.length ? '<span class="step-line"></span>' : ''}`; }).join('')}</div>`;
}

function renderSupportModal() {
  const modal = state.modal;
  if (!modal) return '';
  if (modal.step === 1) {
    return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="support-modal-title"><button class="icon-button modal-close" aria-label="Close" data-action="close-modal">${icon('close')}</button><div class="modal-header"><div class="modal-eyebrow">Support ${escapeHtml(state.profile.displayName)}</div><h2 id="support-modal-title">Choose your support amount</h2><p>Your support goes directly to the creator's UPI account. This preview does not move money.</p></div>${renderStepper(1)}<form class="modal-form" id="support-amount-form"><div class="amount-grid">${[20, 50, 100, 200].map((amount) => `<button type="button" class="amount-button ${modal.amount === amount && !modal.custom ? 'is-selected' : ''}" data-action="select-modal-amount" data-amount="${amount}">${formatINR(amount)}</button>`).join('')}</div><button type="button" class="custom-amount-button ${modal.custom ? 'is-selected' : ''}" data-action="toggle-modal-custom">${icon('plus')}Enter a different amount</button><div class="custom-amount-input-wrap ${modal.custom ? 'is-visible' : ''}"><span>₹</span><input id="modal-custom-amount" type="number" min="20" max="5000" step="1" value="${modal.custom ? escapeHtml(modal.amount) : ''}" placeholder="20 – 5,000" aria-label="Custom amount" /></div><button class="primary-button button-wide" type="submit">Continue with ${formatINR(modal.amount)} ${icon('arrow-right')}</button></form><div class="payment-safety">${icon('shield')}<span>Payments are made directly to the creator's UPI ID. No bank account, card, or net-banking details are collected.</span></div></section></div>`;
  }

  if (modal.step === 2) {
    const upiUri = `upi://pay?pa=${encodeURIComponent(state.profile.upiId)}&pn=${encodeURIComponent(state.profile.displayName)}&am=${encodeURIComponent(modal.amount)}&cu=INR`;
    return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="upi-modal-title"><button class="icon-button modal-close" aria-label="Close" data-action="close-modal">${icon('close')}</button><div class="modal-header"><div class="modal-eyebrow">Step 2 of 4</div><h2 id="upi-modal-title">Continue with UPI</h2><p>Use a UPI app to send the exact amount to the creator. After paying, return here and submit your UTR for review.</p></div>${renderStepper(2)}<div class="modal-amount-summary"><span>Support amount</span><strong>${formatINR(modal.amount)}</strong></div><div class="upi-recipient"><span class="upi-symbol">U</span><div><strong>${escapeHtml(state.profile.displayName)}</strong><span>Receiving directly in creator's UPI account</span></div></div><div class="upi-id-row"><span>UPI ID</span><strong>${escapeHtml(state.profile.upiId)}</strong></div>${modal.showQr ? `<div class="qr-panel"><div class="qr-art" aria-label="Illustrative QR preview">${renderQrCells()}</div><p>Illustrative QR preview for this static build. Connect a trusted QR generator in production.</p></div>` : ''}<div class="modal-action-row">${modal.showQr ? `<button class="secondary-button" data-action="hide-qr">${icon('arrow-left')}Back</button>` : `<button class="secondary-button" data-action="show-qr">${icon('qr')}Show QR</button>`}<a class="primary-button" href="${upiUri}" data-action="open-upi">${icon('external')}Open UPI app</a></div><div class="modal-action-row"><button class="ghost-button button-wide" data-action="payment-complete">I have completed the payment ${icon('arrow-right')}</button></div></section></div>`;
  }

  if (modal.step === 3) {
    return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="utr-modal-title"><button class="icon-button modal-close" aria-label="Close" data-action="close-modal">${icon('close')}</button><div class="modal-header"><div class="modal-eyebrow">Step 3 of 4</div><h2 id="utr-modal-title">Tell the creator about your payment</h2><p>Submit the UTR or transaction ID from your UPI app. Entering it does not automatically verify the payment.</p></div>${renderStepper(3)}<div class="modal-amount-summary"><span>Supporting ${escapeHtml(state.profile.displayName)}</span><strong>${formatINR(modal.amount)}</strong></div><form class="modal-form" id="utr-form"><label class="form-field"><span class="form-label">UTR / Transaction ID <span class="required">*</span></span><input class="form-control" name="utr" required minlength="6" maxlength="40" autocomplete="off" placeholder="Enter the ID from your UPI app" /><p class="form-helper">Usually a 6–40 character number or reference. Keep it private.</p></label><label class="form-field"><span class="form-label">Your name <span class="optional">Optional</span></span><input class="form-control" name="supporterName" maxlength="60" placeholder="How should the creator thank you?" /></label><label class="form-field"><span class="form-label">Message <span class="optional">Optional</span></span><textarea class="form-control" name="message" maxlength="180" placeholder="Leave a short note"></textarea></label><button class="primary-button button-wide" type="submit">Submit payment details ${icon('arrow-right')}</button></form><div class="payment-safety">${icon('lock')}<span>Your UTR is shared only for review. It will not appear on the public creator page.</span></div></section></div>`;
  }

  return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="success-modal-title"><button class="icon-button modal-close" aria-label="Close" data-action="close-modal">${icon('close')}</button><div class="success-panel"><div class="success-icon">${icon('check-circle')}</div><h2 id="success-modal-title">Payment submitted</h2><p>Your support details have been sent to ${escapeHtml(state.profile.displayName)} for review.</p><div class="support-id-card"><span>Support ID</span><strong>${escapeHtml(modal.supportId)}</strong></div><div class="pending-message">${icon('clock')}<span><strong>Pending verification.</strong> A UTR submission does not itself prove that money was received. The creator or permitted reviewer must review the transaction information.</span></div><button class="primary-button button-wide" data-action="close-and-payments">View payment status ${icon('arrow-right')}</button><button class="ghost-button button-wide" data-action="close-modal">Done</button></div></section></div>`;
}

function renderQrCells() {
  const pattern = [
    '1111111001101',
    '1000001010011',
    '1011101011101',
    '1011101010001',
    '1011101010111',
    '1000001010100',
    '1111111010101',
    '0000000011010',
    '1101111110111',
    '0010100010001',
    '1110111011101',
    '1001001000100',
    '1011111011111',
  ];
  return pattern.flatMap((row) => [...row].map((cell) => `<span class="qr-cell ${cell === '1' ? '' : 'blank'}"></span>`)).join('');
}

function renderInfoModal(title, eyebrow, body, list = []) {
  return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="info-modal-title"><button class="icon-button modal-close" aria-label="Close" data-action="close-modal">${icon('close')}</button><div class="modal-header"><div class="modal-eyebrow">${escapeHtml(eyebrow)}</div><h2 id="info-modal-title">${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p></div>${list.length ? `<div class="demo-note-list">${list.map((item) => `<div class="demo-note-item">${icon(item.icon || 'check-circle')}<span>${escapeHtml(item.text)}</span></div>`).join('')}</div>` : ''}<div class="modal-action-row"><button class="primary-button button-wide" data-action="close-modal">Got it</button></div></section></div>`;
}

function renderPaymentModal(payment) {
  const canReview = payment.status === 'PENDING' || payment.status === 'FLAGGED';
  return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal-card wide" role="dialog" aria-modal="true" aria-labelledby="payment-detail-title"><button class="icon-button modal-close" aria-label="Close" data-action="close-modal">${icon('close')}</button><div class="modal-header"><div class="modal-eyebrow">Payment detail · ${escapeHtml(payment.id)}</div><h2 id="payment-detail-title">${escapeHtml(payment.supporter)}</h2><p>Review the submitted information and keep the server-confirmed status accurate.</p></div><div class="modal-amount-summary"><span>Submitted support</span><strong>${formatINR(payment.amount)}</strong></div><div class="info-list"><div class="info-list-row"><span>Current status</span><strong>${statusBadge(payment.status, true)}</strong></div><div class="info-list-row"><span>UTR / transaction ID</span><strong class="masked-utr">${escapeHtml(payment.utr)}</strong></div><div class="info-list-row"><span>Submitted</span><strong>${escapeHtml(payment.date)}</strong></div><div class="info-list-row"><span>Message</span><strong>${escapeHtml(payment.message || 'No message')}</strong></div>${payment.verifiedAt ? `<div class="info-list-row"><span>Reviewed</span><strong>${escapeHtml(payment.verifiedAt)} by ${escapeHtml(payment.verifiedBy || 'creator')}</strong></div>` : ''}${payment.rejectionReason ? `<div class="info-list-row"><span>Review note</span><strong>${escapeHtml(payment.rejectionReason)}</strong></div>` : ''}</div>${canReview ? `<div class="modal-action-row"><button class="danger-button" data-action="reject-payment" data-payment-id="${escapeHtml(payment.id)}">${icon('close')}Reject</button><button class="secondary-button" data-action="flag-payment" data-payment-id="${escapeHtml(payment.id)}">${icon('flag')}Flag</button><button class="primary-button" data-action="verify-payment" data-payment-id="${escapeHtml(payment.id)}">${icon('check')}Verify</button></div>` : `<div class="payment-safety">${icon(payment.status === 'VERIFIED' ? 'check-circle' : 'flag')}<span>${payment.status === 'VERIFIED' ? 'This submission is marked verified after review. A verified status is not generated by UTR entry alone.' : 'This submission is not currently available for a normal verification action.'}</span></div>`}</section></div>`;
}

function renderModal() {
  if (!state.modal) {
    modalRoot.innerHTML = '';
    return;
  }
  if (state.modal.type === 'support') modalRoot.innerHTML = renderSupportModal();
  if (state.modal.type === 'info') modalRoot.innerHTML = renderInfoModal(state.modal.title, state.modal.eyebrow, state.modal.body, state.modal.list);
  if (state.modal.type === 'payment') {
    const payment = state.payments.find((item) => item.id === state.modal.paymentId);
    modalRoot.innerHTML = payment ? renderPaymentModal(payment) : '';
  }
}

function navigate(view) {
  if (!Object.prototype.hasOwnProperty.call(viewMeta, view)) return;
  state.view = view;
  closeSidebar();
  if (window.location.hash !== `#${view}`) window.history.replaceState(null, '', `#${view}`);
  renderApp();
}

function openSupportModal() {
  state.modal = { type: 'support', step: 1, amount: state.selectedAmount, custom: false, showQr: false };
  renderModal();
}

function closeModal() {
  state.modal = null;
  renderModal();
}

function showInfoModal(title, eyebrow, body, list) {
  state.modal = { type: 'info', title, eyebrow, body, list };
  renderModal();
}

function normalizeUtr(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function maskUtr(value) {
  const normalized = normalizeUtr(value);
  return normalized.length > 4 ? `•••• ${normalized.slice(-4)}` : '••••';
}

function makeSupportId() {
  return `SUP-${Math.random().toString(36).slice(2, 8).toUpperCase()}${Math.floor(Math.random() * 9)}`;
}

function showToast(title, message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icon(type === 'error' ? 'close' : type === 'success' ? 'check-circle' : 'help')}</span><span class="toast-copy"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span></span>`;
  toastRegion.appendChild(toast);
  window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(7px)';
    window.setTimeout(() => toast.remove(), 180);
  }, 3800);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    helper.select();
    document.execCommand('copy');
    helper.remove();
  }
}

async function sharePage() {
  const url = `https://supportly.example/@${state.profile.username}`;
  const shareData = { title: `Support ${state.profile.displayName}`, text: `Support ${state.profile.displayName} on UPI`, url };
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  await copyText(url);
  showToast('Link copied', 'Your short support link is ready to share.');
}

function closeSidebar() {
  sidebar.classList.remove('is-open');
  sidebarScrim.classList.remove('is-visible');
}

function openSidebar() {
  sidebar.classList.add('is-open');
  sidebarScrim.classList.add('is-visible');
}

function changePaymentStatus(paymentId, nextStatus) {
  const payment = state.payments.find((item) => item.id === paymentId);
  if (!payment || payment.status === nextStatus) return;
  const previous = payment.status;
  payment.status = nextStatus;
  payment.verifiedAt = nextStatus === 'VERIFIED' ? 'Just now' : undefined;
  payment.verifiedBy = nextStatus === 'VERIFIED' ? 'You' : undefined;
  payment.rejectionReason = nextStatus === 'REJECTED' ? 'The submitted transaction details could not be matched during review.' : undefined;

  if (previous === 'PENDING') state.metrics.pendingSubmissions = Math.max(0, state.metrics.pendingSubmissions - 1);
  if (nextStatus === 'PENDING') state.metrics.pendingSubmissions += 1;
  if (previous !== 'VERIFIED' && nextStatus === 'VERIFIED') {
    state.metrics.verifiedPayments += 1;
    state.metrics.verifiedAmount += payment.amount;
  }
  if (previous === 'VERIFIED' && nextStatus !== 'VERIFIED') {
    state.metrics.verifiedPayments = Math.max(0, state.metrics.verifiedPayments - 1);
    state.metrics.verifiedAmount = Math.max(0, state.metrics.verifiedAmount - payment.amount);
  }
}

function handleClick(event) {
  const viewTarget = event.target.closest('[data-view]');
  if (viewTarget) {
    navigate(viewTarget.dataset.view);
    return;
  }

  const actionTarget = event.target.closest('[data-action]');
  if (!actionTarget) return;
  const action = actionTarget.dataset.action;

  if (action === 'open-sidebar') return openSidebar();
  if (action === 'close-sidebar') return closeSidebar();
  if (action === 'close-modal') return closeModal();
  if (action === 'backdrop-close' && event.target === actionTarget) return closeModal();
  if (action === 'open-demo-note') {
    return showInfoModal('A focused front-end preview', 'Preview mode', 'This build turns the product brief into a polished, dependency-free HTML experience. It demonstrates the creator dashboard, public support page, UPI handoff, UTR submission, and review states without moving real money.', [
      { icon: 'check-circle', text: 'Interactive support flow: amount → UPI handoff → UTR submission → pending status.' },
      { icon: 'shield', text: 'The interface never calls a UTR automatically verified. Review actions are clearly separate.' },
      { icon: 'file', text: 'For production, connect Firebase Auth, Realtime Database, App Check, server-side validation, and secure rules.' },
    ]);
  }
  if (action === 'open-guide') {
    return showInfoModal('Start with the essential loop', 'Getting started', 'A creator only needs three things to begin: a clear page, a verified UPI ID, and a link shared where their audience already watches.', [
      { icon: 'check-circle', text: 'Complete your profile and add your YouTube channel.' },
      { icon: 'share', text: 'Copy your short link into video descriptions and pinned comments.' },
      { icon: 'wallet', text: 'Review every pending submission before changing its status.' },
    ]);
  }
  if (action === 'notifications') {
    return showInfoModal('Notifications', 'Inbox', 'Your workspace is up to date.', [{ icon: 'check-circle', text: 'No new alerts. Pending payment submissions are waiting in Payments.' }]);
  }
  if (action === 'account-menu') {
    return showInfoModal('Creator account', 'Ritam Paine', 'This static preview keeps the session local to your browser.', [{ icon: 'shield', text: 'No account credentials or payment secrets are stored by this prototype.' }]);
  }
  if (action === 'logout') return showToast('Demo session', 'Sign out is disabled in the static preview.', 'info');
  if (action === 'share-page') return sharePage();
  if (action === 'copy-link') {
    copyText(`https://supportly.example/@${state.profile.username}`);
    return showToast('Link copied', 'Your public support link is on the clipboard.');
  }
  if (action === 'select-public-amount') {
    state.customAmount = false;
    state.selectedAmount = Number(actionTarget.dataset.amount);
    return renderApp();
  }
  if (action === 'toggle-custom-amount') {
    state.customAmount = !state.customAmount;
    if (state.customAmount && !state.selectedAmount) state.selectedAmount = 100;
    return renderApp();
  }
  if (action === 'start-support') {
    const amount = getSupportAmountFromPublic();
    if (!amount) return showToast('Choose a valid amount', 'Enter an amount between ₹20 and ₹5,000.', 'error');
    state.selectedAmount = amount;
    return openSupportModal();
  }
  if (action === 'select-modal-amount') {
    state.modal.amount = Number(actionTarget.dataset.amount);
    state.modal.custom = false;
    return renderModal();
  }
  if (action === 'toggle-modal-custom') {
    state.modal.custom = !state.modal.custom;
    return renderModal();
  }
  if (action === 'show-qr') {
    state.modal.showQr = true;
    return renderModal();
  }
  if (action === 'hide-qr') {
    state.modal.showQr = false;
    return renderModal();
  }
  if (action === 'open-upi') {
    showToast('UPI handoff ready', 'On a supported mobile device, your UPI app can open from this link.');
    return;
  }
  if (action === 'payment-complete') {
    state.modal.step = 3;
    state.modal.showQr = false;
    return renderModal();
  }
  if (action === 'close-and-payments') {
    closeModal();
    return navigate('payments');
  }
  if (action === 'open-payment') {
    state.modal = { type: 'payment', paymentId: actionTarget.dataset.paymentId };
    return renderModal();
  }
  if (action === 'verify-payment' || action === 'reject-payment' || action === 'flag-payment') {
    const next = action === 'verify-payment' ? 'VERIFIED' : action === 'reject-payment' ? 'REJECTED' : 'FLAGGED';
    changePaymentStatus(actionTarget.dataset.paymentId, next);
    const title = next === 'VERIFIED' ? 'Payment verified' : next === 'REJECTED' ? 'Payment rejected' : 'Payment flagged';
    const message = next === 'VERIFIED' ? 'The submission is now marked verified after your review.' : next === 'REJECTED' ? 'The submission remains private and is marked rejected.' : 'The submission is highlighted for additional review.';
    showToast(title, message, next === 'REJECTED' ? 'info' : 'success');
    renderApp();
    return renderModal();
  }
  if (action === 'filter-payments') {
    state.filter = actionTarget.dataset.filter;
    return renderApp();
  }
  if (action === 'export-payments') return showToast('Export preview', 'Connect this action to a trusted server-side export in production.', 'info');
  if (action === 'analytics-period') return showToast('Date range', 'The static preview is showing the last 30 days.', 'info');
  if (action === 'change-avatar') return showToast('Profile photo', 'Connect Firebase Storage or another trusted upload service before production.', 'info');
  if (action === 'discard-settings') return renderApp();
}

function handleSubmit(event) {
  if (event.target.id === 'support-amount-form') {
    event.preventDefault();
    const customInput = document.getElementById('modal-custom-amount');
    const amount = state.modal.custom ? Number(customInput?.value) : state.modal.amount;
    if (!Number.isFinite(amount) || amount < 20 || amount > 5000) return showToast('Choose a valid amount', 'Enter an amount between ₹20 and ₹5,000.', 'error');
    state.modal.amount = Math.round(amount);
    state.modal.step = 2;
    state.modal.custom = false;
    return renderModal();
  }

  if (event.target.id === 'utr-form') {
    event.preventDefault();
    const form = new FormData(event.target);
    const rawUtr = String(form.get('utr') || '').trim();
    const normalizedUtr = normalizeUtr(rawUtr);
    if (normalizedUtr.length < 6 || normalizedUtr.length > 40) return showToast('Check the UTR', 'Enter a 6–40 character transaction reference.', 'error');
    const duplicate = state.payments.some((payment) => payment.normalizedUtr && payment.normalizedUtr === normalizedUtr);
    if (duplicate) return showToast('Duplicate transaction reference', 'This UTR is already associated with a submission. Please check the ID.', 'error');
    const supporterName = String(form.get('supporterName') || '').trim() || 'Anonymous supporter';
    const payment = {
      id: makeSupportId(),
      supporter: supporterName,
      initials: supporterName === 'Anonymous supporter' ? 'AN' : supporterName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
      avatar: 'avatar-purple',
      amount: state.modal.amount,
      date: 'Just now',
      shortDate: 'Just now',
      utr: maskUtr(rawUtr),
      normalizedUtr,
      status: 'PENDING',
      message: String(form.get('message') || '').trim() || 'No message',
      isNew: true,
    };
    state.payments.unshift(payment);
    state.metrics.pendingSubmissions += 1;
    state.modal.supportId = payment.id;
    state.modal.step = 4;
    showToast('Submission received', 'Your payment details are pending review.', 'success');
    return renderModal();
  }

  if (event.target.id === 'profile-form') {
    event.preventDefault();
    const form = new FormData(event.target);
    const username = String(form.get('username') || '').trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,24}$/.test(username)) return showToast('Check your username', 'Use 3–24 lowercase letters, numbers, underscores, or hyphens.', 'error');
    const youtubeUrl = String(form.get('youtubeUrl') || '').trim();
    if (youtubeUrl && !/^https?:\/\/(www\.)?youtube\.com\//i.test(youtubeUrl)) return showToast('Check your YouTube URL', 'Use a valid youtube.com channel link.', 'error');
    state.profile.displayName = String(form.get('displayName') || '').trim() || state.profile.displayName;
    state.profile.username = username;
    state.profile.bio = String(form.get('bio') || '').trim();
    state.profile.youtubeChannelName = String(form.get('youtubeChannelName') || '').trim();
    state.profile.youtubeUrl = youtubeUrl || state.profile.youtubeUrl;
    showToast('Profile saved', 'Your public preview now reflects the changes.');
    return renderApp();
  }
}

function handleInput(event) {
  if (event.target.matches('[data-action="search"]')) {
    if (event.target.value.trim().length > 1) showToast('Search preview', 'Search is ready to connect to your creator data.', 'info');
  }
}

function handleChange(event) {
  if (event.target.matches('[data-action="sort-payments"]')) {
    state.sort = event.target.value;
    renderApp();
  }
}

document.addEventListener('click', handleClick);
document.addEventListener('submit', handleSubmit);
document.addEventListener('input', handleInput);
document.addEventListener('change', handleChange);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.modal) closeModal();
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    document.querySelector('[data-action="search"]')?.focus();
  }
});
window.addEventListener('hashchange', () => {
  const next = readHashView();
  if (next !== state.view) {
    state.view = next;
    closeSidebar();
    renderApp();
  }
});

renderApp();

if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

window.addEventListener('offline', () => showToast('You are offline', 'Payment submissions must not silently succeed while offline.', 'error'));
window.addEventListener('online', () => showToast('Back online', 'You can continue using the public page and dashboard.', 'success'));
