import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const STORAGE_API_KEY = 'voltlog-firebase-api-key';

export function getStoredApiKey(): string {
  if (typeof window === 'undefined') return '';
  return (
    import.meta.env.VITE_FIREBASE_API_KEY ||
    localStorage.getItem(STORAGE_API_KEY) ||
    ''
  );
}

export function saveStoredApiKey(key: string) {
  if (typeof window === 'undefined') return;
  if (key) {
    localStorage.setItem(STORAGE_API_KEY, key.trim());
  } else {
    localStorage.removeItem(STORAGE_API_KEY);
  }
}

// User-provided Firebase configuration for dimlog-d0f35
export const firebaseConfig = {
  projectId: 'dimlog-d0f35',
  databaseURL: 'https://dimlog-d0f35-default-rtdb.firebaseio.com/',
  authDomain: 'dimlog-d0f35.firebaseapp.com',
  appId: '1:1010607869915:web:9bcfd6f5a74761a8dba1fe',
  apiKey: getStoredApiKey(),
};

let appInstance: ReturnType<typeof initializeApp> | null = null;
let authInstance: ReturnType<typeof getAuth> | null = null;
let dbInstance: ReturnType<typeof getDatabase> | null = null;

export function initFirebase(customApiKey?: string) {
  const currentKey = customApiKey || getStoredApiKey();
  
  const config = {
    ...firebaseConfig,
    apiKey: currentKey,
  };

  try {
    if (!getApps().length) {
      // If we don't have an apiKey yet, initialize with placeholder or wait
      appInstance = initializeApp(config);
    } else {
      appInstance = getApp();
    }

    if (config.apiKey) {
      authInstance = getAuth(appInstance);
    }
    dbInstance = getDatabase(appInstance, config.databaseURL);

    return { app: appInstance, auth: authInstance, db: dbInstance, isConfigured: !!config.apiKey };
  } catch (err) {
    console.warn('Firebase initialization notice:', err);
    return { app: null, auth: null, db: null, isConfigured: false, error: err };
  }
}

// Default export initialized instances
export const { app, auth, db } = initFirebase();
