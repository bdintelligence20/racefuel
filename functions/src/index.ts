import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { Resend } from 'resend';

initializeApp();

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

// Using Resend's shared sender so we don't need DNS verification on fuelcue.com
// to start. Once the domain is verified in Resend, swap FROM_ADDRESS to
// 'fuelcue <hello@fuelcue.com>'.
const FROM_ADDRESS = 'fuelcue <onboarding@resend.dev>';
const REPLY_TO = 'nicholasflemmer@gmail.com';
const ADMIN_EMAIL = 'nicholasflemmer@gmail.com';
const APP_URL = 'https://fuelcue.com';

interface EarlyAccessDoc {
  name: string;
  email: string;
  sports?: string[];
  notes?: string | null;
}

export const onEarlyAccessRequest = onDocumentCreated(
  {
    document: 'earlyAccessRequests/{docId}',
    region: 'us-central1',
    secrets: [RESEND_API_KEY],
    // Best-effort: a single attempt is enough — the Firestore record is the
    // source of truth, the email is a courtesy.
    retry: false,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const docId = event.params.docId;
    const data = snap.data() as EarlyAccessDoc;

    const name = (data.name || '').trim();
    const email = (data.email || '').trim().toLowerCase();
    const sports = Array.isArray(data.sports)
      ? data.sports.map((s) => String(s).trim()).filter(Boolean).slice(0, 10)
      : [];
    const notes = data.notes ? String(data.notes).trim() : null;
    const firstName = name.split(/\s+/)[0] || 'there';

    if (!name || !email) {
      logger.warn('Skipping email: invalid record', { docId, hasName: !!name, hasEmail: !!email });
      return;
    }

    const resend = new Resend(RESEND_API_KEY.value());

    // 1. Confirmation to the athlete
    let confirmationId: string | null = null;
    try {
      const result = await resend.emails.send({
        from: FROM_ADDRESS,
        to: email,
        replyTo: REPLY_TO,
        subject: "You're on the fuelcue early-access list",
        html: confirmationHtml(firstName, sports),
        text: confirmationText(firstName, sports),
      });
      if (result.error) throw result.error;
      confirmationId = result.data?.id ?? null;
      logger.info('Sent confirmation email', { docId, email, confirmationId });
    } catch (err) {
      logger.error('Confirmation email failed', { docId, email, err });
    }

    // 2. Notification to admin
    let adminId: string | null = null;
    try {
      const result = await resend.emails.send({
        from: FROM_ADDRESS,
        to: ADMIN_EMAIL,
        replyTo: email,
        subject: `[fuelcue] new early-access signup — ${name}`,
        html: adminHtml({ name, email, sports, notes, docId }),
        text: adminText({ name, email, sports, notes, docId }),
      });
      if (result.error) throw result.error;
      adminId = result.data?.id ?? null;
      logger.info('Sent admin notification', { docId, adminId });
    } catch (err) {
      logger.error('Admin notification failed', { docId, err });
    }

    // 3. Audit trail back on the Firestore doc so we can see, in the console,
    //    whether the email actually went out.
    try {
      await getFirestore()
        .collection('earlyAccessRequests')
        .doc(docId)
        .update({
          notification: {
            confirmationId,
            adminId,
            sentAt: FieldValue.serverTimestamp(),
          },
        });
    } catch (err) {
      logger.error('Audit update failed', { docId, err });
    }
  }
);

/* ------------------------ email body templates ------------------------ */

function confirmationHtml(firstName: string, sports: string[]): string {
  const sportPhrase = formatSports(sports);
  const sportLine = sportPhrase
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3D2152;">We've noted that you're focused on <b>${escapeHtml(sportPhrase)}</b> — we'll prioritise routes and products that fit when we send your invite.</p>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <title>You're on the fuelcue list</title>
</head>
<body style="margin:0;padding:0;background:#FFF9F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#3D2152;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FFF9F0;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid rgba(61,33,82,0.08);">
          <tr>
            <td style="padding:36px 36px 28px;">
              <div style="font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#F5A020;font-weight:700;margin-bottom:14px;">Early access</div>
              <h1 style="margin:0 0 18px;font-size:28px;line-height:1.15;color:#3D2152;font-weight:900;letter-spacing:-0.01em;">Hey ${escapeHtml(firstName)} — you're on the list.</h1>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3D2152;">
                Thanks for signing up for fuelcue. We're letting athletes in gradually so we can shape the product around real race-day feedback rather than guesses.
              </p>
              ${sportLine}
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3D2152;">
                In the next week or two we'll send through your invite link plus a quick walkthrough on planning nutrition for a real course — drop gels on climbs, time caffeine for the final push, export cue-ready waypoints to your watch.
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3D2152;">
                In the meantime, if you've got a specific race coming up, just reply to this email and tell us what you're training for. It genuinely helps us prioritise the right products and features.
              </p>
              <div style="border-top:1px solid rgba(61,33,82,0.1);margin-top:8px;padding-top:18px;font-size:12px;color:#6B5A7A;">
                Nic — fuelcue<br />
                <a href="${APP_URL}" style="color:#F5A020;text-decoration:none;font-weight:600;">fuelcue.com</a>
              </div>
            </td>
          </tr>
        </table>
        <div style="margin-top:18px;font-size:11px;color:#A0929E;letter-spacing:0.04em;">
          You're getting this email because you requested early access at fuelcue.com.
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function confirmationText(firstName: string, sports: string[]): string {
  const sportPhrase = formatSports(sports);
  return [
    `Hey ${firstName} — you're on the fuelcue early-access list.`,
    '',
    "Thanks for signing up. We're letting athletes in gradually so we can shape the product around real race-day feedback.",
    sportPhrase ? `We've noted you're focused on ${sportPhrase} — we'll prioritise routes and products that fit.` : '',
    '',
    "In the next week or two we'll send through your invite link plus a quick walkthrough on planning nutrition for a real course.",
    '',
    "If you have a specific race coming up, reply to this email and tell us what you're training for — it genuinely helps us prioritise.",
    '',
    'Nic — fuelcue',
    APP_URL,
  ].filter(Boolean).join('\n');
}

function adminHtml(d: {
  name: string; email: string; sports: string[]; notes: string | null; docId: string;
}): string {
  const sportsList = d.sports.length ? d.sports.map(escapeHtml).join(', ') : '—';
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;color:#111;font-size:14px;line-height:1.55;">
    <h2 style="margin:0 0 12px;font-size:18px;">New early-access signup</h2>
    <table cellspacing="0" cellpadding="6" border="0" style="border-collapse:collapse;">
      <tr><td style="color:#666;">Name</td><td><b>${escapeHtml(d.name)}</b></td></tr>
      <tr><td style="color:#666;">Email</td><td><a href="mailto:${escapeHtml(d.email)}">${escapeHtml(d.email)}</a></td></tr>
      <tr><td style="color:#666;">Sports</td><td>${sportsList}</td></tr>
      <tr><td style="color:#666;vertical-align:top;">Notes</td><td>${d.notes ? escapeHtml(d.notes).replace(/\n/g, '<br />') : '—'}</td></tr>
      <tr><td style="color:#666;">Doc&nbsp;ID</td><td><code>${escapeHtml(d.docId)}</code></td></tr>
    </table>
  </div>`;
}

function adminText(d: {
  name: string; email: string; sports: string[]; notes: string | null; docId: string;
}): string {
  return [
    'New early-access signup',
    '',
    `Name:   ${d.name}`,
    `Email:  ${d.email}`,
    `Sports: ${d.sports.length ? d.sports.join(', ') : '—'}`,
    `Notes:  ${d.notes || '—'}`,
    `Doc:    ${d.docId}`,
  ].join('\n');
}

function formatSports(sports: string[]): string {
  if (sports.length === 0) return '';
  if (sports.length === 1) return sports[0];
  if (sports.length === 2) return `${sports[0]} and ${sports[1]}`;
  return `${sports.slice(0, -1).join(', ')}, and ${sports[sports.length - 1]}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return c;
    }
  });
}
