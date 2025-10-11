// utils/firebaseAdmin.js
const admin = require("firebase-admin");
require("dotenv").config();

const getFirebaseConfig = () => {
  // En production, utiliser les variables d'environnement
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    if (!process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error('Firebase private key is missing in production');
    }
    
    return {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
    };
  }
  
  // En développement local, utiliser le fichier
  try {
    const serviceAccount = require("./serviceAccount.json");
    console.log('🔧 Using local serviceAccount.json');
    return serviceAccount;
  } catch (error) {
    console.error("❌ serviceAccount.json not found locally");
    
    // Fallback aux variables d'environnement en développement
    if (process.env.FIREBASE_PRIVATE_KEY) {
      console.log('🔧 Falling back to environment variables');
      return {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
      };
    }
    
    throw error;
  }
};

// Initialisation Firebase
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(getFirebaseConfig()),
    });
    console.log('✅ Firebase Admin initialized successfully');
  }
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error.message);
}

const db = admin.firestore();

module.exports = { admin, db };