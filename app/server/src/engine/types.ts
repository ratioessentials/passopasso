import type { BodyZone, Exercise } from '../content.js';

export type Experience = 'nessuna' | 'poca' | 'qualche_volta';
export type PreferredTime = 'mattina' | 'pausa_pranzo' | 'sera';

export type Track = 'corsa' | 'forza' | 'mobilita';
export interface Runner { kmPerWeek: number; longestRunMin: number; easyPaceMinKm: number | null; runGoal: string }
export interface FoodProfile { breakfast: boolean; veggiesPerDay: number; sugaryDrinks: 'mai' | 'a_volte' | 'spesso'; mealsOut: number; cooks: 'mai' | 'a_volte' | 'spesso' }

export interface Profile {
  name: string;
  age?: number | null;
  sex?: 'f' | 'm' | 'altro' | 'non_dico';
  heightCm?: number | null;
  weightKg?: number | null;
  job?: 'seduto' | 'in_piedi' | 'fisico';
  sleepHours?: number;
  health?: {
    heartCondition: boolean; chestPain: boolean; dizziness: boolean; jointIssue: boolean;
    medication: boolean; pregnancy: boolean; otherCondition: boolean; notes: string;
  };
  caution?: boolean;
  medicalOk?: string | null;      // data del via libera del medico, detto al coach
  calendarUrl?: string | null;
  track?: Track;
  runner?: Runner | null;
  food?: FoodProfile | null;
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
export type SessionKind = 'normale' | 'ripartenza' | 'importata';
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
  segments: string | null;
  run_type: string | null;
  origin: string | null;
  external_id: string | null;
  was_planned: number;
}

export interface UserRow {
  id: string;
  profile: string | null;
  level: number;
  intensity: number;
  created_at: string;
  start_date: string | null;
  level_since: string | null;
  draft: string | null;
}

export interface Segment {
  label: string;
  minutes: number;
  motion: string;
  rpe: number;
  repeat?: number;
  recovery?: { label: string; minutes: number; motion: string; rpe: number };
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
  segments: Segment[] | null;
  runType?: string | null;
  origin?: string | null;
}

export interface DraftSession {
  segments?: Segment[] | null;
  run_type?: string | null;
  minutes: number;
  intensity: number;
  title: string;
  reason: string;
  items: Item[];
  source: 'rules' | 'ai';
}
