// Firebase configuration and initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getAuth, 
    signInAnonymously, 
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    onSnapshot,
    collection,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase configuration
// Replace with your actual Firebase config
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

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);

// Auto-sign in anonymously
let currentUser = null;

async function initializeAuth() {
    try {
        // Sign in anonymously
        const userCredential = await signInAnonymously(auth);
        currentUser = userCredential.user;
        console.log('Signed in anonymously:', currentUser.uid);
        return currentUser;
    } catch (error) {
        console.error('Error signing in anonymously:', error);
        throw error;
    }
}

// Listen for auth state changes
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        console.log('User is signed in:', user.uid);
    } else {
        currentUser = null;
        console.log('User is signed out');
    }
});

// Initialize auth when module is loaded
initializeAuth().catch(console.error);

// Export Firebase services
export { 
    auth, 
    db, 
    currentUser,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    onSnapshot,
    collection,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp
};
