// Montaggio finale: slide iniziali → demo continua (voce sincronizzata sui marker) → slide finali.
// Uso: node pitch/video/assemble-final.mjs <voce> <clip-slide> <cartella-demo> <output.mp4> [pad.m4a]
import ffmpeg from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [voiceDir, slideDir, demoDir, out, pad] = process.argv.slice(2);
const battute = JSON.parse(fs.readFileSync(path.join(voiceDir, 'battute.json'), 'utf8'));
const B = Object.fromEntries(battute.map((b) => [b.id, b]));
const demo = JSON.parse(fs.readFileSync(path.join(demoDir, 'markers.json'), 'utf8'));
const work = path.join(demoDir, 'build');
fs.mkdirSync(work, { recursive: true });
const run = (args) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
const length = (f) => { try { execFileSync(ffmpeg, ['-i', f], { stdio: 'pipe' }); } catch (e) { const m = String(e.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/); return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : 0; } return 0; };
const XF = 0.7;
const PRE = ['B01', 'B02', 'B03'], POST = ['B18', 'B19', 'B20'];

// 1) Ogni slide: video muto alla durata voce + 0.6 s di respiro + XF.
const parts = [];   // { file, len, voices: [{id, at}] }
for (const id of [...PRE]) {
  const src = path.join(slideDir, `${id}.webm`);
  const len = B[id].seconds + 0.6 + XF;
  const f = path.join(work, `${id}.mp4`);
  run(['-i', src, '-t', len.toFixed(2), '-vf', 'scale=1920:1080,format=yuv420p,fps=30', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', f]);
  parts.push({ file: f, len, voices: [{ id, at: 0.15 }] });
}
// 2) La demo intera, non accelerata: le voci sui marker.
{
  const src = demo.file;
  const len = Math.min(length(src), demo.end + 1.0);
  const f = path.join(work, 'demo.mp4');
  run(['-i', src, '-t', len.toFixed(2), '-vf', 'scale=1920:1080,format=yuv420p,fps=30', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', f]);
  parts.push({ file: f, len, voices: demo.markers.map((m) => ({ id: m.id, at: m.at })) });
}
for (const id of POST) {
  const src = path.join(slideDir, `${id}.webm`);
  const len = B[id].seconds + (id === 'B20' ? 2.5 : 0.6) + XF;
  const f = path.join(work, `${id}.mp4`);
  run(['-i', src, '-t', len.toFixed(2), '-vf', 'scale=1920:1080,format=yuv420p,fps=30', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', f]);
  parts.push({ file: f, len, voices: [{ id, at: 0.15 }] });
}

// 3) Video: xfade tra le parti. Timeline assoluta di ogni parte = somma delle precedenti meno le dissolvenze.
let fc = '', v = '[0:v]', offset = 0;
const starts = [0];
for (let i = 1; i < parts.length; i++) {
  offset += parts[i - 1].len - XF;
  starts.push(offset);
  fc += `${v}[${i}:v]xfade=transition=fade:duration=${XF}:offset=${offset.toFixed(3)}[v${i}];`;
  v = `[v${i}]`;
}
const total = offset + parts[parts.length - 1].len;

// 4) Audio: ogni voce ritardata al suo istante assoluto, poi mixate; sottofondo con ducking.
const voiceInputs = [];
let ai = parts.length;
const delayed = [];
for (let i = 0; i < parts.length; i++) {
  for (const vc of parts[i].voices) {
    const at = starts[i] + vc.at;
    voiceInputs.push('-i', path.join(voiceDir, `${vc.id}.mp3`));
    fc += `[${ai}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(at * 1000)}|${Math.round(at * 1000)}[d${ai}];`;
    delayed.push(`[d${ai}]`); ai++;
  }
}
fc += `${delayed.join('')}amix=inputs=${delayed.length}:duration=longest:dropout_transition=0:normalize=0,atrim=duration=${total.toFixed(2)},apad=whole_dur=${total.toFixed(2)}[voice];`;
fc += `[voice]asplit=2[voiceA][voiceB];`;
let maps = ['-map', v, '-map', '[voiceA]'];
let padInput = [];
if (pad && fs.existsSync(pad)) {
  fc += `[${ai}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration=${total.toFixed(2)},apad=whole_dur=${total.toFixed(2)},volume=0.32,afade=t=out:st=${(total - 6).toFixed(2)}:d=6[pad];`;
  fc += `[pad][voiceB]sidechaincompress=threshold=0.02:ratio=6:attack=60:release=900[duck];`;
  fc += `[voiceA][duck]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mix]`;
  padInput = ['-i', pad]; maps = ['-map', v, '-map', '[mix]'];
} else { fc += `[voiceB]anullsink`; }
run([...parts.flatMap((p) => ['-i', p.file]), ...voiceInputs, ...padInput, '-filter_complex', fc, ...maps, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-t', total.toFixed(2), out]);
console.log('durata', Math.floor(total / 60) + ':' + String(Math.round(total % 60)).padStart(2, '0'), '→', out);
