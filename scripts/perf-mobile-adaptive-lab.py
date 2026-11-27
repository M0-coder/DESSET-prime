"""Isolated encoding and paired playback experiment. No adaptive policy or source changes."""
import hashlib
import json
import os
from pathlib import Path
import re
import statistics
import subprocess
import tempfile

root=Path(__file__).resolve().parent.parent
os.chdir(root)
dist=root/"dist"
report=root/"reports/perf-adaptive"
report.mkdir(parents=True,exist_ok=True)
asset=dist/"assets/desset-hero-editorial.mp4"
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def snapshot(): return {str(p.relative_to(dist)):digest(p) for p in dist.rglob("*") if p.is_file()}
def save(n,x): (report/n).write_text(json.dumps(x,indent=2)+"\n")
def call(args,**kwargs): return subprocess.run(args,check=True,**kwargs)
def probe(p):
    x=json.loads(subprocess.check_output(["ffprobe","-v","error","-show_streams","-of","json",str(p)]))["streams"]
    assert len(x)==1
    return x[0]
before=snapshot()
original=asset.read_bytes()
assert digest(asset)=="76944235866393f12d88c4ce3869cdf984a13805638af441747f59f318a725b0"
with tempfile.TemporaryDirectory() as tmp:
    candidate=Path(tmp)/"mobile.mp4"
    try:
        # Same edit, timestamps and color; constrained-rate H.264 with fast start.
        call(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(asset),"-vf","scale=960:480:flags=lanczos","-c:v","libx264","-preset","slow","-crf","23","-maxrate","850k","-bufsize","850k","-g","25","-keyint_min","25","-sc_threshold","0","-pix_fmt","yuv420p","-movflags","+faststart","-an","-threads","4",str(candidate)])
        a,b=probe(asset),probe(candidate)
        for k in ("codec_name","r_frame_rate","nb_frames","duration","pix_fmt","color_space","color_range","color_primaries","color_transfer"):
            assert a.get(k)==b.get(k),k
        assert b["width"]==960 and b["height"]==480
        assert b["nb_frames"]=="250"
        stats=report/"ssim-frames.txt"
        # Evaluate at original raster; this includes the loss from downscaling.
        call(["ffmpeg","-hide_banner","-loglevel","error","-i",str(candidate),"-i",str(asset),"-lavfi","[0:v]scale=1920:960:flags=lanczos[c];[c][1:v]ssim=stats_file="+str(stats),"-f","null","-"])
        frames=[float(x) for x in re.findall(r"All:([0-9.]+)",stats.read_text())]
        assert len(frames)==250
        q={"original_bytes":len(original),"candidate_bytes":candidate.stat().st_size,"candidate_sha256":digest(candidate),"resolution":[960,480],"fps":25,"frames":250,"duration_s":10,"ssim_original_raster_mean":statistics.mean(frames),"ssim_original_raster_min":min(frames),"ffmpeg":subprocess.check_output(["ffmpeg","-version"],text=True).splitlines()[0]}
        q["quality_gate"]=q["ssim_original_raster_mean"]>=.95 and q["ssim_original_raster_min"]>=.90 and q["candidate_bytes"]<=1100000
        save("candidate-quality.json",q)
        print(json.dumps(q,indent=2))
        # Keep measurements even if quality is insufficient: no false acceptance.
        call(["node","scripts/perf-mobile-adaptive-lab.mjs"],env={**os.environ,"PERF_CANDIDATE":str(candidate)})
        rows=json.loads((report/"summary.json").read_text())
        def metrics(v):
            s=[x for x in rows if x["variant"]==v]
            assert len(s)==3
            return {"lcp_ms":statistics.median(x["lcp"]["startTime"] for x in s) if all(x["lcp"] for x in s) else None,"first_frame_ms":statistics.median(x["firstFrame"]["presentationTime"] for x in s) if all(x["firstFrame"] for x in s) else None,"waiting_events":statistics.median(x["waitingEvents"] for x in s),"media_time_s":statistics.median(x["state"]["time"] for x in s),"all_four_cues":all({z["cue"] for z in x["cues"]}>={"0","2.4","4.4","7.8"} for x in s)}
        A,B=metrics("A"),metrics("B")
        reduced=next(x for x in rows if x["variant"]=="REDUCED-A")
        fast=next(x for x in rows if x["variant"]=="FAST-A")
        controls=reduced["state"]["src"] is None and reduced["firstFrame"] is None and fast["firstFrame"] is not None
        passes=bool(q["quality_gate"] and controls and A["lcp_ms"] and B["lcp_ms"] and A["first_frame_ms"] and B["first_frame_ms"] and B["lcp_ms"]<=A["lcp_ms"]*.8 and B["first_frame_ms"]<=A["first_frame_ms"]*.8 and B["waiting_events"]<=max(1,A["waiting_events"]-3) and B["all_four_cues"])
        result={"A":A,"B":B,"quality":q,"controls_pass":controls,"lab_acceptance":passes,"status":"candidate for visual/policy review ONLY" if passes else "NO-GO","limitations":"Applied synthetic throttling; no actual adaptive selection, physical phone, active-video human review or field data. LCP target 2.5s is reported separately, not assumed.","lcp_2500ms_met":bool(B["lcp_ms"] is not None and B["lcp_ms"]<=2500)}
        save("decision.json",result);print(json.dumps(result,indent=2))
    finally:
        asset.write_bytes(original)
        assert snapshot()==before,"Original package not restored"
