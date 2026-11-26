import {departments,provinces,districtsFor} from "./territory.mjs";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ds=departments(),ps=ds.flatMap(d=>provinces(d.code).map(p=>({...p,parent:d.name,department:d.name}))),xs=ps.flatMap(p=>districtsFor(p.code).map(d=>({...d,parent:p.name,department:p.department})));
export const shortInterestLabels=Object.freeze({ready:"Deseo incorporarme",soon:"Planeo incorporarme",evaluating:"Estoy evaluando",information:"Deseo información"});
export function locationControl(key,attrs,data={}){
 const options=key==="department"?ds:key==="province"?ps:xs;
 const selected=o=>data[key]===o.name&&(key==="department"||o.department===data.department)&&(key!=="district"||o.parent===data.province);
 const option=o=>'<option value="'+esc(o.name)+'" data-code="'+esc(o.code)+'"'+(o.parent?' data-parent="'+esc(o.parent)+'" data-department="'+esc(o.department)+'"':"")+(selected(o)?" selected":"")+'>'+esc(o.name)+'</option>';
 return '<select'+attrs+'><option value="">Selecciona una opción</option>'+options.map(option).join("")+'</select>';
}
// Progressive enhancement; server still validates the complete territorial hierarchy.
export const territoryScript=`(()=>{const form=document.querySelector('form[action$="/confirm"]');if(!form)return;const d=form.elements.namedItem('department'),p=form.elements.namedItem('province'),x=form.elements.namedItem('district');if(!d||!p||!x)return;function filter(select,ok){const previous=select.selectedOptions[0];for(const o of select.options){if(!o.value)continue;const visible=ok(o);o.hidden=!visible;o.disabled=!visible;}if(previous?.disabled)select.selectedIndex=0;}function update(){filter(p,o=>!!d.value&&o.dataset.department===d.value);filter(x,o=>!!d.value&&!!p.value&&o.dataset.department===d.value&&o.dataset.parent===p.value);}d.addEventListener('change',()=>{p.selectedIndex=0;x.selectedIndex=0;update();});p.addEventListener('change',()=>{x.selectedIndex=0;update();});update();})();`;
