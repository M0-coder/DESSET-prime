import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html'), css=read('styles-visual02.css');
test('corporate summary is the last main section with the three approved cards',()=>{
  const match=html.match(/<section class="institutional-home corporate-summary"[^>]*>([\s\S]*?)<\/section>\s*<\/main>\s*<footer class="site-footer home-footer-dark">/);
  assert.ok(match);
  assert.deepEqual([...match[1].matchAll(/<h3>([^<]+)<\/h3>/g)].map(m=>m[1]),['Empresa','Inversores','Noticias']);
  assert.deepEqual([...match[1].matchAll(/href="([^"]+)"/g)].map(m=>m[1]),['./empresa.html','./empresa.html#inversores','./noticias.html']);
  assert.equal((html.match(/id="noticias-destacadas"/g)||[]).length,1);
  assert.match(html,/name="robots" content="noindex,nofollow"/);
});
test('homepage footer retains real links and responsive navigation',()=>{
  const footer=html.split('<footer class="site-footer home-footer-dark">')[1];
  assert.ok(footer);
  assert.deepEqual([...footer.matchAll(/<strong>([^<]+)<\/strong>/g)].map(m=>m[1]),['Empresa','Servicios','Aplicaciones','Contacto']);
  assert.deepEqual([...footer.matchAll(/<summary>([^<]+)<\/summary>/g)].map(m=>m[1]),['Empresa','Servicios','Aplicaciones','Contacto']);
  assert.equal((footer.match(/data-footer-channel=/g)||[]).length,5);
  assert.match(footer,/<p>© 2026 DESSET\. Todos los derechos reservados\.<\/p>\s*<\/footer>/);
});
test('approved layout stays scoped to homepage and collapses on mobile',()=>{
  assert.match(css,/body\.desset-home-cinematic #empresa-destacada\.corporate-summary \.institutional-home-grid\{\s*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/body:has\(#inicio\) \.site-footer\.home-footer-dark\{[^}]*background:#0a0a0a/);
  assert.match(css,/@media\(max-width:700px\)\{\s*body\.desset-home-cinematic #empresa-destacada\.corporate-summary \.institutional-home-grid\{grid-template-columns:minmax\(0,1fr\)/);
});

test('homepage labels do not weaken the canonical internal navigation checks', async()=>{
  const {assertInstitutionalNavigation}=await import('../scripts/institutional-navigation-contract.mjs');
  const company=read('empresa.html');
  assert.doesNotThrow(()=>assertInstitutionalNavigation(html,company,'empresa'));
  assert.throws(()=>assertInstitutionalNavigation(html,company.replace('<strong>Ecosistema</strong>','<strong>Unexpected</strong>'),'empresa'),/Footer differs/);
  assert.throws(()=>assertInstitutionalNavigation(html,company.replace('<nav class="corporate-footer"'+company.split('<nav class="corporate-footer"')[1],('<nav class="corporate-footer"'+company.split('<nav class="corporate-footer"')[1]).replace('href="./prime.html">DESSET prime','href="./contacto.html">DESSET prime')),'empresa'),/Footer differs/);
});
test('social strip preserves its existing icon appearance and layout rules',()=>{
  const scoped=css.split('/* CORPORATE-FOOTER-02')[1];
  assert.match(scoped,/\.footer-social\{\s*grid-column:1\/-1;background:#f5f5f5;\s*\}/);
  assert.doesNotMatch(scoped,/\.footer-social a(?:\:hover)?\s*\{/);
  assert.match(scoped,/a:not\(\.footer-social a\):focus-visible/);
});

test('copyright retains original markup and typography',()=>{
 const scoped=css.split('/* CORPORATE-FOOTER-02')[1];
 assert.match(scoped,/\.site-footer\.home-footer-dark>p\{\s*grid-column:1\/-1;background:#f5f5f5;\s*\}/);
});
