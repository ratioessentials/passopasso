// PassoPasso: widget medio per l'app iOS Scriptable (https://scriptable.app)
// 1. Copia questo file in Scriptable.  2. Aggiungi un widget Scriptable medio alla Home.
// 3. Nel parametro del widget scrivi il tuo userId (oppure lascia vuoto per l'utente demo).

const BASE_URL = 'https://passopasso.andreavallieri.com'
const USER_ID = (args.widgetParameter || 'demo').trim()

const COLORS = {
  1: ['#3F8C8C', '#7FC1AD'], 2: ['#357F84', '#73B9A6'], 3: ['#2C6975', '#68B2A0'],
  4: ['#25596A', '#5BA696'], 5: ['#1D4A5A', '#4E9C8D'],
}

async function load() {
  const req = new Request(`${BASE_URL}/api/widget/${encodeURIComponent(USER_ID)}`)
  req.timeoutInterval = 10
  return await req.loadJSON()
}

async function loadIcon() {
  try {
    // Scriptable non disegna gli SVG: proviamo la PNG della PWA e, se manca, niente icona
    const r = new Request(`${BASE_URL}/pwa/icon-192.png`)
    return await r.loadImage()
  } catch (e) { return null }
}

function text(stack, value, size, opts = {}) {
  const t = stack.addText(String(value))
  t.font = opts.bold ? Font.heavySystemFont(size) : opts.semi ? Font.semiboldSystemFont(size) : Font.systemFont(size)
  t.textColor = new Color('#FFFFFF', opts.alpha ?? 1)
  if (opts.lines) t.lineLimit = opts.lines
  return t
}

function bar(progress, width = 110) {
  const ctx = new DrawContext()
  ctx.size = new Size(width, 6)
  ctx.opaque = false
  ctx.respectScreenScale = true
  const bg = new Path(); bg.addRoundedRect(new Rect(0, 0, width, 6), 3, 3)
  ctx.addPath(bg); ctx.setFillColor(new Color('#FFFFFF', 0.25)); ctx.fillPath()
  const fg = new Path(); fg.addRoundedRect(new Rect(0, 0, Math.max(6, width * progress), 6), 3, 3)
  ctx.addPath(fg); ctx.setFillColor(Color.white()); ctx.fillPath()
  return ctx.getImage()
}

async function build() {
  const w = new ListWidget()
  w.setPadding(16, 16, 16, 16)
  w.url = BASE_URL
  let d
  try { d = await load() } catch (e) {
    w.backgroundColor = new Color('#2C6975')
    text(w, 'PassoPasso', 16, { bold: true })
    text(w, 'Non riesco a collegarmi. Riprovo tra poco.', 12, { alpha: 0.8 })
    return w
  }
  const [c1, c2] = COLORS[d.level.n] || COLORS[3]
  const g = new LinearGradient()
  g.colors = [new Color(c1), new Color(c2)]
  g.locations = [0, 1]
  w.backgroundGradient = g

  const row = w.addStack()
  row.layoutHorizontally()

  const left = row.addStack()
  left.layoutVertically()
  left.size = new Size(120, 0)
  const icon = await loadIcon()
  if (icon) { const im = left.addImage(icon); im.imageSize = new Size(44, 44); im.cornerRadius = 10 }
  left.addSpacer()
  text(left, `LIVELLO ${d.level.n}`, 10, { semi: true, alpha: 0.75 })
  text(left, d.level.name, 17, { bold: true, lines: 1 })
  left.addSpacer(5)
  left.addImage(bar(d.level.progress))
  left.addSpacer(4)
  text(left, `Costanza ${d.consistency}`, 11, { semi: true, alpha: 0.85 })

  row.addSpacer(12)

  const right = row.addStack()
  right.layoutVertically()
  right.backgroundColor = new Color('#FFFFFF', 0.15)
  right.cornerRadius = 16
  right.setPadding(10, 12, 10, 12)
  if (d.next) {
    text(right, d.next.label.toUpperCase(), 10, { semi: true, alpha: 0.75 })
    text(right, d.next.title, 15, { bold: true, lines: 2 })
    text(right, `${d.next.minutes} minuti`, 11, { alpha: 0.8 })
    right.addSpacer()
    const btn = right.addStack()
    btn.backgroundColor = Color.white()
    btn.cornerRadius = 12
    btn.setPadding(4, 12, 4, 12)
    const bt = btn.addText('▶ Inizia')
    bt.font = Font.boldSystemFont(12)
    bt.textColor = new Color('#2C6975')
  } else {
    text(right, 'OGGI', 10, { semi: true, alpha: 0.75 })
    text(right, 'Giornata di riposo', 15, { bold: true, lines: 2 })
    right.addSpacer()
  }
  right.addSpacer(0)
  return w
}

const widget = await build()
if (config.runsInWidget) Script.setWidget(widget)
else await widget.presentMedium()
Script.complete()
