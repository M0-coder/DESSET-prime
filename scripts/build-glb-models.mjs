/* LOGISTICS-3D-01 — new warehouse/fleet/loading-bays authored as deterministic GLB geometry.
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
 royal:0x1551d8,royalLight:0x4878ef,royalDark:0x112f71,sky:0x86c2ff,
 gold:0xffc62f,goldDark:0xa96812,cream:0xf6f9ff,red:0xff3328,
 redDark:0x871f26,rubber:0x131928,steel:0xb4cce7,glass:0x8ddcff,
 asphalt:0xdfe9f6,teal:0x24a9a1,stone:0xc4d5e9,wood:0x805c47,
 brick:0xb83d35,leaf:0x447c5a,light:0xffe6a5
};
const keyMat=new Map();
const material=(name,color,metal=0.12,rough=.55)=>{
 const key=name;
 if(!keyMat.has(key)){
  const m=new THREE.MeshStandardMaterial({name,color,metalness:metal,roughness:rough,
   emissive:name==="glass"?0x144577:name==="light"?0xffb624:0x000000,
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
function commerce(){
 const m=create("DESSET-Logistics-Warehouse");
 const {box,slab}=m;slab(5.85,4.55);
 // Low-poly industrial distribution hub, double-wall and stepped roof.
 box(5.58,2.62,3.48,"cream",0,1.40,-.24);
 box(5.76,.24,3.83,"steel",0,2.82,-.24);
 box(5.62,.115,3.72,"royalLight",0,2.96,-.24);
 for(let i=0;i<9;i++)box(.028,.025,3.70,"cream",-2.50+i*.625,3.03,-.24);
 for(const z of [-1.92,1.39])for(const px of [-2.70,2.70]){
   box(.15,2.52,.14,"royalLight",px,1.37,z);
 }
 // Loading shutters: three dock openings, lintels and blue frames.
 for(const px of [-1.87,0,1.87]){
  box(1.53,1.68,.07,"royalDark",px,1.06,1.529);
  box(1.27,1.35,.08,"steel",px,.96,1.580);
  for(let y=.42;y<1.51;y+=.16)box(1.27,.018,.09,"cream",px,y,1.628);
  box(1.56,.15,.22,"royal",px,1.91,1.592);
  for(const side of [-.74,.74])box(.065,1.70,.12,"royal",px+side,1.10,1.594);
  box(1.51,.14,.62,"stone",px,.14,1.83);
 }
 for(let z=-1.65;z<1.40;z+=.42)box(.04,1.96,.035,"steel",2.84,1.20,z);
 box(1.61,.34,.08,"royalDark",0,2.28,1.552);
 box(1.48,.26,.09,"cream",0,2.28,1.609);
 // Loading signage, roof HVAC, parcel stacks.
 for(const [px,pz] of [[-2.28,-.95],[2.15,-1.10]]){
  box(.82,.32,.70,"steel",px,3.20,pz);
  for(let i=0;i<4;i++)box(.027,.20,.62,"royalLight",px-.28+i*.18,3.25,pz);
 }
 for(let i=0;i<5;i++){
  const px=-2.30+i*.76;
  box(.47,.37,.42,i%2?"steel":"wood",px,.24,2.45);
  box(.48,.04,.43,"cream",px,.46,2.45);
 }
 return m.group;
}
function courier(){
 const m=create("DESSET-Logistics-Fleet");
 const {box,cyl,slab}=m;slab(3.96,3.10);
 // Two miniature tractor-trailer trucks replace the former motorbike.
 for(let n=0;n<2;n++){
  const ox=n===0?-1.04:1.08,z=n===0?-.42:.55;
  box(.92,.88,1.70,"cream",ox,1.00,z);
  box(.95,.095,1.72,"steel",ox,1.49,z);
  for(const side of [-.48,.48])box(.025,.70,1.66,"royalLight",ox+side,1.03,z);
  box(.77,.69,.68,"royal",ox,.90,z+1.07);
  box(.65,.32,.035,"glass",ox,1.05,z+1.428);
  box(.78,.09,.07,"steel",ox,.61,z+1.432);
  for(const side of [-.37,.37]){
   box(.13,.09,.055,"light",ox+side,.74,z+1.46);
   for(const zWheel of [z-.57,z+.65,z+1.06]){
    cyl(.19,.19,.16,"rubber",ox+side*1.38,.41,zWheel,12,[0,0,Math.PI/2]);
    cyl(.085,.085,.17,"steel",ox+side*1.38,.41,zWheel,12,[0,0,Math.PI/2]);
   }
  }
  box(.44,.07,.14,"gold",ox,1.40,z+.12);
 }
 box(3.20,.05,.06,"teal",0,.045,1.46);
 for(let i=0;i<4;i++)box(.40,.035,.07,"cream",-1.25+i*.83,.048,1.57);
 return m.group;
}
function destination(){
 const m=create("DESSET-Loading-Docks");
 const {box,cyl,slab}=m;slab(3.85,3.26);
 // Industrial annex, loading ramps, loading status markers and pallets.
 box(3.38,2.35,2.50,"cream",0,1.20,-.29);
 box(3.66,.22,2.78,"steel",0,2.51,-.29);
 box(3.58,.07,2.70,"royalLight",0,2.65,-.29);
 for(const px of [-1.08,1.08]){
   box(1.26,1.52,.05,"royalDark",px,.92,1.01);
   box(1.08,1.28,.075,"steel",px,.85,1.053);
   for(let j=0;j<7;j++)box(1.07,.022,.08,"cream",px,.38+j*.16,1.103);
   box(.10,1.54,.14,"royal",px-.65,.93,1.09);
   box(.10,1.54,.14,"royal",px+.65,.93,1.09);
   box(1.42,.15,.63,"stone",px,.13,1.34);
   box(.10,.12,.09,"teal",px,1.86,1.12);
 }
 for(let i=0;i<4;i++){
  const px=-1.2+i*.80;
  box(.54,.47,.52,"wood",px,.25,2.01);
  box(.56,.055,.56,"cream",px,.51,2.01);
 }
 for(const px of [-1.56,1.56])for(let j=0;j<4;j++)box(.055,.14,2.38,"royalLight",px,.50+j*.50,-.31);
 cyl(.12,.12,.44,"teal",-1.50,.23,1.73,14);
 cyl(.12,.12,.44,"gold",1.50,.23,1.73,14);
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
