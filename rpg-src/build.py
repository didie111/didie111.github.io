#!/usr/bin/env python3
"""src/ 의 HTML + CSS + JS 를 단일 HTML(../rpg/index.html) 로 묶는다."""
import pathlib, re

root = pathlib.Path(__file__).parent
src = root / "src"
html = (src / "index.html").read_text(encoding="utf-8")

css = (src / "css/style.css").read_text(encoding="utf-8")
html = html.replace('<link rel="stylesheet" href="css/style.css">',
                    "<style>\n" + css + "\n</style>")

def inline(m):
    path = src / m.group(1)
    return "<script>\n" + path.read_text(encoding="utf-8") + "\n</script>"

html = re.sub(r'<script src="([^"]+)"></script>', inline, html)

out = root.parent / "rpg" / "index.html"
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding="utf-8")
print("built:", out, f"{len(html)/1024:.1f} KB")
