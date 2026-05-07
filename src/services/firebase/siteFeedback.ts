import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { firestore, auth } from './config';

export interface SiteFeedbackInput {
  message: string;
  email?: string | null;
}

/** Submit a site-wide feedback message. Available to anonymous and signed-in
 *  visitors. Stored at siteFeedback/{auto} — admin reads via callable. */
export async function submitSiteFeedback(input: SiteFeedbackInput): Promise<void> {
  const message = input.message.trim();
  if (!message) throw new Error('Message is required.');
  if (message.length > 4000) throw new Error('Message is too long (max 4000 chars).');

  const user = auth.currentUser;
  const explicit = (input.email ?? '').trim().toLowerCase();
  const fromAuth = (user?.email ?? '').trim().toLowerCase();
  const email = explicit || fromAuth || null;

  const path = typeof window !== 'undefined' ? window.location.pathname.slice(0, 500) : null;
  const userAgent = typeof window !== 'undefined' ? (window.navigator.userAgent || '').slice(0, 500) : null;
  const referrer = typeof document !== 'undefined' ? (document.referrer || '').slice(0, 500) : null;

  await addDoc(collection(firestore, 'siteFeedback'), {
    message,
    email,
    displayName: user?.displayName ?? null,
    uid: user?.uid ?? null,
    path,
    userAgent,
    referrer,
    createdAt: serverTimestamp(),
  });
}
