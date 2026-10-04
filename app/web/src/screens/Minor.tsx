import { motion } from 'motion/react'
import { useNavigate } from 'react-router'
import { setUserId } from '../api/client'
import { Button, LevelIcon } from '../ui/kit'
import { spring } from '../ui/motion'

/** Sotto i 16 anni niente piano: un invito gentile a farsi accompagnare da un adulto. */
export function Minor({ message }: { message?: string }) {
  const nav = useNavigate()
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-gradient-to-b from-salvia to-white px-8 text-center">
      <LevelIcon n={1} size={110} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.bouncy} />
      <h1 className="font-title mt-8 text-[30px] leading-tight text-inchiostro">Che bello che tu voglia muoverti!</h1>
      <p className="mt-4 text-[16px] leading-relaxed text-inchiostro/80">
        {message ?? 'PassoPasso è pensata per gli adulti. Alla tua età il movimento migliore è quello fatto insieme: sport a scuola, una squadra, giochi all\'aperto con gli amici.'}
      </p>
      <p className="mt-3 text-[15px] text-inchiostro/70">Se vuoi usare l'app, chiedi a un genitore o a un adulto di farlo con te.</p>
      <div className="mt-10 w-full space-y-2">
        <Button className="w-full" onClick={() => { setUserId(null); nav('/benvenuto', { replace: true }) }}>Torna all'inizio</Button>
      </div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-6 text-xs text-inchiostro/50">Per i ragazzi l'OMS consiglia un'ora di movimento al giorno, giocando.</motion.p>
    </div>
  )
}
export default Minor
