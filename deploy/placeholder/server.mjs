// Placeholder statico: tiene online il dominio finché l'app vera non è pronta.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const dir = new URL('.', import.meta.url).pathname;
const types = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, placeholder: true }));
  }
  const file = url.pathname === '/logo.svg' ? 'logo.svg' : 'index.html';
  const body = await readFile(dir + file);
  res.writeHead(200, { 'content-type': types[file.slice(file.lastIndexOf('.'))] });
  res.end(body);
}).listen(3210, '0.0.0.0', () => console.log('placeholder su :3210'));
