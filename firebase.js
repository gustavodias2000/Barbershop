import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// NOTA: Não use getMessaging do Web SDK em React Native.
// Para push notifications, use @react-native-firebase/messaging (veja NotificationService.js).

const firebaseConfig = {
  apiKey: "AIzaSyA4phVWJPifqkoUhlo_oJbCiJ9A0FtS2Bo",
  authDomain: "barbershop-a754d.firebaseapp.com",
  projectId: "barbershop-a754d",
  storageBucket: "barbershop-a754d.appspot.com",
  messagingSenderId: "498555639521",
  appId: "1:498555639521:android:fe3f6581d33450a66e49a0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

