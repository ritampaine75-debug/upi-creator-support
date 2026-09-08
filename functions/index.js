const crypto = require('node:crypto');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');

initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10, timeoutSeconds: 30 });

const db = getDatabase();
const APP_CHECK_REQUIRED = process.env.ENFORCE_APP_CHECK === 'true';
const RESERVED_USERNAMES = new Set(['admin', 'administrator', 'api', 'about', 'analytics', 'auth', 'dashboard', 'discover', 'forgot-password', 'help', 'login', 'payments', 'payment', 'privacy', 'settings', 'signup', 'support', 'terms', 'notifications', 'system', 'supportly', 'www']);

function requireAuth(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'You must be signed in to perform this action.');
  if (APP_CHECK_REQUIRED && !request.app) throw new HttpsError('failed-precondition', 'App Check is required for this operation.');
  return request.auth.uid;
}

function verifyAppCheck(request) {
  if (APP_CHECK_REQUIRED && !request.app) throw new HttpsError('failed-precondition', 'App Check is required for this operation.');
}

function cleanText(value, max) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function validateUsername(value) {
  const username = cleanText(value, 24).toLowerCase();
  if (!/^[a-z0-9_-]{3,24}$/.test(username) || RESERVED_USERNAMES.has(username)) throw new HttpsError('invalid-argument', 'That username is invalid or reserved.');
  return username;
}

function validateUpi(value) {
  const upiId = cleanText(value, 256).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,255}@[a-z0-9][a-z0-9.-]{1,126}$/.test(upiId)) throw new HttpsError('invalid-argument', 'Enter a valid UPI ID.');
  return upiId;
}

function validateYoutube(value) {
  const valueString = cleanText(value, 240);
  if (!valueString) return '';
  try {
    const url = new URL(valueString);
    if (url.protocol !== 'https:' || !['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname.toLowerCase())) throw new Error('invalid');
    return url.href;
  } catch {
    throw new HttpsError('invalid-argument', 'Enter a valid HTTPS YouTube URL.');
  }
}

function normalizeUtr(value) {
  const raw = cleanText(value, 40);
  const normalized = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalized.length < 6 || normalized.length > 40 || /^(.)\1+$/.test(normalized) || /^0+$/.test(normalized)) throw new HttpsError('invalid-argument', 'Enter a valid transaction reference.');
  return { raw, normalized };
}

function utrHash(normalized) {
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

function validateAmount(value) {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 20 || amount > 5000) throw new HttpsError('invalid-argument', 'Support amount must be an integer from ₹20 to ₹5,000.');
  return amount;
}

async function read(path) {
  const snapshot = await db.ref(path).once('value');
  return snapshot.exists() ? snapshot.val() : null;
}

async function isAdmin(uid) {
  const record = await read(`admins/${uid}`);
  return record?.isActive === true;
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

function notification({ type, title, message, paymentId = null }) {
  return { type, title, message, paymentId, read: false, createdAt: Date.now() };
}

function incrementAnalytics(creatorId, changes) {
  return db.ref(`analytics/${creatorId}`).transaction((current) => {
    const analytics = current || { profileViews: 0, supportPageViews: 0, supportAttempts: 0, submittedPayments: 0, verifiedPayments: 0, pendingPaymentCount: 0, rejectedPayments: 0, flaggedPayments: 0, verifiedAmount: 0, totalSubmittedAmount: 0 };
    for (const [key, change] of Object.entries(changes)) analytics[key] = Math.max(0, Number(analytics[key] || 0) + Number(change || 0));
    return analytics;
  });
}

exports.saveCreatorProfile = onCall(async (request) => {
  const uid = requireAuth(request);
  const input = request.data || {};
  const username = validateUsername(input.username);
  const displayName = cleanText(input.displayName, 80);
  if (!displayName) throw new HttpsError('invalid-argument', 'Display name is required.');
  const bio = cleanText(input.bio, 160);
  const avatar = String(input.avatar || '');
  if (avatar.length > 260000 || (avatar && !/^data:image\/(jpeg|png|webp);base64,/.test(avatar))) throw new HttpsError('invalid-argument', 'Profile image is invalid or too large.');
  const upiId = validateUpi(input.payment?.upiId);
  const youtube = input.youtube || {};
  const channelUrl = validateYoutube(youtube.channelUrl);
  const supportAmounts = [...new Set((Array.isArray(input.supportAmounts) ? input.supportAmounts : []).map(validateAmount))].slice(0, 6);
  if (!supportAmounts.length) throw new HttpsError('invalid-argument', 'Add at least one support amount.');
  const existingCreator = await read(`creators/${uid}`);
  const usernameRef = db.ref(`usernames/${username}`);
  const claim = await usernameRef.transaction((current) => current || { uid });
  if (!claim.committed || claim.snapshot.val()?.uid !== uid) throw new HttpsError('already-exists', 'That username is already taken.');
  if (existingCreator?.username && existingCreator.username !== username) {
    const oldOwner = await read(`usernames/${existingCreator.username}`);
    if (oldOwner?.uid === uid) await db.ref(`usernames/${existingCreator.username}`).remove();
  }
  const now = Date.now();
  const creator = {
    username,
    displayName,
    bio,
    avatar,
    youtube: { channelId: cleanText(youtube.channelId, 80), channelName: cleanText(youtube.channelName, 80), channelUrl },
    payment: { upiId, currency: 'INR' },
    supportAmounts,
    thankYouMessage: cleanText(input.thankYouMessage || 'Thank you for supporting my work!', 120),
    isPublic: input.isPublic !== false,
    showRecentSupport: input.showRecentSupport !== false,
    createdAt: existingCreator?.createdAt || now,
    updatedAt: now,
  };
  const updates = {};
  updates[`creators/${uid}`] = creator;
  updates[`usernames/${username}`] = { uid };
  updates[`users/${uid}/displayName`] = displayName;
  updates[`users/${uid}/role`] = 'creator';
  updates[`users/${uid}/updatedAt`] = now;
  await db.ref().update(updates);
  return { ...creator, uid };
});

exports.submitPayment = onCall(async (request) => {
  verifyAppCheck(request);
  const input = request.data || {};
  const creatorId = cleanText(input.creatorId, 128);
  const creator = await read(`creators/${creatorId}`);
  if (!creator || creator.isPublic === false) throw new HttpsError('not-found', 'This creator page is not available.');
  const amount = validateAmount(input.amount);
  const { raw, normalized } = normalizeUtr(input.utr);
  const hash = utrHash(normalized);
  const paymentId = randomId('PAY');
  const utrReservation = await db.ref(`utrIndex/${hash}`).transaction((current) => current || { paymentId, createdAt: Date.now() });
  if (!utrReservation.committed || utrReservation.snapshot.val()?.paymentId !== paymentId) throw new HttpsError('already-exists', 'This transaction reference has already been submitted.');
  const supporterId = request.auth?.uid || null;
  const payment = {
    creatorId,
    supporterId,
    supporterName: cleanText(input.supporterName || 'Anonymous supporter', 60) || 'Anonymous supporter',
    amount,
    currency: 'INR',
    utr: raw,
    status: 'pending',
    message: cleanText(input.message, 180),
    createdAt: Date.now(),
    verifiedAt: null,
    verifiedBy: null,
    rejectionReason: null,
  };
  const updates = {};
  updates[`payments/${paymentId}`] = payment;
  updates[`creatorPayments/${creatorId}/${paymentId}`] = true;
  if (supporterId) updates[`supporterPayments/${supporterId}/${paymentId}`] = true;
  const creatorNotification = db.ref(`notifications/${creatorId}`).push().key;
  updates[`notifications/${creatorId}/${creatorNotification}`] = notification({ type: 'new_payment', title: 'New support submission', message: `${payment.supporterName} submitted ${amount} INR for review.`, paymentId });
  if (supporterId) {
    const supporterNotification = db.ref(`notifications/${supporterId}`).push().key;
    updates[`notifications/${supporterId}/${supporterNotification}`] = notification({ type: 'payment_submitted', title: 'Payment submitted', message: `Your ${amount} INR support is pending review.`, paymentId });
  }
  await db.ref().update(updates);
  await incrementAnalytics(creatorId, { submittedPayments: 1, pendingPaymentCount: 1, totalSubmittedAmount: amount, supportAttempts: 0 });
  return { paymentId, status: 'pending' };
});

exports.reviewPayment = onCall(async (request) => {
  const uid = requireAuth(request);
  const paymentId = cleanText(request.data?.paymentId, 120);
  const nextStatus = cleanText(request.data?.status, 20).toLowerCase();
  if (!['verified', 'rejected', 'flagged'].includes(nextStatus)) throw new HttpsError('invalid-argument', 'Unsupported payment status.');
  const payment = await read(`payments/${paymentId}`);
  if (!payment) throw new HttpsError('not-found', 'Payment not found.');
  const admin = await isAdmin(uid);
  if (!admin && payment.creatorId !== uid) throw new HttpsError('permission-denied', 'You cannot review this payment.');
  const previous = String(payment.status || '').toLowerCase();
  if (!['pending', 'flagged'].includes(previous)) throw new HttpsError('failed-precondition', 'This payment is no longer reviewable.');
  const rejectionReason = cleanText(request.data?.rejectionReason, 240);
  if (nextStatus === 'rejected' && !rejectionReason) throw new HttpsError('invalid-argument', 'A rejection reason is required.');
  const now = Date.now();
  const update = {
    status: nextStatus,
    verifiedAt: nextStatus === 'verified' ? now : null,
    verifiedBy: nextStatus === 'verified' ? uid : null,
    rejectionReason: nextStatus === 'rejected' ? rejectionReason : null,
  };
  await db.ref(`payments/${paymentId}`).update(update);
  const notificationId = db.ref(`notifications/${payment.creatorId}`).push().key;
  const title = nextStatus === 'verified' ? 'Payment verified' : nextStatus === 'rejected' ? 'Payment rejected' : 'Payment flagged for review';
  const message = nextStatus === 'verified' ? `Your ${payment.amount} INR support was verified.` : nextStatus === 'rejected' ? 'Your support submission could not be verified.' : 'Your support submission needs additional review.';
  const updates = { [`notifications/${payment.creatorId}/${notificationId}`]: notification({ type: `payment_${nextStatus}`, title, message, paymentId }) };
  if (payment.supporterId) {
    const supporterNotificationId = db.ref(`notifications/${payment.supporterId}`).push().key;
    updates[`notifications/${payment.supporterId}/${supporterNotificationId}`] = notification({ type: `payment_${nextStatus}`, title, message, paymentId });
  }
  const auditId = db.ref('adminAuditLogs').push().key;
  updates[`adminAuditLogs/${auditId}`] = { adminId: uid, action: `payment_${nextStatus}`, targetId: paymentId, timestamp: now, metadata: { creatorId: payment.creatorId, previousStatus: previous, rejectionReason: rejectionReason || null } };
  await db.ref().update(updates);
  const changes = {};
  if (previous === 'pending') changes.pendingPaymentCount = -1;
  if (nextStatus === 'verified') { changes.verifiedPayments = 1; changes.verifiedAmount = payment.amount; }
  if (nextStatus === 'rejected') changes.rejectedPayments = 1;
  if (nextStatus === 'flagged') changes.flaggedPayments = 1;
  if (Object.keys(changes).length) await incrementAnalytics(payment.creatorId, changes);
  return { paymentId, status: nextStatus, verifiedBy: update.verifiedBy, verifiedAt: update.verifiedAt };
});

exports.recordProfileView = onCall(async (request) => {
  verifyAppCheck(request);
  const creatorId = cleanText(request.data?.creatorId, 128);
  const creator = await read(`creators/${creatorId}`);
  if (!creator || creator.isPublic === false) return { recorded: false };
  await incrementAnalytics(creatorId, { profileViews: 1, supportPageViews: 1 });
  return { recorded: true };
});

exports.createReport = onCall(async (request) => {
  const uid = requireAuth(request);
  const reportRef = db.ref('reports').push();
  const report = {
    reporterUid: uid,
    targetType: cleanText(request.data?.targetType, 30),
    targetId: cleanText(request.data?.targetId, 120),
    reason: cleanText(request.data?.reason, 80),
    description: cleanText(request.data?.description, 500),
    status: 'OPEN',
    createdAt: Date.now(),
    resolvedAt: null,
    resolvedBy: null,
  };
  await reportRef.set(report);
  return { id: reportRef.key };
});
