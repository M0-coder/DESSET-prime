/* DESSET Prime V6.2 — three locally generated binary glTF models.
 * All maps are authored on a local canvas, without third-party texture imports.
 * Renderer fallback remains functional when loading or decoding fails.
 */
import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";

const sources=Object.freeze({
 commerce:"./assets/v62-commerce.glb",
 courier:"./assets/v62-courier.glb",
 destination:"./assets/v62-destination.glb"
});
const patternByScene={
 commerce:{royal:"metal",cream:"metal",royalDark:"ribbed",steel:"metal"},
 courier:{royal:"metal",cream:"metal",rubber:"rubber"},
 destination:{cream:"metal",steel:"metal",rubber:"rubber"}
};
function makeLocalTexture(pattern,registry){
 const canvas=document.createElement("canvas");
 canvas.width=256;canvas.height=256;
 const ctx=canvas.getContext("2d");
 if(!ctx)throw new Error("No Canvas2D to make authored textures");
 ctx.fillStyle="#eeeeee";ctx.fillRect(0,0,256,256);
 if(pattern==="stucco"){
  ctx.fillStyle="#faf5f0";ctx.fillRect(0,0,256,256);
  ctx.strokeStyle="rgba(41,34,35,.14)";ctx.lineWidth=3;
  for(let row=0;row<8;row++){
   let shift=(row%2)*32;
   ctx.beginPath();ctx.moveTo(0,row*32);ctx.lineTo(256,row*32);ctx.stroke();
   for(let col=0;col<5;col++){
    const x=(col*64+shift)%256;ctx.beginPath();
    ctx.moveTo(x,row*32);ctx.lineTo(x,(row+1)*32);ctx.stroke();
   }
  }
 }else if(pattern==="woven"){
  ctx.fillStyle="#f7f3e5";ctx.fillRect(0,0,256,256);
  for(let y=0;y<256;y+=6){
   for(let x=0;x<256;x+=6){
    ctx.fillStyle=(x+y)%12===0?"rgba(65,54,40,.10)":"rgba(255,255,255,.18)";
    ctx.fillRect(x,y,3,3);
   }
  }
 }else if(pattern==="metal"){
  const grd=ctx.createLinearGradient(0,0,256,256);
  grd.addColorStop(0,"#ffffff");grd.addColorStop(.6,"#e4ecff");grd.addColorStop(1,"#f7fbff");
  ctx.fillStyle=grd;ctx.fillRect(0,0,256,256);
  ctx.lineWidth=1;ctx.strokeStyle="rgba(15,34,88,.10)";
  for(let x=0;x<256;x+=17){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+4,256);ctx.stroke()}
 }else if(pattern==="tile"){
  ctx.fillStyle="#f7eee0";ctx.fillRect(0,0,256,256);
  ctx.strokeStyle="rgba(112,70,37,.19)";ctx.lineWidth=3;
  for(let y=0;y<256;y+=30){
   ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();
   for(let x=0;x<256;x+=64){
    ctx.beginPath();ctx.moveTo(x+(y/30%2)*32,y);ctx.lineTo(x+(y/30%2)*32,y+30);ctx.stroke();
   }
  }
 }else if(pattern==="ribbed"){
  ctx.fillStyle="#eaf1ff";ctx.fillRect(0,0,256,256);
  for(let x=0;x<256;x+=16){
   ctx.fillStyle=x%32===0?"rgba(26,46,88,.17)":"rgba(255,255,255,.55)";
   ctx.fillRect(x,0,4,256);
  }
 }else{
  ctx.fillStyle="#e1e5ea";ctx.fillRect(0,0,256,256);
  for(let x=10;x<256;x+=22)for(let y=10;y<256;y+=22){
   ctx.fillStyle="rgba(20,31,48,.23)";ctx.beginPath();
   ctx.arc(x,y,3,0,2*Math.PI);ctx.fill();
  }
 }
 const map=new THREE.CanvasTexture(canvas);
 map.colorSpace=THREE.SRGBColorSpace;
 map.wrapS=THREE.RepeatWrapping;
 map.wrapT=THREE.RepeatWrapping;
 map.anisotropy=2;
 registry.push(map);
 return map;
}
function disposeLoaded(gltf){
 gltf.scene.traverse(node=>{
  if(!node.isMesh)return;
  node.geometry?.dispose();
  if(Array.isArray(node.material))for(const m of node.material)m.dispose();
  else node.material?.dispose();
 });
}
export async function hydrateGLBModels({scene,coarse,stage,sign,ownedTextures,isLive}){
 stage.dataset.v62ModelsStatus="loading";
 const loader=new GLTFLoader();
 // Avoid decompressors, Draco/KTX remote plugins, and textures in the imported GLBs.
 const rows=Object.entries(sources);
 let loaded;
 try{
  const tasks=rows.map(async([name,url])=>{
   const gltf=await loader.loadAsync(url);
   let meshes=0,triangles=0;
   gltf.scene.traverse(node=>{
    if(!node.isMesh)return;
    meshes++;
    const geo=node.geometry;
    triangles+=(geo.index?geo.index.count:geo.attributes.position.count)/3;
   });
   if(meshes<5||meshes>40||triangles<250||triangles>45000){
    disposeLoaded(gltf);
    throw new Error("GLB model outside budget: "+name+" "+meshes+" meshes "+triangles+" triangles");
   }
   return {name,url,gltf,meshes,triangles};
  });
  // Three independent assets must either succeed together or leave the
  // working procedural 3D visible; never partially replace scene meshes.
  const pending=Promise.allSettled(tasks);
  const timeoutToken=Symbol("glb-timeout");
  let deadline;
  const outcomes=await Promise.race([
   pending,
   new Promise(resolve=>{deadline=setTimeout(()=>resolve(timeoutToken),10000)})
  ]);
  clearTimeout(deadline);
  if(outcomes===timeoutToken){
   // Late responses must be disposed, never inserted after fallback starts.
   void pending.then(results=>{
    for(const item of results)if(item.status==="fulfilled")disposeLoaded(item.value.gltf);
   });
   throw new Error("GLB loading timed out after 10s");
  }
  const failures=outcomes.filter(item=>item.status==="rejected");
  if(failures.length){
   for(const item of outcomes)if(item.status==="fulfilled")disposeLoaded(item.value.gltf);
   throw new Error("GLB batch failed: "+failures.map(item=>String(item.reason).slice(0,100)).join("; "));
  }
  loaded=outcomes.map(item=>item.value);
 }catch(error){
  stage.dataset.v62ModelsStatus="fallback";
  stage.dataset.v62ModelsError="asset-loading";
  // This is not a public error disclosure; procedural 3D stays visible and interactive.
  console.warn("DESSET GLB model fallback:",String(error).slice(0,200));
  return {ready:false,models:[]};
 }
 if(!isLive()){
  for(const row of loaded)disposeLoaded(row.gltf);
  return {ready:false,models:[]};
 }
 const sceneParents=new Map(loaded.map(row=>[row.name,scene.getObjectByName(row.name)]));
 if([...sceneParents.values()].some(parent=>!parent)){
  for(const row of loaded)disposeLoaded(row.gltf);
  stage.dataset.v62ModelsStatus="fallback";
  return {ready:false,models:[]};
 }
 const details=[];
 for(const row of loaded){
  const parent=sceneParents.get(row.name);
  const maps=new Map();
  const patternNames=patternByScene[row.name];
  row.gltf.scene.traverse(node=>{
   if(!node.isMesh)return;
   node.castShadow=!coarse;node.receiveShadow=!coarse;
   const materialName=node.material?.name||"";
   if(patternNames[materialName]){
    const pattern=patternNames[materialName];
    if(!maps.has(pattern))maps.set(pattern,makeLocalTexture(pattern,ownedTextures));
    node.material=node.material.clone();
    node.material.map=maps.get(pattern);
    node.material.needsUpdate=true;
   }
  });
  // Keep scene positions unchanged while replacing procedural warehouse placeholders
  // models with the authored, geometrically detailed glTF roots.
  parent.traverse(node=>{if(node.isMesh)node.geometry?.dispose()});
  parent.clear();
  parent.add(row.gltf.scene);
  if(row.name==="commerce"){
   sign(parent,"DESSET Prime",0,2.72,1.91,3.00,.29);
   sign(parent,"MUELLES",0,2.38,1.91,1.11,.18);
  }
  if(row.name==="destination")sign(parent,"PATIO",0,1.22,1.69,.86,.22);
  if(row.name==="courier")sign(parent,"DESSET",0,1.84,.77,.90,.21);
  details.push({name:row.name,meshes:row.meshes,triangles:Math.round(row.triangles),
   path:row.url,texturedMaterials:maps.size});
 }
 stage.dataset.v62ModelsStatus="ready";
 return {ready:true,models:details};
}
