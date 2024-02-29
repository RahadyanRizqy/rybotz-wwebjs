// FIREBASE INIT //
const { initializeApp } = require("firebase/app");
require('dotenv').config();
require('firebase/storage');

const firebaseConfig = {
  apiKey: "AIzaSyAYMfgYJN0q9_i1WBFLpqhMy-ZClQfQVFM",
  authDomain: process.env.AUTH_DOMAIN,
  databaseURL: process.env.DB_URL,
  projectId: process.env.PROJECT_ID,
  storageBucket: process.env.STORAGE_BUCK,
  messagingSenderId: process.env.MESSENGER_ID,
  appId: process.env.APP_ID
};

const app = initializeApp(firebaseConfig);
// END FIREBASE INIT //

// FIREBASE STORAGE //
const { getStorage, ref, uploadString, deleteObject } = require('firebase/storage');
const storage = getStorage(app);
// END FIREBASE STORAGE //

async function uploadBase64(base64String, filename, folder) {
    try {
        const fileRef = ref(ref(storage, folder), filename);
        await uploadString(fileRef, base64String, 'base64');
    } catch (error) {
        throw error;
    }
}

async function deleteExistingData(path) {
  try {
    const fileRef = ref(storage, path);
    await deleteObject(fileRef);
  }
  catch (error) {
    throw error;
  }
}

const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(process.env.SERVICE_ACCOUNT_PATH),
  databaseURL: process.env.DB_URL
});
const db = admin.database();

module.exports = { uploadBase64, deleteExistingData, db, admin };