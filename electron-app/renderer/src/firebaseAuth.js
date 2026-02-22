import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

import { firebaseConfig, validateFirebaseConfig } from "./firebaseConfig";

let cachedAuth = null;
let cachedError = null;

export function getFirebaseAuthClient() {
  if (cachedAuth) {
    return { enabled: true, auth: cachedAuth, error: null };
  }
  if (cachedError) {
    return { enabled: false, auth: null, error: cachedError };
  }

  const configError = validateFirebaseConfig(firebaseConfig);
  if (configError) {
    cachedError = configError;
    return { enabled: false, auth: null, error: configError };
  }

  const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  cachedAuth = getAuth(app);
  return { enabled: true, auth: cachedAuth, error: null };
}
