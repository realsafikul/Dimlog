import { FirebaseApp } from 'firebase/app';
import { Database } from 'firebase/database';
import { Firestore } from 'firebase/firestore';

export declare const app: FirebaseApp;
export declare const db: Database;
export declare const rtdb: Database;
export declare const firestore: Firestore | null;
export default db;
