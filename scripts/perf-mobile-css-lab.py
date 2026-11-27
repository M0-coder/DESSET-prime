"""Temporary single-sheet experiment. No source, media or release modifications."""
import hashlib
import json
import os
from pathlib import Path
import re
import statistics
import subprocess
import time
import urllib.request

root = Path(__file__).resolve().parent.parent
os.chdir(root)
dist = root / "dist"
report = root / "reports/perf-css"
report.mkdir(parents=True, exist_ok=True)
html = dist / "index.html"
css = dist / "styles.css"
files = ["styles.css", "styles-v5.css", "styles-system.css", "styles-hero-photo.css", "styles-visual02.css", "styles-typography.css", "styles-service-video.css", "styles-hero-editorial.css"]
original_html, original_css = html.read_bytes(), css.read_bytes()

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def snapshot():
    return {str(p.relative_to(dist)):sha(p) for p in dist.rglob("*") if p.is_file()}

def save(name, data):
    (report / name).write_text(json.dumps(data,indent=2)+"\n")

def call(args, **kw):
    return subprocess.run(args,check=True,**kw)

actual=subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip()
assert actual==os.environ["EXPECTED_SOURCE_SHA"]
before=snapshot()
parts=[(dist/name).read_bytes() for name in files]
for part in parts:
    assert not re.search(rb"@(?:charset|import|namespace|layer)\b",part,re.I)
    for match in re.findall(rb"url\(([^)]*)\)",part,re.I):
        assert match.strip(b" \"'") in (b"./fonts/inter-latin-variable.woff2",b"./fonts/plus-jakarta-sans-latin-variable.woff2")
pattern=rb'(?m)^  <link rel="stylesheet" href="\./([^"?]+)(?:\?[^"]*)?">\r?\n'
matches=list(re.finditer(pattern,original_html))
assert [x.group(1).decode() for x in matches]==files
assert original_html[matches[0].start():matches[-1].end()]==b"".join(x.group(0) for x in matches)
bundle=b"\n".join(parts)
candidate=original_html[:matches[0].start()]+b'  <link rel="stylesheet" href="./styles.css?v=perf-css-lab">\n'+original_html[matches[-1].end():]
assert b'noindex,nofollow' in candidate
save("experiment.json",{"source_sha":actual,"original_sheet_count":8,"candidate_sheet_count":1,"original_css_bytes":sum(map(len,parts)),"candidate_css_bytes":len(bundle),"ordered_sha256":[{"file":n,"sha256":hashlib.sha256(b).hexdigest()} for n,b in zip(files,parts)],"bundle_sha256":hashlib.sha256(bundle).hexdigest(),"method":"all CSS bytes retained in source order, same URL directory, no async CSS or minification, no media changes"})
def switch(v):
    html.write_bytes(original_html if v=="A" else candidate)
    css.write_bytes(original_css if v=="A" else bundle)
    now=snapshot()
    assert now.keys()==before.keys()
    assert {k for k in now if now[k]!=before[k]}==(set() if v=="A" else {"index.html","styles.css"})
server=None
try:
    cmd=["npm","exec","--yes","--package=lighthouse@12.8.2","--","lighthouse"]
    call(cmd+["--version"])
    server=subprocess.Popen(["node","scripts/local-preview.mjs"],env={**os.environ,"DESSET_PRIME_WEB_ROOT":"dist"},stdout=subprocess.DEVNULL)
    for _ in range(30):
        try:
            with urllib.request.urlopen("http://127.0.0.1:4173/",timeout=1) as resp:
                assert resp.status==200
            break
        except OSError:
            time.sleep(1)
    else:
        raise RuntimeError("Loopback preview unavailable")
    for v in ("A","B"):
        switch(v)
        call(["node","scripts/perf-mobile-css-visual.mjs",v])
    visual={}
    for width in (320,390,768,1024,1440):
        a=json.loads((report/f"A-{width}.json").read_text())
        b=json.loads((report/f"B-{width}.json").read_text())
        visual[str(width)]={"computed_styles_and_geometry_equal":a==b,"viewport_png_identical":sha(report/f"A-{width}.png")==sha(report/f"B-{width}.png")}
    save("visual-comparison.json",visual)
    rows=[]
    for i,v in enumerate(("A","B","B","A","A","B"),1):
        switch(v)
        path=report/f"{i:02d}-{v}-mobile.json"
        call(cmd+["http://127.0.0.1:4173/","--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage","--output=json","--output-path="+str(path),"--only-categories=performance,accessibility,best-practices","--quiet"])
        raw=json.loads(path.read_text())
        assert not raw.get("runtimeError")
        def metric(k): return raw["audits"][k]["numericValue"]
        rows.append({"run":i,"variant":v,"lcp_ms":metric("largest-contentful-paint"),"fcp_ms":metric("first-contentful-paint"),"cls":metric("cumulative-layout-shift"),"tbt_ms":metric("total-blocking-time"),"performance":raw["categories"]["performance"]["score"]*100,"accessibility":raw["categories"]["accessibility"]["score"]*100,"best_practices":raw["categories"]["best-practices"]["score"]*100,"benchmark_index":raw["environment"]["benchmarkIndex"]})
        save("runs.json",rows)
    keys=("lcp_ms","fcp_ms","cls","tbt_ms","performance","accessibility","best_practices","benchmark_index")
    med={v:{k:statistics.median(x[k] for x in rows if x["variant"]==v) for k in keys} for v in ("A","B")}
    sentinels=all(x["performance"]>=85 and x["accessibility"]>=90 and x["best_practices"]>=90 and x["cls"]<=.1 and x["lcp_ms"]<=4000 for x in rows if x["variant"]=="B")
    visual_ok=all(all(v.values()) for v in visual.values())
    improvement=med["B"]["lcp_ms"]<=min(2500,med["A"]["lcp_ms"]*.95) and med["B"]["fcp_ms"]<=med["A"]["fcp_ms"]+50 and med["B"]["tbt_ms"]<=med["A"]["tbt_ms"]+50 and med["B"]["cls"]<=med["A"]["cls"]+.01 and med["B"]["performance"]>=med["A"]["performance"] and sentinels and visual_ok
    result={"medians":med,"visual_exact_reduced_motion":visual_ok,"candidate_sentinels_pass":sentinels,"mobile_lab_target_met":improvement,"status":"LAB ONLY, further review required" if improvement else "NO-GO"}
    save("summary.json",result)
    print(json.dumps(result,indent=2))
finally:
    try:
        if server:
            server.terminate()
            server.wait(timeout=10)
    finally:
        html.write_bytes(original_html)
        css.write_bytes(original_css)
        assert snapshot()==before,"Original package was not restored"
