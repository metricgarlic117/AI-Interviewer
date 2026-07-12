import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

/**
 * Firebase Admin SDK bootstrap (server only).
 *
 * Credentials are resolved in this order:
 *  1. FIREBASE_SERVICE_ACCOUNT_KEY — the service-account JSON, either raw or
 *     base64-encoded (base64 is easier to paste into most dashboards).
 *  2. Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS or the
 *     ambient identity on Google Cloud / Firebase App Hosting).
 */
function resolveCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    let json;
    try {
      json = raw.trim().startsWith('{')
        ? JSON.parse(raw)
        : JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch (err) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_KEY is set but is not valid JSON (raw or base64-encoded).'
      );
    }
    return cert(json);
  }
  return applicationDefault();
}

function getAdminApp() {
  const existing = getApps();
  if (existing.length > 0) {
    return existing[0];
  }
  return initializeApp({
    credential: resolveCredential(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

let cachedAuth = null;

/** Lazily initialized so importing this module never crashes at build time. */
export function adminAuth() {
  if (!cachedAuth) {
    cachedAuth = getAuth(getAdminApp());
  }
  return cachedAuth;
}
