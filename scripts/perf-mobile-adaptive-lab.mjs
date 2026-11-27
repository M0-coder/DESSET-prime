import {spawn} from "node:child_process";
import {writeFile,mkdtemp,rm,mkdir,readFile,copyFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {createHash} from "node:crypto";
import {tmpdir} from "node:os";
const output=resolve("reports/perf-adaptive");
await mkdir(output,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),"desset-chrome-"));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const child=spawn(process.env.CHROME_BIN||"google-chrome",[
 "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
 "--no-first-run","--no-default-browser-check","--disable-background-networking",
 "--remote-debugging-pipe","--user-data-dir="+profile,"about:blank"
],{stdio:["ignore","ignore","pipe","pipe","pipe"],env:{...process.env,DBUS_SESSION_BUS_ADDRESS:"",DBUS_SYSTEM_BUS_ADDRESS:""}});
let chromeError="";
child.stderr.on("data",b=>{chromeError+=String(b).slice(-900)});
let requestId=0,sessionId=null,pipeBuffer="";
const pending=new Map();
const report={timestamp:new Date().toISOString(),viewports:[],screenshots:[],tests:[],failures:[]};
async function until(fn,label){
 for(let i=0;i<110;i++){
  if(child.exitCode!==null)throw new Error("Chrome exited during "+label+": "+chromeError.slice(-500));
  try{const v=await fn();if(v)return v}catch{}
  await sleep(100);
 }
 throw new Error("Timeout waiting for "+label+"; Chrome stderr: "+chromeError.slice(-1200));
}
child.stdio[4].on("data",chunk=>{
 pipeBuffer+=chunk.toString();
 let pos;
 while((pos=pipeBuffer.indexOf("\0"))!==-1){
  const frame=pipeBuffer.slice(0,pos);pipeBuffer=pipeBuffer.slice(pos+1);
  if(!frame)continue;
  let msg;try{msg=JSON.parse(frame)}catch(e){chromeError+=" CDP parse error: "+String(e);continue}
  if(!msg.id)continue;
  const pendingCall=pending.get(msg.id);if(!pendingCall)continue;
  clearTimeout(pendingCall.timeout);pending.delete(msg.id);
  if(msg.error)pendingCall.reject(new Error(msg.error.message));
  else pendingCall.accept(msg);
 }
});
function call(method,params={},page=true){
 const id=++requestId;
 return new Promise((accept,reject)=>{
  const timeout=setTimeout(()=>{pending.delete(id);reject(new Error("CDP timeout "+method+"; Chrome stderr: "+chromeError.slice(-400)))},25000);
  pending.set(id,{accept,reject,timeout});
  const msg={id,method,params};
  if(page&&sessionId)msg.sessionId=sessionId;
  child.stdio[3].write(JSON.stringify(msg)+"\0");
 });
}
async function js(expression){
 const response=await call("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
 if(response.exceptionDetails)throw new Error("Browser evaluation failed: "+JSON.stringify(response.exceptionDetails));
 return response.result.result.value;
}

const setup=String.raw`(()=>{
 const log={events:[],lcp:[],paint:[],frames:[],ready:[],resources:[],cues:[]};
 Object.defineProperty(window,'__perfMediaLab',{value:log});
 const stamp=(name,v)=>({name,t:performance.now(),readyState:v.readyState,networkState:v.networkState,mediaTime:v.currentTime});
 const hero=v=>v instanceof HTMLVideoElement&&v.id==='desset-editorial-video';
 for(const name of ['loadstart','loadedmetadata','loadeddata','canplay','play','playing','waiting','stalled','error','pause','suspend']){
  document.addEventListener(name,e=>{if(hero(e.target))log.events.push(stamp(name,e.target))},true);
 }
 for(const [type,key] of [['largest-contentful-paint','lcp'],['paint','paint']]){
  try{new PerformanceObserver(list=>{for(const e of list.getEntries())log[key].push({name:e.name,startTime:e.startTime,renderTime:e.renderTime,loadTime:e.loadTime,size:e.size,id:e.element?.id||'',tag:e.element?.tagName||'',url:e.url||''})}).observe({type,buffered:true})}catch(e){log.events.push({name:'observer-error',type,error:String(e)})}
 }
 let bound=false;
 const watch=()=>{const v=document.getElementById('desset-editorial-video');if(!hero(v))return;
 if(!bound){bound=true;if(typeof v.requestVideoFrameCallback==='function')v.requestVideoFrameCallback((t,m)=>log.frames.push({callbackTime:t,presentationTime:m.presentationTime,expectedDisplayTime:m.expectedDisplayTime,mediaTime:m.mediaTime,presentedFrames:m.presentedFrames}));}
 const cue=document.querySelector('#hero-messages [aria-hidden=false]')?.dataset.at;const previous=log.cues.at(-1);if(cue!==undefined&&previous?.cue!==cue)log.cues.push({cue,t:performance.now(),mediaTime:v.currentTime});
 const value=v.getAttribute('data-ready');const last=log.ready.at(-1);if(!last||last.value!==value)log.ready.push({value,t:performance.now(),currentTime:v.currentTime,opacity:getComputedStyle(v).opacity});
 };
 new MutationObserver(watch).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['data-ready','aria-hidden']});
})();`;
const rows=[];
const asset=resolve("dist/assets/desset-hero-editorial.mp4");
const original=await readFile(asset), candidate=await readFile(process.env.PERF_CANDIDATE);
const hash=b=>createHash("sha256").update(b).digest("hex");
const trials=["A","B","B","A","A","B","FAST-A","REDUCED-A"];
try{
 for(let i=1;i<=trials.length;i++){
  const variant=trials[i-1],reduce=variant==="REDUCED-A",fast=variant==="FAST-A";
  await writeFile(asset,variant==="B"?candidate:original);
  if(hash(await readFile(asset))!==hash(variant==="B"?candidate:original))throw Error("asset mismatch");
  const t=await call("Target.createTarget",{url:"about:blank"},false);
  const attached=await call("Target.attachToTarget",{targetId:t.result.targetId,flatten:true},false);
  sessionId=attached.result.sessionId;
  await call("Page.enable");await call("Runtime.enable");await call("Network.enable");
  await call("Network.setCacheDisabled",{cacheDisabled:true});await call("Network.clearBrowserCache");
  await call("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await call("Emulation.setEmulatedMedia",{media:"screen",features:[{name:"prefers-reduced-motion",value:reduce?"reduce":"no-preference"}]});
  await call("Emulation.setCPUThrottlingRate",{rate:4});
  await call("Network.emulateNetworkConditions",{offline:false,latency:fast?20:150,downloadThroughput:fast?2500000:200000,uploadThroughput:fast?1250000:93750,connectionType:fast?"wifi":"cellular3g"});
  await call("Page.addScriptToEvaluateOnNewDocument",{source:setup});
  await call("Page.navigate",{url:"http://127.0.0.1:4173/"});
  await until(async()=>await js("location.origin==='http://127.0.0.1:4173' && !!document.querySelector('#desset-editorial-video')"),"hero present");
  // Fixed observation window: no input, no artificial play/pause, no changes to the page.
  const elapsed=await js("performance.now()");await sleep(Math.max(0,20000-elapsed));
  const data=await js(`(()=>{const v=document.getElementById('desset-editorial-video');return {log:window.__perfMediaLab,resources:performance.getEntriesByType('resource').filter(x=>/desset-hero-editorial|styles|woff2/.test(x.name)).map(x=>({name:x.name,startTime:x.startTime,responseStart:x.responseStart,responseEnd:x.responseEnd,transferSize:x.transferSize,encodedBodySize:x.encodedBodySize})),state:{src:v.getAttribute('src'),ready:v.getAttribute('data-ready'),time:v.currentTime,paused:v.paused,opacity:getComputedStyle(v).opacity,visibility:document.visibilityState,reduce:matchMedia('(prefers-reduced-motion: reduce)').matches}}})()`);
  const entry={run:i,variant,assetSha256:hash(variant==="B"?candidate:original),reducedMotion:reduce,network:{latency_ms:fast?20:150,download_bytes_per_s:fast?2500000:200000,upload_bytes_per_s:fast?1250000:93750,cpu_slowdown:4},...data};
  rows.push(entry);
  await writeFile(join(output,"run-"+i+".json"),JSON.stringify(entry,null,2));
  const shot=await call("Page.captureScreenshot",{format:"png",fromSurface:true});
  await writeFile(join(output,"run-"+i+".png"),Buffer.from(shot.result.data,"base64"));
  await call("Target.closeTarget",{targetId:t.result.targetId},false);sessionId=null;
 }
 const summary=rows.map(x=>({run:x.run,variant:x.variant,reducedMotion:x.reducedMotion,lcp:x.log.lcp.at(-1)||null,firstFrame:x.log.frames[0]||null,waitingEvents:x.log.events.filter(e=>e.name==="waiting").length,events:x.log.events,ready:x.log.ready,cues:x.log.cues,heroResources:x.resources.filter(v=>v.name.includes("desset-hero-editorial")),state:x.state}));
 await writeFile(join(output,"summary.json"),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary.map(({events,ready,heroResources,...x})=>x),null,2));
 if(rows.some(x=>!x.log||!x.state))throw Error("Missing timing evidence");
}finally{
 await writeFile(asset,original);
 child.kill();await new Promise(r=>{if(child.exitCode!==null)r();else child.once("exit",r)});await rm(profile,{recursive:true,force:true});
}
