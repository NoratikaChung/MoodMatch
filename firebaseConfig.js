// File: firebaseConfig.js (Corrected with Emulator Imports)

import { initializeApp } from 'firebase/app';
// --- ADD EMULATOR IMPORTS HERE ---
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
// --- END EMULATOR IMPORTS ---
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

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functionsInstance = getFunctions(app); // Using functionsInstance to avoid name collision

// --- Emulator Connection Logic ---
// For React Native (Expo), __DEV__ is a global variable available in development.
// For web, process.env.NODE_ENV === 'development' or checking hostname is common.
// Let's assume __DEV__ for a typical Expo setup, adjust if primarily for web.
// const IS_DEV_MODE = typeof __DEV__ !== 'undefined' && __DEV__;
// const IS_DEV_MODE = process.env.NODE_ENV === 'development' || (typeof window !== 'undefined' && window.location.hostname === 'localhost');


// if (IS_DEV_MODE) {
//   try {
//     console.log("Attempting to connect to Firebase Emulators...");

//     // Use 'localhost' or '127.0.0.1' generally.
//     // For Android Emulator connecting to host machine, use '10.0.2.2'.
//     const host = 'localhost'; // Or "127.0.0.1"

//     connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
//     console.log(`Auth Emulator connected to http://${host}:9099`);

//     connectFirestoreEmulator(db, host, 8080);
//     console.log(`Firestore Emulator connected to ${host}:8080`);

//     connectStorageEmulator(storage, host, 9199);
//     console.log(`Storage Emulator connected to ${host}:9199`);

//     // Use the 'functionsInstance' variable here
//     connectFunctionsEmulator(functionsInstance, host, 5001);
//     console.log(`Functions Emulator connected to ${host}:5001`);

//   } catch (error) {
//     console.error("Error connecting to Firebase Emulators:", error);
//   }
// } else {
//   console.log("Running in production mode or IS_DEV_MODE is false.");
// }
// --- END Emulator Connection ---

// Export the initialized services
export { app, auth, db, storage, functionsInstance as functions }; // Exporting functionsInstance as functions