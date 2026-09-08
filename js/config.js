// Public Firebase web configuration. Firebase API keys identify a web app; they
// are not service-account secrets. Privileged operations live in Cloud Functions.
export const firebaseConfig = {
  apiKey: 'AIzaSyCChxWVg-w1TiertkXlUrfUgcC19y-CPNw',
  authDomain: 'hiiii-72d78.firebaseapp.com',
  databaseURL: 'https://hiiii-72d78-default-rtdb.firebaseio.com',
  projectId: 'hiiii-72d78',
  storageBucket: 'hiiii-72d78.firebasestorage.app',
  messagingSenderId: '560685164053',
  appId: '1:560685164053:web:7f672f7503160ec868901c',
};

// GitHub Pages repository deployment uses this path. For a custom domain at the
// domain root, change it to '/'. Keep the trailing slash.
export const BASE_PATH = window.SUPPORTLY_BASE_PATH || '/upi-creator-support/';
export const FUNCTIONS_REGION = 'us-central1';
export const APP_CHECK_SITE_KEY = window.SUPPORTLY_APP_CHECK_SITE_KEY || '';
export const SUPPORTLY_NAME = 'Supportly';

export function routeUrl(path = '') {
  const normalized = String(path).replace(/^\/+/, '');
  return `${BASE_PATH}${normalized}`;
}

export function assetUrl(path = '') {
  const normalized = String(path).replace(/^\/+/, '');
  return `${BASE_PATH}${normalized}`;
}
