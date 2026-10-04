import type { BodyZone, Exercise } from '../content.js';

export type Experience = 'nessuna' | 'poca' | 'qualche_volta';
export type PreferredTime = 'mattina' | 'pausa_pranzo' | 'sera';

export interface Profile {
  name: string;
  age?: number | null;
  goal: string;
  experience: Experience;
  daysPerWeek: number;
  minutesPerSession: number;
  equipment: string[];
  limitations: BodyZone[];
  preferredTime: PreferredTime;
  startLevel: number;
}

export interface Item {
  exerciseId: string;
  sets: number;
  reps?: number;
  seconds?: number;
  restSec: number;
  note?: string;
}

export type SessionStatus = 'planned' | 'done' | 'skipped' | 'blocked';
export type SessionKind = 'normale' | 'ripartenza';
export type Feedback = 'facile' | 'giusto' | 'duro';

export interface SessionRow {
  id: string;
  user_id: string;
  date: string;
  status: SessionStatus;
  kind: SessionKind;
  level: number;
  minutes: number;
  intensity: number;
  title: string;
  reason: string | null;
  items: string;
  bonus_points: number;
  feedback: Feedback | null;
  skip_reason: string | null;
  recovers: string | null;
  source: 'rules' | 'ai';
  checkin: string | null;
  done_at: string | null;
}

export interface UserRow {
  id: string;
  profile: string | null;
  level: number;
  intensity: number;
  created_at: string;
  start_date: string | null;
  level_since: string | null;
}

export interface Session {
  id: string;
  date: string;
  status: SessionStatus;
  kind: SessionKind;
  level: number;
  minutes: number;
  intensity: number;
  title: string;
  reason: string | null;
  items: (Item & { exercise: Exercise })[];
  bonusPoints: number;
  feedback?: Feedback | null;
  source?: 'rules' | 'ai';
}

export interface DraftSession {
  minutes: number;
  intensity: number;
  title: string;
  reason: string;
  items: Item[];
  source: 'rules' | 'ai';
}
