// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD26o_heKopixxpHrcT6yGR1PaY4TVpI1U",
  authDomain: "dashboard-producao-empresa.firebaseapp.com",
  projectId: "dashboard-producao-empresa",
  storageBucket: "dashboard-producao-empresa.firebasestorage.app",
  messagingSenderId: "246718812896",
  appId: "1:246718812896:web:3b31a9ce2bc3ccb78e3685",
  measurementId: "G-NCZLGSVBWC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);