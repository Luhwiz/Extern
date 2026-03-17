import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';

// Firebase configuration
// Get these from Firebase Console: Project Settings > General > Your apps > Firebase SDK snippet
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_GA_MEASUREMENT_ID  // Required for Firebase Analytics
};

// Initialize Firebase
if (import.meta.env.DEV) {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) {
    console.error('[Firebase] ERROR: VITE_FIREBASE_API_KEY is missing from environment.');
    console.log('[Firebase] Please ensure your .env file exists in the root directory and contains VITE_FIREBASE_API_KEY.');
  } else if (!apiKey.startsWith('AIzaSy')) {
    console.error('[Firebase] ERROR: VITE_FIREBASE_API_KEY does not appear to be a valid Firebase API key (should start with AIzaSy).');
  } else {
    console.log('[Firebase] API Key found and appears valid (prefix: AIzaSy)');
  }
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize Firebase Analytics (only where supported — not in SSR/Node)
let analytics = null;
isSupported().then(yes => {
  if (yes) {
    analytics = getAnalytics(app);
    console.log('[Firebase] Analytics initialized:', import.meta.env.VITE_GA_MEASUREMENT_ID);
  } else {
    console.warn('[Firebase] Analytics not supported in this environment.');
  }
}).catch(err => {
  console.warn('[Firebase] Analytics init error:', err.message);
});

// Sign up new user
export const signUp = async (email, password, name) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Update profile with name
    await updateProfile(userCredential.user, {
      displayName: name
    });

    return {
      success: true,
      user: {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        name: name
      }
    };
  } catch (error) {
    console.error('Sign up error:', error);
    return {
      success: false,
      error: getErrorMessage(error.code)
    };
  }
};

// Sign in existing user
export const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    return {
      success: true,
      user: {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        name: userCredential.user.displayName
      }
    };
  } catch (error) {
    console.error('Sign in error:', error);
    return {
      success: false,
      error: getErrorMessage(error.code)
    };
  }
};

// Sign out
export const logout = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error('Sign out error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Get current user's ID token (for API authentication)
export const getIdToken = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No user logged in');
  }

  try {
    const token = await user.getIdToken();
    return token;
  } catch (error) {
    console.error('Error getting ID token:', error);
    throw error;
  }
};

// Listen to auth state changes
export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      callback({
        uid: user.uid,
        email: user.email,
        name: user.displayName
      });
    } else {
      callback(null);
    }
  });
};

// Get current user
export const getCurrentUser = () => {
  const user = auth.currentUser;
  if (user) {
    return {
      uid: user.uid,
      email: user.email,
      name: user.displayName
    };
  }
  return null;
};

// Helper to get user-friendly error messages
const getErrorMessage = (errorCode) => {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'Email already registered';
    case 'auth/invalid-email':
      return 'Invalid email address';
    case 'auth/operation-not-allowed':
      return 'Operation not allowed';
    case 'auth/weak-password':
      return 'Password is too weak (minimum 6 characters)';
    case 'auth/user-disabled':
      return 'Account has been disabled';
    case 'auth/user-not-found':
      return 'Invalid credentials';
    case 'auth/wrong-password':
      return 'Invalid credentials';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection';
    default:
      return 'Authentication failed. Please try again';
  }
};

// Get Firebase app instance (for use with other Firebase services)
export const getApp = () => app;

// Get Firebase Analytics instance
export const getAnalyticsInstance = () => analytics;

export default {
  signUp,
  signIn,
  logout,
  getIdToken,
  onAuthChange,
  getCurrentUser,
  getApp,
  getAnalyticsInstance,
  db
};
