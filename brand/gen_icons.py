# Genera le 5 icone di livello di PassoPasso (omino che passa dal camminare allo sprint).
import json, pathlib

LEVELS = [
  # name, motion, gradient top/bottom, head, shoulder, hip, near arm (E,W), far arm, near leg (K,F), far leg, trails
  dict(n=1, name="Attivazione", verb="Cammina",      top="#3F8C8C", bot="#7FC1AD", head=(62,26), S=(61,42), H=(59,70),
       na=[(52,55),(46,66)], fa=[(68,55),(73,66)], nl=[(63,85),(67,100)], fl=[(54,85),(49,99)], trails=0),
  dict(n=2, name="Fondamenta",  verb="Passo svelto", top="#357F84", bot="#73B9A6", head=(64,25), S=(61,41), H=(57,69),
       na=[(51,53),(46,63)], fa=[(70,52),(77,58)], nl=[(67,83),(74,98)], fl=[(52,84),(42,95)], trails=0),
  dict(n=3, name="Costruzione", verb="Corsetta",     top="#2C6975", bot="#68B2A0", head=(67,25), S=(62,41), H=(55,68),
       na=[(49,51),(40,46)], fa=[(72,50),(79,41)], nl=[(70,78),(70,95)], fl=[(50,85),(37,91)], trails=1),
  dict(n=4, name="Slancio",     verb="Corsa",        top="#25596A", bot="#5BA696", head=(71,24), S=(64,40), H=(54,66),
       na=[(48,47),(37,41)], fa=[(75,48),(85,38)], nl=[(75,74),(73,92)], fl=[(48,84),(31,86)], trails=2),
  dict(n=5, name="Autonomia",   verb="Sprint",       top="#1D4A5A", bot="#4E9C8D", head=(75,24), S=(66,40), H=(52,64),
       na=[(46,44),(33,37)], fa=[(78,46),(91,34)], nl=[(79,70),(77,89)], fl=[(44,82),(25,82)], trails=3),
]

def pl(pts): return " ".join(f"{x},{y}" for x,y in pts)

def svg(L, uid):
    g = f"g{uid}"
    trails = ""
    for i, y in enumerate([46, 58, 70][:L["trails"]]):
        x1 = 14 + i*3; x2 = x1 + 16 - i*2
        trails += f'<line x1="{x1}" y1="{y}" x2="{x2}" y2="{y}" stroke="#fff" stroke-opacity=".38" stroke-width="6" stroke-linecap="round"/>'
    far = (f'<polyline points="{pl([L["S"]]+L["fa"])}"/>'
           f'<polyline points="{pl([L["H"]]+L["fl"])}"/>')
    near = (f'<polyline points="{pl([L["H"]]+L["nl"])}"/>'
            f'<line x1="{L["S"][0]}" y1="{L["S"][1]}" x2="{L["H"][0]}" y2="{L["H"][1]}" stroke-width="13"/>'
            f'<polyline points="{pl([L["S"]]+L["na"])}"/>')
    hx, hy = L["head"]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">'
            f'<defs><linearGradient id="{g}" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{L["top"]}"/><stop offset="1" stop-color="{L["bot"]}"/></linearGradient>'
            f'<radialGradient id="{g}h" cx=".3" cy=".15" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>'
            f'<rect width="120" height="120" rx="27" fill="url(#{g})"/>'
            f'{trails}'
            f'<g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="10">'
            f'<g stroke="#E0ECDE" stroke-opacity=".55">{far}</g>{near}</g>'
            f'<circle cx="{hx}" cy="{hy}" r="9.5" fill="#fff"/></svg>')

out = pathlib.Path(__file__).parent
meta = []
for L in LEVELS:
    (out/"icons"/f"level-{L['n']}.svg").write_text(svg(L, f"f{L['n']}"))
    meta.append(dict(n=L["n"], name=L["name"], verb=L["verb"], svg=svg(L, "x{uid}")))
(out/"icons"/"levels.json").write_text(json.dumps(meta, ensure_ascii=False))
print("ok")
