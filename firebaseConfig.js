// File: firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions'; // Make sure this line is present
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDjIsv5zx37_03yUDVHj2d4Ud7sARUMR9s",
  authDomain: "moodmatch-1ce33.firebaseapp.com",
  projectId: "moodmatch-1ce33",
  storageBucket: "moodmatch-1ce33.firebasestorage.app",
  messagingSenderId: "433617246028",
  appId: "1:433617246028:web:ca4dffcd1f27a252e661e9",
  measurementId: "G-DEH9GHE92K"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functionsInstance = getFunctions(app); // <<< --- 2. This line MUST be present
// const functions = getFunctions(app); // Optional: specify region e.g., getFunctions(app, 'us-central1')

// Export the initialized services
export { app, auth, db, storage, functionsInstance as functions }; // Renamed export for clarity/consistency

