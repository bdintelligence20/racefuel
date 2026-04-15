import { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { Zap, Download, Route, Cloud, Star, ArrowRight, Activity, Bike, Footprints, Timer, BarChart3, ChevronRight } from 'lucide-react';

/* ── Animated counter ── */
function useCountUp(end: number, duration = 2000) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  useEffect(() => {
    if (!inView) return;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      setCount(Math.floor((1 - Math.pow(1 - p, 3)) * end));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, end, duration]);
  return { count, ref };
}

/* ── Reveal on scroll ── */
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6, delay, ease: [0.25, 1, 0.5, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}


/* ══════════════════════════════════════════
   LANDING PAGE
   ══════════════════════════════════════════ */
export function LandingPage({ onEnterApp }: { onEnterApp: () => void }) {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -60]);
  const athletes = useCountUp(2847);
  const routesN = useCountUp(12400);
  const carbsN = useCountUp(890);

  return (
    <div className="min-h-screen bg-[#FFF9F0] text-[#2A1639] overflow-x-hidden font-sans selection:bg-[#3D2152]/10">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 lg:px-14 py-3 flex items-center justify-between bg-[#FFF9F0]/90 backdrop-blur-lg border-b border-[#3D2152]/[0.06]">
        <img
          src="/logo.png"
          alt="fuelcue"
          className="h-8 sm:h-10 w-auto object-contain"
        />
        <div className="hidden md:flex items-center gap-8 text-[13px] text-[#6B5A7A] font-medium">
          <a href="#features" className="hover:text-[#3D2152] transition-colors cursor-pointer">Features</a>
          <a href="#races" className="hover:text-[#3D2152] transition-colors cursor-pointer">Races</a>
          <a href="#how" className="hover:text-[#3D2152] transition-colors cursor-pointer">How it works</a>
        </div>
        <button onClick={onEnterApp} className="px-4 sm:px-5 py-2 rounded-xl bg-[#3D2152] text-white text-xs sm:text-[13px] font-bold hover:bg-[#5C2D6E] transition-colors cursor-pointer">
          Open App
        </button>
      </nav>

      {/* ── HERO ── */}
      <motion.section className="relative pt-24 pb-12 lg:pt-40 lg:pb-28 min-h-[100vh] flex items-center" style={{ y: heroY }}>
        {/* Warm BG accents */}
        <div className="absolute top-[10%] right-0 w-[300px] lg:w-[500px] h-[300px] lg:h-[500px] rounded-full bg-[#FFCD6B]/20 blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[20%] left-[5%] w-[200px] lg:w-[350px] h-[200px] lg:h-[350px] rounded-full bg-[#F5A020]/10 blur-[120px] pointer-events-none" />

        <div className="relative z-10 px-5 sm:px-6 lg:px-14 w-full max-w-[1400px] mx-auto">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-6 items-center">

            {/* Left col */}
            <div className="lg:col-span-6">
              <motion.div className="flex items-center gap-3 mb-8"
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}>
                <div className="h-px w-12 bg-[#F5A020]" />
                <span className="text-[11px] font-display uppercase tracking-[0.25em] font-semibold text-[#F5A020]">Route Aware Nutrition</span>
              </motion.div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.5rem] font-display font-black leading-[1.1] tracking-[-0.03em]">
                <motion.span className="block text-[#3D2152]" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
                  Know what to
                </motion.span>
                <motion.span className="block" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}>
                  <span className="text-[#F5A020]">fuel</span><span className="text-[#E0D6CC]">, </span><span className="text-[#E8671A]">when</span><span className="text-[#E0D6CC]">.</span>
                </motion.span>
              </h1>

              <motion.p className="mt-8 text-base lg:text-lg text-[#6B5A7A] max-w-[440px] leading-relaxed"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }}>
                Plan nutrition on the actual course. Drop gels on climbs. Time caffeine for the final push. Export to your watch. Race smarter.
              </motion.p>

              <motion.div className="mt-8 flex flex-wrap gap-3"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.65 }}>
                <button onClick={onEnterApp} className="group flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#3D2152] text-white font-bold text-[13px] uppercase tracking-wider hover:bg-[#5C2D6E] hover:shadow-[0_0_30px_rgba(61,33,82,0.15)] transition-all cursor-pointer">
                  Start Planning <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
                <button className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl border border-[#3D2152]/15 text-[#3D2152] text-[13px] font-medium hover:border-[#3D2152]/30 hover:bg-[#3D2152]/5 transition-all cursor-pointer">
                  <Activity className="w-4 h-4" /> Connect Strava
                </button>
              </motion.div>
            </div>

            {/* Right col — brand illustrated hero */}
            <motion.div className="lg:col-span-6 -mx-5 sm:mx-0"
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}>
              <div className="relative">
                <div className="absolute -inset-6 rounded-[2rem] bg-[#F5A020]/[0.08] blur-2xl pointer-events-none hidden sm:block" />
                <img
                  src="/logo-illustrated.jpg"
                  alt="fuelcue — Route Aware Nutrition — runner on terrain with layered hills and warm sky"
                  className="relative sm:rounded-2xl sm:shadow-2xl shadow-[#3D2152]/10 w-full"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* ── TERRAIN DIVIDER ── */}
      <div className="w-full h-24 -mt-1">
        <svg viewBox="0 0 1200 96" className="w-full h-full" preserveAspectRatio="none">
          <path d="M0,60 C200,20 400,70 600,40 C800,10 1000,50 1200,30 L1200,96 L0,96 Z" fill="#3D2152" fillOpacity="0.04" />
          <path d="M0,75 C300,50 500,80 700,55 C900,30 1100,65 1200,50 L1200,96 L0,96 Z" fill="#F5A020" fillOpacity="0.06" />
        </svg>
      </div>

      {/* ── STATS ── */}
      <section className="py-16 border-y border-[#3D2152]/[0.06]">
        <div className="px-6 lg:px-14 max-w-[1400px] mx-auto grid grid-cols-2 lg:grid-cols-4 gap-10">
          {[
            { ref: athletes.ref, v: athletes.count.toLocaleString(), s: '+', l: 'Athletes', sub: 'Planning smarter' },
            { ref: routesN.ref, v: routesN.count.toLocaleString(), s: '+', l: 'Routes Planned', sub: 'Across 40+ countries' },
            { ref: carbsN.ref, v: `${carbsN.count}k`, s: 'g', l: 'Carbs Tracked', sub: 'And counting' },
            { ref: null, v: '4.9', s: '/5', l: 'Rating', sub: 'From real athletes' },
          ].map((st, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <div ref={st.ref}>
                <div className="h-0.5 w-8 bg-[#F5A020] mb-4" />
                <div className="text-3xl font-display font-black tracking-tight text-[#3D2152]">
                  {st.v}<span className="text-[#F5A020]">{st.s}</span>
                </div>
                <div className="text-sm font-semibold text-[#3D2152] mt-1.5">{st.l}</div>
                <div className="text-[11px] text-[#A0929E]">{st.sub}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 lg:py-32">
        <div className="px-6 lg:px-14 max-w-[1400px] mx-auto">
          <Reveal>
            <div className="mb-16">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px w-12 bg-[#E8671A]" />
                <span className="text-[11px] font-display uppercase tracking-[0.25em] font-semibold text-[#E8671A]">Features</span>
              </div>
              <h2 className="text-3xl lg:text-4xl font-display font-black tracking-tight text-[#3D2152]">
                Every tool you need. <span className="text-[#A0929E]">Nothing you don't.</span>
              </h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: <Route className="w-5 h-5 text-[#3D2152]" />, iconBg: 'bg-[#3D2152]/10', title: 'Draw Routes', desc: 'Click to place waypoints that snap to real roads. Import GPX or pull from Strava.', d: 0 },
              { icon: <Zap className="w-5 h-5 text-[#F5A020]" />, iconBg: 'bg-[#F5A020]/10', title: 'Auto-Generate', desc: 'Science-backed plans from terrain, duration, weight, and sweat rate. One click.', d: 0.06 },
              { icon: <Download className="w-5 h-5 text-[#3D2152]" />, iconBg: 'bg-[#3D2152]/10', title: 'Export to Watch', desc: 'Smart GPX waypoint names for Garmin. PDF race sheets. Social share images.', d: 0.12 },
              { icon: <Cloud className="w-5 h-5 text-[#E8671A]" />, iconBg: 'bg-[#E8671A]/10', title: 'Race Weather', desc: '16-day forecast. Hot day? Sodium and hydration targets adjust automatically.', d: 0.18 },
              { icon: <Star className="w-5 h-5 text-[#F5A020]" />, iconBg: 'bg-[#F5A020]/10', title: '120+ Products', desc: 'Real SA pricing. 32Gi, Styrkr, NeverSecond, SiS. Rate products, track gut comfort.', d: 0 },
              { icon: <BarChart3 className="w-5 h-5 text-[#5C2D6E]" />, iconBg: 'bg-[#5C2D6E]/10', title: 'Nutrition Profile', desc: 'Track carbs across races. Log bonking and gut feedback. See trends over time.', d: 0.06 },
              { icon: <Activity className="w-5 h-5 text-[#E8671A]" />, iconBg: 'bg-[#E8671A]/10', title: 'Strava Sync', desc: 'Import activities. Sync weight and FTP. Share nutrition plans as social images.', d: 0.12 },
              { icon: <Timer className="w-5 h-5 text-[#3D2152]" />, iconBg: 'bg-[#3D2152]/10', title: 'Run Feedback', desc: 'Rate execution, bonking, gut issues after every run. Build nutrition intelligence.', d: 0.18 },
            ].map((f, i) => (
              <Reveal key={i} delay={f.d}>
                <div className="group h-full rounded-2xl bg-white border border-[#3D2152]/[0.06] p-6 hover:border-[#3D2152]/15 hover:shadow-lg hover:shadow-[#3D2152]/[0.04] transition-all duration-300 cursor-pointer">
                  <div className={`w-10 h-10 rounded-xl ${f.iconBg} flex items-center justify-center mb-4`}>{f.icon}</div>
                  <h3 className="text-[15px] font-display font-bold text-[#3D2152] mb-1.5">{f.title}</h3>
                  <p className="text-[13px] text-[#6B5A7A] leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── RACE SCENARIOS ── */}
      <section id="races" className="py-24 lg:py-32 border-t border-[#3D2152]/[0.06]">
        <div className="px-6 lg:px-14 max-w-[1400px] mx-auto">
          <Reveal>
            <div className="mb-16">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px w-12 bg-[#3D2152]" />
                <span className="text-[11px] font-display uppercase tracking-[0.25em] font-semibold text-[#3D2152]">Built for your race</span>
              </div>
              <h2 className="text-3xl lg:text-4xl font-display font-black tracking-tight text-[#3D2152]">
                From Comrades to your local 10k.
              </h2>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-4">
            <Reveal>
              <div className="h-full rounded-2xl bg-white border border-[#3D2152]/[0.06] p-6 hover:border-[#F5A020]/30 hover:shadow-lg hover:shadow-[#F5A020]/[0.06] transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-display font-medium text-[#A0929E] uppercase tracking-wider">Durban - PMB</span>
                  <span className="text-[10px] font-display font-bold text-[#3D2152]">89km</span>
                </div>
                <h3 className="text-lg font-display font-bold text-[#3D2152] mb-4">Comrades Ultra</h3>
                <div className="grid grid-cols-4 gap-1 mb-4 p-2.5 rounded-lg bg-[#FFF5E8]">
                  {[['380g','carbs'],['4.2g','sodium'],['14','pts'],['8:30','time']].map(([v,k]) => (
                    <div key={k} className="text-center"><div className="text-xs font-display font-bold text-[#3D2152]">{v}</div><div className="text-[8px] font-display text-[#A0929E] uppercase">{k}</div></div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {['32Gi Race Pro', '32Gi Endure', 'PVM Octane', '32Gi Chews'].map((p) => (
                    <span key={p} className="px-2 py-0.5 rounded text-[9px] font-display text-[#3D2152] bg-[#FFF5E8] border border-[#3D2152]/10">{p}</span>
                  ))}
                </div>
                <div className="p-3 rounded-lg bg-[#FFF5E8]/50 border border-[#F5A020]/15">
                  <div className="text-[9px] font-display uppercase tracking-wider text-[#F5A020] font-semibold mb-1">Pro tip</div>
                  <p className="text-[12px] text-[#6B5A7A] leading-relaxed">Start conservative. The back half destroys runners who front-load caffeine.</p>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="h-full rounded-2xl bg-white border border-[#3D2152]/[0.06] p-6 hover:border-[#E8671A]/30 hover:shadow-lg hover:shadow-[#E8671A]/[0.06] transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-display font-medium text-[#A0929E] uppercase tracking-wider">Green Point - Constantia</span>
                  <span className="text-[10px] font-display font-bold text-[#E8671A]">42.2km</span>
                </div>
                <h3 className="text-lg font-display font-bold text-[#3D2152] mb-4">Cape Town Marathon</h3>
                <div className="grid grid-cols-4 gap-1 mb-4 p-2.5 rounded-lg bg-[#FFF5E8]">
                  {[['210g','carbs'],['2.1g','sodium'],['8','pts'],['3:45','time']].map(([v,k]) => (
                    <div key={k} className="text-center"><div className="text-xs font-display font-bold text-[#3D2152]">{v}</div><div className="text-[8px] font-display text-[#A0929E] uppercase">{k}</div></div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {['226ERS HF Gel', 'Styrkr MIX90', 'SiS Beta Fuel'].map((p) => (
                    <span key={p} className="px-2 py-0.5 rounded text-[9px] font-display text-[#3D2152] bg-[#FFF5E8] border border-[#3D2152]/10">{p}</span>
                  ))}
                </div>
                <div className="p-3 rounded-lg bg-[#FFF5E8]/50 border border-[#E8671A]/15">
                  <div className="text-[9px] font-display uppercase tracking-wider text-[#E8671A] font-semibold mb-1">Pro tip</div>
                  <p className="text-[12px] text-[#6B5A7A] leading-relaxed">Hot coastal route. Increase sodium by 30% when temps exceed 25°C.</p>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.24}>
              <div className="h-full rounded-2xl bg-white border border-[#3D2152]/[0.06] p-6 hover:border-[#5C2D6E]/30 hover:shadow-lg hover:shadow-[#5C2D6E]/[0.06] transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-display font-medium text-[#A0929E] uppercase tracking-wider">2,100m climbing</span>
                  <span className="text-[10px] font-display font-bold text-[#5C2D6E]">98km MTB</span>
                </div>
                <h3 className="text-lg font-display font-bold text-[#3D2152] mb-4">Cape Epic Stage</h3>
                <div className="grid grid-cols-4 gap-1 mb-4 p-2.5 rounded-lg bg-[#FFF5E8]">
                  {[['420g','carbs'],['5.1g','sodium'],['16','pts'],['5:20','time']].map(([v,k]) => (
                    <div key={k} className="text-center"><div className="text-xs font-display font-bold text-[#3D2152]">{v}</div><div className="text-[8px] font-display text-[#A0929E] uppercase">{k}</div></div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {['NeverSecond C90', 'Styrkr BAR50', 'Skratch Labs', 'Enduren Gel'].map((p) => (
                    <span key={p} className="px-2 py-0.5 rounded text-[9px] font-display text-[#3D2152] bg-[#FFF5E8] border border-[#3D2152]/10">{p}</span>
                  ))}
                </div>
                <div className="p-3 rounded-lg bg-[#FFF5E8]/50 border border-[#5C2D6E]/15">
                  <div className="text-[9px] font-display uppercase tracking-wider text-[#5C2D6E] font-semibold mb-1">Pro tip</div>
                  <p className="text-[12px] text-[#6B5A7A] leading-relaxed">Solid food on flats. Switch to gels and liquids for the final climbs.</p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── BRANDS MARQUEE ── */}
      <section className="py-10 border-y border-[#3D2152]/[0.06] overflow-hidden">
        <motion.div className="flex items-center gap-16 whitespace-nowrap"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}>
          {[0, 1].map((r) => (
            <div key={r} className="flex items-center gap-16">
              {['226ERS', '32Gi', 'Styrkr', 'NeverSecond', 'High Five', 'Science in Sport', 'Skratch Labs', 'Enduren', 'PVM', 'Named Sport', 'Pace Power'].map((b) => (
                <span key={`${r}-${b}`} className="text-sm font-display font-bold text-[#A0929E] hover:text-[#3D2152] transition-colors">{b}</span>
              ))}
            </div>
          ))}
        </motion.div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="py-24 lg:py-32">
        <div className="px-6 lg:px-14 max-w-[1400px] mx-auto">
          <Reveal>
            <div className="flex items-end justify-between mb-16">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px w-12 bg-[#F5A020]" />
                  <span className="text-[11px] font-display uppercase tracking-[0.25em] font-semibold text-[#F5A020]">How it works</span>
                </div>
                <h2 className="text-3xl lg:text-4xl font-display font-black tracking-tight text-[#3D2152]">
                  Three steps. <span className="text-[#A0929E]">Zero bonking.</span>
                </h2>
              </div>
              <button onClick={onEnterApp} className="hidden lg:flex items-center gap-2 text-[#3D2152] text-[13px] font-display font-bold hover:gap-3 transition-all cursor-pointer">
                Try it now <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-8">
            <Reveal>
              <div className="relative pt-14">
                <span className="absolute -top-2 -left-1 text-[80px] font-display font-black text-[#3D2152]/[0.06] select-none pointer-events-none leading-none">01</span>
                <div className="w-10 h-10 rounded-xl bg-[#3D2152]/10 flex items-center justify-center mb-4 relative z-10"><Route className="w-5 h-5 text-[#3D2152]" /></div>
                <h3 className="text-lg font-display font-bold text-[#3D2152] mb-2 relative z-10">Load your route</h3>
                <p className="text-[14px] text-[#6B5A7A] leading-relaxed relative z-10">Import GPX, pull from Strava, or draw directly on the map. Elevation and terrain analysis included.</p>
              </div>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="relative pt-14">
                <span className="absolute -top-2 -left-1 text-[80px] font-display font-black text-[#F5A020]/[0.08] select-none pointer-events-none leading-none">02</span>
                <div className="w-10 h-10 rounded-xl bg-[#F5A020]/10 flex items-center justify-center mb-4 relative z-10"><Zap className="w-5 h-5 text-[#F5A020]" /></div>
                <h3 className="text-lg font-display font-bold text-[#3D2152] mb-2 relative z-10">Plan your nutrition</h3>
                <p className="text-[14px] text-[#6B5A7A] leading-relaxed relative z-10">Auto-generate a science-backed plan or drag products onto the course. Adjust for weather and gut tolerance.</p>
              </div>
            </Reveal>
            <Reveal delay={0.24}>
              <div className="relative pt-14">
                <span className="absolute -top-2 -left-1 text-[80px] font-display font-black text-[#E8671A]/[0.08] select-none pointer-events-none leading-none">03</span>
                <div className="w-10 h-10 rounded-xl bg-[#E8671A]/10 flex items-center justify-center mb-4 relative z-10"><Download className="w-5 h-5 text-[#E8671A]" /></div>
                <h3 className="text-lg font-display font-bold text-[#3D2152] mb-2 relative z-10">Race with confidence</h3>
                <p className="text-[14px] text-[#6B5A7A] leading-relaxed relative z-10">Export to your watch with clear waypoint cues. Log feedback after. Get better every race.</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── DISCIPLINES ── */}
      <section className="py-10 border-y border-[#3D2152]/[0.06] overflow-hidden">
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
              <span className="text-[11px] font-display uppercase tracking-[0.15em] font-medium">{l}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA with brand illustration ── */}
      <section className="py-32 lg:py-40 relative overflow-hidden">
        {/* Illustrated terrain background */}
        <div className="absolute inset-0 pointer-events-none">
          <img
            src="/logo-illustrated.jpg"
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-[0.08]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#FFF9F0] via-[#FFF9F0]/80 to-[#FFF9F0]" />
        </div>
        <div className="relative z-10 px-6 lg:px-14 max-w-[1400px] mx-auto text-center">
          <Reveal>
            <h2 className="text-4xl lg:text-6xl font-display font-black tracking-tight leading-tight mb-5 text-[#3D2152]">
              Stop guessing.<br /><span className="text-[#F5A020]">Start fueling.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="text-base text-[#6B5A7A] max-w-sm mx-auto mb-10">
              Free. No account needed. Just drop a GPX and start planning.
            </p>
          </Reveal>
          <Reveal delay={0.25}>
            <button onClick={onEnterApp} className="group inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-[#3D2152] text-white font-display font-bold text-base hover:bg-[#5C2D6E] hover:shadow-[0_0_40px_rgba(61,33,82,0.15)] transition-all cursor-pointer">
              Open fuelcue <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[#3D2152]/[0.06] py-10 bg-[#3D2152]">
        <div className="px-6 lg:px-14 max-w-[1400px] mx-auto flex flex-col items-center gap-4">
          <img
            src="/logo-white.png"
            alt="fuelcue — Route Aware Nutrition"
            className="h-16 w-auto object-contain"
          />
          <span className="text-[11px] text-white/40 font-display">Built for athletes who refuse to bonk</span>
        </div>
      </footer>
    </div>
  );
}
