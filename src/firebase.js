import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const STORAGE_API_KEY = 'voltlog-firebase-api-key';
export const DEFAULT_FIREBASE_API_KEY = 'AIzaSyA2U9TQPCUwj0X_fBqyEhHsf7rDd1QsjC0';

export function getStoredApiKey() {
  // 1. Primary source: Vite environment variable (Netlify / .env)
  const envKey = import.meta.env.VITE_FIREBASE_API_KEY;
  if (typeof envKey === 'string' && envKey.trim().length > 0) {
    return envKey.trim();
  }

  // 2. Secondary fallback: Local storage (if manually updated)
  if (typeof window !== 'undefined') {
    const localKey = localStorage.getItem(STORAGE_API_KEY);
    if (localKey && localKey.trim().length > 0) {
      return localKey.trim();
    }
  }

  // 3. Guaranteed project Web API key
  return DEFAULT_FIREBASE_API_KEY;
}

export function saveStoredApiKey(key) {
  if (typeof window === 'undefined') return;
  if (key && key.trim().length > 0) {
    localStorage.setItem(STORAGE_API_KEY, key.trim());
  } else {
    localStorage.removeItem(STORAGE_API_KEY);
  }
}

const currentApiKey = getStoredApiKey();

// Read Firebase configuration from Vite environment variables or stored key
export const firebaseConfig = {
  apiKey: currentApiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'dimlog-d0f35.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'dimlog-d0f35',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://dimlog-d0f35-default-rtdb.firebaseio.com/',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'dimlog-d0f35.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1010607869915',
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
  
  // Initialize Auth & Google Provider
  try {
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
  } catch (authErr) {
    console.warn('[Firebase Auth Init Warning]:', authErr);
  }

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
  const apiKey = getStoredApiKey();
  const config = { ...firebaseConfig, apiKey };
  const secondaryAppName = `secondary-auth-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const secondaryApp = initializeApp(config, secondaryAppName);
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
