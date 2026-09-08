import { listenToNotifications, markAllNotificationsRead, markNotificationRead } from './database.js';

export function subscribeNotifications(uid, callback, onError) {
  return listenToNotifications(uid, callback, onError);
}

export function unreadNotifications(notifications = []) {
  return notifications.filter((notification) => notification.read !== true).length;
}

export function markOneRead(uid, notificationId) {
  return markNotificationRead(uid, notificationId);
}

export function markEverythingRead(uid, notifications) {
  return markAllNotificationsRead(uid, notifications);
}
