import assert from "node:assert/strict";
export const appPages=Object.freeze(["aplicaciones","aplicaciones-clientes","aplicaciones-comercios","aplicaciones-repartidores"]);
export function assertClosedDistribution(source,config){
 const matches=[...source.matchAll(/^const registry=(.+);$/gm)];
 assert.equal(matches.length,1,"Expected single distribution registry");
 const value=JSON.parse(matches[0][1]);
 if(config!==undefined)assert.equal(JSON.stringify(value),JSON.stringify(config),"Distribution projection differs from canonical source");
 assert.equal(matches[0][1],JSON.stringify(value),"Noncanonical distribution projection");
 const platform=()=>({status:"not_published",verified:false,storeId:null,developer:null,compatibility:null,url:null,countries:[],evidence:[]});
 const expected={schema:"desset-app-distribution-v1",policy:"closed",queryCountry:"PE",apps:[["clientes","Clientes"],["comercios","Comercios"],["repartidores","Repartidores"]].map(([id,audience])=>({id,audience,officialName:null,activation:"not_enabled",coverage:[],qr:null,platforms:{android:platform(),ios:platform()}}))};
 assert.deepEqual(value,expected,"APP-DISTRIBUTION-01 release is closed; separate activation authorization required");
 return value;
}
export function assertClosedAppPage(doc,name){
 assert.ok(appPages.includes(name),"Unexpected application route");
 assert.ok(doc.includes('name="robots" content="noindex,nofollow"')&&doc.includes("form-action 'none'"),"Missing indexing/CSP gate: "+name);
 assert.doesNotMatch(doc,/<(?:form|iframe|object|embed)\b|\bon[a-z]+\s*=|<a\b[^>]*\bhref=["'](?:https?:|market:|itms-apps:)|\sdownload(?:\s|=|>)/i,"Unapproved public distribution control: "+name);
 const scripts=doc.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi)||[];
 assert.deepEqual(scripts,['<script defer src="./scripts/service-state.js"></script>'],"Only existing distribution controller allowed: "+name);
 assert.ok(doc.includes('href="./styles-applications.css"')&&doc.includes('data-app-download>Descarga no disponible.'),"Missing inactive default: "+name);
 assert.doesNotMatch(doc,/<img\b[^>]*(?:qr|\.apk|\.ipa)/i,"Unapproved QR or installer");
}
