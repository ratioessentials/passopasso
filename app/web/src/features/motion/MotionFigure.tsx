import { useEffect, useId, useMemo, useRef } from 'react'
import { CLIPS, isArchetype, type Clip } from './archetypes'
import { GROUND, L, NEUTRAL, sample, segTransform, solve, type Rig } from './skeleton'

export type MotionFigureProps = {
  /** Archetipo di movimento (`exercise.motion`). Null o sconosciuto → omino fermo in piedi. */
  motion?: string | null
  playing?: boolean
  size?: number
  /** true: tessera arrotondata con la sfumatura del brand e omino bianco. false: omino petrolio su sfondo trasparente. */
  framed?: boolean
  className?: string
  title?: string
}

const STILL_CLIP: Clip = { label: 'Fermo', duration: 1000, interp: 'ease', still: 0, keys: [NEUTRAL] }

function rigAt(clip: Clip, phase: number): Rig {
  const pose = clip.fn ? clip.fn(phase) : sample(clip.keys!, phase, clip.interp)
  return solve(pose, clip.anchorX ?? 60, clip.anchor ?? 'hip')
}

type SegName = 'upperB' | 'foreB' | 'thighB' | 'shinB' | 'torso' | 'thighF' | 'shinF' | 'upperF' | 'foreF'
const LEN: Record<SegName, number> = {
  upperB: L.upper, foreB: L.fore, thighB: L.thigh, shinB: L.shin, torso: L.torso,
  thighF: L.thigh, shinF: L.shin, upperF: L.upper, foreF: L.fore,
}
const BACK: SegName[] = ['upperB', 'foreB', 'thighB', 'shinB']
const FRONT: SegName[] = ['thighF', 'shinF', 'upperF', 'foreF']

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function MotionFigure({
  motion,
  playing = true,
  size = 160,
  framed = true,
  className = '',
  title,
}: MotionFigureProps) {
  const clip = isArchetype(motion) ? CLIPS[motion] : STILL_CLIP
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const svgRef = useRef<SVGSVGElement>(null)
  const segs = useRef<Partial<Record<SegName, SVGGElement | null>>>({})
  const headRef = useRef<SVGCircleElement>(null)

  // Prima immagine (e immagine da fermo): la posa "rappresentativa" del movimento
  const still = useMemo(() => rigAt(clip, clip.still), [clip])

  useEffect(() => {
    const apply = (rig: Rig) => {
      for (const name of Object.keys(LEN) as SegName[]) {
        segs.current[name]?.setAttribute('transform', segTransform(rig[name]))
      }
      headRef.current?.setAttribute('transform', `translate(${rig.head[0].toFixed(2)} ${rig.head[1].toFixed(2)})`)
    }
    apply(still)
    if (!playing || clip === STILL_CLIP || reducedMotion()) return

    let raf = 0
    let visible = true
    // Partiamo dalla fase "rappresentativa", così non c'è uno scatto all'avvio
    const t0 = performance.now() - clip.still * clip.duration
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (!visible) return
      const phase = (((now - t0) % clip.duration) + clip.duration) % clip.duration / clip.duration
      apply(rigAt(clip, phase))
    }
    raf = requestAnimationFrame(tick)

    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
    if (svgRef.current) io.observe(svgRef.current)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
    }
  }, [clip, playing, still])

  const front = framed ? '#FFFFFF' : '#2C6975'
  const back = framed ? '#E0ECDE' : '#68B2A0'
  const backOpacity = framed ? 0.55 : 0.6
  const prop = framed ? '#FFFFFF' : '#2C6975'
  const segment = (name: SegName, width = 10) => (
    <g key={name} ref={(el) => void (segs.current[name] = el)} transform={segTransform(still[name])}>
      <line x1={0} y1={0} x2={0} y2={LEN[name]} strokeWidth={width} />
    </g>
  )

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title ?? clip.label}
    >
      {framed && (
        <defs>
          <linearGradient id={`mf${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2C6975" />
            <stop offset="1" stopColor="#68B2A0" />
          </linearGradient>
          <radialGradient id={`mfh${uid}`} cx=".3" cy=".15" r=".8">
            <stop offset="0" stopColor="#fff" stopOpacity=".22" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
      )}
      {framed && <rect width="120" height="120" rx="27" fill={`url(#mf${uid})`} />}
      {framed && <rect width="120" height="120" rx="27" fill={`url(#mfh${uid})`} />}

      {/* Terreno e attrezzi */}
      <g fill={prop} opacity={framed ? 0.28 : 0.18}>
        <rect x="10" y={GROUND + 5} width="100" height="2.5" rx="1.25" />
        {clip.props?.includes('wall') && <rect x="89" y="16" width="7" height={GROUND - 11} rx="3.5" />}
        {clip.props?.includes('step') && <rect x="62" y={GROUND - 7} width="34" height="12" rx="3" />}
        {clip.props?.includes('mat') && <rect x="8" y={GROUND + 1} width="104" height="5" rx="2.5" />}
      </g>

      <g fill="none" strokeLinecap="round">
        <g stroke={back} strokeOpacity={backOpacity}>{BACK.map((n) => segment(n))}</g>
        <g stroke={front}>
          {segment('torso', 13)}
          {FRONT.map((n) => segment(n))}
        </g>
      </g>
      <circle ref={headRef} r={L.head} fill={front} transform={`translate(${still.head[0]} ${still.head[1]})`} />
    </svg>
  )
}
