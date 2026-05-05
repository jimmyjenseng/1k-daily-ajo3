import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCn_1Xk2FFyym0BZHVIf7akIMaMMlISv5w",
  authDomain: "ajohub-f72fd.firebaseapp.com",
  projectId: "ajohub-f72fd",
  storageBucket: "ajohub-f72fd.firebasestorage.app",
  messagingSenderId: "154304599043",
  appId: "1:154304599043:web:82a82c5438361d8ed52a36"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore (The database) and export it
export const db = getFirestore(app);
