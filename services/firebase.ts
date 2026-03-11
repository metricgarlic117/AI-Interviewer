import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyCWR1_kva_pqmZyDWdZCLobzhhTItwoOEQ',
  authDomain: 'inter-87ac9.firebaseapp.com',
  projectId: 'inter-87ac9',
  storageBucket: 'inter-87ac9.firebasestorage.app',
  messagingSenderId: '506501043628',
  appId: '1:506501043628:web:d30db6f46483394d965609',
  measurementId: 'G-PL0QS7PLR8'
};

// Initialize Firebase (SSR-safe)
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Initialize Auth (client-side only)
export const auth = typeof window !== 'undefined' ? getAuth(app) : null as any;
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore
export const db = getFirestore(app);

// Initialize analytics safely (client-side only)
let analytics: any = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      try {
        analytics = getAnalytics(app);
      } catch (e) {
        console.warn('Firebase Analytics failed to initialize', e);
      }
    }
  });
}
export { analytics };