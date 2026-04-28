"""
Generate /app/SWIFTPOS_INTEGRATION_BRIEF.pdf from the markdown source.
"""
import os
import re
import markdown
from weasyprint import HTML, CSS

ROOT = "/app"
SRC = f"{ROOT}/SWIFTPOS_INTEGRATION_BRIEF.md"
OUT = f"{ROOT}/SWIFTPOS_INTEGRATION_BRIEF.pdf"

with open(SRC) as f:
    md_text = f.read()

# Strip top-level title (we put a custom cover instead)
md_body = re.sub(r"^# Luna Group VIP App.*?\n", "", md_text, count=1)
html_body = markdown.markdown(md_body, extensions=["tables", "fenced_code", "sane_lists"])

cover = """
<div class="cover">
  <div class="kicker">LUNA GROUP HOSPITALITY</div>
  <h1>SwiftPOS Integration<br/>Technical Brief</h1>
  <div class="sub">Detailed data-exchange requirements<br/>for the Luna Group VIP loyalty platform</div>
  <div class="meta">
    <div>To: SwiftPOS Integrations Team</div>
    <div>From: Luna Group · Trent Murphy</div>
    <div>Date: April 2026 · Version 1.0</div>
    <div>Confidential — for SwiftPOS use only</div>
  </div>
</div>
<div style="page-break-after: always;"></div>
"""

html = f"""<!doctype html>
<html><head><meta charset="utf-8"></head>
<body>{cover}<main>{html_body}</main></body></html>"""

css = CSS(string=r"""
@page {
  size: A4;
  margin: 22mm 18mm 22mm 18mm;
  @bottom-center {
    content: "Luna Group · SwiftPOS Integration Brief · Page " counter(page) " of " counter(pages);
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 8pt;
    color: #666;
  }
}
@page :first { margin: 0; @bottom-center { content: ""; } }

body {
  font-family: 'Helvetica Neue', Arial, sans-serif;
  color: #1a1a1f;
  line-height: 1.55;
  font-size: 10.5pt;
}

.cover {
  background: linear-gradient(160deg, #08080E 0%, #1a1530 60%, #0a0a14 100%);
  color: #f0f0f8;
  height: 297mm;
  padding: 75mm 25mm 30mm 25mm;
  box-sizing: border-box;
  position: relative;
}
.cover .kicker {
  letter-spacing: 6px;
  font-size: 11pt;
  color: #D4AF5A;
  margin-bottom: 25mm;
}
.cover h1 {
  font-size: 36pt;
  font-weight: 800;
  letter-spacing: 1.5px;
  line-height: 1.15;
  color: #ffffff;
  margin: 0 0 14mm 0;
  border: none;
}
.cover .sub {
  font-size: 13pt;
  color: rgba(240,240,248,0.85);
  margin-bottom: 50mm;
  line-height: 1.5;
}
.cover .meta {
  position: absolute;
  left: 25mm; right: 25mm; bottom: 25mm;
  font-size: 9pt;
  letter-spacing: 1px;
  color: rgba(240,240,248,0.6);
  border-top: 1px solid rgba(212,175,90,0.4);
  padding-top: 8mm;
  display: grid; gap: 3mm;
}

main { padding: 4mm 0 0 0; }

h1 { font-size: 18pt; color: #1a1a1f; border-bottom: 2px solid #D4AF5A; padding-bottom: 3mm; margin-top: 0; }
h2 { font-size: 14pt; color: #08080E; margin-top: 9mm; margin-bottom: 3mm; page-break-after: avoid; border-bottom: 1px solid #d8d4e6; padding-bottom: 1mm; }
h3 { font-size: 11.5pt; color: #2a2540; margin-top: 6mm; }
h4 { font-size: 10.5pt; color: #4a4360; }

p { margin: 0 0 3mm 0; }

table { width: 100%; border-collapse: collapse; margin: 3mm 0 5mm 0; font-size: 9.5pt; page-break-inside: avoid; }
th { background: #1a1530; color: #D4AF5A; text-align: left; padding: 2mm 3mm; font-weight: 600; letter-spacing: 0.5px; border: 1px solid #D4AF5A; }
td { padding: 2mm 3mm; border: 1px solid #d8d4e6; vertical-align: top; }
tr:nth-child(even) td { background: #faf9fc; }

ul, ol { padding-left: 7mm; margin: 0 0 4mm 0; }
li { margin: 0.8mm 0; }

code { background: #f0eef7; padding: 0.5mm 1.5mm; border-radius: 1mm; font-size: 9pt; color: #2a2540; }
pre { background: #1a1530; color: #D4AF5A; padding: 4mm 5mm; border-radius: 2mm; font-size: 8.5pt; overflow-x: hidden; line-height: 1.45; page-break-inside: avoid; white-space: pre-wrap; word-break: break-word; }
pre code { background: transparent; color: inherit; padding: 0; font-size: 8.5pt; }

blockquote { border-left: 3px solid #D4AF5A; background: #fdfaf2; margin: 3mm 0; padding: 3mm 5mm; font-style: italic; color: #4a4360; }
hr { border: none; border-top: 1px solid #d8d4e6; margin: 6mm 0; }
""")

print("Building PDF…")
HTML(string=html, base_url=ROOT).write_pdf(OUT, stylesheets=[css])
print(f"  → {OUT} ({os.path.getsize(OUT)//1024} KB)")
