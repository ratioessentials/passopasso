// Guida vocale del player: sintesi vocale del browser, voce italiana se c'è. Silenziosa dove non è supportata.
const KEY = 'passopasso.voice'
export const voiceSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
export function voiceEnabled(): boolean {
  try { return voiceSupported && localStorage.getItem(KEY) !== 'off' } catch { return voiceSupported }
}
export function setVoiceEnabled(on: boolean) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* niente storage */ }
  if (!on) stop()
}
function pick(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  return voices.find((v) => v.lang === 'it-IT' && /Alice|Federica|Luca|Google|Elsa|Isabella/i.test(v.name)) ?? voices.find((v) => v.lang.startsWith('it'))
}
export function say(text: string, { interrupt = true } = {}) {
  if (!voiceEnabled()) return
  try {
    if (interrupt) window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'it-IT'
    const v = pick(); if (v) u.voice = v
    u.rate = 1.02; u.pitch = 1
    window.speechSynthesis.speak(u)
  } catch { /* silenzio */ }
}
export function stop() { try { window.speechSynthesis.cancel() } catch { /* niente */ } }
