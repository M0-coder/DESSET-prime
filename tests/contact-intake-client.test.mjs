import test from "node:test";
import assert from "node:assert/strict";
import {createIntakeAttempt} from "../internal/contact-platform/intake-client.mjs";
import worker from "../internal/contact-platform/worker.mjs";
const input=()=>({category:"alianzas",person:"Synthetic Person",email:"Synthetic1@example.invalid",organization:"Synthetic Organization",phone:"+51900000000",subject:"Synthetic subject",message:"Synthetic message",consent:true});
const id="12345678-1234-1234-1234-123456789abc";
const config=transport=>({input:input(),privacyVersion:"synthetic-v1",transport,requestKey:"a".repeat(64)});
const reply=(status,value)=>Response.json(value,{status});
test("intake adapter validates and normalizes the exact D1 contract without transmitting at construction",async()=>{
 let calls=0;
 const cfg=config(async(path,options)=>{calls++;assert.equal(path,"/api/contact");assert.equal(options.method,"POST");assert.equal(options.credentials,"same-origin");assert.equal(options.cache,"no-store");assert.equal(options.redirect,"error");const v=JSON.parse(options.body);assert.equal(Object.keys(v).length,11);assert.equal(v.email,"synthetic1@example.invalid");assert.equal(v.requestKey,"a".repeat(64));assert.equal(v.privacyVersion,"synthetic-v1");assert.equal(v.challenge,"fresh");assert.equal(v.consent,true);return reply(201,{id,replayed:false});});
 const attempt=createIntakeAttempt(cfg);assert.equal(calls,0);cfg.input.message="Changed after creation";
 assert.deepEqual(await attempt.submit("fresh"),{state:"RECEIVED",id,replayed:false});assert.equal(calls,1);
 assert.deepEqual(await attempt.submit("another"),{state:"RECEIVED",id,replayed:false});assert.equal(calls,1);
});
test("lost response retries preserve normalized payload and request key with a fresh challenge",async()=>{
 const bodies=[];const a=createIntakeAttempt(config(async(_p,o)=>{bodies.push(JSON.parse(o.body));if(bodies.length===1)throw Error("network");return reply(200,{id,replayed:true});}));
 assert.equal((await a.submit("first")).state,"RETRY_UNCERTAIN");assert.deepEqual(await a.submit("second"),{state:"RECEIVED",id,replayed:true});const [x,y]=bodies;assert.deepEqual({...x,challenge:"second"},y);
});
test("duplicate clicks cannot dispatch a second request",async()=>{
 let release,calls=0;const a=createIntakeAttempt(config(()=>{calls++;return new Promise(ok=>release=ok);}));
 const pending=a.submit("token");assert.equal((await a.submit("token2")).state,"BUSY");assert.equal(calls,1);release(reply(201,{id,replayed:false}));assert.equal((await pending).state,"RECEIVED");
});
test("malformed receipts cannot indicate success",async()=>{
 for(const response of [reply(201,{id:"bad",replayed:false}),reply(200,{id,replayed:false}),reply(201,{id,replayed:true}),reply(201,{id,replayed:false,extra:true}),new Response("not JSON",{status:201}),reply(202,{id,replayed:false})]){
  const a=createIntakeAttempt(config(async()=>response));assert.equal((await a.submit("token")).state,"RETRY_UNCERTAIN");
 }
});
test("conflict or invalid request is terminal for an unchanged attempt",async()=>{
 for(const [status,state] of [[409,"CONFLICT"],[400,"INVALID"],[413,"INVALID"],[415,"INVALID"]]){
  let calls=0;const a=createIntakeAttempt(config(async()=>{calls++;return reply(status,{error:"TEST"});}));assert.equal((await a.submit("a")).state,state);assert.equal((await a.submit("b")).state,state);assert.equal(calls,1);
 }
});
test("challenge, rate limit and service unavailability remain retryable without false receipts",async()=>{
 for(const [status,state] of [[403,"CHALLENGE_OR_ACCESS_DENIED"],[429,"THROTTLED"],[503,"UNAVAILABLE"]]){
  let calls=0;const a=createIntakeAttempt(config(async()=>++calls===1?reply(status,{error:"TEST"}):reply(201,{id,replayed:false})));
  assert.equal((await a.submit("")).state,"CHALLENGE_REQUIRED");assert.equal(calls,0);assert.equal((await a.submit("first")).state,state);assert.equal((await a.submit("fresh")).state,"RECEIVED");assert.equal(calls,2);
 }
});
test("invalid fields, consent, configuration and category restrictions fail before transport",()=>{
 const transport=()=>{throw Error("must not call");};
 for(const bad of [{...config(transport),transport:undefined},{...config(transport),privacyVersion:""},{...config(transport),requestKey:"bad"},{...config(transport),input:{...input(),consent:false}},{...config(transport),input:{...input(),category:"seguridad"}},{...config(transport),input:{...input(),extra:"bad"}}])assert.throws(()=>createIntakeAttempt(bad));
});
test("adapter does not unlock the actual Worker default export",async()=>{
 const a=createIntakeAttempt(config(async(path,o)=>worker.fetch(new Request("https://contacto.desset.lat"+path,o),new Proxy({},{get(){throw Error("must not read");}}),{})));
 assert.equal((await a.submit("token")).state,"UNAVAILABLE");
});
