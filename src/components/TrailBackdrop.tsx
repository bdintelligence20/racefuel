/**
 * TrailBackdrop — a quiet, layered ridgeline with a winding route line,
 * drawn in the pine palette so the signed-in surface never opens on a blank
 * white screen. Everything is painted through the theme tokens
 * (--color-accent / -light / -muted / route) at low opacity, so it adapts on
 * its own: three pine greens in light mode, three soft cream tones on plum in
 * dark. It is decorative only — aria-hidden, no pointer events — and sits far
 * enough back (opacities 0.05–0.12) that dense content still reads on top.
 *
 * preserveAspectRatio="xMidYMax slice" anchors the ridges to the bottom edge
 * whatever the pane size, and fades to transparent up top so the paper ground
 * carries the upper half.
 */
export function TrailBackdrop({
  className = '',
  showRoute = true,
}: {
  className?: string;
  /** The dashed route trace is right for open hero screens, but it crosses
   *  dense content (e.g. the fuel spine's rows and numbers). Set false there
   *  to keep only the ridges. */
  showRoute?: boolean;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Soft haze so the ridges dissolve into the paper rather than
            cutting a hard line across the screen. */}
        <linearGradient id="fc-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-accent-light)" stopOpacity="0" />
          <stop offset="0.72" stopColor="var(--color-accent-light)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--color-accent-light)" stopOpacity="0.06" />
        </linearGradient>
        <radialGradient id="fc-sun" cx="0.78" cy="0.24" r="0.42">
          <stop offset="0" stopColor="var(--color-golden)" stopOpacity="0.10" />
          <stop offset="1" stopColor="var(--color-golden)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Atmosphere */}
      <rect x="0" y="0" width="1440" height="900" fill="url(#fc-sky)" />
      <rect x="0" y="0" width="1440" height="900" fill="url(#fc-sun)" />

      {/* Far ridge — palest, gentlest */}
      <path
        d="M0,560 C180,500 320,542 480,502 C640,462 820,430 1000,472 C1180,514 1320,520 1440,474 L1440,900 L0,900 Z"
        fill="var(--color-accent-light)"
        fillOpacity="0.06"
      />
      {/* Mid ridge */}
      <path
        d="M0,662 C220,600 360,652 560,612 C760,572 900,548 1120,602 C1280,642 1360,652 1440,614 L1440,900 L0,900 Z"
        fill="var(--color-accent)"
        fillOpacity="0.08"
      />
      {/* Near ridge — deepest, boldest */}
      <path
        d="M0,764 C200,724 380,772 600,732 C820,692 980,684 1200,742 C1330,776 1390,782 1440,754 L1440,900 L0,900 Z"
        fill="var(--color-accent-muted)"
        fillOpacity="0.11"
      />

      {/* The route — a winding line climbing into the hills, dashed like a
          course trace. This is the brand's "route aware" idea as texture.
          Hidden behind dense content so it never crosses rows or numbers. */}
      {showRoute && (
        <>
          <path
            d="M690,900 C672,824 748,792 712,724 C676,656 604,632 664,566 C712,514 806,506 770,440 C742,388 786,352 828,332"
            fill="none"
            stroke="var(--color-accent)"
            strokeOpacity="0.22"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="1 12"
          />
          {/* A single marker where the route crests the near ridge */}
          <circle cx="828" cy="332" r="4.5" fill="var(--color-accent)" fillOpacity="0.30" />
        </>
      )}
    </svg>
  );
}
