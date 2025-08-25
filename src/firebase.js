// Firebase configuration and initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getAuth, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile
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

// User authentication state
let currentUser = null;

// Register new user with profile data
async function registerUser(email, password, userData) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Update user profile with additional data
        await updateProfile(user, {
            displayName: userData.name,
            photoURL: userData.photoURL || null
        });
        
        // Save additional user data to Firestore
        await saveUserData(user.uid, userData);
        
        console.log('User registered successfully:', user.uid);
        return user;
    } catch (error) {
        console.error('Error registering user:', error);
        throw error;
    }
}

// Sign in existing user
async function signInUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log('User signed in successfully:', user.uid);
        return user;
    } catch (error) {
        console.error('Error signing in user:', error);
        throw error;
    }
}

// Sign out user
async function signOutUser() {
    try {
        await signOut(auth);
        console.log('User signed out successfully');
    } catch (error) {
        console.error('Error signing out user:', error);
        throw error;
    }
}

// Save user data to Firestore
async function saveUserData(userId, userData) {
    try {
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, {
            ...userData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        console.log('User data saved to Firestore');
    } catch (error) {
        console.error('Error saving user data:', error);
        throw error;
    }
}

// Get user data from Firestore
async function getUserData(userId) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            return { id: userSnap.id, ...userSnap.data() };
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error getting user data:', error);
        throw error;
    }
}

// Listen for auth state changes
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        console.log('User is signed in:', user.uid);
        
        // Check if user has complete profile data
        checkUserProfile(user);
    } else {
        currentUser = null;
        console.log('User is signed out');
    }
});

// Check if user has complete profile data
async function checkUserProfile(user) {
    try {
        const userData = await getUserData(user.uid);
        if (!userData || !userData.phone || !userData.name) {
            console.log('User profile incomplete, redirecting to profile setup');
            // You can redirect to profile setup here
        }
    } catch (error) {
        console.error('Error checking user profile:', error);
    }
}

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
    serverTimestamp,
    registerUser,
    signInUser,
    signOutUser,
    saveUserData,
    getUserData
};
