export const firebaseConfig = {
  apiKey: "AIzaSyBRsfVOifth1JOWEBJo3FkPwxnpE8bZ__Y",
  authDomain: "framesort-app.firebaseapp.com",
  projectId: "framesort-app",
  storageBucket: "framesort-app.firebasestorage.app",
  messagingSenderId: "186134180562",
  appId: "1:186134180562:web:86180ed868d55badb9b30b",
};

function isPlaceholder(value) {
  return typeof value !== "string" || value.length === 0 || value.startsWith("YOUR_FIREBASE_");
}

export function validateFirebaseConfig(config = firebaseConfig) {
  const requiredKeys = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId",
  ];

  const missing = requiredKeys.filter((key) => isPlaceholder(config[key]));
  if (missing.length > 0) {
    return `Firebase config is incomplete. Update renderer/src/firebaseConfig.js (${missing.join(", ")}).`;
  }

  return null;
}
