/* V6.2 — original deterministic geometry baked to standalone glTF 2.0 GLB files.
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
 gold:0xffc62f,goldDark:0xa96812,cream:0xfff3d8,red:0xff3328,
 redDark:0x871f26,rubber:0x131928,steel:0xb4cce7,glass:0x8ddcff,
 asphalt:0x17233d,teal:0x24a9a1,stone:0xb2becb,wood:0x805c47,
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
 const slab=(w,d)=>{box(w,.2,d,"royalDark",0,-.16,0);box(w-.23,.035,d-.23,"asphalt",0,-.04,0)};
 return {group,box,cyl,ball,torus,slab};
};
function commerce(){
 const m=create("DESSET-Commerce");
 const {box,cyl,ball,slab}=m;
 slab(4.12,3.14);
 box(3,2.25,2.08,"royal",0,1.16,-.29);
 box(3.27,.21,2.34,"royalLight",0,2.37,-.29);
 box(3.2,.09,.07,"steel",0,2.45,1.01);
 // Horizontal architectural wall ribs
 for(let y=.40;y<2.18;y+=.36){
  box(3.10,.025,.02,"royalDark",0,y,-1.338);
  box(.027,.36,2.02,"royalDark",1.515,y,-.29);
 }
 // Vestibule, glazing, etched frame and interior shelving
 box(2.62,1.46,.055,"royalDark",0,1.02,.777);
 for(const x of [-.95,.95]){
  box(.71,1.10,.03,"glass",x,1.08,.817);
  box(.045,1.18,.05,"steel",x+.36,1.08,.848);
  box(.65,.025,.07,"steel",x,1.37,.847);
 }
 box(.75,1.54,.07,"rubber",0,.84,.836);
 box(.08,.22,.09,"gold",.29,.86,.889);
 for(let x=-1.34;x<1.36;x+=.53){
  box(.37,.065,.12,"goldDark",x,.47,.84);
 }
 // Warm premium canopy with alternating fabric stripes and valance
 box(3.35,.21,1.30,"gold",0,1.89,1.13);
 for(let i=0;i<10;i++){
  const x=-1.52+i*.338;
  box(.19,.045,1.23,i%2?"cream":"red",x,1.79,1.15);
  box(.21,.23,.035,i%2?"cream":"red",x,1.69,1.77);
 }
 for(const x of [-1.44,1.44]){
  cyl(.035,.035,1.16,"steel",x,1.21,1.70,10);
  box(.16,.035,.11,"steel",x,.61,1.71);
 }
 // Shop name sign holder: actual readable label is applied in the browser.
 box(1.63,.40,.07,"royalDark",0,2.11,.90);
 box(1.52,.33,.02,"cream",0,2.11,.952);
 // A/C, ceiling detail, parcels and decorative awning pipes
 box(.62,.49,.30,"steel",.85,2.04,-1.48);
 for(let i=0;i<5;i++)box(.082,.26,.012,"royalDark",.63+i*.10,2.05,-1.644);
 for(const x of [-1.25,1.25]){
  box(.34,.40,.34,"gold",x,.21,1.40);
  box(.36,.06,.07,"cream",x,.30,1.586);
 }
 // Café shelves visible from glazed shop front
 for(let y=.58;y<=1.34;y+=.36){
  box(.63,.08,.19,"wood",-1.06,y,.63);
  for(let i=0;i<3;i++)cyl(.07,.06,.18,i===0?"red":"teal",-1.23+i*.15,y+.12,.63,10);
 }
 // Pavement tiles and a tiny ornamental planter
 for(let x=-1.7;x<=1.7;x+=.51)box(.028,.02,.65,"stone",x,-.02,1.21);
 cyl(.24,.20,.40,"cream",1.68,.19,-.78,12);
 for(let j=0;j<6;j++)ball(.14,"leaf",1.68+Math.sin(j)*.18,.50+j*.03,-.78+Math.cos(j)*.18);
 return m.group;
}
function courier(){
 const m=create("DESSET-Courier");
 const {box,cyl,ball,torus,slab}=m;
 slab(3.9,2.73);
 // Wheels with rims, spokes, forks and suspension
 for(const x of [-.93,.94]){
  torus(.39,.105,"rubber",x,.52,.42);
  cyl(.225,.225,.032,"steel",x,.52,.42,16,[Math.PI/2,0,0]);
  for(let n=0;n<8;n++){
   const theta=2*Math.PI*n/8;
   box(.30,.025,.04,"royalDark",x+Math.cos(theta)*.13,.52+Math.sin(theta)*.13,.463,[0,0,theta]);
  }
  box(.05,.57,.05,"steel",x,.68,.48);
 }
 box(1.87,.15,.52,"red",0,.75,.36);
 box(.95,.49,.67,"royal",-.02,1.04,.21);
 box(.77,.24,.48,"royalLight",-.24,1.29,.12);
 box(.36,.12,.69,"rubber",-.17,1.37,.06);
 box(.23,.38,.27,"steel",-.99,.85,.20);
 box(.33,.18,.32,"gold",-.97,1.07,.18);
 ball(.15,"light",-1.25,.91,.51,14);
 box(.37,.13,.05,"steel",-1.18,1.10,.45);
 // Handlebar, rear rack and plate
 cyl(.035,.035,.9,"steel",-.50,1.47,.08,8,[0,0,-.45]);
 box(.78,.055,.05,"steel",-.58,1.81,.10);
 box(.48,.07,.43,"steel",1.03,1.12,-.08);
 // Rider torso jacket with color blocks, gloves, boots and legs
 box(.61,.69,.42,"royal",-.19,1.65,-.17);
 box(.19,.60,.45,"gold",-.15,1.63,.08);
 box(.38,.20,.45,"royalDark",-.16,1.41,-.11);
 for(const x of [-.44,.10]){
  box(.19,.52,.23,"cream",x,1.13,-.10);
  box(.26,.14,.35,"rubber",x,.85,.02);
 }
 box(.20,.53,.20,"royal",-.58,1.58,.04,[0,0,-.23]);
 ball(.17,"cream",-.64,1.32,.07,10);
 cyl(.16,.14,.43,"cream",-.17,2.13,-.12,12);
 ball(.41,"gold",-.17,2.57,-.12,20);
 box(.46,.15,.07,"rubber",-.06,2.59,.275);
 box(.32,.06,.06,"steel",-.19,2.80,.10);
 // Insulated delivery trunk / panel
 box(1.09,.92,.92,"gold",.86,1.61,-.31);
 box(1.17,.095,.98,"red",.86,2.12,-.31);
 for(const x of [.35,1.35]){
  box(.065,.72,.045,"cream",x,1.61,.174);
 }
 box(.60,.45,.022,"royal",.84,1.61,.178);
 box(.26,.26,.031,"cream",.84,1.61,.198);
 // Safety reflectors and tail lamps
 box(.15,.10,.08,"red",1.48,1.00,.45);
 ball(.075,"light",-1.19,1.01,.58);
 for(let i=0;i<3;i++)cyl(.085,.085,.16,"steel",.48+i*.18,.62,-.32,12);
 return m.group;
}
function destination(){
 const m=create("DESSET-Destination");
 const {box,cyl,ball,slab}=m;
 slab(3.76,3.28);
 box(2.80,2.16,2.22,"red",0,1.11,0);
 // Articulated pitched roof, ridge cap, tiles, gutter
 const roof=new THREE.Mesh(new THREE.ConeGeometry(2.20,1.35,4),material("cream",P.cream));
 roof.position.set(0,2.82,0);roof.rotation.y=Math.PI/4;m.group.add(roof);
 box(2.95,.13,.12,"redDark",0,2.19,1.12);
 for(let j=0;j<5;j++){
  const z=-1.01+j*.50;
  box(.075,.045,1.03,"goldDark",-1.18,2.37+j*.03,z,[0,0,.24]);
  box(.075,.045,1.03,"goldDark",1.18,2.37+j*.03,z,[0,0,-.24]);
 }
 // Main door, relief frame, handle, archway and threshold
 box(.93,1.64,.08,"royalDark",.33,.85,1.16);
 box(1.01,.10,.12,"steel",.33,1.67,1.20);
 box(.09,1.60,.09,"steel",-.18,.84,1.20);
 box(.09,1.60,.09,"steel",.84,.84,1.20);
 ball(.055,"gold",.71,.82,1.24);
 box(1.27,.13,.43,"cream",.33,.08,1.36);
 // Windows multi pane
 for(const [x,y,z] of [[-0.84,1.33,1.18],[.88,1.42,-1.15]]){
  box(.69,.73,.06,"glass",x,y,z);
  box(.08,.77,.11,"cream",x,y,z+.04);
  box(.74,.075,.11,"cream",x,y,z+.04);
  box(.81,.12,.30,"stone",x,y-.40,z+.14);
 }
 // Stucco details / corner facing
 for(const x of [-1.39,1.39])for(let y=.38;y<=1.92;y+=.39){
  box(.14,.08,2.24,"cream",x,y,0);
 }
 // Porch lamp, house sign and delivery planter
 box(.37,.42,.22,"royalDark",-.54,1.71,1.22);
 ball(.12,"light",-.54,1.71,1.36,12);
 box(1.47,.29,.085,"royalDark",0,2.21,1.16);
 box(1.35,.24,.035,"cream",0,2.21,1.205);
 box(.71,.53,.54,"gold",1.39,.26,1.06);
 box(.75,.05,.60,"cream",1.39,.55,1.06);
 cyl(.16,.20,.41,"stone",-1.62,.15,.94,12);
 for(let i=0;i<5;i++)ball(.14,"leaf",-1.62+Math.sin(i)*.12,.42+i*.045,.94+Math.cos(i)*.14);
 for(let i=0;i<4;i++){
  box(.05,.38,.05,"steel",-1.7+i*.27,.11,-1.31);
 }
 box(1.15,.07,.08,"steel",-1.29,.33,-1.32);
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
