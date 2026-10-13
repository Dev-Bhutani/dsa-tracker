import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCVmf1U8mKfvTzCv81Gg3q2xGJBiQ1Qm-o",
  authDomain: "dsa-tracker-63c98.firebaseapp.com",
  projectId: "dsa-tracker-63c98",
  storageBucket: "dsa-tracker-63c98.firebasestorage.app",
  messagingSenderId: "339049066389",
  appId: "1:339049066389:web:5980c4195fe0159700909c",
  measurementId: "G-7NJ3RKPDEH"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
// Yahan humne '(default)' explicitly pass kar diya hai taaki database properly mil jaye
export const db = getFirestore(app, "(default)");