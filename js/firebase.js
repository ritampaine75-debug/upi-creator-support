import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js';
import { getFunctions } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js';
import { APP_CHECK_SITE_KEY, FUNCTIONS_REGION, firebaseConfig } from './config.js';

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const functions = getFunctions(app, FUNCTIONS_REGION);

let appCheckInstance = null;

export async function initializeOptionalAppCheck() {
  if (appCheckInstance || !APP_CHECK_SITE_KEY) return appCheckInstance;
  try {
    const { initializeAppCheck, ReCaptchaV3Provider } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-check.js');
    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(APP_CHECK_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
    return appCheckInstance;
  } catch (error) {
    console.warn('Firebase App Check could not be initialized.', error);
    return null;
  }
}
