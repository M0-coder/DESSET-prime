import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {contactCategoryIds,contactCandidateUrl,prepareContactLinkRehearsal} from "../scripts/prime-contact-link-rehearsal.mjs";
const names=["contacto","confianza","noticias","en"];
const pages=()=>Object.fromEntries(names.map(name=>[name,readFileSync(new URL("../"+name+".html",import.meta.url),"utf8")]));
test("all nine contact categories have exact candidate destinations in private rehearsal only",()=>{
 const source=pages(),snapshot=JSON.stringify(source),out=prepareContactLinkRehearsal(source);
 for(const category of contactCategoryIds)assert.equal(out.contacto.split('href="'+contactCandidateUrl(category)+'"').length,2);
 assert.equal(JSON.stringify(source),snapshot);
 for(const html of Object.values(out)){assert.match(html,/name="robots" content="noindex,nofollow"/);assert.match(html,/form-action 'none'/);assert.doesNotMatch(html,/<form\b/);}
 assert.match(out.contacto,/candidato no habilitado/);assert.doesNotMatch(source.contacto,/https:\/\/contacto\.desset\.lat/);
 assert.throws(()=>contactCandidateUrl("https://example.org"));
});
test("incomplete category inventory or indexed rehearsal fails closed",()=>{
 const source=pages();assert.throws(()=>prepareContactLinkRehearsal({...source,contacto:source.contacto.replace('id="alianzas"','id="missing"')}));
 assert.throws(()=>prepareContactLinkRehearsal({...source,en:source.en.replace('noindex,nofollow','index,follow')}));
 assert.throws(()=>prepareContactLinkRehearsal({...source,extra:""}));
});
