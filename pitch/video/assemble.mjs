// Monta il video: adatta ogni clip alla voce, dissolvenze incrociate tra le scene, sottofondo con ducking.
// Uso: node pitch/video/assemble.mjs <cartella-voce> <cartella-clip> <output.mp4> [pad.m4a]
import ffmpeg from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [voiceDir, clipDir, out, pad] = process.argv.slice(2);
const battute = JSON.parse(fs.readFileSync(path.join(voiceDir, 'battute.json'), 'utf8'));
const work = path.join(clipDir, 'segments');
fs.mkdirSync(work, { recursive: true });
const run = (args) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
const length = (f) => { try { execFileSync(ffmpeg, ['-i', f], { stdio: 'pipe' }); } catch (e) { const m = String(e.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/); return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : 0; } return 0; };
const PAUSE = 0.6;   // respiro dopo ogni battuta
const XF = 0.6;      // dissolvenza incrociata
const segs = [];

for (const b of battute) {
  const clip = path.join(clipDir, `${b.id}.webm`);
  if (!fs.existsSync(clip)) { console.log('manca', clip); continue; }
  const target = b.seconds + PAUSE + (b.hold || 0) + XF;   // la dissolvenza mangia XF secondi tra una scena e l'altra
  const clipLen = length(clip);
  const speed = Math.min(2.2, Math.max(1, clipLen / target));
  const seg = path.join(work, `${b.id}.mp4`);
  const vf = `setpts=PTS/${speed.toFixed(3)},tpad=stop_mode=clone:stop_duration=${Math.max(0, target - clipLen / speed + 1).toFixed(2)},trim=duration=${target.toFixed(2)},setpts=PTS-STARTPTS,scale=1920:1080:flags=lanczos,format=yuv420p,fps=30`;
  const af = `apad=pad_dur=${(PAUSE + (b.hold || 0) + XF).toFixed(2)},atrim=duration=${target.toFixed(2)},asetpts=PTS-STARTPTS`;
  run(['-i', clip, '-i', path.join(voiceDir, `${b.id}.mp3`), '-filter_complex', `[0:v]${vf}[v];[1:a]${af}[a]`, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', seg]);
  segs.push({ seg, len: target });
  console.log(b.id, 'clip', clipLen.toFixed(1), 's → x' + speed.toFixed(2), '→', target.toFixed(1), 's');
}

// Catena di xfade/acrossfade.
const inputs = segs.flatMap((s) => ['-i', s.seg]);
let fc = '', v = '[0:v]', a = '[0:a]', offset = 0;
for (let i = 1; i < segs.length; i++) {
  offset += segs[i - 1].len - XF;
  fc += `${v}[${i}:v]xfade=transition=fade:duration=${XF}:offset=${offset.toFixed(3)}[v${i}];`;
  fc += `${a}[${i}:a]acrossfade=d=${XF}:c1=tri:c2=tri[a${i}];`;
  v = `[v${i}]`; a = `[a${i}]`;
}
const total = offset + segs[segs.length - 1].len;
let maps = ['-map', v, '-map', a];
let extra = [];
if (pad && fs.existsSync(pad)) {
  // Sottofondo: basso, con ducking sotto la voce, dissolvenza finale.
  fc += `[${segs.length}:a]atrim=duration=${total.toFixed(2)},volume=0.35,afade=t=out:st=${(total - 6).toFixed(2)}:d=6[pad];`;
  fc += `[pad]${a}sidechaincompress=threshold=0.02:ratio=6:attack=80:release=900[duck];`;
  fc += `${a}[duck]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mix]`;
  extra = ['-i', pad]; maps = ['-map', v, '-map', '[mix]'];
}
fc = fc.replace(/;$/, '');
run([...inputs, ...extra, '-filter_complex', fc, ...maps, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out]);
console.log('durata prevista', (total / 60).toFixed(0) + ':' + String(Math.round(total % 60)).padStart(2, '0'), '→', out);
