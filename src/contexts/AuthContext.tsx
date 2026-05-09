import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, googleProvider, isConfigured } from '../services/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isDemo: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, loading: true, isDemo: false,
  signInWithGoogle: async () => {}, logout: async () => {},
});

const DEMO_USER = {
  uid: 'demo-user', displayName: '体验用户',
  email: 'demo@zupu.app', photoURL: null,
} as unknown as User;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isDemo = !isConfigured;

  useEffect(() => {
    if (!isConfigured || !auth) {
      if (localStorage.getItem('zupu_demo_auth')) setUser(DEMO_USER);
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
  }, []);

  const signInWithGoogle = async () => {
    if (!isConfigured || !auth || !googleProvider) {
      localStorage.setItem('zupu_demo_auth', 'true');
      setUser(DEMO_USER);
      return;
    }
    await signInWithPopup(auth, googleProvider);
  };

  const logout = async () => {
    if (!isConfigured || !auth) {
      localStorage.removeItem('zupu_demo_auth');
      setUser(null);
      return;
    }
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isDemo, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
