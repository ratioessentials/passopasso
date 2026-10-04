import type { BodyZone, RedFlag } from '../api/types'
import levelsJson from './levels.json'
import redFlagsJson from '../api/mockdata/red_flags.json'

// Microtesti dell'app. La fonte "ufficiale" è content/copy.json (chat 3);
// qui teniamo i testi che servono al client anche senza server.
export const copy = {
  'onboarding.hello': 'Ciao! Sono il tuo coach di PassoPasso. Costruiamo insieme un percorso su misura, un passo alla volta. Come ti chiami?',
  'onboarding.typing': 'sta scrivendo…',
  'welcome.title': 'Da zero a dove vuoi arrivare.',
  'welcome.subtitle': 'Un percorso in 5 livelli che si adatta a te ogni giorno. Niente colpe, solo passi avanti.',
  'checkin.loading': [
    'Sto preparando la tua seduta…',
    'Guardo come ti senti oggi…',
    'Scelgo gli esercizi più adatti…',
    'Tengo d\'occhio le zone che ti fanno male…',
    'Calibro tempi e recuperi…',
  ],
  'skip.title': 'Capita. Riprendiamo da qui, con calma.',
  'blocked.title': 'Oggi ci fermiamo qui.',
  'meal.loading': ['Guardo il tuo piatto…', 'Cerco le cose buone…', 'Penso a un piccolo consiglio…'],
  'onboarding.loading': ['Preparo il tuo percorso…', 'Scelgo il livello giusto per partire…'],
} as const

export type LevelInfo = { n: number; name: string; verb: string }
export const LEVELS: LevelInfo[] = (levelsJson as { n: number; name: string; verb: string }[]).map(({ n, name, verb }) => ({ n, name, verb }))
export const TRACK_LABELS: Record<string, string> = { corsa: 'Corsa', forza: 'Forza', mobilita: 'Mobilità' }

// Verbi dei livelli per percorso (riserva: la fonte è content/program.json → tracks)
export const TRACK_VERBS: Record<string, string[]> = {
  corsa: ['Cammina', 'Passo svelto', 'Corsetta', 'Corsa', 'Sprint'],
  forza: ['Alzati dalla sedia', 'Corpo libero', 'Più controllo', 'Elastici e manubri', 'Forza piena'],
  mobilita: ['Sciogli', 'Allunga', 'Stabilizza', 'Controlla', 'Fluidità'],
}

export const levelInfo = (n: number, track?: string | null): LevelInfo => {
  const base = LEVELS[Math.min(Math.max(n, 1), 5) - 1]
  const verb = track ? TRACK_VERBS[track]?.[base.n - 1] : undefined
  return verb ? { ...base, verb } : base
}

// Colori di ogni livello (dalle icone del brand): scuro in alto, chiaro in basso
export const LEVEL_COLORS: Record<number, [string, string]> = {
  1: ['#3F8C8C', '#7FC1AD'],
  2: ['#357F84', '#73B9A6'],
  3: ['#2C6975', '#68B2A0'],
  4: ['#25596A', '#5BA696'],
  5: ['#1D4A5A', '#4E9C8D'],
}

export const ZONE_LABELS: Record<BodyZone, string> = {
  collo: 'Collo',
  spalle: 'Spalle',
  schiena_alta: 'Schiena alta',
  schiena_bassa: 'Schiena bassa',
  petto: 'Petto',
  braccia: 'Braccia',
  polsi: 'Polsi',
  anche: 'Anche',
  ginocchia: 'Ginocchia',
  caviglie: 'Caviglie',
}

// Le voci del check-in "Oggi hai…?": copia di content/red_flags.json (il server le espone con GET /api/red-flags).
export const RED_FLAGS: RedFlag[] = (redFlagsJson as (RedFlag & { keywords?: string[] })[]).map(({ id, label, message, urgent }) => ({ id, label, message, urgent }))

export const WIN_ICONS: Record<string, string> = {
  star: '⭐', trophy: '🏆', heart: '💚', flame: '🔥', sun: '☀️', leaf: '🌿', stairs: '🪜',
  walk: '🚶', run: '🏃', moon: '🌙', water: '💧', medal: '🏅', sparkle: '✨', clock: '⏱️', calendar: '📅',
  flag: '🏁', bolt: '⚡', sprout: '🌱', shoe: '👟', camera: '📷', shield: '🛡️', smile: '😊',
}
export const winIcon = (icon: string) => WIN_ICONS[icon] ?? '✨'
