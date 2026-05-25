import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDX2ugh_y7qhFPDSyYkEuSZExrtH-AxbD4",
  authDomain: "calculadora-eleitoral-60f59.firebaseapp.com",
  projectId: "calculadora-eleitoral-60f59",
  storageBucket: "calculadora-eleitoral-60f59.firebasestorage.app",
  messagingSenderId: "986438975351",
  appId: "1:986438975351:web:053bf6c0472b7d4f1cab72",
  measurementId: "G-8BFLNSXE7R"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);