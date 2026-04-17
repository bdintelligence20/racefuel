import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { onAuthChange, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, sendPasswordResetEmail } from '../services/firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInGoogle: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string, name?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

type FirebaseLikeError = { code?: string; message?: string };

function friendlyAuthError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = err as FirebaseLikeError;
  const code = e?.code || '';
  const map: Record<string, string> = {
    'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
    'auth/invalid-email': 'That\'s not a valid email address.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/missing-password': 'Please enter a password.',
    'auth/operation-not-allowed': 'Email sign-in is disabled for this project. Contact support.',
    'auth/network-request-failed': 'No internet connection. Try again.',
    'auth/too-many-requests': 'Too many attempts. Try again in a few minutes.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/user-not-found': 'No account with that email. Try signing up instead.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/popup-closed-by-user': 'Sign-in cancelled.',
    'auth/popup-blocked': 'Sign-in popup was blocked. Allow popups and try again.',
    'auth/cancelled-popup-request': 'Sign-in cancelled.',
    'auth/account-exists-with-different-credential': 'An account already exists with a different sign-in method.',
    'auth/invalid-action-code': 'This reset link has expired. Request a new one.',
    'auth/expired-action-code': 'This reset link has expired. Request a new one.',
  };
  if (code && map[code]) return map[code];
  const raw = e?.message || '';
  if (raw) {
    const cleaned = raw.replace(/^Firebase:\s*/, '').replace(/\s*\(auth\/[^)]*\)\.?$/, '').trim();
    if (cleaned.length > 2) return cleaned;
  }
  return code ? `${fallback} (${code})` : fallback;
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
      console.error('[auth] google sign-in failed:', err);
      setError(friendlyAuthError(err, 'Failed to sign in with Google.'));
    }
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      console.error('[auth] email sign-in failed:', err);
      setError(friendlyAuthError(err, 'Failed to sign in.'));
    }
  }, []);

  const signUpEmail = useCallback(async (email: string, password: string, name?: string) => {
    setError(null);
    try {
      await signUpWithEmail(email, password, name);
    } catch (err) {
      console.error('[auth] sign-up failed:', err);
      setError(friendlyAuthError(err, 'Failed to create account.'));
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    try {
      await sendPasswordResetEmail(email);
    } catch (err) {
      console.error('[auth] password reset failed:', err);
      setError(friendlyAuthError(err, 'Failed to send reset email.'));
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{ user, loading, error, signInGoogle, signInEmail, signUpEmail, resetPassword, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
