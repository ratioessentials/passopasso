import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import QRCode from 'qrcode'
import { useEffect, useState, type ReactNode } from 'react'
import { LEVELS } from '../content/copy'
import { LevelIcon } from './kit'
import { WidgetsPreview } from '../screens/WidgetGallery'

const PUBLIC_URL = 'https://passopasso.andreavallieri.com'

function useMedia(q: string) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return m
}

/** Su desktop (≥1024px, puntatore fine) l'app vive dentro una cornice da iPhone 390×844. */
export function DesktopShell({ children }: { children: ReactNode }) {
  const desktop = useMedia('(min-width: 1024px) and (pointer: fine)')
  const wide = useMedia('(min-width: 1280px)')
  const short = useMedia('(max-height: 940px)')

  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rx = useSpring(useTransform(my, [-1, 1], [4, -4]), { stiffness: 80, damping: 20 })
  const ry = useSpring(useTransform(mx, [-1, 1], [-5, 5]), { stiffness: 80, damping: 20 })
  const glareX = useTransform(ry, [-5, 5], ['-30%', '30%'])

  const [qr, setQr] = useState('')
  useEffect(() => {
    if (!desktop) return
    QRCode.toDataURL(PUBLIC_URL, { margin: 1, width: 280, color: { dark: '#1D4A5A', light: '#FFFFFF' } }).then(setQr).catch(() => {})
  }, [desktop])

  if (!desktop) return <div className="h-full">{children}</div>

  const scale = short ? 0.86 : 1

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(170deg, #1D4A5A 0%, #2C6975 30%, #68B2A0 72%, #CDE0C9 100%)' }}
      onMouseMove={(e) => {
        mx.set((e.clientX / window.innerWidth) * 2 - 1)
        my.set((e.clientY / window.innerHeight) * 2 - 1)
      }}
      onMouseLeave={() => { mx.set(0); my.set(0) }}
    >
      {/* luci di sfondo */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-acqua/40 blur-[120px]" style={{ animation: 'blob 30s ease-in-out infinite' }} />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-[500px] w-[700px] rounded-full bg-salvia/50 blur-[120px]" style={{ animation: 'blob 26s ease-in-out infinite reverse' }} />

      <div className="relative z-10 flex w-full max-w-[1500px] items-center justify-center gap-[clamp(32px,5vw,96px)] px-10">
        {/* Colonna sinistra */}
        <motion.aside initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 90, damping: 20 }} className="w-[340px] shrink-0 text-white">
          <div className="mb-2 flex items-center gap-3">
            <LevelIcon n={3} size={52} />
            <span className="font-title text-[44px] leading-none">PassoPasso</span>
          </div>
          <p className="mb-8 text-xl font-medium text-white/85">Da zero a dove vuoi arrivare.</p>
          <div className="mb-8 space-y-2.5">
            {LEVELS.map((l, i) => (
              <motion.div key={l.n} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.08, type: 'spring', stiffness: 120, damping: 18 }} className="flex items-center gap-3">
                <div style={{ animation: `floaty ${5 + i * 0.7}s ease-in-out ${i * 0.4}s infinite` }}>
                  <LevelIcon n={l.n} size={40} />
                </div>
                <div className="leading-tight">
                  <div className="font-title text-lg">{l.n}. {l.name}</div>
                  <div className="text-sm text-white/70">{l.verb}</div>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="flex items-center gap-4">
            {qr && <img src={qr} alt="QR code per aprire PassoPasso sul telefono" className="h-[112px] w-[112px] rounded-2xl bg-white p-1.5" style={{ animation: 'qrglow 4s ease-in-out infinite' }} />}
            <div>
              <div className="font-title text-xl leading-tight">Provala sul tuo telefono</div>
              <div className="mt-1 text-sm text-white/70">passopasso.andreavallieri.com</div>
            </div>
          </div>
        </motion.aside>

        {/* Cornice iPhone */}
        <div style={{ perspective: 1600, transform: `scale(${scale})` }} className="shrink-0">
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 80, damping: 18 }}
            style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
            className="relative rounded-[62px] bg-[#0e1a1f] p-[13px] shadow-[0_60px_120px_-30px_rgb(10_30_36/.75),0_0_0_2px_#33464d,inset_0_0_0_2px_#1a2a30]"
          >
            <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[50px] bg-salvia-chiaro" style={{ transform: 'translateZ(0)' }}>
              {children}
              {/* Dynamic Island */}
              <div className="pointer-events-none absolute left-1/2 top-[11px] z-[100] h-[35px] w-[124px] -translate-x-1/2 rounded-full bg-black" />
              {/* riflesso */}
              <motion.div className="pointer-events-none absolute inset-0 z-[99]" style={{ x: glareX, background: 'linear-gradient(115deg, rgb(255 255 255 / 0) 35%, rgb(255 255 255 / .10) 48%, rgb(255 255 255 / 0) 60%)' }} />
            </div>
            {/* tasti laterali */}
            <div className="absolute -left-[3px] top-[180px] h-[60px] w-[4px] rounded-l bg-[#26363c]" />
            <div className="absolute -left-[3px] top-[260px] h-[60px] w-[4px] rounded-l bg-[#26363c]" />
            <div className="absolute -right-[3px] top-[220px] h-[90px] w-[4px] rounded-r bg-[#26363c]" />
          </motion.div>
        </div>

        {/* Colonna destra: widget */}
        {wide && (
          <motion.aside initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 90, damping: 20, delay: 0.15 }} className="w-[340px] shrink-0">
            <div className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-white/80">Anche nei widget</div>
            <WidgetsPreview compact />
          </motion.aside>
        )}
      </div>
    </div>
  )
}
