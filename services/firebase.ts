
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyBceqpT8fKseYI2MKapeFb7XN80YoOdCFU",
  authDomain: "sanbadm-c0577.firebaseapp.com",
  projectId: "sanbadm-c0577",
  storageBucket: "sanbadm-c0577.firebasestorage.app",
  messagingSenderId: "635145173370",
  appId: "1:635145173370:web:f9be48df68592ed8bdfec3",
  measurementId: "G-LN2BQ1X1CG"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
