import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { auth } from './firebase.js';
import { isMobileDevice } from './utils.js';
import { upsertUserRecord } from './database.js';

let redirectResultHandled = false;

export async function initializeAuth() {
  await setPersistence(auth, browserLocalPersistence);
  if (!redirectResultHandled) {
    redirectResultHandled = true;
    try {
      await getRedirectResult(auth);
    } catch (error) {
      console.warn('Google redirect result could not be read.', error);
    }
  }
}

export function subscribeAuth(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        await upsertUserRecord(user);
      } catch (error) {
        console.warn('User record could not be synchronized.', error);
      }
    }
    callback(user);
  });
}

export async function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function createEmailAccount({ email, password, displayName }) {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (displayName?.trim()) await updateProfile(credential.user, { displayName: displayName.trim() });
  await upsertUserRecord(auth.currentUser);
  return credential.user;
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    const shouldRedirect = isMobileDevice() || ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(error?.code);
    if (shouldRedirect) {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw error;
  }
}

export function signOut() {
  return firebaseSignOut(auth);
}

export function sendPasswordReset(email) {
  return sendPasswordResetEmail(auth, email.trim());
}

export { auth };
