
"use client";

import type { FirebaseApp } from 'firebase/app';
import { initializeApp, getApps } from 'firebase/app';
import type { Auth, User as FirebaseUser } from 'firebase/auth';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';

const firebaseConfig = {
  apiKey: "AIzaSyCKfOnI6JFgeqmRkwzSX-6OGbfCHbnj42s",
  authDomain: "controle-ebd-f222c.firebaseapp.com",
  projectId: "controle-ebd-f222c",
  storageBucket: "controle-ebd-f222c.firebasestorage.app",
  messagingSenderId: "233919272471",
  appId: "1:233919272471:web:7776cca222be99274aee52",
  measurementId: "G-VK757JGJ20"
};

interface FirebaseContextType {
  app: FirebaseApp | null;
  auth: Auth | null;
  db: Firestore | null;
  currentUser: FirebaseUser | null;
  loadingAuth: boolean;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [app, setApp] = useState<FirebaseApp | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [db, setDb] = useState<Firestore | null>(null);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    let unsubscribe = () => {}; // Initialize with a no-op function

    try {
      let firebaseAppInstance: FirebaseApp;
      if (!getApps().length) {
        firebaseAppInstance = initializeApp(firebaseConfig);
      } else {
        firebaseAppInstance = getApps()[0];
      }
      setApp(firebaseAppInstance);

      const authInstanceFirebase = getAuth(firebaseAppInstance);
      setAuth(authInstanceFirebase);

      const firestoreInstance = getFirestore(firebaseAppInstance);
      setDb(firestoreInstance);

      unsubscribe = onAuthStateChanged(
        authInstanceFirebase,
        (user) => {
          setCurrentUser(user);
          setLoadingAuth(false);
        },
        (error) => {
          // This is the error observer for onAuthStateChanged
          console.error("Firebase Auth State Error:", error);
          // We should still set loading to false to prevent infinite spinners
          // if there's an issue with the auth state listener itself.
          setCurrentUser(null); // Assume no user if there's an auth state error
          setLoadingAuth(false);
        }
      );
    } catch (error) {
      console.error("Error initializing Firebase services:", error);
      // If initialization fails, ensure loadingAuth is set to false
      // so the app doesn't spin infinitely.
      setApp(null);
      setAuth(null);
      setDb(null);
      setCurrentUser(null);
      setLoadingAuth(false);
    }

    // Cleanup function for useEffect
    return () => {
      // Check if unsubscribe is a function before calling,
      // in case an error occurred before it was assigned.
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []); // Empty dependency array ensures this runs once on mount

  return (
    <FirebaseContext.Provider value={{ app, auth, db, currentUser, loadingAuth }}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = (): FirebaseContextType => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};
