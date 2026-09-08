import { getCreatorAnalytics, recordProfileView } from './database.js';

export async function loadAnalytics(uid) {
  return getCreatorAnalytics(uid);
}

export async function trackPublicProfileView(uid, username) {
  try {
    await recordProfileView({ creatorId: uid, username });
  } catch (error) {
    // Analytics must never block a public profile or a payment flow.
    console.warn('Profile view could not be recorded.', error);
  }
}
