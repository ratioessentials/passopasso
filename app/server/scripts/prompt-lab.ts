// Prova dei prompt della seduta su check-in diversi: npm run prompt:lab
import { aiMode } from '../src/ai/claude.js';
import { config } from '../src/config.js';
import { content, type BodyZone } from '../src/content.js';
import { generateSession } from '../src/engine/builder.js';
import type { Profile } from '../src/engine/types.js';

const giulia: Profile = { name: 'Giulia', age: 34, goal: 'Riuscire a correre 20 minuti senza fermarmi', experience: 'poca', daysPerWeek: 3, minutesPerSession: 25, equipment: ['sedia', 'tappetino'], limitations: ['ginocchia'], preferredTime: 'sera', startLevel: 1 };
const marco: Profile = { name: 'Marco', age: 52, goal: 'Fare le scale senza fiatone', experience: 'nessuna', daysPerWeek: 2, minutesPerSession: 15, equipment: [], limitations: ['schiena_bassa'], preferredTime: 'mattina', startLevel: 1 };

const cases: { label: string; level: number; profile: Profile; minutes: number; energy: number; pain: BodyZone[]; restart?: boolean }[] = [
  { label: 'L2 standard, energia 3', level: 2, profile: giulia, minutes: 25, energy: 3, pain: [] },
  { label: 'L2 poco tempo, stanca, ginocchia', level: 2, profile: giulia, minutes: 10, energy: 1, pain: ['ginocchia'] },
  { label: 'L1 principiante, schiena e spalle', level: 1, profile: marco, minutes: 15, energy: 3, pain: ['schiena_bassa', 'spalle'] },
  { label: 'L3 carica, tempo pieno', level: 3, profile: giulia, minutes: 30, energy: 5, pain: [] },
  { label: 'L2 ripartenza, caviglie', level: 2, profile: giulia, minutes: 15, energy: 2, pain: ['caviglie'], restart: true },
];

console.log(`AI: ${aiMode()} — ${config.aiModel} (${config.aiEffort})\n`);
const r = content.program().restartSession;
const results = await Promise.all(cases.map(async (c) => {
  const t0 = Date.now();
  const s = await generateSession({
    level: c.level, profile: c.profile, intensity: c.restart ? 0.8 : 1, checkin: { minutes: c.minutes, energy: c.energy, pain: c.pain }, seed: c.label,
    template: c.restart ? r.sessionTemplate : undefined, easy: c.restart,
    kindNote: c.restart ? `È una seduta di ripartenza dopo una seduta saltata: più corta e leggera. Vale +${r.bonusPoints} punti di costanza.` : undefined,
  });
  return { c, s, ms: Date.now() - t0 };
}));
for (const { c, s, ms } of results) {
  const words = s.reason.split(/\s+/).length;
  const bad = s.items.filter((i) => content.exercise(i.exerciseId)!.zones.some((z) => c.pain.includes(z)));
  console.log(`— ${c.label} [${s.source}, ${ms} ms]`);
  console.log(`  titolo: ${s.title}`);
  console.log(`  reason (${s.reason.length} car, ${words} parole): ${s.reason}`);
  console.log(`  esercizi: ${s.items.map((i) => `${i.exerciseId}${i.reps ? ` ${i.sets}x${i.reps}` : ` ${i.sets}x${i.seconds}s`}${i.note ? ` «${i.note}»` : ''}`).join(', ')}`);
  if (bad.length) console.log(`  !! esercizi su zone doloranti: ${bad.map((b) => b.exerciseId).join(', ')}`);
  console.log();
}
