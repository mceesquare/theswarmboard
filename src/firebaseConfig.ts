import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// 1. Go to console.firebase.google.com
// 2. Create a new project (or use an existing one)
// 3. Go to Project Settings > General > "Your apps" > Web App (</>)
// 4. Copy the "firebaseConfig" object and paste it below:

const firebaseConfig = {
  // PASTE YOUR CONFIG HERE. IT LOOKS LIKE THIS:
  // apiKey: "AIzaSyD...",
  // authDomain: "your-app.firebaseapp.com",
  // projectId: "your-app",
  // storageBucket: "your-app.firebasestorage.app",
  // messagingSenderId: "123456789",
  // appId: "1:123456789..."
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
