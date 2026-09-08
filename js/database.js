import { httpsCallable } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js';
import {
  equalTo,
  get,
  limitToLast,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  runTransaction,
  set,
  update,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js';
import { db, functions } from './firebase.js';
import { sha256 } from './security.js';

export function pathRef(path) {
  return ref(db, path.replace(/^\/+/, ''));
}

export async function getPath(path) {
  const snapshot = await get(pathRef(path));
  return snapshot.exists() ? snapshot.val() : null;
}

export async function upsertUserRecord(user) {
  if (!user) return null;
  const userRef = pathRef(`users/${user.uid}`);
  const snapshot = await get(userRef);
  const existing = snapshot.exists() ? snapshot.val() : {};
  const record = {
    displayName: user.displayName || existing.displayName || 'Creator',
    email: user.email || existing.email || '',
    photoURL: user.photoURL || existing.photoURL || '',
    role: existing.role || 'creator',
    provider: user.providerData?.[0]?.providerId === 'google.com' ? 'google' : existing.provider || 'password',
    createdAt: existing.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  await update(userRef, record);
  return record;
}

export async function getUserRecord(uid) {
  return getPath(`users/${uid}`);
}

export async function getUsernameOwner(username) {
  return getPath(`usernames/${username}`);
}

export async function getCreator(uid) {
  return getPath(`creators/${uid}`);
}

export async function getCreatorByUsername(username) {
  const owner = await getUsernameOwner(username);
  if (!owner?.uid) return null;
  const creator = await getCreator(owner.uid);
  if (!creator) return null;
  return { ...creator, uid: owner.uid };
}

export async function saveCreatorProfile(profile) {
  const callable = httpsCallable(functions, 'saveCreatorProfile');
  const result = await callable(profile);
  return result.data;
}

export async function submitPayment(payload) {
  const callable = httpsCallable(functions, 'submitPayment');
  const result = await callable(payload);
  return result.data;
}

export async function reviewPayment(payload) {
  const callable = httpsCallable(functions, 'reviewPayment');
  const result = await callable(payload);
  return result.data;
}

export async function createReport(payload) {
  const callable = httpsCallable(functions, 'createReport');
  const result = await callable(payload);
  return result.data;
}

export async function recordProfileView(payload) {
  const callable = httpsCallable(functions, 'recordProfileView');
  const result = await callable(payload);
  return result.data;
}

export async function getPayment(paymentId) {
  return getPath(`payments/${paymentId}`);
}

export function subscribeCreatorPayments(uid, callback, onError = () => {}) {
  const indexReference = pathRef(`creatorPayments/${uid}`);
  let sequence = 0;
  return onValue(indexReference, async (indexSnapshot) => {
    const currentSequence = ++sequence;
    const index = indexSnapshot.exists() ? indexSnapshot.val() : {};
    const ids = Object.keys(index);
    try {
      const records = await Promise.all(ids.map(async (paymentId) => {
        const payment = await getPayment(paymentId);
        return payment ? { ...payment, id: paymentId } : null;
      }));
      if (currentSequence !== sequence) return;
      callback(records.filter(Boolean).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)));
    } catch (error) {
      onError(error);
    }
  }, onError);
}

export async function getCreatorPayments(uid) {
  return new Promise((resolve, reject) => {
    let stop;
    stop = subscribeCreatorPayments(uid, (payments) => {
      stop?.();
      resolve(payments);
    }, reject);
  });
}

export async function getCreatorAnalytics(uid) {
  const analytics = await getPath(`analytics/${uid}`);
  return analytics || { profileViews: 0, supportPageViews: 0, supportAttempts: 0, submittedPayments: 0, verifiedPayments: 0, rejectedPayments: 0, verifiedAmount: 0, totalSubmittedAmount: 0 };
}

export function listenToNotifications(uid, callback, onError = () => {}) {
  return onValue(pathRef(`notifications/${uid}`), (snapshot) => {
    const raw = snapshot.exists() ? snapshot.val() : {};
    const notifications = Object.entries(raw).map(([id, item]) => ({ id, ...item })).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    callback(notifications);
  }, onError);
}

export async function markNotificationRead(uid, notificationId) {
  await update(pathRef(`notifications/${uid}/${notificationId}`), { read: true });
}

export async function markAllNotificationsRead(uid, notifications) {
  const updates = {};
  for (const notification of notifications) updates[`notifications/${uid}/${notification.id}/read`] = true;
  if (Object.keys(updates).length) await update(pathRef('/'), updates);
}

export async function getAdminProfile(uid) {
  return getPath(`admins/${uid}`);
}

export async function saveReportDirectFallback(payload) {
  // Used only for the public report form if callable functions are unavailable.
  // The production rules accept only a reporter-owned OPEN report.
  const reportRef = push(pathRef('reports'));
  const report = {
    ...payload,
    reporterUid: payload.reporterUid || null,
    status: 'OPEN',
    createdAt: Date.now(),
  };
  await set(reportRef, report);
  return { id: reportRef.key, ...report };
}

export async function reserveUtrFallback(rawUtr, paymentId) {
  const hash = await sha256(rawUtr.toUpperCase().replace(/[^A-Z0-9]/g, ''));
  const transaction = await runTransaction(pathRef(`utrIndex/${hash}`), (current) => current || { paymentId, createdAt: Date.now() });
  if (!transaction.committed || transaction.snapshot.val()?.paymentId !== paymentId) throw Object.assign(new Error('Duplicate UTR'), { code: 'functions/already-exists' });
  return hash;
}

export function queryPaymentsByCreator(uid) {
  return query(pathRef('payments'), orderByChild('creatorId'), equalTo(uid), limitToLast(100));
}
