import { FirebaseApp } from 'firebase/app';
import { Database } from 'firebase/database';
import { Firestore } from 'firebase/firestore';
import { Auth, GoogleAuthProvider } from 'firebase/auth';

export declare const app: FirebaseApp;
export declare const db: Database;
export declare const rtdb: Database;
export declare const firestore: Firestore | null;
export declare const auth: Auth | null;
export declare const googleProvider: GoogleAuthProvider | null;
export declare function getStoredApiKey(): string;
export declare function saveStoredApiKey(key: string): void;
export declare function createSecondaryAuth(): {
  secondaryApp: FirebaseApp;
  secondaryAuth: Auth;
  cleanup: () => Promise<void>;
};
export default db;
