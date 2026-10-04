import json, pathlib
here = pathlib.Path(__file__).parent
lv = json.loads((here/"icons"/"levels.json").read_text())
weeks = ["Settimane 1-2","Settimane 3-4","Settimane 5-7","Settimane 8-10","Settimane 11-12"]
def ic(i, uid): return lv[i]["svg"].replace("{uid}", uid)

hero = "".join(f'<div class="hl" data-l="{i}">{ic(i,f"h{i}")}</div>' for i in range(5))
dots = "".join(f'<button class="dot" data-l="{i}" aria-label="Livello {i+1}"></button>' for i in range(5))
cards = "".join(f'''<div class="lvl" data-l="{i}">{ic(i,f"c{i}")}<div><b>{lv[i]["n"]} · {lv[i]["name"]}</b><span>{lv[i]["verb"]} · {weeks[i]}</span></div></div>''' for i in range(5))
home = "".join(f'<div class="hm" data-l="{i}">{ic(i,f"m{i}")}</div>' for i in range(5))
data = json.dumps([dict(n=l["n"],name=l["name"],verb=l["verb"],w=weeks[i]) for i,l in enumerate(lv)], ensure_ascii=False)

html = (here/"page.tpl.html").read_text()
for k,v in dict(HERO=hero,DOTS=dots,CARDS=cards,HOME=home,DATA=data,FAV=ic(2,"f"),FAV2=ic(2,"g"),FAV3=ic(2,"k"),FAV4=ic(2,"z"),LOCK1=ic(2,"l1"),LOCK2=ic(4,"l2"),LOCK3=ic(0,"l3")).items():
    html = html.replace("{{"+k+"}}", v)
(here/"brand.html").write_text(html)
print("ok")
