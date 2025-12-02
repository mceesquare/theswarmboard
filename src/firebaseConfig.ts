import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// @ts-ignore
const isPreview = typeof __firebase_config !== 'undefined';
// @ts-ignore
const previewConfig = isPreview ? JSON.parse(__firebase_config) : {};

const firebaseConfig = {
  apiKey: "AIzaSyDzf9VlMw9YpJQ_sdGf006hJa6WorHbEbI",
  authDomain: "theswarmboard.firebaseapp.com",
  projectId: "theswarmboard",
  storageBucket: "theswarmboard.firebasestorage.app",
  messagingSenderId: "628377029710",
  appId: "1:628377029710:web:da5a1f2443ab30c351071f",
  measurementId: "G-VFN3CV6SM9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
