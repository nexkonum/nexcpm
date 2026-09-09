// NEXCPM — Firebase yapılandırması
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDiFa6RjkuqdEbz8L9YsrBD1Be5shgAjUg",
  authDomain: "plane-gr.firebaseapp.com",
  databaseURL: "https://plane-gr-default-rtdb.firebaseio.com",
  projectId: "plane-gr",
  storageBucket: "plane-gr.firebasestorage.app",
  messagingSenderId: "764208760476",
  appId: "1:764208760476:web:19f6aa746f6270ad568f59"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
