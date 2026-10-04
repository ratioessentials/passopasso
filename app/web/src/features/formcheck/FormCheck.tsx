import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { analyze, CUE_TEXT, RepCounter, type Cue, type Lm } from './squat'

// MediaPipe arriva dalla CDN solo quando apri questa pagina: niente peso nel bundle principale.
const MP_VERSION = '1.0.1'
const MP_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

type Landmarker = {
  detectForVideo(video: HTMLVideoElement, ts: number): { landmarks: Lm[][]; worldLandmarks?: Lm[][] }
  close(): void
}

async function loadLandmarker(): Promise<Landmarker> {
  const mp = await import(/* @vite-ignore */ `${MP_URL}/vision_bundle.mjs`)
  const fileset = await mp.FilesetResolver.forVisionTasks(`${MP_URL}/wasm`)
  const opts = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
  })
  try {
    return await mp.PoseLandmarker.createFromOptions(fileset, opts('GPU'))
  } catch {
    return await mp.PoseLandmarker.createFromOptions(fileset, opts('CPU'))
  }
}

const BONES: [number, number][] = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [11, 13], [13, 15], [12, 14], [14, 16],
]

type Status = 'idle' | 'loading' | 'running' | 'error'

export default function FormCheck() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stopRef = useRef<() => void>(() => {})
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [reps, setReps] = useState(0)
  const [cue, setCue] = useState<{ text: string; good: boolean } | null>(null)
  const [visible, setVisible] = useState(true)

  const start = useCallback(async () => {
    setStatus('loading')
    setError('')
    let stream: MediaStream | null = null
    let landmarker: Landmarker | null = null
    let raf = 0
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      const video = videoRef.current!
      video.srcObject = stream
      await video.play()
      landmarker = await loadLandmarker()
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop())
      const denied = e instanceof DOMException && e.name === 'NotAllowedError'
      setError(
        denied
          ? 'Serve il permesso della fotocamera. Puoi darlo dalle impostazioni del browser.'
          : 'Non riesco ad avviare la fotocamera qui. Prova dal telefono, con Chrome o Safari.',
      )
      setStatus('error')
      return
    }

    const counter = new RepCounter()
    const video = videoRef.current!
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let lastTs = -1
    let lastVisible = true
    let cueTimer = 0

    const showCue = (cues: Cue[]) => {
      window.clearTimeout(cueTimer)
      setCue(cues.length ? { text: CUE_TEXT[cues[0]], good: false } : { text: 'Ottima ripetizione!', good: true })
      cueTimer = window.setTimeout(() => setCue(null), 2500)
    }

    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (video.readyState < 2) return
      const ts = performance.now()
      if (ts <= lastTs) return
      lastTs = ts
      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }
      const res = landmarker!.detectForVideo(video, ts)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const lm = res.landmarks[0]
      if (!lm) {
        if (lastVisible) setVisible((lastVisible = false))
        return
      }
      const frame = analyze(lm, res.worldLandmarks?.[0])
      if (frame.visible !== lastVisible) setVisible((lastVisible = frame.visible))
      draw(ctx, lm, canvas.width, canvas.height, frame.kneesIn || frame.leaning)
      const cues = counter.push(frame)
      if (cues) {
        setReps(counter.reps)
        showCue(cues)
      }
    }
    loop()
    setStatus('running')

    stopRef.current = () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(cueTimer)
      stream?.getTracks().forEach((t) => t.stop())
      landmarker?.close()
    }
  }, [])

  useEffect(() => () => stopRef.current(), [])

  return (
    <div className="flex min-h-full flex-col bg-gradient-to-b from-petrolio to-acqua px-4 pb-8 safe-top text-white">
      <div className="flex items-center justify-between">
        <Link to="/" className="rounded-full px-3 py-2 text-sm font-semibold text-white/90">
          ← Indietro
        </Link>
        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">Squat</span>
      </div>

      <h1 className="font-title mt-3 text-3xl">Controllo della forma</h1>
      <p className="mt-1 text-sm text-white/85">
        Appoggia il telefono a terra, fai un passo indietro e mettiti di fronte. Si devono vedere fianchi, ginocchia e piedi.
      </p>

      <div className="relative mt-4 aspect-[3/4] w-full overflow-hidden rounded-[26px] bg-black/30 shadow-soft">
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />

        {status === 'running' && (
          <>
            <div className="glass absolute left-3 top-3 rounded-2xl px-4 py-2 text-petrolio">
              <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Ripetizioni</div>
              <div className="font-title text-4xl leading-none">{reps}</div>
            </div>
            {!visible && (
              <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-black/55 px-4 py-3 text-center text-sm">
                Allontanati un po’: devo vederti dalla testa ai piedi.
              </div>
            )}
            {visible && cue && (
              <div
                className={`absolute inset-x-3 bottom-3 rounded-2xl px-4 py-3 text-center font-semibold ${
                  cue.good ? 'bg-acqua text-white' : 'bg-sole text-inchiostro'
                }`}
              >
                {cue.text}
              </div>
            )}
          </>
        )}

        {status !== 'running' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            {status === 'loading' ? (
              <p className="text-sm">Preparo la fotocamera…</p>
            ) : (
              <>
                {error && <p className="text-sm">{error}</p>}
                <button
                  onClick={start}
                  className="rounded-full bg-white px-6 py-3.5 font-semibold text-petrolio shadow-soft"
                >
                  {status === 'error' ? 'Riprova' : 'Accendi la fotocamera'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-white/90">
        <span aria-hidden>🔒</span> Il video non lascia il tuo telefono: tutto avviene sul dispositivo.
      </p>
    </div>
  )
}

function draw(ctx: CanvasRenderingContext2D, lm: Lm[], w: number, h: number, warn: boolean) {
  ctx.lineWidth = Math.max(3, w / 120)
  ctx.lineCap = 'round'
  ctx.strokeStyle = warn ? '#F6C76B' : 'rgba(255,255,255,0.9)'
  for (const [a, b] of BONES) {
    const p = lm[a]
    const q = lm[b]
    if ((p.visibility ?? 1) < 0.5 || (q.visibility ?? 1) < 0.5) continue
    ctx.beginPath()
    ctx.moveTo(p.x * w, p.y * h)
    ctx.lineTo(q.x * w, q.y * h)
    ctx.stroke()
  }
  ctx.fillStyle = '#68B2A0'
  for (const i of [11, 12, 23, 24, 25, 26, 27, 28]) {
    const p = lm[i]
    if ((p.visibility ?? 1) < 0.5) continue
    ctx.beginPath()
    ctx.arc(p.x * w, p.y * h, ctx.lineWidth * 1.4, 0, Math.PI * 2)
    ctx.fill()
  }
}
