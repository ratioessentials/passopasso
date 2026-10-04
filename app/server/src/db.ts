import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });
export const db = new Database(path.join(config.dataDir, 'passopasso.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const migrations: string[] = [
  `CREATE TABLE users (
     id TEXT PRIMARY KEY,
     profile TEXT,
     level INTEGER NOT NULL DEFAULT 1,
     intensity REAL NOT NULL DEFAULT 1.0,
     created_at TEXT NOT NULL,
     start_date TEXT,
     level_since TEXT
   );
   CREATE TABLE sessions (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     date TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'planned',
     kind TEXT NOT NULL DEFAULT 'normale',
     level INTEGER NOT NULL,
     minutes INTEGER NOT NULL,
     intensity REAL NOT NULL,
     title TEXT NOT NULL,
     reason TEXT,
     items TEXT NOT NULL,
     bonus_points INTEGER NOT NULL DEFAULT 0,
     feedback TEXT,
     skip_reason TEXT,
     recovers TEXT,
     source TEXT NOT NULL DEFAULT 'rules',
     checkin TEXT,
     done_at TEXT
   );
   CREATE INDEX sessions_user_date ON sessions(user_id, date);
   CREATE TABLE planned_weeks (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, week_start TEXT NOT NULL, PRIMARY KEY (user_id, week_start));
   CREATE TABLE habit_checkins (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TEXT NOT NULL, habit_id TEXT NOT NULL, PRIMARY KEY (user_id, date));
   CREATE TABLE wins (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, win_id TEXT NOT NULL, date TEXT NOT NULL, PRIMARY KEY (user_id, win_id));
   CREATE TABLE level_history (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, n INTEGER NOT NULL, from_date TEXT NOT NULL, to_date TEXT);
   CREATE TABLE meals (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TEXT NOT NULL, habit_id TEXT, feedback TEXT NOT NULL);
   CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);`,
  // 2: scheda compilata prima della conversazione di onboarding
  `ALTER TABLE users ADD COLUMN draft TEXT;`,
  // 3: corsa a segmenti e sedute importate (Strava, Apple Salute)
  `ALTER TABLE sessions ADD COLUMN segments TEXT;
   ALTER TABLE sessions ADD COLUMN run_type TEXT;
   ALTER TABLE sessions ADD COLUMN origin TEXT;
   ALTER TABLE sessions ADD COLUMN external_id TEXT;`,
  // 4: abitudine alimentare scelta per la persona, settimana per settimana
  `CREATE TABLE user_habits (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, week_start TEXT NOT NULL, habit_id TEXT NOT NULL, why TEXT, PRIMARY KEY (user_id, week_start));`,
  // 5: test di prontezza
  `CREATE TABLE level_tests (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TEXT NOT NULL, to_level INTEGER NOT NULL, results TEXT NOT NULL, passed INTEGER NOT NULL, skipped INTEGER NOT NULL DEFAULT 0);`,
  // 6: Health Bridge (dati del corpo, allenamenti importati, sorgenti, token) e notifiche push
  `CREATE TABLE health_days (
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, source TEXT NOT NULL, date TEXT NOT NULL,
     steps INTEGER, resting_hr REAL, hrv REAL, sleep_minutes INTEGER, active_minutes INTEGER, updated_at TEXT NOT NULL,
     PRIMARY KEY (user_id, source, date));
   CREATE TABLE health_workouts (
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, source TEXT NOT NULL, external_id TEXT NOT NULL, date TEXT NOT NULL,
     type TEXT NOT NULL, minutes REAL NOT NULL, distance_km REAL, avg_hr REAL, session_id TEXT,
     PRIMARY KEY (user_id, source, external_id));
   CREATE TABLE health_sources (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, source TEXT NOT NULL, last_sync TEXT, data TEXT, PRIMARY KEY (user_id, source));
   CREATE TABLE health_tokens (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL);
   ALTER TABLE sessions ADD COLUMN was_planned INTEGER NOT NULL DEFAULT 0;
   CREATE TABLE push_subs (endpoint TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, subscription TEXT NOT NULL, minutes_before INTEGER NOT NULL DEFAULT 60, created_at TEXT NOT NULL);
   CREATE TABLE push_log (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TEXT NOT NULL, kind TEXT NOT NULL, sent_at TEXT NOT NULL, PRIMARY KEY (user_id, date));`,
  // 7: coach proattivo (inbox) e aperture dell'app
  `CREATE TABLE coach_messages (
     id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL, day TEXT NOT NULL,
     trigger TEXT NOT NULL, key TEXT NOT NULL, text TEXT NOT NULL, because TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0, actions TEXT);
   CREATE INDEX coach_messages_user ON coach_messages(user_id, day);
   CREATE TABLE app_opens (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TEXT NOT NULL, PRIMARY KEY (user_id, date));`,
];

db.exec('CREATE TABLE IF NOT EXISTS schema_version (v INTEGER NOT NULL)');
const current = (db.prepare('SELECT MAX(v) AS v FROM schema_version').get() as { v: number | null }).v ?? 0;
for (let i = current; i < migrations.length; i++) {
  db.transaction(() => {
    db.exec(migrations[i]);
    db.prepare('INSERT INTO schema_version (v) VALUES (?)').run(i + 1);
  })();
}
