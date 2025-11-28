// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyDmnMAQ-90Pk3vNgTSPgTKUr4SJFsywCzU",
    authDomain: "e-commerce-72a4b.firebaseapp.com",
    projectId: "e-commerce-72a4b",
    storageBucket: "e-commerce-72a4b.firebasestorage.app",
    messagingSenderId: "1018392602564",
    appId: "1:1018392602564:web:db0a690e611f9926dba691",
    measurementId: "G-474PWQQW9X"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };