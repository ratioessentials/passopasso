// Genera la voce di ogni battuta dello script (pitch/script.md) con le voci neurali di Edge.
// Uso: node pitch/video/voice.mjs <cartella-output> [voce]
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const out = process.argv[2];
const voice = process.argv[3] || 'it-IT-GiuseppeMultilingualNeural';
import ffmpegPath from 'ffmpeg-static';
const dur = (f) => { try { execFileSync(ffmpegPath, ['-i', f], { stdio: 'pipe' }); } catch (e) { const m = String(e.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/); return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : null; } return null; };
const battute = JSON.parse(fs.readFileSync(new URL('./battute.json', import.meta.url), 'utf8'));
fs.mkdirSync(out, { recursive: true });
const tts = new MsEdgeTTS();
await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
for (const b of battute) {
  if (ONLY && !ONLY.has(b.id)) { const prev = JSON.parse(fs.readFileSync(path.join(out, 'battute.json'), 'utf8')).find((x) => x.id === b.id); b.seconds = prev?.seconds; continue; }
  const dir = path.join(out, b.id);
  fs.mkdirSync(dir, { recursive: true });
  const { audioFilePath } = await tts.toFile(dir, b.say || b.text);
  const final = path.join(out, `${b.id}.mp3`);
  fs.renameSync(audioFilePath, final);
  fs.rmSync(dir, { recursive: true, force: true });
  b.seconds = dur(final);
  console.log(b.id, b.seconds?.toFixed(1), 's', b.text.slice(0, 60));
}
fs.writeFileSync(path.join(out, 'battute.json'), JSON.stringify(battute, null, 2));
