import assert from "node:assert/strict";
// Homepage is the canonical navigation source. No runtime template or dependency.
export const institutionalPages=Object.freeze(["empresa","comercios","repartidores","contacto","confianza","noticias","talento","aplicaciones"]);
export const menuScript='<script defer src="./scripts/app.js"></script>';
export function sharedHeader(home,page){
 assert.ok(institutionalPages.includes(page));
 const header=home.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0];
 assert.ok(header,"Missing canonical header");
 return header.replace('href="#inicio"','href="./index.html"').replace(/href="#(soluciones|ecosistema|negocios)"/g,'href="./index.html#$1"').replace('href="./'+page+'.html"','href="./'+page+'.html" aria-current="page"');
}
export function sharedFooterNav(home,page){
 assert.ok(institutionalPages.includes(page));
 const nav=home.match(/<nav class="corporate-footer"[\s\S]*?<\/nav>/)?.[0];
 assert.ok(nav,"Missing canonical footer navigation");
 return nav.replace('href="#soluciones"','href="./index.html#soluciones"').replace('href="./'+page+'.html"','href="./'+page+'.html" aria-current="page"');
}
export function assertInstitutionalNavigation(home,doc,page){
 assert.equal(doc.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0],sharedHeader(home,page),"Header differs from canonical navigation");
 assert.equal(doc.match(/<nav class="corporate-footer"[\s\S]*?<\/nav>/)?.[0],sharedFooterNav(home,page),"Footer differs from canonical navigation");
 const scripts=doc.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi)||[];
 assert.deepEqual(scripts,page==="aplicaciones"?[menuScript,'<script defer src="./scripts/service-state.js"></script>']:[menuScript],"Only approved local navigation script permitted");
}
