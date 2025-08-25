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
    apiKey: "AIzaSyBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
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
