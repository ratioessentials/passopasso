import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { api, downloadFile, getUserId, setUserId } from '../api/client'
import { useStore } from '../lib/store'
import { Button, Card, Header } from '../ui/kit'
import { press, spring, stagger } from '../ui/motion'

/** I miei dati: esporta, aggiungi la settimana al calendario, cancella tutto. */
export default function MyData() {
  const nav = useNavigate()
  const { toast } = useStore()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  async function dl(path: string, name: string, key: string, ok: string) {
    setBusy(key)
    try { await downloadFile(path, name); toast(ok, '✅') } catch (e) { toast((e as Error).message, '🌿') } finally { setBusy(null) }
  }

  async function wipe() {
    setBusy('delete')
    try {
      await api.deleteMe()
      try { localStorage.removeItem(`passopasso.coach.${getUserId()}`) } catch { /* niente */ }
      setUserId(null)
      nav('/benvenuto', { replace: true })
    } catch (e) {
      toast((e as Error).message, '🌿')
      setBusy(null)
    }
  }

  const rows = [
    { key: 'export', icon: '📦', title: 'Scarica i tuoi dati', sub: 'Profilo, sedute, feedback, vittorie e piatti in un file JSON', action: () => dl('/me/export', 'passopasso-dati.json', 'export', 'File pronto') },
    { key: 'ics', icon: '📅', title: 'Aggiungi la settimana al calendario', sub: 'Un file .ics con le sedute: aprilo con Google o Apple Calendar', action: () => dl('/week.ics', 'passopasso-settimana.ics', 'ics', 'Aprilo per aggiungerlo al calendario') },
  ]

  return (
    <div className="min-h-full bg-gradient-to-b from-salvia to-salvia-chiaro pb-12">
      <Header title="I miei dati" onBack={() => nav(-1)} />
      <div className="space-y-3 px-5">
        <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
          <span className="text-3xl">🔒</span>
          <p className="text-[15px] leading-snug text-inchiostro/85">Niente account, niente pubblicità: i tuoi dati stanno su un server in Europa e li cancelli quando vuoi.</p>
        </Card>
        {rows.map((r, i) => (
          <motion.button key={r.key} whileTap={press} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={stagger(i + 1)} onClick={r.action} disabled={!!busy}
            className="flex w-full items-center gap-3 rounded-[22px] bg-white/85 p-4 text-left shadow-[0_8px_20px_-14px_rgb(44_105_117/.6)] disabled:opacity-60">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-salvia-chiaro text-2xl">{r.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-inchiostro">{busy === r.key ? 'Preparo il file…' : r.title}</span>
              <span className="block text-xs text-inchiostro/60">{r.sub}</span>
            </span>
          </motion.button>
        ))}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="pt-6">
          <Button variant="ghost" className="w-full text-[#9a4a36]" onClick={() => setConfirm(true)}>Cancella tutto</Button>
        </motion.div>
      </div>

      <AnimatePresence>
        {confirm && (
          <motion.div className="fixed inset-0 z-50 flex items-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-inchiostro/40 backdrop-blur-sm" onClick={() => setConfirm(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={spring.gentle}
              className="safe-bottom relative w-full rounded-t-[34px] bg-white px-6 pt-6 text-center shadow-[0_-20px_60px_-20px_rgb(18_49_58/.5)]">
              <div className="text-4xl">🗑️</div>
              <h2 className="font-title mt-2 text-[26px] leading-tight text-inchiostro">Cancelliamo tutto?</h2>
              <p className="mt-2 text-inchiostro/70">Profilo, sedute, vittorie e foto valutate spariscono subito e per sempre. Se vuoi, prima scarica i tuoi dati.</p>
              <div className="space-y-1 pb-4 pt-5">
                <Button className="w-full bg-none !bg-[#b0563f]" onClick={wipe} disabled={busy === 'delete'}>{busy === 'delete' ? 'Cancello…' : 'Sì, cancella tutto'}</Button>
                <Button variant="ghost" className="w-full" onClick={() => setConfirm(false)}>No, tengo tutto</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
