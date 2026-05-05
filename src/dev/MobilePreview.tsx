import { useState } from 'react';

/**
 * Local mobile testing harness. Renders the SPA inside a phone-sized
 * iframe with a device frame so we can inspect mobile UX on desktop
 * with full hot reload, no need to deploy + reload on a real phone.
 *
 * Available at /dev/preview in dev mode only. The iframe loads the app
 * with ?devbypass=1, which AuthContext picks up and injects a mock
 * signed-in user — bypassing Firebase Auth entirely so we can hit
 * /app, the Map tab, the Fuel tab, etc. without setup.
 *
 * Real-phone testing: `npm run dev -- --host` exposes the dev server on
 * the LAN. Type the printed IP on your phone and add ?devbypass=1.
 */

const DEVICES: Record<string, { w: number; h: number; ua?: string }> = {
  'iPhone 14 Pro':       { w: 393, h: 852 },
  'iPhone 14':           { w: 390, h: 844 },
  'iPhone SE':           { w: 375, h: 667 },
  'iPhone 16 Pro Max':   { w: 430, h: 932 },
  'Galaxy S22':          { w: 360, h: 780 },
  'Pixel 7':             { w: 412, h: 915 },
  'iPad Mini':           { w: 768, h: 1024 },
};

const PATHS = [
  { label: '/ (landing)', path: '/' },
  { label: '/app', path: '/app' },
  { label: '/checkout-test', path: '/checkout-test' },
  { label: '/admin/orders', path: '/admin/orders' },
];

export function MobilePreview() {
  const [device, setDevice] = useState('iPhone 14');
  const [path, setPath] = useState(PATHS[1]);
  const [reloadKey, setReloadKey] = useState(0);

  const { w, h } = DEVICES[device];

  function buildSrc() {
    const url = new URL(path.path, window.location.origin);
    url.searchParams.set('devbypass', '1');
    url.searchParams.set('_r', String(reloadKey));
    return url.toString();
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a1a', color: '#eee', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ padding: 16, borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <strong>fuelcue dev preview</strong>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          Device:
          <select
            value={device}
            onChange={(e) => setDevice(e.target.value)}
            style={{ background: '#222', color: '#eee', border: '1px solid #444', padding: '4px 8px', borderRadius: 6 }}
          >
            {Object.keys(DEVICES).map((d) => (
              <option key={d} value={d}>{d} ({DEVICES[d].w}×{DEVICES[d].h})</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          Page:
          <select
            value={path.label}
            onChange={(e) => setPath(PATHS.find((p) => p.label === e.target.value)!)}
            style={{ background: '#222', color: '#eee', border: '1px solid #444', padding: '4px 8px', borderRadius: 6 }}
          >
            {PATHS.map((p) => (
              <option key={p.label} value={p.label}>{p.label}</option>
            ))}
          </select>
        </label>

        <button
          onClick={() => setReloadKey((k) => k + 1)}
          style={{ background: '#444', color: '#eee', border: 0, padding: '6px 12px', borderRadius: 6, cursor: 'pointer' }}
        >
          ↻ Reload iframe
        </button>

        <span style={{ fontSize: 11, color: '#888', marginLeft: 'auto' }}>
          Tip: dev server on LAN — open <code>npm run dev:mobile</code> for the IP to test on a real phone.
        </span>
      </div>

      <div style={{ display: 'grid', placeItems: 'center', padding: 32 }}>
        <div
          style={{
            width: w,
            height: h,
            border: '12px solid #2a2a2a',
            borderRadius: 36,
            overflow: 'hidden',
            background: '#000',
            boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
            position: 'relative',
          }}
        >
          {/* Camera notch (purely decorative) */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: w * 0.3,
              height: 22,
              background: '#111',
              borderRadius: '0 0 12px 12px',
              zIndex: 10,
            }}
          />
          <iframe
            key={`${device}-${path.label}-${reloadKey}`}
            src={buildSrc()}
            title="fuelcue mobile preview"
            allow="geolocation; clipboard-write"
            style={{ width: '100%', height: '100%', border: 0, background: '#fff' }}
          />
        </div>
      </div>
    </div>
  );
}
