// Browser-only synthetic integration evidence. No public route or deployment.
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {randomBytes} from "node:crypto";
import {makeReviewerCredential,startSyntheticIntake} from "../internal/merchant-intake/server.mjs";
import {openMerchantIntake} from "../internal/merchant-intake/intake.mjs";

export async function auditPrivateMerchant({call,js,until,capture,report}){
 const dir=await mkdtemp(join(tmpdir(),"desset-merchant-browser-"));
 const databasePath=join(dir,"synthetic.sqlite");
 let server,store;
 try{
  const password=randomBytes(24).toString("hex");
  server=await startSyntheticIntake({databasePath,credential:await makeReviewerCredential(password),syntheticEnabled:true});
  store=openMerchantIntake(databasePath);
  const actor={id:"browser-test-reviewer",role:"merchant-reviewer"};
  const ready=async(path,selector)=>{
   try{
    await until(async()=>await js("document.readyState==='complete' && location.origin==="+JSON.stringify(server.origin)+" && location.pathname==="+JSON.stringify(path)+" && !!document.querySelector("+JSON.stringify(selector)+")"),"merchant synthetic "+path);
   }catch(e){
    const state=await js("(()=>{let error=null;try{const b=JSON.parse(document.body.innerText);if(typeof b.error==='string'&&/^[A-Z_]{1,50}$/.test(b.error))error=b.error}catch{}return {sameOrigin:location.origin==="+JSON.stringify(server.origin)+",path:location.pathname,ready:document.readyState,error,formCount:document.forms.length,hasAlert:!!document.querySelector('[role=alert]')}})()").catch(()=>({unavailable:true}));
    throw Error("Private browser navigation to "+path+" failed: "+JSON.stringify(state),{cause:e});
   }
   await js("document.fonts.ready.then(()=>true)");
  };
  const navigate=async(path,selector)=>{
   await call("Page.navigate",{url:server.origin+path});
   await ready(path,selector);
  };
  const submit=async(action,path,selector)=>{
   const ok=await js("(()=>{const f=document.querySelector("+JSON.stringify("form[action='"+action+"']")+");if(!f||!f.checkValidity())return false;setTimeout(()=>f.requestSubmit(),50);return true})()");
   assert.equal(ok,true,"Form not ready: "+action);
   await ready(path,selector);
  };
  const fit=async(label)=>{
   const state=await js("(()=>{const v=document.documentElement.clientWidth;return {viewport:v,scroll:document.documentElement.scrollWidth,fonts:document.fonts.status,visible:[...document.querySelectorAll('main input:not([type=hidden]),main select,main textarea,main button')].every(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.left>=-2&&r.right<=v+2})}})()");
   assert.ok(state.scroll<=state.viewport+2,label+" horizontal overflow");
   assert.equal(state.visible,true,label+" controls out of bounds");
   assert.equal(state.fonts,"loaded");
   assert.equal(await js("Array.from(document.querySelectorAll('link[rel=stylesheet]')).every(l=>!!l.sheet) && document.querySelector('.brand-mark').naturalWidth>0"),true,label+" styles or logo not loaded");
   return state;
  };
  const refs=[];
  for(const [w,h] of [[1440,900],[768,900],[390,844],[320,700]]){
   await call("Emulation.setDeviceMetricsOverride",{width:w,height:h,deviceScaleFactor:1,mobile:w<=800});
   await navigate("/registro-comercios.html","form[action='/merchant/confirm']");
   const initial=await js("(()=>{const f=document.querySelector('form');return {invalid:!f.checkValidity(),sheets:[...document.querySelectorAll('link[rel=stylesheet]')].every(l=>!!l.sheet),logo:document.querySelector('.brand-mark').naturalWidth>0,labels:[...f.querySelectorAll('input:not([type=hidden]),select,textarea')].every(e=>e.labels&&e.labels.length>0)}})()");
   assert.deepEqual(initial,{invalid:true,sheets:true,logo:true,labels:true});
   const formData={business_name:"Synthetic browser "+w,category:"restaurant",department:"Lima",province:"Huaura",district:"Huacho",postal_code:"15136",address:"Synthetic street "+w,contact_name:"Synthetic person",contact_pronunciation:"Synthetic name",phone:"+51900000000",email:"browser"+w+"@example.invalid",email_confirm:"browser"+w+"@example.invalid",interest_level:"evaluating",observations:"Synthetic visual test"};
   const filled=await js("(()=>{const f=document.querySelector('form');for(const [k,v] of Object.entries("+JSON.stringify(formData)+")){const e=f.elements.namedItem(k);if(!e)return false;e.value=v;}f.elements.namedItem('consent').checked=true;return f.checkValidity()})()");
   assert.equal(filled,true,"Browser form validation "+w);
   const information=await fit("Information "+w);
   await capture("merchant-private-information-"+w+".png",true);
   const before=store.list(actor).length;
   await submit("/merchant/confirm","/merchant/confirm","form[action='/merchant/submit']");
   assert.equal(store.list(actor).length,before,"Confirmation must not persist");
   assert.equal(await js("document.querySelector('.ob-review').textContent.includes('15136') && document.querySelector('.ob-review').textContent.includes('Estoy evaluando la incorporación')"),true);
   const confirmation=await fit("Confirmation "+w);
   await capture("merchant-private-confirmation-"+w+".png",true);
   await submit("/merchant/edit","/merchant/edit","form[action='/merchant/confirm']");
   assert.equal(await js("document.querySelector('[name=postal_code]').value==='15136' && document.querySelector('[name=interest_level]').value==='evaluating'"),true);
   assert.equal(await js("document.querySelector('[name=consent]').checked"),false);
   await js("document.querySelector('[name=consent]').checked=true");
   await submit("/merchant/confirm","/merchant/confirm","form[action='/merchant/submit']");
   await submit("/merchant/submit","/merchant/submit",".ob-inner h2");
   assert.equal(await js("document.querySelector('.ob-inner h2').textContent"),"Solicitud de ensayo recibida");
   const rows=store.list(actor),row=rows.find(r=>r.business_name===formData.business_name);
   assert.equal(rows.length,before+1);
   assert.ok(row);
   assert.equal(row.postal_code,"15136");assert.equal(row.interest_level,"evaluating");assert.equal(row.contact_pronunciation,"Synthetic name");
   assert.equal(row.status,"PENDING");
   assert.equal(await js("document.querySelector('.ob-inner').textContent.includes("+JSON.stringify(row.id)+")"),true);
   refs.push(row.id);
   const receipt=await fit("Receipt "+w);
   await capture("merchant-private-receipt-"+w+".png",true);
   report.tests.push({name:"MERCHANT-UI private browser flow "+w,information,confirmation,receipt,persisted:true});
  }
  await call("Emulation.setDeviceMetricsOverride",{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await navigate("/login","form[action='/login']");
  // Never capture or report the generated password.
  await js("document.querySelector('[name=password]').value="+JSON.stringify(password));
  await submit("/login","/admin","main article");
  const admin=await js("(()=>({rows:document.querySelectorAll('main article').length,text:document.querySelector('main').textContent}))()");
  assert.equal(admin.rows,4);
  for(const ref of refs)assert.ok(admin.text.includes(ref));
  assert.ok(admin.text.includes("15136")&&admin.text.includes("evaluating")&&admin.text.includes("Synthetic name"));
  await capture("merchant-private-admin-1440.png",true);
  report.tests.push({name:"MERCHANT-UI authenticated browser admin",rows:admin.rows,fieldsVerified:true});
 }finally{
  try{store?.close();}finally{try{if(server)await server.close();}finally{await rm(dir,{recursive:true,force:true});}}
 }
}
