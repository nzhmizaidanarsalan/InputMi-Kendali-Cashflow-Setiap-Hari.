import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore with specific databaseId if provided
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const storage = getStorage(app);

// Test server connection gracefully when user is authenticated
export async function testFirestoreConnection(userId?: string) {
  if (!userId) return;
  try {
    await getDocFromServer(doc(db, 'users', userId, '_health', 'ping'));
  } catch (err: any) {
    if (err?.message?.includes('offline')) {
      console.warn('Firebase client is offline or network restricted.');
    }
  }
}

export default app;
