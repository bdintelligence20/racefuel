import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, Mail, Lock, User } from 'lucide-react';

export function AuthScreen() {
  const { signInGoogle, signInEmail, signUpEmail, resetPassword, error, clearError, loading } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await signUpEmail(email, password, name);
      } else if (mode === 'reset') {
        await resetPassword(email);
        setResetSent(true);
      } else {
        await signInEmail(email, password);
      }
    } catch {
      // Error surfaced via auth context; resetSent not set
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (next: 'signin' | 'signup' | 'reset') => {
    setMode(next);
    clearError();
    setResetSent(false);
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    try {
      await signInGoogle();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="text-center">
          <img src="/logo.png" alt="fuelcue" className="h-16 w-auto mx-auto mb-4" />
          <div className="w-8 h-8 border-2 border-warm border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm overflow-y-auto p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-surface border-t sm:border border-[var(--color-border)] rounded-t-2xl sm:rounded-2xl shadow-2xl my-auto max-h-[100dvh] sm:max-h-[95dvh] flex flex-col overflow-hidden">
        {/* Hero */}
        <div className="relative h-40 sm:h-48 flex-shrink-0 overflow-hidden">
          <img
            src="/logo-illustrated.jpg"
            alt="fuelcue"
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-surface to-transparent" />
        </div>

        <div className="px-6 pb-6 pt-4 sm:pt-0 sm:-mt-4 relative z-10 flex-1 overflow-y-auto">
          <p className="text-center text-text-muted text-sm font-display mb-6">
            {mode === 'signin' && 'Sign in to your account'}
            {mode === 'signup' && 'Create your account'}
            {mode === 'reset' && 'Reset your password'}
          </p>

          {mode !== 'reset' && (
            <>
              <button
                onClick={handleGoogle}
                disabled={submitting}
                className="w-full h-12 flex items-center justify-center gap-3 rounded-xl bg-surface border border-[var(--color-border)] text-text-primary font-display font-semibold text-sm hover:bg-surfaceHighlight active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-[var(--color-border)]" />
                <span className="text-xs text-text-muted font-display">or</span>
                <div className="flex-1 h-px bg-[var(--color-border)]" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); clearError(); }}
                  autoComplete="name"
                  autoCapitalize="words"
                  className="w-full h-12 pl-10 pr-4 rounded-xl bg-surfaceHighlight border border-[var(--color-border)] text-text-primary text-sm font-display focus:border-accent focus:ring-1 focus:ring-accent/20 focus:outline-none placeholder:text-text-muted transition-all"
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError(); setResetSent(false); }}
                autoComplete="email"
                autoCapitalize="off"
                autoCorrect="off"
                inputMode="email"
                className="w-full h-12 pl-10 pr-4 rounded-xl bg-surfaceHighlight border border-[var(--color-border)] text-text-primary text-sm font-display focus:border-accent focus:ring-1 focus:ring-accent/20 focus:outline-none placeholder:text-text-muted transition-all"
                required
              />
            </div>
            {mode !== 'reset' && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError(); }}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className="w-full h-12 pl-10 pr-4 rounded-xl bg-surfaceHighlight border border-[var(--color-border)] text-text-primary text-sm font-display focus:border-accent focus:ring-1 focus:ring-accent/20 focus:outline-none placeholder:text-text-muted transition-all"
                  required
                  minLength={6}
                />
              </div>
            )}

            {mode === 'signin' && (
              <div className="text-right -mt-1">
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  className="text-xs text-text-muted hover:text-accent font-display"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-500 font-display text-center">{error}</p>
            )}

            {resetSent && mode === 'reset' && (
              <p className="text-sm text-green-600 font-display text-center">
                Check your inbox for a password reset link.
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-accent text-white font-display font-bold text-sm uppercase tracking-wider hover:bg-accent-light active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {submitting
                ? 'Please wait...'
                : mode === 'signin'
                ? 'Sign In'
                : mode === 'signup'
                ? 'Create Account'
                : 'Send Reset Link'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="text-center text-sm text-text-muted font-display mt-4">
            {mode === 'signin' && (
              <>Don't have an account?{' '}
                <button onClick={() => switchMode('signup')} className="text-accent font-semibold hover:underline">
                  Sign up
                </button>
              </>
            )}
            {mode === 'signup' && (
              <>Already have an account?{' '}
                <button onClick={() => switchMode('signin')} className="text-accent font-semibold hover:underline">
                  Sign in
                </button>
              </>
            )}
            {mode === 'reset' && (
              <>Remember your password?{' '}
                <button onClick={() => switchMode('signin')} className="text-accent font-semibold hover:underline">
                  Back to sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
