/* LOGISTICS-3D-02 — central-hub/fleet/yard authored as deterministic GLB geometry.
 * The original design, meshes and parts are ours: no downloaded models, fonts or assets.
 * All three files are CI build outputs, not production assets. */
import * as THREE from "three";
import {GLTFExporter} from "three/addons/exporters/GLTFExporter.js";
import {mergeGeometries} from "three/addons/utils/BufferGeometryUtils.js";
import {mkdir,writeFile,stat} from "node:fs/promises";
import {createHash} from "node:crypto";
if(!globalThis.FileReader)globalThis.FileReader=class FileReader {
 result=null;onloadend=null;onerror=null;
 async readAsArrayBuffer(blob){
  try{this.result=await blob.arrayBuffer();this.onloadend?.({target:this})}
  catch(error){this.onerror?.(error);throw error}
 }
 async readAsDataURL(blob){
  try{this.result="data:"+(blob.type||"application/octet-stream")+";base64,"+
    Buffer.from(await blob.arrayBuffer()).toString("base64");this.onloadend?.({target:this})}
  catch(error){this.onerror?.(error);throw error}
 }
};
const P={
 royal:0x1551d8,royalLight:0x4878ef,royalDark:0x222222,sky:0x86c2ff,
 gold:0xffc62f,goldDark:0xa96812,cream:0xf6f9ff,red:0xff3328,
 redDark:0x871f26,rubber:0x111111,steel:0xb4cce7,glass:0x8ddcff,
 asphalt:0xdfe9f6,teal:0x24a9a1,stone:0xc4d5e9,wood:0x805c47,
 brick:0xb83d35,leaf:0x447c5a,light:0xfff8d3
};
const keyMat=new Map();
const material=(name,color,metal=0.12,rough=.55)=>{
 const key=name;
 if(!keyMat.has(key)){
  const m=new THREE.MeshStandardMaterial({name,color,metalness:metal,roughness:rough,
   emissive:name==="glass"?0x444444:name==="light"?0xffb624:0x000000,
   emissiveIntensity:name==="light"?.45:name==="glass"?.17:0});
  keyMat.set(key,m);
 }
 return keyMat.get(key);
};
const create=(name)=>{
 const group=new THREE.Group();group.name=name;
 const add=(geo,name,x,y,z,rotation=[0,0,0])=>{
  const mesh=new THREE.Mesh(geo,material(name,P[name]??0xffffff,
    name==="steel"?.68:name==="glass"?.25:.12,
    name==="rubber"?.87:name==="steel"?.26:name==="glass"?.19:.57));
  mesh.name=name;mesh.position.set(x,y,z);mesh.rotation.set(...rotation);group.add(mesh);return mesh;
 };
 const box=(w,h,d,name,x,y,z,rot)=>add(new THREE.BoxGeometry(w,h,d),name,x,y,z,rot);
 const cyl=(r1,r2,h,name,x,y,z,n=12,rot)=>add(new THREE.CylinderGeometry(r1,r2,h,n),name,x,y,z,rot);
 const ball=(r,name,x,y,z,n=12)=>add(new THREE.SphereGeometry(r,n,8),name,x,y,z);
 const torus=(r,t,name,x,y,z)=>add(new THREE.TorusGeometry(r,t,9,22),name,x,y,z);
 const slab=(w,d)=>{box(w,.2,d,"steel",0,-.16,0);box(w-.23,.035,d-.23,"asphalt",0,-.04,0)};
 return {group,box,cyl,ball,torus,slab};
};
/* LOGISTICS-3D-01 — new original, reference-guided warehouse, fleet and docks.
 * Replaces the former retail storefront, motorbike courier and red house.
 * Keep three GLB contract keys only as stable internal loader ABI identifiers. */
/* LOGISTICS-3D-02: single dominant distribution hub and 5 independent
 * delivery trucks across two GLB yard sectors. Reference-guided, original geometry.
 * Each component remains batched by PBR material for modest mobile draw calls. */
function buildTruck(m,x,z,scale=1,variant=0){
 const {box,cyl}=m;
 const B=(w,h,d,mat,px,py,pz)=>box(w*scale,h*scale,d*scale,mat,x+px*scale,py*scale,z+pz*scale);
 const C=(r,mat,px,py,pz,n=10)=>cyl(r*scale,r*scale,.105*scale,mat,x+px*scale,py*scale,z+pz*scale,n,[0,0,Math.PI/2]);
 // Axles, low chassis, insulated trailer, corrugated sidewalls and roof.
 B(.78,.14,2.42,"royalDark",0,.39,.05);
 B(.86,1.02,1.73,"cream",0,1.05,-.38);
 B(.88,.11,1.76,"steel",0,1.62,-.38);
 B(.80,.075,1.69,"cream",0,1.66,-.38);
 for(const side of [-.444,.444]){
  B(.020,.65,1.59,"steel",side,1.06,-.38);
  B(.040,.14,1.58,"royalLight",side,1.43,-.38);
  for(let stripe=0;stripe<3;stripe++)B(.025,.025,1.5,"steel",side,1.02+stripe*.2,-.38);
 }
 // Aerodynamic tractor cab, curved impression via layered angled fascia.
 B(.80,.79,.71,variant%2?"cream":"royal",0,.88,1.0);
 B(.84,.13,.79,"steel",0,1.34,1.0);
 B(.69,.31,.04,"glass",0,1.08,1.369);
 B(.60,.16,.045,"royalDark",0,.81,1.383);
 B(.61,.095,.05,"steel",0,.62,1.382);
 for(const side of [-.38,.38]){
  B(.11,.075,.052,"light",side,.76,1.399);
  B(.032,.24,.34,"glass",side*.96,1.10,1.03);
  B(.09,.07,.045,"royalDark",side*1.22,1.18,1.20);
  B(.035,.05,.31,"royalDark",side*1.2,1.14,1.08);
  for(const wheelZ of [-.92,.08,1.06]){
   C(.185,"rubber",side*1.18,.36,wheelZ,10);
   C(.078,"steel",side*1.20,.36,wheelZ,10);
  }
 }
 B(.46,.095,.12,"royalLight",0,1.41,-.39);
 B(.60,.055,.10,"light",0,1.67,-.38);
}
function commerce(){
 const m=create("DESSET-Logistics-Central-Hub");
 const {box,cyl,slab}=m;slab(7.6,5.25);
 // ONE dominant warehouse. No separate secondary building.
 box(7.24,3.02,4.20,"cream",0,1.61,-.44);
 box(7.44,.24,4.46,"steel",0,3.16,-.44);
 box(7.27,.11,4.35,"cream",0,3.31,-.44);
 box(7.47,.11,.12,"royalLight",0,3.22,1.79);
 // Extremely subtle roof standing seams and plant units.
 for(let i=0;i<13;i++)box(.024,.032,4.28,"steel",-3.45+i*.575,3.39,-.44);
 for(const [px,pz] of [[-2.38,-1.47],[2.36,-1.33]]){
  box(.82,.32,.71,"steel",px,3.62,pz);
  box(.70,.07,.62,"cream",px,3.81,pz);
  for(let i=0;i<4;i++)box(.035,.23,.66,"royalLight",px-.27+i*.18,3.62,pz);
 }
 // Four loading gates; depth cavities, shadowed interiors and dock levellers.
 for(const px of [-2.72,-.91,.91,2.72]){
  box(1.54,1.89,.14,"royalDark",px,1.17,1.735);
  box(1.26,1.63,.065,"steel",px,1.08,1.825);
  for(let i=0;i<10;i++)box(1.25,.018,.076,"cream",px,.37+i*.157,1.871);
  for(const side of [-.76,.76]){
   box(.12,1.97,.25,"royalLight",px+side,1.21,1.80);
   box(.10,.33,.33,"royalDark",px+side,.26,1.92);
  }
  box(1.68,.16,.41,"royal",px,2.19,1.90);
  box(1.69,.16,.80,"stone",px,.10,2.11);
  box(1.49,.023,.56,"royalDark",px,.20,2.28);
  box(.18,.10,.08,"teal",px+.64,2.35,1.91);
 }
 // Side wall ribs and loading-bay roof/structure.
 for(let z=-2.34;z<1.58;z+=.43){
  box(.035,2.76,.035,"steel",3.65,1.65,z);
  box(.035,2.76,.035,"steel",-3.65,1.65,z);
 }
 for(const px of [-3.58,3.58])for(const pz of [-2.5,1.65])
  box(.15,2.92,.16,"royalLight",px,1.57,pz);
 box(2.28,.38,.075,"royalDark",0,2.72,1.817);
 box(2.18,.29,.083,"cream",0,2.72,1.862);
 // Loading platforms, hazard-guidance and stacked goods.
 for(let i=0;i<6;i++){
  const px=-3.18+i*1.17;
  box(.58,.32,.54,i%3?"cream":"steel",px,.26,3.04);
  box(.60,.055,.59,"stone",px,.46,3.04);
  if(i%2===0)box(.45,.24,.46,"steel",px,.64,3.04);
 }
 for(let i=0;i<4;i++){
  const px=-2.82+i*1.86;
  box(.08,.015,1.28,"gold",px,.016,3.75);
 }
 // Industrial yard barrels.
 for(const pz of [-1.78,-1.20,-.61])cyl(.17,.17,.43,"royalLight",3.94,.25,pz,12);
 return m.group;
}
function courier(){
 const m=create("DESSET-Logistics-Trailer-Fleet");
 const {box}=m;
 box(6.06,.064,4.35,"asphalt",0,-.04,.12);
 // Four distinct freight trucks, no motorbike and no storefront.
 for(const [i,x,z] of [[0,-1.55,-.83],[1,.03,-.92],[2,1.61,-.74],[3,.35,1.09]]){
  buildTruck(m,x,z,i===3?.84:.94,i);
 }
 // Direction arrows and painted parking lanes.
 for(const px of [-2.33,-.86,.77,2.36])
  box(.042,.017,2.80,"steel",px,.013,.30);
 for(let i=0;i<4;i++)box(.37,.018,.09,"teal",-1.76+i*1.04,.027,2.12);
 return m.group;
}
function destination(){
 const m=create("DESSET-Logistics-Yard-Operations");
 const {box,cyl,slab}=m;
 // The third GLB is an OPEN YARD, never another warehouse or a house.
 slab(4.12,3.55);
 for(let i=0;i<7;i++){
  const px=-1.67+(i%4)*1.10,pz=-1.0+Math.floor(i/4)*1.04;
  box(.77,.07,.67,"stone",px,.10,pz);
  box(.67,.46,.55,i%3===0?"steel":"cream",px,.38,pz);
  box(.73,.04,.61,"royalLight",px,.64,pz);
 }
 // Compact fifth truck near the far-side staging area.
 buildTruck(m,1.08,.82,.60,1);
 for(const [px,pz,mat] of [[-1.9,1.25,"teal"],[-1.9,.64,"gold"]]){
  cyl(.15,.15,.42,mat,px,.22,pz,12);
  box(.29,.05,.29,"steel",px,.46,pz);
 }
 for(let i=0;i<5;i++)box(.10,.025,.66,"royalLight",-1.58+i*.59,.018,1.65);
 return m.group;
}
const models={commerce:commerce(),courier:courier(),destination:destination()};
const outputDir="assets";
const report={schema:"desset-v62-glb-authored-assets",generator:"Three.js GLTFExporter / procedural DESSET originals",
format:"GLB glTF 2.0 binary, self-hosted",models:[]};
await mkdir(outputDir,{recursive:true});
const exporter=new GLTFExporter();
for(const [name,group] of Object.entries(models)){
 // Batch all surfaces by PBR material to minimize per-frame mobile draw calls.
 group.updateMatrixWorld(true);
 const buckets=new Map();
 let sourceMeshes=0;
 group.traverse(node=>{
  if(!node.isMesh)return;
  sourceMeshes++;
  let geo=node.geometry.clone();
  geo.applyMatrix4(node.matrixWorld);
  if(geo.index)geo=geo.toNonIndexed();
  for(const key of [...Object.keys(geo.attributes)])if(!["position","normal","uv"].includes(key))geo.deleteAttribute(key);
  const mat=node.material;
  const list=buckets.get(mat.name)||[];
  list.push(geo);buckets.set(mat.name,list);
 });
 const packed=new THREE.Group();packed.name="DESSET-"+name+"-GLB-v62";
 for(const [name,geos] of buckets){
  const geo=mergeGeometries(geos,false);
  if(!geo)throw Error("Unable to merge "+name+" in "+group.name);
  const mesh=new THREE.Mesh(geo,keyMat.get(name));
  mesh.name=name;packed.add(mesh);
 }
 const glb=await exporter.parseAsync(packed,{binary:true,onlyVisible:true,maxTextureSize:512});
 const bytes=Buffer.from(glb);
 const filename=outputDir+"/v62-"+name+".glb";
 if(bytes.subarray(0,4).toString()!=="glTF")throw Error("GLB signature not present: "+filename);
 if(bytes.length>400000)throw Error("GLB too heavy: "+filename+" "+bytes.length);
 await writeFile(filename,bytes);
 report.models.push({name,path:filename,rawBytes:bytes.length,
  sha256:createHash("sha256").update(bytes).digest("hex"),
  sourceMeshes,drawMeshes:packed.children.length,
  glbVersion:bytes.readUInt32LE(4),format:"glTF2 GLB"});
 for(const geo of buckets.values())for(const item of geo)item.dispose();
}
const total=report.models.reduce((n,m)=>n+m.rawBytes,0);
if(total>800000)throw Error("Total GLB payload >800KB: "+total);
report.totalBytes=total;
await mkdir("reports/quality",{recursive:true});
await writeFile("reports/quality/v62-glb-assets.json",JSON.stringify(report,null,2)+"\n");
console.log("DESSET V6.2 3 original GLB models generated: "+report.models.map(m=>m.name+" "+m.rawBytes+"B/" +m.drawMeshes+" meshes").join("; ")+" total="+total+"B");
