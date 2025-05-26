
"use client";

import type { User as FirebaseUser, UserCredential } from 'firebase/auth'; // Added UserCredential
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword, // Ensure this is imported
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { useFirebase } from '@/providers/FirebaseProvider';
import { useCallback } from 'react';

// --- MOCK USER CONFIGURATION ---
const MOCK_USER_MODE = false; 
// Removido o objeto mockUserObject para simplificar, já que não estamos usando no momento.
// --- END MOCK USER CONFIGURATION ---


export function useAuth() {
  const { auth, currentUser, loadingAuth: firebaseLoadingAuth } = useFirebase();

  const effectiveUser = MOCK_USER_MODE ? null /* mockUserObject */ : currentUser; // Adjusted for mock mode off
  const effectiveLoading = MOCK_USER_MODE ? false : firebaseLoadingAuth;

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<UserCredential | void> => { // Return type UserCredential
    if (MOCK_USER_MODE) {
      console.warn("Login com Email/Senha desabilitado: MOCK_USER_MODE está ativo.");
      return;
    }
    if (!auth) throw new Error("Firebase auth não inicializado");
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      throw error; 
    }
  }, [auth]);

  const signUpWithEmail = useCallback(async (email: string, password: string): Promise<UserCredential | void> => { // Return type UserCredential
    if (MOCK_USER_MODE) {
      console.warn("Cadastro com Email/Senha desabilitado: MOCK_USER_MODE está ativo.");
      return; // Retorna void se mock mode estiver ativo
    }
    if (!auth) throw new Error("Firebase auth não inicializado");
    try {
      return await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      throw error;
    }
  }, [auth]);

  const signOut = useCallback(async () => {
    if (MOCK_USER_MODE) {
      console.warn("Sign out desabilitado: MOCK_USER_MODE está ativo.");
      return;
    }
    if (!auth) throw new Error("Firebase auth não inicializado");
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Erro ao tentar sign out: ", error);
      throw error;
    }
  }, [auth]);

  return {
    user: effectiveUser,
    loading: effectiveLoading,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };
}
