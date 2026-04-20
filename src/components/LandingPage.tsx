import { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useSpring, MotionValue } from 'framer-motion';
import { Zap, Download, Route as RouteIcon, Cloud, Star, ArrowRight, Activity, Bike, Footprints, Timer, BarChart3, ChevronRight, Flag, MapPin } from 'lucide-react';

/* ── Reveal on scroll ── */
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, delay, ease: [0.25, 1, 0.5, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ════════════════════════════════════════════════
   THE ROUTE — full-page scroll-driven elevation path
   ════════════════════════════════════════════════ */

// Precomputed path + checkpoint positions.
// ViewBox is 100 wide × 2400 tall; preserveAspectRatio="none" stretches it to the container.
// Path weaves left/right in a continuous S-curve with subtle vertical variation.
const ROUTE_PATH =
  'M 50 0 ' +
  'C 30 80, 18 180, 52 260 ' +
  'C 86 340, 88 440, 48 520 ' +
  'C 14 600, 12 720, 50 800 ' +
  'C 88 880, 92 1000, 52 1080 ' +
  'C 18 1160, 14 1280, 50 1360 ' +
  'C 86 1440, 90 1560, 48 1640 ' +
  'C 16 1720, 18 1840, 52 1920 ' +
  'C 84 2000, 90 2120, 50 2200 ' +
  'C 30 2280, 34 2360, 50 2400';

function RouteTrail({ scrollYProgress }: { scrollYProgress: MotionValue<number> }) {
  const smoothed = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.8 });
  const pathLength = useTransform(smoothed, [0, 1], [0, 1]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
      <svg
        viewBox="0 0 100 2400"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="routeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#F5A020" />
            <stop offset="50%"  stopColor="#E8671A" />
            <stop offset="100%" stopColor="#3D2152" />
          </linearGradient>
          <linearGradient id="routeGlowGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#F5A020" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#3D2152" stopOpacity={0.25} />
          </linearGradient>
        </defs>

        {/* Unwalked path — hairline */}
        <path
          d={ROUTE_PATH}
          stroke="#3D2152"
          strokeOpacity={0.08}
          strokeWidth={0.8}
          fill="none"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Single soft glow under the walked line */}
        <motion.path
          d={ROUTE_PATH}
          stroke="url(#routeGlowGrad)"
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ pathLength }}
          strokeOpacity={0.45}
        />

        {/* Main route — single elegant stroke */}
        <motion.path
          d={ROUTE_PATH}
          stroke="url(#routeGradient)"
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ pathLength }}
        />
      </svg>
    </div>
  );
}

/* ── Nav progress indicator — "you are here" km counter ── */
function ScrollKmBadge({ progress }: { progress: MotionValue<number> }) {
  const [km, setKm] = useState(0);
  useEffect(() => {
    return progress.on('change', (v) => setKm(Math.round(v * 42.2 * 10) / 10));
  }, [progress]);
  return (
    <div className="hidden sm:flex items-center gap-2 text-[10px] font-display tracking-[0.2em] text-[#6B5A7A] uppercase">
      <span className="h-1.5 w-1.5 rounded-full bg-[#F5A020] animate-pulse" />
      {km.toFixed(1)} km
    </div>
  );
}

/* ════════════════════════════════════════════════
   LANDING PAGE
   ════════════════════════════════════════════════ */
export function LandingPage({ onEnterApp }: { onEnterApp: () => void }) {
  const pageRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: pageRef, offset: ['start start', 'end end'] });

  const heroY = useTransform(scrollYProgress, [0, 0.15], [0, -80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0.6]);

  return (
    <div ref={pageRef} className="relative min-h-screen bg-[#FFF9F0] text-[#2A1639] overflow-x-hidden font-sans selection:bg-[#F5A020]/20">

      {/* Subtle grain overlay for that tactile, premium feel */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[60] opacity-[0.035] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.65 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Warm atmospheric glows — live with the page */}
      <div className="pointer-events-none absolute top-[8%] right-[-10%] w-[420px] lg:w-[620px] h-[420px] lg:h-[620px] rounded-full bg-[#FFCD6B]/25 blur-[160px]" />
      <div className="pointer-events-none absolute top-[45%] left-[-10%] w-[320px] lg:w-[480px] h-[320px] lg:h-[480px] rounded-full bg-[#F5A020]/15 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-[5%] right-[-8%] w-[380px] lg:w-[520px] h-[380px] lg:h-[520px] rounded-full bg-[#3D2152]/10 blur-[160px]" />

      {/* ── THE ROUTE — behind everything ── */}
      <RouteTrail scrollYProgress={scrollYProgress} />

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 lg:px-14 py-3 flex items-center justify-between bg-[#FFF9F0]/80 backdrop-blur-xl border-b border-[#3D2152]/[0.06]">
        <img src="/logo.png" alt="fuelcue" className="h-8 sm:h-10 w-auto object-contain" />
        <div className="hidden md:flex items-center gap-8 text-[13px] text-[#6B5A7A] font-medium">
          <a href="#features" className="hover:text-[#3D2152] transition-colors">Features</a>
          <a href="#races" className="hover:text-[#3D2152] transition-colors">Races</a>
          <a href="#how" className="hover:text-[#3D2152] transition-colors">How it works</a>
          <ScrollKmBadge progress={scrollYProgress} />
        </div>
        <button
          onClick={onEnterApp}
          className="group flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl bg-[#3D2152] text-white text-xs sm:text-[13px] font-bold hover:bg-[#5C2D6E] transition-colors"
        >
          Open App
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </nav>

      {/* Top scroll progress bar */}
      <motion.div
        style={{ scaleX: scrollYProgress, transformOrigin: '0% 50%' }}
        className="fixed top-[54px] sm:top-[60px] left-0 right-0 h-[2px] z-50 bg-gradient-to-r from-[#F5A020] via-[#E8671A] to-[#3D2152]"
      />

      {/* ═══ HERO ═══ */}
      <motion.section style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 pt-32 sm:pt-40 lg:pt-44 pb-20 lg:pb-28 min-h-[100vh] flex items-center">
        <div className="relative w-full max-w-[1400px] mx-auto px-6 lg:px-14 grid lg:grid-cols-12 gap-10 items-center">

          {/* Left column — typography-led hero */}
          <div className="lg:col-span-7 relative">
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="flex items-center gap-3 mb-8"
            >
              <div className="h-px w-12 bg-[#F5A020]" />
              <span className="text-[11px] font-display uppercase tracking-[0.28em] font-semibold text-[#F5A020]">
                Route Aware Nutrition
              </span>
            </motion.div>

            <h1
              className="font-display font-black leading-[0.95] tracking-[-0.03em] text-[#3D2152]"
              style={{ fontSize: 'clamp(2.25rem, 5.2vw, 4.25rem)' }}
            >
              <motion.span
                className="block"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.15, ease: [0.25, 1, 0.5, 1] }}
              >
                Know what to <span className="italic font-light text-[#F5A020]">fuel</span>,
              </motion.span>
              <motion.span
                className="block"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.28, ease: [0.25, 1, 0.5, 1] }}
              >
                when <span className="italic font-light text-[#E8671A]">&amp; where</span>.
              </motion.span>
            </h1>

            <motion.p
              className="mt-8 max-w-[520px] text-base sm:text-lg text-[#6B5A7A] leading-relaxed"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55 }}
            >
              Plan nutrition on the actual course. Drop gels on climbs. Time caffeine for the final push.
              Export cue-ready waypoints to your watch.
            </motion.p>

            <motion.div
              className="mt-10 flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
            >
              <button
                onClick={onEnterApp}
                className="group relative flex items-center gap-2.5 px-7 py-4 rounded-2xl bg-[#3D2152] text-white font-bold text-[13px] uppercase tracking-wider overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-[#F5A020] to-[#E8671A] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <span className="relative flex items-center gap-2.5">
                  Plan your race
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
              </button>
            </motion.div>

            <motion.div
              className="mt-10 flex flex-wrap items-center gap-5 text-[11px] font-display uppercase tracking-[0.15em] text-[#6B5A7A]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.9 }}
            >
              <span className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-[#F5A020]" /> 120+ products</span>
              <span className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-[#E8671A]" /> Garmin cues</span>
            </motion.div>
          </div>

          {/* Right column — live start-line card (replaces the photo) */}
          <motion.div
            initial={{ opacity: 0, y: 30, rotate: -1 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.9, delay: 0.5, ease: [0.25, 1, 0.5, 1] }}
            className="lg:col-span-5 relative"
          >
            <div className="relative rounded-[2rem] bg-white/70 backdrop-blur-xl border border-[#3D2152]/10 p-6 lg:p-7 shadow-[0_40px_80px_-30px_rgba(61,33,82,0.25)]">
              {/* Corner meta */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#F5A020] animate-pulse" />
                  <span className="text-[10px] font-display font-bold uppercase tracking-[0.2em] text-[#3D2152]">
                    Live Plan
                  </span>
                </div>
                <span className="text-[10px] font-display uppercase tracking-[0.2em] text-[#A0929E]">
                  42.2 km
                </span>
              </div>

              {/* Mini elevation profile */}
              <div className="relative h-28 lg:h-32 rounded-xl bg-[#FFF5E8]/60 overflow-hidden border border-[#3D2152]/[0.06]">
                <svg viewBox="0 0 400 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="miniFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F5A020" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#3D2152" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,65 C40,50 70,75 110,55 C150,30 180,62 220,40 C260,20 300,48 340,30 C370,18 385,25 400,35 L400,100 L0,100 Z"
                    fill="url(#miniFill)"
                  />
                  <path
                    d="M0,65 C40,50 70,75 110,55 C150,30 180,62 220,40 C260,20 300,48 340,30 C370,18 385,25 400,35"
                    fill="none"
                    stroke="#E8671A"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                  {/* Fuel dots on the profile */}
                  {[
                    { x: 65,  y: 62, c: '#F5A020' },
                    { x: 155, y: 45, c: '#3D2152' },
                    { x: 240, y: 33, c: '#E8671A' },
                    { x: 330, y: 28, c: '#5C2D6E' },
                  ].map((d, i) => (
                    <g key={i}>
                      <circle cx={d.x} cy={d.y} r={6} fill={d.c} opacity={0.22} />
                      <circle cx={d.x} cy={d.y} r={3.2} fill={d.c} stroke="#FFF9F0" strokeWidth={1} />
                    </g>
                  ))}
                </svg>

                <div className="absolute top-2 left-3 text-[9px] font-display uppercase tracking-widest text-[#6B5A7A]">
                  Elevation · 420m
                </div>
                <div className="absolute bottom-2 right-3 text-[9px] font-display uppercase tracking-widest text-[#6B5A7A]">
                  4 fuel points
                </div>
              </div>

              {/* Cue list */}
              <div className="mt-4 space-y-1.5">
                {[
                  { k: '5.2 km',  p: '226ERS High Fructose', g: '30g', c: '#F5A020' },
                  { k: '12.0 km', p: 'Styrkr MIX90 Bottle',  g: '90g', c: '#3D2152' },
                  { k: '21.1 km', p: '32Gi Endure Chews',    g: '25g', c: '#E8671A' },
                  { k: '32.0 km', p: 'NeverSecond C30+CAF',  g: '30g', c: '#5C2D6E' },
                ].map((row, i) => (
                  <div
                    key={row.k}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#FFF9F0]/70 hover:bg-[#FFF9F0] transition-colors"
                    style={{ animationDelay: `${0.9 + i * 0.12}s` }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: row.c }} />
                    <span className="text-[11px] font-display font-bold tracking-wide text-[#3D2152] w-14">{row.k}</span>
                    <span className="text-[12px] text-[#3D2152] flex-1 truncate">{row.p}</span>
                    <span className="text-[10px] font-display font-bold text-[#6B5A7A]">{row.g}</span>
                  </div>
                ))}
              </div>

              {/* Footer summary */}
              <div className="mt-5 pt-4 border-t border-[#3D2152]/[0.08] grid grid-cols-3 text-center">
                <div>
                  <div className="text-[9px] font-display uppercase tracking-widest text-[#A0929E]">Carbs</div>
                  <div className="text-sm font-display font-black text-[#3D2152]">175g</div>
                </div>
                <div className="border-x border-[#3D2152]/[0.08]">
                  <div className="text-[9px] font-display uppercase tracking-widest text-[#A0929E]">Sodium</div>
                  <div className="text-sm font-display font-black text-[#3D2152]">2.1g</div>
                </div>
                <div>
                  <div className="text-[9px] font-display uppercase tracking-widest text-[#A0929E]">Caffeine</div>
                  <div className="text-sm font-display font-black text-[#3D2152]">75mg</div>
                </div>
              </div>
            </div>

            {/* Floating micro-stats */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.1 }}
              className="hidden lg:flex absolute -left-8 top-12 bg-[#3D2152] text-white rounded-xl px-3.5 py-2.5 shadow-2xl shadow-[#3D2152]/20 border border-white/10"
            >
              <div>
                <div className="text-[8px] font-display uppercase tracking-[0.2em] text-[#F5A020]">Bonk risk</div>
                <div className="text-xs font-display font-black mt-0.5">Low · 4%</div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.25 }}
              className="hidden lg:flex absolute -right-6 bottom-20 bg-white border border-[#3D2152]/10 rounded-xl px-3.5 py-2.5 shadow-2xl shadow-[#3D2152]/10"
            >
              <div>
                <div className="text-[8px] font-display uppercase tracking-[0.2em] text-[#E8671A]">Temp adj</div>
                <div className="text-xs font-display font-black text-[#3D2152] mt-0.5">+12% sodium</div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.8 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[9px] font-display uppercase tracking-[0.3em] text-[#6B5A7A]"
        >
          <span>Scroll the course</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            className="h-6 w-px bg-gradient-to-b from-[#F5A020] to-transparent"
          />
        </motion.div>
      </motion.section>


      {/* ═══ FEATURES — "Fuel drops" ═══ */}
      <section id="features" className="relative z-10 py-24 lg:py-36">
        <div className="px-6 lg:px-14 max-w-[1400px] mx-auto">
          <Reveal>
            <div className="mb-14 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-px w-12 bg-[#E8671A]" />
                  <span className="text-[11px] font-display uppercase tracking-[0.28em] font-semibold text-[#E8671A]">
                    KM 5 · The toolkit
                  </span>
                </div>
                <h2
                  className="font-display font-black tracking-[-0.02em] text-[#3D2152] leading-[0.98]"
                  style={{ fontSize: 'clamp(1.75rem, 3.8vw, 3rem)' }}
                >
                  Every tool you need.<br />
                  <span className="italic font-light text-[#A0929E]">Nothing you don&apos;t.</span>
                </h2>
              </div>
              <p className="max-w-md text-sm text-[#6B5A7A] leading-relaxed">
                Eight focused tools that do one thing well &mdash; built from hundreds of conversations with
                ultra runners, Ironman athletes, and weekend racers.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: <RouteIcon className="w-5 h-5 text-[#3D2152]" />, iconBg: 'bg-[#3D2152]/10', title: 'Draw Routes', desc: 'Click waypoints snap to real roads. Import GPX or pull from Strava.', num: '01' },
              { icon: <Zap className="w-5 h-5 text-[#F5A020]" />, iconBg: 'bg-[#F5A020]/10', title: 'Auto-Generate', desc: 'Science-backed plans from terrain, duration, weight and sweat rate. One click.', num: '02' },
              { icon: <Download className="w-5 h-5 text-[#3D2152]" />, iconBg: 'bg-[#3D2152]/10', title: 'Export to Watch', desc: 'Smart GPX cues for Garmin. PDF race sheets. Share images for socials.', num: '03' },
              { icon: <Cloud className="w-5 h-5 text-[#E8671A]" />, iconBg: 'bg-[#E8671A]/10', title: 'Race Weather', desc: '16-day forecast. Hot day? Sodium & hydration targets adjust automatically.', num: '04' },
              { icon: <Star className="w-5 h-5 text-[#F5A020]" />, iconBg: 'bg-[#F5A020]/10', title: '120+ Products', desc: 'Real prices. 32Gi, Styrkr, NeverSecond, SiS. Rate & track gut comfort.', num: '05' },
              { icon: <BarChart3 className="w-5 h-5 text-[#5C2D6E]" />, iconBg: 'bg-[#5C2D6E]/10', title: 'Nutrition Profile', desc: 'Track carbs across races. Log bonking & feedback. See trends over time.', num: '06' },
              { icon: <Activity className="w-5 h-5 text-[#E8671A]" />, iconBg: 'bg-[#E8671A]/10', title: 'Strava Sync', desc: 'Import activities. Sync weight & FTP. Post plans as share-ready images.', num: '07' },
              { icon: <Timer className="w-5 h-5 text-[#3D2152]" />, iconBg: 'bg-[#3D2152]/10', title: 'Run Feedback', desc: 'Rate execution, bonking, gut issues after each run. Build your intelligence.', num: '08' },
            ].map((f, i) => (
              <Reveal key={i} delay={(i % 4) * 0.08}>
                <div className="group h-full rounded-2xl bg-white/80 backdrop-blur-sm border border-[#3D2152]/[0.08] p-6 hover:border-[#F5A020]/40 hover:bg-white hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(61,33,82,0.15)] transition-all duration-500">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl ${f.iconBg} flex items-center justify-center`}>{f.icon}</div>
                    <span className="text-[10px] font-display font-black tracking-widest text-[#3D2152]/20 group-hover:text-[#F5A020]/60 transition-colors">
                      {f.num}
                    </span>
                  </div>
                  <h3 className="text-[15px] font-display font-bold text-[#3D2152] mb-1.5">{f.title}</h3>
                  <p className="text-[13px] text-[#6B5A7A] leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ RACE SCENARIOS — "Segments of the course" ═══ */}
      <section id="races" className="relative z-10 py-24 lg:py-36 border-t border-[#3D2152]/[0.06]">
        <div className="px-6 lg:px-14 max-w-[1400px] mx-auto">
          <Reveal>
            <div className="mb-14 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-px w-12 bg-[#3D2152]" />
                  <span className="text-[11px] font-display uppercase tracking-[0.28em] font-semibold text-[#3D2152]">
                    KM 21 · Built for your race
                  </span>
                </div>
                <h2
                  className="font-display font-black tracking-[-0.02em] text-[#3D2152] leading-[0.98]"
                  style={{ fontSize: 'clamp(1.75rem, 3.8vw, 3rem)' }}
                >
                  From Comrades<br />
                  <span className="italic font-light text-[#E8671A]">to your local 10k.</span>
                </h2>
              </div>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-4 lg:gap-6">
            {[
              {
                region: 'Durban – PMB', name: 'Comrades Ultra', dist: '89km', accent: '#F5A020',
                stats: [['380g', 'carbs'], ['4.2g', 'sodium'], ['14', 'pts'], ['8:30', 'time']],
                products: ['32Gi Race Pro', '32Gi Endure', 'PVM Octane', '32Gi Chews'],
                tip: 'Start conservative. The back half destroys runners who front-load caffeine.',
                label: 'Pro tip',
              },
              {
                region: 'Green Point – Constantia', name: 'Cape Town Marathon', dist: '42.2km', accent: '#E8671A',
                stats: [['210g', 'carbs'], ['2.1g', 'sodium'], ['8', 'pts'], ['3:45', 'time']],
                products: ['226ERS HF Gel', 'Styrkr MIX90', 'SiS Beta Fuel'],
                tip: 'Hot coastal route. Increase sodium by 30% when temps exceed 25°C.',
                label: 'Pro tip',
              },
              {
                region: '2,100m climbing', name: 'Cape Epic Stage', dist: '98km MTB', accent: '#5C2D6E',
                stats: [['420g', 'carbs'], ['5.1g', 'sodium'], ['16', 'pts'], ['5:20', 'time']],
                products: ['NeverSecond C90', 'Styrkr BAR50', 'Skratch Labs', 'Enduren Gel'],
                tip: 'Solid food on flats. Switch to gels and liquids for the final climbs.',
                label: 'Pro tip',
              },
            ].map((r, i) => (
              <Reveal key={r.name} delay={i * 0.12}>
                <div
                  className="group h-full rounded-2xl bg-white/80 backdrop-blur-sm border border-[#3D2152]/[0.08] p-7 hover:border-[color:var(--accent)]/40 hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(61,33,82,0.2)] transition-all duration-500"
                  style={{ ['--accent' as string]: r.accent }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-display font-medium text-[#A0929E] uppercase tracking-wider">{r.region}</span>
                    <span className="text-[10px] font-display font-black" style={{ color: r.accent }}>{r.dist}</span>
                  </div>
                  <h3 className="text-xl font-display font-black text-[#3D2152] mb-5 tracking-tight">{r.name}</h3>
                  <div className="grid grid-cols-4 gap-1 mb-5 p-3 rounded-xl bg-[#FFF5E8]/70 border border-[#3D2152]/[0.05]">
                    {r.stats.map(([v, k]) => (
                      <div key={k} className="text-center">
                        <div className="text-xs font-display font-black text-[#3D2152]">{v}</div>
                        <div className="text-[8px] font-display text-[#A0929E] uppercase tracking-wider mt-0.5">{k}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {r.products.map((p) => (
                      <span key={p} className="px-2 py-0.5 rounded-md text-[9px] font-display text-[#3D2152] bg-white border border-[#3D2152]/10">
                        {p}
                      </span>
                    ))}
                  </div>
                  <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#FFF5E8]/80 to-transparent border border-[color:var(--accent)]/15">
                    <div className="text-[9px] font-display uppercase tracking-[0.2em] font-bold mb-1" style={{ color: r.accent }}>
                      {r.label}
                    </div>
                    <p className="text-[12px] text-[#6B5A7A] leading-relaxed">{r.tip}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ BRANDS MARQUEE ═══ */}
      <section className="relative z-10 py-8 lg:py-10 border-y border-[#3D2152]/[0.06] overflow-hidden bg-[#FFF9F0]/60 backdrop-blur-sm">
        <motion.div
          className="flex items-center gap-16 whitespace-nowrap"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
        >
          {[0, 1].map((r) => (
            <div key={r} className="flex items-center gap-16">
              {['226ERS', '32Gi', 'Styrkr', 'NeverSecond', 'High Five', 'Science in Sport', 'Skratch Labs', 'Enduren', 'PVM', 'Named Sport', 'Pace Power'].map((b) => (
                <span key={`${r}-${b}`} className="text-sm font-display font-bold text-[#A0929E] hover:text-[#3D2152] transition-colors">
                  {b}
                </span>
              ))}
            </div>
          ))}
        </motion.div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="how" className="relative z-10 py-24 lg:py-36">
        <div className="px-6 lg:px-14 max-w-[1400px] mx-auto">
          <Reveal>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between mb-16 gap-4">
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-px w-12 bg-[#F5A020]" />
                  <span className="text-[11px] font-display uppercase tracking-[0.28em] font-semibold text-[#F5A020]">
                    KM 30 · How it works
                  </span>
                </div>
                <h2
                  className="font-display font-black tracking-[-0.02em] text-[#3D2152] leading-[0.98]"
                  style={{ fontSize: 'clamp(1.75rem, 3.8vw, 3rem)' }}
                >
                  Three steps.<br />
                  <span className="italic font-light text-[#A0929E]">Zero bonking.</span>
                </h2>
              </div>
              <button
                onClick={onEnterApp}
                className="hidden lg:flex items-center gap-2 text-[#3D2152] text-[13px] font-display font-bold hover:gap-3 transition-all"
              >
                Try it now <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-10">
            {[
              { icon: <RouteIcon className="w-5 h-5 text-[#3D2152]" />, bg: 'bg-[#3D2152]/10', num: '01',
                t: 'Load your route', d: 'Import GPX, pull from Strava, or draw on the map. Elevation and terrain analysis included.' },
              { icon: <Zap className="w-5 h-5 text-[#F5A020]" />, bg: 'bg-[#F5A020]/10', num: '02',
                t: 'Plan your nutrition', d: 'Auto-generate a science-backed plan or drag products onto the course. Adjust for weather.' },
              { icon: <Download className="w-5 h-5 text-[#E8671A]" />, bg: 'bg-[#E8671A]/10', num: '03',
                t: 'Race with confidence', d: 'Export to your watch with clear waypoint cues. Log feedback after. Get better every race.' },
            ].map((s, i) => (
              <Reveal key={s.num} delay={i * 0.12}>
                <div className="relative pt-16 text-center flex flex-col items-center">
                  <span
                    className="absolute -top-4 left-1/2 -translate-x-1/2 text-[120px] font-display font-black select-none pointer-events-none leading-none"
                    style={{ color: ['#3D2152', '#F5A020', '#E8671A'][i], opacity: 0.07 }}
                  >
                    {s.num}
                  </span>
                  <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center mb-5 relative z-10`}>{s.icon}</div>
                  <h3 className="text-xl font-display font-black text-[#3D2152] mb-2 relative z-10 tracking-tight">{s.t}</h3>
                  <p className="text-[14px] text-[#6B5A7A] leading-relaxed relative z-10 max-w-xs">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ DISCIPLINES ═══ */}
      <section className="relative z-10 py-10 border-y border-[#3D2152]/[0.06] overflow-hidden bg-[#FFF9F0]/60 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-center gap-10 lg:gap-16 px-6">
          {[
            { icon: Footprints, l: 'Road Running' },
            { icon: Footprints, l: 'Trail Running' },
            { icon: Bike, l: 'Road Cycling' },
            { icon: Bike, l: 'Gravel' },
            { icon: Timer, l: 'Triathlon' },
            { icon: Activity, l: 'Ultra' },
          ].map(({ icon: I, l }) => (
            <div key={l} className="flex items-center gap-2 text-[#A0929E]">
              <I className="w-4 h-4" />
              <span className="text-[11px] font-display uppercase tracking-[0.2em] font-medium">{l}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FINISH LINE CTA ═══ */}
      <section className="relative z-10 py-32 lg:py-48 overflow-hidden">
        <div className="relative z-10 px-6 lg:px-14 max-w-[1400px] mx-auto text-center">
          <Reveal>
            <div className="inline-flex items-center gap-3 mb-8">
              <MapPin className="w-4 h-4 text-[#F5A020]" />
              <span className="text-[11px] font-display uppercase tracking-[0.3em] font-bold text-[#3D2152]">
                42.2 km · Finish
              </span>
              <Flag className="w-4 h-4 text-[#E8671A]" />
            </div>
          </Reveal>
          <Reveal delay={0.12}>
            <h2
              className="font-display font-black tracking-[-0.03em] leading-[0.95] text-[#3D2152] mb-6"
              style={{ fontSize: 'clamp(2.25rem, 5.5vw, 4.5rem)' }}
            >
              Stop guessing.<br />
              <span className="italic font-light text-[#F5A020]">Start fueling.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.25}>
            <p className="text-base lg:text-lg text-[#6B5A7A] max-w-md mx-auto mb-10">
              Drop a GPX and start planning in under 30 seconds.
            </p>
          </Reveal>
          <Reveal delay={0.35}>
            <button
              onClick={onEnterApp}
              className="group relative inline-flex items-center gap-3 px-10 py-5 rounded-2xl bg-[#3D2152] text-white font-display font-bold text-base overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-[#F5A020] via-[#E8671A] to-[#3D2152] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <span className="relative flex items-center gap-3">
                Open fuelcue
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </Reveal>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="relative z-10 py-12 bg-[#3D2152]">
        <div className="px-6 lg:px-14 max-w-[1400px] mx-auto flex flex-col items-center gap-3">
          <img src="/logo-white.png" alt="fuelcue — Route Aware Nutrition" className="h-14 w-auto object-contain" />
          <span className="text-[11px] text-white/40 font-display tracking-wide">Built for athletes who refuse to bonk</span>
        </div>
      </footer>
    </div>
  );
}
