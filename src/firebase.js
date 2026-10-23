import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Read Firebase configuration from Vite environment variables without hardcoding
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'dimlog-d0f35.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'dimlog-d0f35',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://dimlog-d0f35-default-rtdb.firebaseio.com/',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1010607869915:web:9bcfd6f5a74761a8dba1fe',
};

let app;
let rtdb = null;
let firestore = null;
let auth = null;
let googleProvider = null;

try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }

  // Active Realtime Database for dimlog-d0f35
  rtdb = getDatabase(app, firebaseConfig.databaseURL);
  
  // Initialize Auth
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();

  // Optional Firestore instance if enabled in Google Cloud
  try {
    firestore = getFirestore(app);
  } catch (fErr) {
    console.warn('[Firestore Notice] Firestore not enabled, falling back to Realtime Database:', fErr);
  }
} catch (error) {
  console.error('[Firebase Init Error]:', error);
}

/**
 * Creates a secondary Firebase App instance for admin user creation
 * without signing out the currently logged in admin.
 */
export function createSecondaryAuth() {
  const secondaryAppName = `secondary-auth-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);
  return {
    secondaryApp,
    secondaryAuth,
    cleanup: async () => {
      try {
        await deleteApp(secondaryApp);
      } catch (err) {
        console.warn('Failed to delete secondary app:', err);
      }
    }
  };
}

export { app, rtdb as db, rtdb, firestore, auth, googleProvider };
export default rtdb;

