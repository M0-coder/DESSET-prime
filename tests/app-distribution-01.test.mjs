import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {appPages,assertClosedDistribution,assertClosedAppPage} from "../scripts/app-distribution-contract.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const source=read("scripts/service-state.js"),config=JSON.parse(read("config/app-distribution.json"));
function withConfig(c){return source.replace(/^const registry=.+;$/m,"const registry="+JSON.stringify(c)+";");}
function functions(){const ctx={document:{querySelectorAll:()=>[]}};vm.runInNewContext(source.replace("const panels=document.querySelectorAll", "globalThis.inspect={officialListing,suggestDevice};const panels=document.querySelectorAll"),ctx,{timeout:700});return ctx.inspect;}
const {officialListing,suggestDevice}=functions();
test("Canonical config, projection and all six release slots are closed",()=>{
 assertClosedDistribution(source,config);
 for(const app of config.apps)for(const platform of ["android","ios"])assert.equal(officialListing(app,platform,"PE"),null);
});
for(const [label,change] of [
 ["global rollout",c=>c.policy="approved"],
 ["platform rollout",c=>c.apps[0].platforms.android.status="published"],
 ["unverified URL",c=>c.apps[0].platforms.android.url="https://example.invalid/app"],
 ["developer identity",c=>c.apps[0].officialName="Synthetic"],
 ["QR insertion",c=>c.apps[0].qr={path:"fake.svg"}],
 ["coverage claim",c=>c.apps[0].coverage=["synthetic"]],
 ["activation claim",c=>c.apps[0].activation="enabled"],
 ["unknown app",c=>c.apps.push(c.apps[0])]
])test("Closed publication gate rejects "+label,()=>{const c=structuredClone(config);change(c);assert.throws(()=>assertClosedDistribution(withConfig(c),c));});
function fixture(platform){
 const c=structuredClone(config.apps[0]);c.officialName="Synthetic test only";
 const id=platform==="android"?"test.example.synthetic":"123456789";
 const url=platform==="android"?"https://play.google.com/store/apps/details?id="+id:"https://apps.apple.com/pe/app/id"+id;
 c.platforms[platform]={status:"published",verified:true,storeId:id,developer:"Synthetic publisher",compatibility:"Synthetic OS",url,countries:["PE"],evidence:[{country:"PE",storeId:id,developer:"Synthetic publisher",url,reference:"synthetic fixture",checkedOn:"2026-01-01"}]};
 return c;
}
for(const platform of ["android","ios"])test("Synthetic exact listing contract and adversarial destinations: "+platform,()=>{
 const a=fixture(platform),s=a.platforms[platform];
 assert.equal(officialListing(a,platform,"PE").url,s.url);
 assert.equal(officialListing(a,platform,"OTHER"),null);
 assert.equal(officialListing(a,platform,"US"),null);
 for(const mutate of [x=>x.verified=false,x=>x.status="withdrawn",x=>x.storeId="other",x=>x.developer="other",x=>x.url+="&extra=1",x=>x.url=x.url.replace("https://","http://"),x=>x.url=x.url.replace(".com/",".com.evil.invalid/"),x=>x.evidence=[],x=>x.evidence.push(x.evidence[0]),x=>x.compatibility=null]){
 const b=structuredClone(a);mutate(b.platforms[platform]);assert.equal(officialListing(b,platform,"PE"),null);
 }
 assert.equal(officialListing({...a,officialName:null},platform,"PE"),null);
 assert.equal(officialListing(a,platform==="android"?"ios":"android","PE"),null);
});
test("Device hint is optional and does not imply region or compatibility",()=>{
 assert.equal(suggestDevice("Mozilla Android"),"android");assert.equal(suggestDevice("Mozilla iPhone"),"ios");assert.equal(suggestDevice(""),"desktop");
});
for(const dir of ["","dist/"])test("Role pages and directory remain static, accessible without JS and fail closed "+(dir||"source"),()=>{
 for(const name of appPages){
 const html=read(dir+name+".html");assertClosedAppPage(html,name);
 assert.match(html,/País de consulta/);
 assert.doesNotMatch(html,/href=["'](?:https?:|market:|itms-apps:)/i);
 if(name!=="aplicaciones"){assert.match(html,/data-app-activation>No habilitada/);assert.match(html,/data-app-coverage>No confirmada/);assert.match(html,/data-app-links hidden/);assert.match(html,/data-app-platforms hidden/);}
 }
 const home=read(dir+"index.html");assert.ok(home.includes('href="./aplicaciones.html"'));
 const directory=read(dir+"aplicaciones.html");for(const name of appPages.slice(1))assert.ok(directory.includes('href="./'+name+'.html"'));
 assertClosedDistribution(read(dir+"scripts/service-state.js"),config);
});
