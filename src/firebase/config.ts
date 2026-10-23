import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const STORAGE_API_KEY = 'voltlog-firebase-api-key';

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
 * Realtime Database always connects to https://dimlog-d0f35-default-rtdb.firebaseio.com/
 * so cloud synchronization is active immediately!
 */
export function initFirebase(customApiKey?: string): FirebaseInitResult {
  const currentKey = (customApiKey || getStoredApiKey()).trim();

  const config: Record<string, string> = {
    projectId: firebaseConfig.projectId,
    databaseURL: firebaseConfig.databaseURL,
    authDomain: firebaseConfig.authDomain,
    appId: firebaseConfig.appId,
  };

  if (currentKey) {
    config.apiKey = currentKey;
  }

  try {
    if (!getApps().length) {
      appInstance = initializeApp(config);
    } else {
      appInstance = getApp();
    }

    if (currentKey) {
      authInstance = getAuth(appInstance);
    }

    // Always connect Realtime Database to the designated URL
    dbInstance = getDatabase(appInstance, firebaseConfig.databaseURL);

    return {
      app: appInstance,
      auth: authInstance,
      db: dbInstance,
      isConfigured: true,
      error: null,
    };
  } catch (err: any) {
    console.error('[VoltLog Firebase Error]', err);
    return {
      app: null,
      auth: null,
      db: null,
      isConfigured: false,
      error: err?.message || 'Failed to initialize Firebase',
    };
  }
}

// Initial initialization attempt
const initialSetup = initFirebase();
export const app = initialSetup.app;
export const auth = initialSetup.auth;
export const db = initialSetup.db;
