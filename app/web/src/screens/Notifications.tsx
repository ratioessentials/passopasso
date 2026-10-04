import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api, USE_MOCK } from '../api/client'
import { useStore } from '../lib/store'
import { Button, Card, Header } from '../ui/kit'
import { press, spring } from '../ui/motion'

const KEY = 'passopasso.push'
const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

function b64ToBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function swRegistration() {
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((r) => setTimeout(() => r(null), 4000)),
  ])
  if (!reg) throw new Error('Le notifiche funzionano sull\'app pubblicata (non in anteprima). Riprova dal link.')
  return reg
}

/** Promemoria gentile: Web Push, mai più di una notifica al giorno. */
export default function Notifications() {
  const nav = useNavigate()
  const { toast } = useStore()
  const [on, setOn] = useState(() => { try { return localStorage.getItem(KEY) === '1' } catch { return false } })
  const [minutes, setMinutes] = useState(60)
  const [busy, setBusy] = useState(false)
  const iosNeedsInstall = isIos() && !standalone()

  useEffect(() => {
    if (!supported() || USE_MOCK) return
    navigator.serviceWorker.getRegistration().then((r) => r?.pushManager.getSubscription()).then((s) => { if (s) setOn(true) }).catch(() => {})
  }, [])

  const persist = (v: boolean) => { setOn(v); try { localStorage.setItem(KEY, v ? '1' : '0') } catch { /* niente */ } }

  async function enable(mins = minutes) {
    setBusy(true)
    try {
      if (USE_MOCK) { await api.pushSubscribe({} as PushSubscriptionJSON, mins); persist(true); toast('Promemoria attivo', '🔔'); return }
      if (!supported()) throw new Error('Questo browser non supporta le notifiche.')
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') throw new Error('Permesso negato: puoi riattivarlo dalle impostazioni del browser.')
      const reg = await swRegistration()
      const { publicKey } = await api.pushVapid()
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) })
      await api.pushSubscribe(sub.toJSON(), mins)
      persist(true)
      toast('Promemoria attivo', '🔔')
    } catch (e) {
      toast((e as Error).message, '🌿')
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    try {
      if (!USE_MOCK && supported()) {
        const reg = await navigator.serviceWorker.getRegistration()
        const sub = await reg?.pushManager.getSubscription()
        await sub?.unsubscribe()
      }
      await api.pushUnsubscribe()
      persist(false)
      toast('Promemoria spenti')
    } catch (e) { toast((e as Error).message) } finally { setBusy(false) }
  }

  async function test() {
    try { await api.pushTest(); toast('Inviata: arriva tra un attimo', '📨') } catch (e) { toast((e as Error).message, '🌿') }
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-salvia to-salvia-chiaro pb-12">
      <Header title="Promemoria" onBack={() => nav(-1)} />
      <div className="space-y-4 px-5">
        <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-4">
            <motion.span animate={on ? { rotate: [0, -14, 12, -8, 0] } : {}} transition={{ duration: 0.7 }} className="text-4xl">🔔</motion.span>
            <div className="flex-1">
              <div className="font-title text-xl text-inchiostro">Promemoria gentile</div>
              <p className="text-sm text-inchiostro/65">Mai più di una al giorno, mai colpe.</p>
            </div>
            <motion.button whileTap={press} disabled={busy} onClick={() => (on ? disable() : enable())} aria-label="Promemoria gentile"
              className={`relative h-9 w-16 shrink-0 rounded-full transition-colors ${on ? 'bg-acqua' : 'bg-petrolio/20'}`}>
              <motion.span layout transition={spring.snappy} className="absolute top-1 h-7 w-7 rounded-full bg-white shadow" style={{ left: on ? 32 : 4 }} />
            </motion.button>
          </div>
          {iosNeedsInstall && (
            <p className="mt-3 rounded-2xl bg-sole/25 p-3 text-sm text-inchiostro/80">Su iPhone le notifiche arrivano solo con l'app installata: tocca Condividi → "Aggiungi alla schermata Home", poi riaprila da lì.</p>
          )}
        </Card>

        <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <h3 className="font-title text-lg">Quanto prima della seduta?</h3>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[30, 60, 120].map((m) => (
              <motion.button key={m} whileTap={press} onClick={() => { setMinutes(m); if (on) void enable(m) }}
                className={`relative rounded-2xl py-3 text-sm font-semibold ${minutes === m ? 'text-white' : 'bg-white text-petrolio'}`}>
                {minutes === m && <motion.span layoutId="remind" transition={spring.snappy} className="absolute inset-0 rounded-2xl bg-gradient-to-b from-petrolio to-acqua" />}
                <span className="relative">{m < 60 ? `${m} min` : m === 60 ? '1 ora' : '2 ore'}</span>
              </motion.button>
            ))}
          </div>
          <div className="mt-4 space-y-2 text-sm text-inchiostro/75">
            <p>🕖 «Tra un'ora c'è la tua seduta: 20 minuti, come stai?»</p>
            <p>🌱 Dopo una seduta saltata: «Capita. Oggi c'è una ripartenza da 15 minuti, se ti va.»</p>
            <p>😴 Quando i tuoi dati consigliano riposo. Mai di sera tardi.</p>
          </div>
        </Card>

        <Button variant="light" className="w-full" onClick={test} disabled={!on}>📨 Mandami una prova</Button>
      </div>
    </div>
  )
}
