// Firebase configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, getDoc, getDocs, query, where, orderBy, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

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
