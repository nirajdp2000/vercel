/**
 * AmbientOrbs — fixed background gradient orbs that slowly drift.
 * Pure CSS, zero JS overhead, pointer-events: none.
 */
export default function AmbientOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>
      {/* Top-left indigo orb */}
      <div
        className="absolute rounded-full blur-[120px] opacity-[0.07]"
        style={{
          width: 700, height: 700,
          top: -200, left: -150,
          background: 'radial-gradient(circle, rgba(99,102,241,1) 0%, transparent 70%)',
          animation: 'orb-drift-1 22s ease-in-out infinite',
        }}
      />
      {/* Top-right violet orb */}
      <div
        className="absolute rounded-full blur-[140px] opacity-[0.06]"
        style={{
          width: 600, height: 600,
          top: -100, right: -100,
          background: 'radial-gradient(circle, rgba(139,92,246,1) 0%, transparent 70%)',
          animation: 'orb-drift-2 28s ease-in-out infinite',
        }}
      />
      {/* Bottom-right cyan orb */}
      <div
        className="absolute rounded-full blur-[160px] opacity-[0.05]"
        style={{
          width: 500, height: 500,
          bottom: -100, right: '20%',
          background: 'radial-gradient(circle, rgba(6,182,212,1) 0%, transparent 70%)',
          animation: 'orb-drift-3 34s ease-in-out infinite',
        }}
      />
      {/* Bottom-left emerald orb */}
      <div
        className="absolute rounded-full blur-[130px] opacity-[0.04]"
        style={{
          width: 450, height: 450,
          bottom: -80, left: '10%',
          background: 'radial-gradient(circle, rgba(16,185,129,1) 0%, transparent 70%)',
          animation: 'orb-drift-1 40s ease-in-out infinite reverse',
        }}
      />
      {/* Center subtle glow */}
      <div
        className="absolute rounded-full blur-[200px] opacity-[0.03]"
        style={{
          width: 800, height: 400,
          top: '30%', left: '50%',
          transform: 'translateX(-50%)',
          background: 'radial-gradient(ellipse, rgba(99,102,241,1) 0%, transparent 70%)',
          animation: 'orb-drift-2 50s ease-in-out infinite',
        }}
      />
    </div>
  );
}
