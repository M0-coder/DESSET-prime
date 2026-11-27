"""Offline experiment only. Restore the original package even when a measurement fails."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import statistics
import subprocess
import tempfile
import time
import urllib.request

root = Path(__file__).resolve().parent.parent
os.chdir(root)
report = root / "reports/perf-mobile"
report.mkdir(parents=True, exist_ok=True)
video = root / "dist/assets/desset-hero-editorial.mp4"
original_hash = "76944235866393f12d88c4ce3869cdf984a13805638af441747f59f318a725b0"
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def call(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)

def probe(path):
    info = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)]))
    assert len(info["streams"]) == 1
    stream = info["streams"][0]
    return {k: stream.get(k) for k in ("codec_name","width","height","pix_fmt","r_frame_rate","nb_frames","duration","color_space","color_range","color_primaries","color_transfer")}

def snapshot():
    return {str(p.relative_to(root / "dist")): sha(p) for p in (root / "dist").rglob("*") if p.is_file()}

def save(name, value):
    (report / name).write_text(json.dumps(value, indent=2) + "\n")

actual = subprocess.check_output(["git","rev-parse","HEAD"], text=True).strip()
assert actual == os.environ["EXPECTED_SOURCE_SHA"]
assert sha(video) == original_hash, "Approved source video changed"
before = snapshot()
save("environment.json", {"source_sha":actual, "ffmpeg":subprocess.check_output(["ffmpeg","-version"],text=True).splitlines()[0], "ffprobe":subprocess.check_output(["ffprobe","-version"],text=True).splitlines()[0],"method":"Lighthouse 12.8.2, alternating cold default mobile runs; same runner and loopback origin. Synthetic, not field data."})
server = None
with tempfile.TemporaryDirectory() as tmp:
    old = Path(tmp) / "original.mp4"
    new = Path(tmp) / "candidate.mp4"
    shutil.copyfile(video, old)
    try:
        call(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(old),"-c:v","libx264","-preset","medium","-crf","21","-pix_fmt","yuv420p","-movflags","+faststart","-an","-threads","4",str(new)])
        assert probe(old) == probe(new), "Video technical properties changed"
        stats = report / "ssim-frames.txt"
        call(["ffmpeg","-hide_banner","-loglevel","error","-i",str(new),"-i",str(old),"-lavfi","ssim=stats_file="+str(stats),"-f","null","-"])
        frames = [float(x) for x in re.findall(r"All:([0-9.]+)", stats.read_text())]
        quality = {"frames":len(frames),"mean_ssim":statistics.mean(frames),"min_ssim":min(frames),"original_bytes":old.stat().st_size,"candidate_bytes":new.stat().st_size,"original_sha256":sha(old),"candidate_sha256":sha(new),"stream":probe(new)}
        save("video-quality.json",quality)
        assert len(frames)==250 and quality["mean_ssim"]>=.985 and quality["min_ssim"]>=.98
        assert new.stat().st_size <= old.stat().st_size*.8
        # Install/warm the pinned Lighthouse package before the first timed navigation.
        cmd = ["npm","exec","--yes","--package=lighthouse@12.8.2","--","lighthouse"]
        call(cmd+["--version"])
        server = subprocess.Popen(["node","scripts/local-preview.mjs"],env={**os.environ,"DESSET_PRIME_WEB_ROOT":"dist"},stdout=subprocess.DEVNULL)
        for _ in range(30):
            try:
                with urllib.request.urlopen("http://127.0.0.1:4173/",timeout=1) as resp:
                    assert resp.status==200
                break
            except OSError:
                time.sleep(1)
        else:
            raise RuntimeError("Loopback preview unavailable")
        rows=[]
        for i, variant in enumerate(("A","B","B","A","A","B"),1):
            shutil.copyfile(old if variant=="A" else new, video)
            changed=[k for k,v in snapshot().items() if before.get(k)!=v]
            assert changed==([] if variant=="A" else ["assets/desset-hero-editorial.mp4"])
            path=report / f"{i:02d}-{variant}-mobile.json"
            call(cmd+["http://127.0.0.1:4173/","--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage","--output=json","--output-path="+str(path),"--only-categories=performance,accessibility,best-practices","--quiet"])
            raw=json.loads(path.read_text())
            assert not raw.get("runtimeError")
            def metric(k): return raw["audits"][k]["numericValue"]
            row={"run":i,"variant":variant,"lcp_ms":metric("largest-contentful-paint"),"fcp_ms":metric("first-contentful-paint"),"cls":metric("cumulative-layout-shift"),"tbt_ms":metric("total-blocking-time"),"performance":raw["categories"]["performance"]["score"]*100,"accessibility":raw["categories"]["accessibility"]["score"]*100,"best_practices":raw["categories"]["best-practices"]["score"]*100,"benchmark_index":raw["environment"]["benchmarkIndex"]}
            rows.append(row)
            save("runs.json",rows)
        keys=("lcp_ms","fcp_ms","cls","tbt_ms","performance","accessibility","best_practices","benchmark_index")
        med={v:{k:statistics.median(x[k] for x in rows if x["variant"]==v) for k in keys} for v in ("A","B")}
        sentinels=all(x["performance"]>=85 and x["accessibility"]>=90 and x["best_practices"]>=90 and x["cls"]<=.1 and x["lcp_ms"]<=4000 for x in rows if x["variant"]=="B")
        improvement=med["B"]["lcp_ms"] <= min(2500,med["A"]["lcp_ms"]*.95) and med["B"]["tbt_ms"]<=med["A"]["tbt_ms"]+50 and med["B"]["cls"]<=med["A"]["cls"]+.01 and med["B"]["performance"]>=med["A"]["performance"] and sentinels
        save("summary.json",{"medians":med,"candidate_sentinels_pass":sentinels,"mobile_lab_target_met":improvement,"status":"LAB CANDIDATE ONLY — visual and release review still required" if improvement else "NO-GO: improvement not demonstrated","limitations":"Three synthetic measurements per variant; no physical devices, field CWV, manual visual or deployment approval. All results retained."})
        print(json.dumps({"medians":med,"mobile_lab_target_met":improvement},indent=2))
    finally:
        if server:
            server.terminate()
            server.wait(timeout=10)
        shutil.copyfile(old,video)
        assert snapshot()==before,"Package restoration failed"
