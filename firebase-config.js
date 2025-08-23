// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC7qU1MGpcsh52kQmYWtBv0YPKgFxketH0",
  authDomain: "driverparty-d28cc.firebaseapp.com",
  projectId: "driverparty-d28cc",
  storageBucket: "driverparty-d28cc.firebasestorage.app",
  messagingSenderId: "1019227765471",
  appId: "1:1019227765471:web:de5ae2dc4e2486fb92c76a",
  measurementId: "G-YF8261PLRK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Export the services for use in other modules
export { auth, db };
