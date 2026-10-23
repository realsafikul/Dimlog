import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const STORAGE_API_KEY = 'voltlog-firebase-api-key';

/**
 * Retrieves the Firebase API Key:
 * 1. Checks Vite environment variable (import.meta.env.VITE_FIREBASE_API_KEY)
 * 2. Checks browser localStorage fallback ('voltlog-firebase-api-key')
 * Returns empty string if not configured.
 */
export function getStoredApiKey(): string {
  // 1. Primary source: Vite environment variable (Netlify / .env)
  const envKey = import.meta.env.VITE_FIREBASE_API_KEY;
  if (typeof envKey === 'string' && envKey.trim().length > 0) {
    return envKey.trim();
  }

  // 2. Secondary fallback: Local storage (for client-side manual configuration)
  if (typeof window !== 'undefined') {
    const localKey = localStorage.getItem(STORAGE_API_KEY);
    if (localKey && localKey.trim().length > 0) {
      return localKey.trim();
    }
  }

  return '';
}

export function saveStoredApiKey(key: string) {
  if (typeof window === 'undefined') return;
  if (key && key.trim().length > 0) {
    localStorage.setItem(STORAGE_API_KEY, key.trim());
  } else {
    localStorage.removeItem(STORAGE_API_KEY);
  }
}

export function getApiKeySource(): 'env' | 'localStorage' | 'missing' {
  const envKey = import.meta.env.VITE_FIREBASE_API_KEY;
  if (typeof envKey === 'string' && envKey.trim().length > 0) {
    return 'env';
  }
  if (typeof window !== 'undefined') {
    const localKey = localStorage.getItem(STORAGE_API_KEY);
    if (localKey && localKey.trim().length > 0) {
      return 'localStorage';
    }
  }
  return 'missing';
}

// User-specified Firebase project configuration for dimlog-d0f35
export const firebaseConfig = {
  projectId: 'dimlog-d0f35',
  databaseURL: 'https://dimlog-d0f35-default-rtdb.firebaseio.com/',
  authDomain: 'dimlog-d0f35.firebaseapp.com',
  appId: '1:1010607869915:web:9bcfd6f5a74761a8dba1fe',
};

let appInstance: ReturnType<typeof initializeApp> | null = null;
let authInstance: ReturnType<typeof getAuth> | null = null;
let dbInstance: ReturnType<typeof getDatabase> | null = null;

export interface FirebaseInitResult {
  app: ReturnType<typeof initializeApp> | null;
  auth: ReturnType<typeof getAuth> | null;
  db: ReturnType<typeof getDatabase> | null;
  isConfigured: boolean;
  error: string | null;
}

/**
 * Initializes Firebase App, Auth, and Realtime Database.
 * Validates that API key is present before attempting initialization.
 * Will NOT initialize with an undefined or empty API key.
 */
export function initFirebase(customApiKey?: string): FirebaseInitResult {
  const currentKey = (customApiKey || getStoredApiKey()).trim();

  // If no API key is provided, do NOT initialize with empty/undefined credentials
  if (!currentKey) {
    const errorMsg = 'Firebase Web API Key is missing. Set VITE_FIREBASE_API_KEY in Netlify or configure it in Cloud Settings.';
    console.warn(`[VoltLog Firebase] ${errorMsg}`);
    return {
      app: null,
      auth: null,
      db: null,
      isConfigured: false,
      error: errorMsg,
    };
  }

  const config = {
    ...firebaseConfig,
    apiKey: currentKey,
  };

  try {
    if (!getApps().length) {
      appInstance = initializeApp(config);
    } else {
      appInstance = getApp();
    }

    authInstance = getAuth(appInstance);
    dbInstance = getDatabase(appInstance, config.databaseURL);

    return {
      app: appInstance,
      auth: authInstance,
      db: dbInstance,
      isConfigured: true,
      error: null,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Failed to initialize Firebase with current credentials.';
    console.error('[VoltLog Firebase Error]', err);
    return {
      app: null,
      auth: null,
      db: null,
      isConfigured: false,
      error: errorMsg,
    };
  }
}

// Initial initialization attempt
const initialSetup = initFirebase();
export const app = initialSetup.app;
export const auth = initialSetup.auth;
export const db = initialSetup.db;
