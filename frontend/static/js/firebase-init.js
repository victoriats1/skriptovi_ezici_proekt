// firebase-init.js


const firebaseConfig = {
  apiKey: "AIzaSyDNjyYxnNqScHffCKs5vcG_0X9w_DAYI_o",
  authDomain: "hangout-planner-a2aae.firebaseapp.com",
  projectId: "hangout-planner-a2aae",
  storageBucket: "hangout-planner-a2aae.firebasestorage.app",
  messagingSenderId: "611468830544",
  appId: "1:611468830544:web:fb55ffcd23aa6c849bee55",
  measurementId: "G-DJN6NCZQ32"
};


if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db   = firebase.firestore ? firebase.firestore() : null;

// Google Auth provider
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/calendar.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');