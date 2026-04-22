import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; 

const firebaseConfig = {
  apiKey: "AIzaSyA8TyxjyDymJJzvyBOYB13-8sDMNsTUzCM",
  authDomain: "ev-calculator-s30.firebaseapp.com",
  projectId: "ev-calculator-s30",
  storageBucket: "ev-calculator-s30.firebasestorage.app",
  messagingSenderId: "475636577872",
  appId: "1:475636577872:web:27b70fa0c0c0eb6fd94355"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);