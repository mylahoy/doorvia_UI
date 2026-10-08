// Firebase settings for DoorVia.
export const firebaseConfig = {
  apiKey: "AIzaSyAo20lonlvhpb9jH_AKJKremqBJeY4QpBc",
  authDomain: "doorvia-smartdoor.firebaseapp.com",
  projectId: "doorvia-smartdoor",
  messagingSenderId: "418665504295",
  appId: "1:418665504295:web:c3c3c7339d8284f6db7802",
  databaseURL: "https://doorvia-smartdoor-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// The one main admin (Firebase User UID).
export const ADMIN_UID = "MB6EaHB9PaX8LaT5mK4V4Qz9ZPm2";

// Admin logs in by typing this username plus a PIN (6+ digits). The page swaps it for the
// private login address below, so no real email is needed. Create that user in Firebase.
export const ADMIN_USERNAME = "admin";
export const ADMIN_LOGIN_EMAIL = "doorvia-admin@example.com";
