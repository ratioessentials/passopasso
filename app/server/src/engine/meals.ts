import { z } from 'zod';
import { askVision } from '../ai/claude.js';
import { PIATTO_SYSTEM } from '../ai/prompts/piatto.js';
import type { Habit } from '../content.js';

export interface Plate { veggies: number; protein: number; grains: number }
export interface MealFeedback { positives: string[]; suggestion: string; habitMatch: boolean; tone: string; plate: Plate | null }

const AiMeal = z.object({
  positives: z.array(z.string().min(2).max(140)).min(1).max(3),
  suggestion: z.string().max(220),
  habitMatch: z.boolean(),
  tone: z.string(),
  plate: z.object({ veggies: z.number().min(0).max(1), protein: z.number().min(0).max(1), grains: z.number().min(0).max(1) }).nullish(),
});

/** Le tre parti del piatto (stima a occhio), normalizzate a somma 1 per il disegno. */
function normPlate(p?: Plate | null): Plate | null {
  if (!p) return null;
  const sum = p.veggies + p.protein + p.grains;
  if (sum <= 0) return null;
  const r = (x: number) => Math.round((x / sum) * 100) / 100;
  return { veggies: r(p.veggies), protein: r(p.protein), grains: r(p.grains) };
}

/** Niente numeri né calorie, mai: se l'AI ne scrive, la frase si scarta. */
const FORBIDDEN = /\d|calori|kcal|grammi|\bgr\b|macro|carboidrati in eccesso|dieta|peso|dimagr|ingrass/i;

function fallback(habit: Habit): MealFeedback {
  return {
    positives: ['Hai fotografato il tuo pasto: prestarci attenzione è già un passo.'],
    suggestion: habit.tips[0] ? `Per l'abitudine di questa settimana: ${habit.tips[0].charAt(0).toLowerCase()}${habit.tips[0].slice(1)}.` : `Questa settimana proviamo: ${habit.title.toLowerCase()}.`,
    habitMatch: false,
    tone: 'incoraggiante',
    plate: null,
  };
}

export async function mealFeedback(image: { base64: string; mimeType: string }, habit: Habit): Promise<MealFeedback> {
  try {
    const ai = await askVision(PIATTO_SYSTEM, `ABITUDINE DELLA SETTIMANA: "${habit.title}" (${habit.why})\nDOMANDA PER CAPIRE SE C'È: ${habit.photoPrompt}`, image, AiMeal, { label: 'piatto', maxTokens: 1200 });
    const fb = fallback(habit);
    const positives = ai.positives.filter((p) => !FORBIDDEN.test(p));
    return {
      positives: positives.length ? positives : fb.positives,
      suggestion: FORBIDDEN.test(ai.suggestion) ? fb.suggestion : ai.suggestion.trim(),
      habitMatch: ai.habitMatch,
      tone: 'incoraggiante',
      plate: normPlate(ai.plate),
    };
  } catch (err) {
    console.warn(`[piatto] riscontro di riserva: ${(err as Error).message}`);
    return fallback(habit);
  }
}
