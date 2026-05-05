/**
 * Cross-platform file download helper.
 *
 * The `<a download>` + Blob URL pattern works on desktop but iOS Safari
 * (and most mobile browsers) ignore the `download` attribute on Blob
 * URLs — they open the file inline instead of saving. The Web Share API
 * with a File payload is the supported path on mobile: the OS share
 * sheet appears with "Save to Files", "AirDrop", "Messages", etc.
 *
 * Strategy:
 *   1. If the browser can share Files (mobile primarily), use
 *      `navigator.share({ files: [...] })` so the user gets the native
 *      share sheet and an explicit "save" affordance.
 *   2. Otherwise fall back to the classic anchor-click pattern.
 *
 * Returns a promise that resolves once the download/share is fired
 * (not necessarily when the user picks an action — the share sheet is
 * non-blocking from our perspective).
 */
export async function downloadFile(
  blob: Blob,
  filename: string,
  mimeType: string,
): Promise<void> {
  // Web Share Level 2 (files) — supported on iOS 15+, Android Chrome.
  // canShare is the cheap pre-check; it returns false when the browser
  // either lacks file-share support or the file type is blocked.
  const file = new File([blob], filename, { type: mimeType });
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
  };
  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (err) {
      // User cancelled the share sheet — that's not an error, just bail.
      // Anything else falls through to the anchor download as a backup.
      const e = err as { name?: string };
      if (e?.name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  // Some browsers require the link to be in the DOM for click() to fire.
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so the browser has time to start the download — on
  // some mobile browsers an immediate revoke nukes the in-flight stream.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
