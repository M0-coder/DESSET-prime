import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const source=readFileSync(new URL("../scripts/app.js",import.meta.url),"utf8");

function createHarness(script=source,withElements=true){
 const handlers={menu:{},nav:{},document:{}};
 const attrs={"aria-expanded":"false","aria-label":"Menú — abrir navegación"};
 let focused=0;
 const rootClasses=new Set();
 const menu={
  setAttribute(key,value){attrs[key]=value},
  getAttribute(key){return attrs[key]},
  addEventListener(event,fn){handlers.menu[event]=fn},
  focus(){focused++}
 };
 const nav={dataset:{},addEventListener(event,fn){handlers.nav[event]=fn}};
 const document={
  documentElement:{classList:{add:(name)=>rootClasses.add(name)}},
  querySelector(selector){
   if(!withElements)return null;
   if(selector===".menu-button")return menu;
   if(selector===".main-nav")return nav;
   throw Error("Unexpected selector: "+selector)
  },
  addEventListener(event,fn){handlers.document[event]=fn}
 };
 runInNewContext(script,{document},{timeout:1000});
 return {
  attrs,nav,handlers,rootClasses,
  clickMenu(){handlers.menu.click()},
  clickNav(isAnchor){handlers.nav.click({target:{closest:(selector)=>selector==="a"&&isAnchor?{}:null}})},
  keydown(key){handlers.document.keydown({key})},
  get focusCount(){return focused}
 };
}

function contract(script=source){
 const h=createHarness(script);
 assert.equal(h.attrs["aria-expanded"],"false");
 assert.ok(h.rootClasses.has("js-enabled"),"Progressive navigation is activated after handlers are registered");
 h.clickMenu();
 assert.equal(h.attrs["aria-expanded"],"true");
 assert.equal(h.attrs["aria-label"],"Menú — cerrar navegación");
 assert.equal(h.nav.dataset.open,"true");

 h.keydown("Tab");
 assert.equal(h.attrs["aria-expanded"],"true","Unrelated key must not close menu");
 h.keydown("Escape");
 assert.equal(h.attrs["aria-expanded"],"false","Escape must close menu");
 assert.equal(h.nav.dataset.open,"false");
 assert.equal(h.attrs["aria-label"],"Menú — abrir navegación");
 assert.equal(h.focusCount,1,"Focus must return to trigger after Escape");

 h.clickMenu();
 h.clickNav(false);
 assert.equal(h.attrs["aria-expanded"],"true","Clicking inside nav outside an anchor should not close");
 h.clickNav(true);
 assert.equal(h.attrs["aria-expanded"],"false","Link selection must close mobile navigation");
 h.clickMenu();h.clickMenu();
 assert.equal(h.attrs["aria-expanded"],"false","Second menu click should toggle closed");
}

test("menu real: toggle, Escape, focus, icon label and anchor navigation",()=>contract());
test("missing optional navigation nodes must not throw",()=>{
 const h=createHarness(source,false);
 assert.equal(Object.keys(h.handlers.menu).length,0);
 assert.equal(Object.keys(h.handlers.nav).length,0);
 assert.ok(!h.rootClasses.has("js-enabled"),"Static fallback must survive missing menu nodes");
});
test("mutation smoke: altering Escape behavior is rejected by the contract",()=>{
 const mutant=source.replace('event.key==="Escape"','event.key==="Enter"');
 assert.notEqual(mutant,source,"Must actually alter source");
 assert.throws(()=>contract(mutant),/Escape must close menu/);
});
