// Logica dello squat sui landmark di MediaPipe Pose (coordinate normalizzate 0..1).
// Indici: 11/12 spalle, 23/24 anche, 25/26 ginocchia, 27/28 caviglie.

export type Lm = { x: number; y: number; z?: number; visibility?: number }
export type Cue = 'depth' | 'knees' | 'torso'

export const CUE_TEXT: Record<Cue, string> = {
  depth: 'Scendi un po’ di più',
  knees: 'Ginocchia in linea con i piedi',
  torso: 'Busto più dritto',
}

const UP = 155 // ginocchio quasi teso: in piedi
const DOWN = 115 // sotto questa soglia la ripetizione conta come "scesa"
const GOOD_DEPTH = 100 // obiettivo di profondità per un principiante

/** Angolo in b (gradi). Con la z (worldLandmarks, in metri) è indipendente dal punto di vista. */
function angle(a: Lm, b: Lm, c: Lm) {
  const u = [a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0)]
  const v = [c.x - b.x, c.y - b.y, (c.z ?? 0) - (b.z ?? 0)]
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
  const n = Math.hypot(...u) * Math.hypot(...v) || 1
  return (Math.acos(Math.min(1, Math.max(-1, dot / n))) * 180) / Math.PI
}
const vis = (l?: Lm) => l?.visibility ?? 1
const mid = (a: Lm, b: Lm): Lm => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z ?? 0) + (b.z ?? 0)) / 2 })

export type Frame = { knee: number; visible: boolean; kneesIn: boolean; leaning: boolean }

/** lm: landmark dell'immagine (0..1); world: landmark 3D in metri, usati per gli angoli se ci sono. */
export function analyze(lm: Lm[], world?: Lm[]): Frame {
  const [lh, rh, lk, rk, la, ra] = [23, 24, 25, 26, 27, 28].map((i) => lm[i])
  const w = world?.length ? world : lm
  const [wls, wrs, wlh, wrh, wlk, wrk, wla, wra] = [11, 12, 23, 24, 25, 26, 27, 28].map((i) => w[i])
  const visible = [lh, rh, lk, rk, la, ra].every((p) => p && vis(p) > 0.5)
  if (!visible) return { knee: 180, visible: false, kneesIn: false, leaning: false }

  // Angolo del ginocchio: lato più visibile
  const left = angle(wlh, wlk, wla)
  const right = angle(wrh, wrk, wra)
  const knee = Math.abs(vis(lk) - vis(rk)) < 0.1 ? (left + right) / 2 : vis(lk) > vis(rk) ? left : right

  // Ginocchia che cedono verso l'interno (vista frontale)
  const kneeW = Math.abs(lk.x - rk.x)
  const ankleW = Math.abs(la.x - ra.x)
  const kneesIn = ankleW > 0.04 && kneeW < ankleW * 0.75

  // Busto: inclinazione rispetto alla verticale (si vede bene di lato)
  const s = mid(wls, wrs)
  const h = mid(wlh, wrh)
  const torso = (Math.atan2(Math.hypot(s.x - h.x, (s.z ?? 0) - (h.z ?? 0)), Math.abs(h.y - s.y)) * 180) / Math.PI
  const leaning = torso > 45

  return { knee, visible, kneesIn, leaning }
}

/** Macchina a stati delle ripetizioni: up → down → up = +1. */
export class RepCounter {
  reps = 0
  phase: 'up' | 'down' = 'up'
  private minKnee = 180
  private kneesIn = false
  private leaning = false

  /** Restituisce gli indizi della ripetizione appena chiusa (o null se non è finita). */
  push(f: Frame): Cue[] | null {
    if (!f.visible) return null
    if (this.phase === 'up') {
      if (f.knee < UP - 15) this.minKnee = Math.min(this.minKnee, f.knee)
      if (f.knee < DOWN) this.phase = 'down'
      // Mezzo squat: è sceso ma non abbastanza, ed è tornato su
      if (f.knee > UP && this.minKnee < UP - 25) {
        this.reset()
        return ['depth']
      }
      if (f.knee > UP) this.reset()
      return null
    }
    this.minKnee = Math.min(this.minKnee, f.knee)
    if (f.kneesIn) this.kneesIn = true
    if (f.leaning) this.leaning = true
    if (f.knee > UP) {
      this.reps++
      const cues: Cue[] = []
      if (this.minKnee > GOOD_DEPTH) cues.push('depth')
      if (this.kneesIn) cues.push('knees')
      if (this.leaning) cues.push('torso')
      this.reset()
      return cues
    }
    return null
  }

  private reset() {
    this.phase = 'up'
    this.minKnee = 180
    this.kneesIn = false
    this.leaning = false
  }
}
