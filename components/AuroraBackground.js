'use client'

/**
 * The living aurora behind every glass surface.
 *
 * Three large blurred colour fields drift on the GPU (transform/opacity only),
 * a faint grain overlay adds texture so the gradients don't band, and a vignette
 * keeps the edges calm. Fixed, behind everything, pointer-events-none — pages
 * render on top and their backdrop-blur frosts whatever aurora sits behind them.
 *
 * Perf: no JS animation loop, no canvas — pure CSS keyframes the compositor runs.
 * Respects prefers-reduced-motion (blobs freeze; the atmosphere stays).
 */
export default function AuroraBackground() {
  return (
    <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* teal — anchored bottom-left, the brand light source */}
      <div
        className="aurora-blob absolute rounded-full"
        style={{
          width: '58vw', height: '58vw', left: '-14vw', bottom: '-20vw',
          background: 'radial-gradient(circle at center, var(--aurora-teal) 0%, transparent 62%)',
          filter: 'blur(90px)', opacity: 0.55,
          animation: 'aurora-drift-a 26s ease-in-out infinite, aurora-breathe 14s ease-in-out infinite',
        }}
      />
      {/* violet — top-right, the cool counterweight */}
      <div
        className="aurora-blob absolute rounded-full"
        style={{
          width: '52vw', height: '52vw', right: '-16vw', top: '-18vw',
          background: 'radial-gradient(circle at center, var(--aurora-violet) 0%, transparent 60%)',
          filter: 'blur(100px)', opacity: 0.42,
          animation: 'aurora-drift-b 32s ease-in-out infinite, aurora-breathe 18s ease-in-out infinite',
        }}
      />
      {/* cyan — centre drift, ties the two together */}
      <div
        className="aurora-blob absolute rounded-full"
        style={{
          width: '44vw', height: '44vw', left: '38vw', top: '30vh',
          background: 'radial-gradient(circle at center, var(--aurora-cyan) 0%, transparent 64%)',
          filter: 'blur(110px)', opacity: 0.30,
          animation: 'aurora-drift-c 38s ease-in-out infinite',
        }}
      />
      {/* grain — kills gradient banding, adds a filmic tooth */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.05, mixBlendMode: 'overlay',
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      {/* vignette — settle the edges so content floats */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 40%, rgba(5,7,10,0.55) 100%)' }}
      />
    </div>
  )
}
