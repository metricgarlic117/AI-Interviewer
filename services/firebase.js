import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";

/**
 * Firebase web config comes from environment variables so each environment
 * (local, staging, production) points at its own Firebase project.
 *
 * These NEXT_PUBLIC_ values are safe to expose in the client bundle — a
 * Firebase web API key only identifies the project; access control is
 * enforced by Firebase Auth and the Firestore security rules.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const missing = ["apiKey", "authDomain", "projectId", "appId"].filter(
  (key) => !firebaseConfig[key],
);
if (missing.length > 0) {
  throw new Error(
    `Missing Firebase configuration: ${missing
      .map((key) => `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, "_$1").toUpperCase()}`)
      .join(", ")}. Copy .env.example to .env.local and fill in your values.`,
  );
}

// Initialize Firebase (SSR-safe)
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Initialize Auth (client-side only)
export const auth = typeof window !== "undefined" ? getAuth(app) : null;
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore
export const db = getFirestore(app);

// Initialize analytics safely (client-side only)
let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      try {
        analytics = getAnalytics(app);
      } catch (e) {
        console.warn("Firebase Analytics failed to initialize", e);
      }
    }
  });
}
export { analytics };
