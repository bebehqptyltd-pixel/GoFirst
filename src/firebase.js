import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
const firebaseConfig = {
  apiKey: "AIzaSyBgbPGFp9cij7UHVZcUEI5tHN-ncjy_ktg",
  authDomain: "go-first-e1867.firebaseapp.com",
  databaseURL: "https://go-first-e1867-default-rtdb.firebaseio.com",
  projectId: "go-first-e1867",
  storageBucket: "go-first-e1867.firebasestorage.app",
  messagingSenderId: "127564102334",
  appId: "1:127564102334:web:fe8416d69af375c3e3fcef",
  measurementId: "G-PQ0SNP11QF"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
