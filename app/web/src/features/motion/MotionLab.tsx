import { useState } from 'react'
import { Link } from 'react-router'
import MotionFigure from './MotionFigure'
import { ARCHETYPES, CLIPS } from './archetypes'

/** Pagina di prova /motion-lab: tutti gli archetipi in griglia. */
export default function MotionLab() {
  const [playing, setPlaying] = useState(true)
  const [framed, setFramed] = useState(true)
  const [focus, setFocus] = useState<string | null>(null)

  return (
    <div className="min-h-full bg-salvia-chiaro px-4 pb-10 safe-top">
      <div className="flex items-center justify-between">
        <Link to="/" className="rounded-full px-3 py-2 text-sm font-semibold text-petrolio">
          ← Indietro
        </Link>
        <div className="flex gap-2">
          <button
            onClick={() => setFramed((f) => !f)}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-petrolio shadow-soft"
          >
            {framed ? 'Senza sfondo' : 'Con sfondo'}
          </button>
          <button
            onClick={() => setPlaying((p) => !p)}
            className="rounded-full bg-petrolio px-3 py-1.5 text-xs font-semibold text-white shadow-soft"
          >
            {playing ? 'Pausa' : 'Play'}
          </button>
        </div>
      </div>

      <h1 className="font-title mt-3 text-3xl text-petrolio">Motion lab</h1>
      <p className="mt-1 text-sm text-inchiostro/70">
        I {ARCHETYPES.length} movimenti dell’omino. Tocca una tessera per vederla in grande.
      </p>

      {focus && (
        <button
          onClick={() => setFocus(null)}
          className="mt-4 flex w-full flex-col items-center rounded-[26px] bg-white/70 p-4 shadow-soft"
        >
          <MotionFigure motion={focus} playing={playing} framed={framed} size={260} />
          <span className="mt-2 font-semibold text-petrolio">{CLIPS[focus as keyof typeof CLIPS].label}</span>
          <span className="text-xs text-inchiostro/60">
            {focus} · {(CLIPS[focus as keyof typeof CLIPS].duration / 1000).toFixed(1)} s per ciclo
          </span>
        </button>
      )}

      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {ARCHETYPES.map((m) => (
          <button key={m} onClick={() => setFocus(m)} className="flex flex-col items-center gap-1">
            <MotionFigure motion={m} playing={playing} framed={framed} size={104} className="h-auto w-full" />
            <span className="text-center text-[11px] font-semibold leading-tight text-petrolio">{CLIPS[m].label}</span>
          </button>
        ))}
        <div className="flex flex-col items-center gap-1">
          <MotionFigure motion={null} framed={framed} size={104} className="h-auto w-full" />
          <span className="text-center text-[11px] font-semibold leading-tight text-inchiostro/50">null (fermo)</span>
        </div>
      </div>
    </div>
  )
}
