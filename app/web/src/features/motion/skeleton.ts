// Scheletro dell'omino del brand (viewBox 120×120, vista laterale, guarda verso destra).
// Proporzioni prese da brand/icons/level-1.svg: busto 28, coscia 16, tibia 15, braccio 15, avambraccio 13, testa r 9.5.

export const L = { torso: 28, thigh: 16, shin: 15, upper: 15, fore: 13, neck: 16, head: 9.5 }
export const GROUND = 101 // y delle caviglie quando l'omino è in piedi

type Pt = [number, number]

/**
 * Una posa. Gli angoli sono in gradi, misurati dalla verticale verso il basso, positivi in avanti (+x).
 * Busto e testa invece si misurano dalla verticale verso l'alto, positivi in avanti.
 * F = arti vicini (bianchi), B = arti lontani (traslucidi).
 */
export type Pose = {
  torso: number
  head?: number // default: come il busto
  hF: number; kF: number; hB: number; kB: number // anca (assoluto) e flessione del ginocchio (≥ 0)
  aF: number; eF: number; aB: number; eB: number // spalla (assoluto) e flessione del gomito (≥ 0)
  lift?: number // sollevamento da terra (salti, punte)
  hip?: Pt // posizione esplicita dell'anca (altrimenti: a terra)
  footF?: Pt; footB?: Pt; handF?: Pt; handB?: Pt // bersagli: risolti con la cinematica inversa
}

export const NEUTRAL: Pose = { torso: 2, hF: 0, kF: 3, hB: 0, kB: 3, aF: 2, eF: 12, aB: -2, eB: 12 }

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
/** Punto finale di un segmento lungo len con angolo a (dal basso, positivo in avanti). */
const down = (p: Pt, a: number, len: number): Pt => [p[0] + len * Math.sin(rad(a)), p[1] + len * Math.cos(rad(a))]
/** Punto finale con angolo misurato dall'alto. */
const up = (p: Pt, a: number, len: number): Pt => [p[0] + len * Math.sin(rad(a)), p[1] - len * Math.cos(rad(a))]

/** Cinematica inversa a due segmenti: restituisce [angolo del primo, flessione]. bend +1: articolazione in avanti/sopra. */
function ik(from: Pt, to: Pt, l1: number, l2: number, bend: 1 | -1): [number, number] {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01)
  const base = deg(Math.atan2(dx, dy))
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
  const A = deg(Math.acos(Math.max(-1, Math.min(1, cosA))))
  const first = base + bend * A
  const mid = down(from, first, l1)
  const second = deg(Math.atan2(to[0] - mid[0], to[1] - mid[1]))
  return [first, bend * (first - second)]
}

export type Segment = { x: number; y: number; a: number }
export type Rig = {
  torso: Segment; head: Pt
  thighF: Segment; shinF: Segment; thighB: Segment; shinB: Segment
  upperF: Segment; foreF: Segment; upperB: Segment; foreB: Segment
}

/** Dalla posa alle posizioni/rotazioni di ogni segmento. */
export function solve(p: Pose, anchorX = 60, anchor: 'hip' | 'foot' = 'hip'): Rig {
  let { hF, kF, hB, kB, aF, eF, aB, eB } = p
  let hip: Pt
  if (p.hip) {
    hip = p.hip
  } else {
    // A terra: il piede più basso tocca il suolo; in orizzontale resta fissa l'anca o il piede vicino
    const fF = down(down([0, 0], hF, L.thigh), hF - kF, L.shin)
    const fB = down(down([0, 0], hB, L.thigh), hB - kB, L.shin)
    hip = [anchor === 'foot' ? anchorX - fF[0] : anchorX, GROUND - Math.max(fF[1], fB[1])]
  }
  hip = [hip[0], hip[1] - (p.lift ?? 0)]
  if (p.footF) [hF, kF] = ik(hip, p.footF, L.thigh, L.shin, 1)
  if (p.footB) [hB, kB] = ik(hip, p.footB, L.thigh, L.shin, 1)

  const neck = up(hip, p.torso, L.torso)
  // Braccia: gomito sotto la linea spalla-mano; con bend -1 ik restituisce già la flessione del gomito
  if (p.handF) [aF, eF] = ik(neck, p.handF, L.upper, L.fore, -1)
  if (p.handB) [aB, eB] = ik(neck, p.handB, L.upper, L.fore, -1)
  const head = up(neck, p.head ?? p.torso, L.neck)

  const kneeF = down(hip, hF, L.thigh)
  const kneeB = down(hip, hB, L.thigh)
  const elbowF = down(neck, aF, L.upper)
  const elbowB = down(neck, aB, L.upper)
  return {
    torso: { x: hip[0], y: hip[1], a: 180 - p.torso }, // il segmento del busto punta verso l'alto (rotate inverte il segno)
    head,
    thighF: { x: hip[0], y: hip[1], a: hF },
    shinF: { x: kneeF[0], y: kneeF[1], a: hF - kF },
    thighB: { x: hip[0], y: hip[1], a: hB },
    shinB: { x: kneeB[0], y: kneeB[1], a: hB - kB },
    upperF: { x: neck[0], y: neck[1], a: aF },
    foreF: { x: elbowF[0], y: elbowF[1], a: aF + eF },
    upperB: { x: neck[0], y: neck[1], a: aB },
    foreB: { x: elbowB[0], y: elbowB[1], a: aB + eB },
  }
}

/** Trasformazione SVG di un segmento disegnato da (0,0) a (0,len), cioè verso il basso. */
export const segTransform = (s: Segment) => `translate(${s.x.toFixed(2)} ${s.y.toFixed(2)}) rotate(${(-s.a).toFixed(2)})`

// ---------- Interpolazione ----------

type Num = Record<string, number | Pt | undefined>

function lerpVal(a: number, b: number, t: number) {
  return a + (b - a) * t
}
/** Catmull-Rom uniforme: velocità continua tra i fotogrammi chiave. */
function cr(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}
const smooth = (t: number) => t * t * (3 - 2 * t)

export type Interp = 'spline' | 'ease'

/** Posa al momento phase (0..1) di un ciclo di fotogrammi chiave equidistanti o con t esplicito. */
export function sample(keys: (Pose & { t?: number })[], phase: number, interp: Interp): Pose {
  const n = keys.length
  const ts = keys.map((k, i) => k.t ?? i / n)
  let i = n - 1
  for (let j = 0; j < n; j++) if (phase >= ts[j]) i = j
  const t0 = ts[i]
  const t1 = i + 1 < n ? ts[i + 1] : 1
  const local = Math.min(1, Math.max(0, (phase - t0) / (t1 - t0 || 1)))
  const k0 = keys[(i - 1 + n) % n] as unknown as Num
  const k1 = keys[i] as unknown as Num
  const k2 = keys[(i + 1) % n] as unknown as Num
  const k3 = keys[(i + 2) % n] as unknown as Num
  const out: Num = {}
  const f = (a: number, b: number, c: number, d: number) =>
    interp === 'spline' ? cr(a, b, c, d, local) : lerpVal(b, c, smooth(local))
  for (const key of Object.keys(k1)) {
    if (key === 't') continue
    const v1 = k1[key]
    const v2 = k2[key] ?? v1
    const v0 = k0[key] ?? v1
    const v3 = k3[key] ?? v2
    if (Array.isArray(v1)) {
      out[key] = [0, 1].map((c) =>
        f((v0 as Pt)[c], v1[c], (v2 as Pt)[c], (v3 as Pt)[c]),
      ) as Pt
    } else if (typeof v1 === 'number') {
      out[key] = f(v0 as number, v1, v2 as number, v3 as number)
    }
  }
  return out as unknown as Pose
}
