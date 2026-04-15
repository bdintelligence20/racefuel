import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { onAuthChange, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut } from '../services/firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInGoogle: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInGoogle = useCallback(async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with Google');
    }
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to sign in';
      setError(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim());
    }
  }, []);

  const signUpEmail = useCallback(async (email: string, password: string, name?: string) => {
    setError(null);
    try {
      await signUpWithEmail(email, password, name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create account';
      setError(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim());
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{ user, loading, error, signInGoogle, signInEmail, signUpEmail, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
