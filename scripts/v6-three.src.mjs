/* DESSET PRIME V6 — actual Three.js / WebGL2, no static-image masquerade.
 * All geometry is procedural, no external textures, fetch, tracking or WebGPU.
 * Image-free text remains readable when GPU rendering is unavailable. */
import * as THREE from "three";
import {hydrateGLBModels} from "./v62-glb-loader.src.mjs";
import {STORY_BEATS,STORY_DURATION,storyAtTime,routeProgress} from "./v63-storyboard.mjs";

const stage=document.querySelector(".v5-city-stage");
const mount=stage?.querySelector(".v6-three-mount");
const controls=stage?.querySelector(".v6-three-controls");
const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true;
const coarse=window.matchMedia?.("(max-width: 800px)")?.matches===true;
// Geometry layout follows the CSS aspect-ratio breakpoint (430px), not the GPU quality breakpoint.
const vertical=window.matchMedia?.("(max-width: 430px)")?.matches===true;
if(!stage||!mount||!controls||reduced){
 if(stage)stage.dataset.v6State=reduced?"reduced":"missing";
}else{
 let renderer,scene,camera,ro,observer,raf=0,alive=false,onscreen=true,paused=false;
 let cameraPreset="overview",frame=0,particle,parcel,routeHalo;
 let modelStats={ready:false,models:[]};
 let storyActive=false,storyElapsed=0,storyBeat=-1;
 const storyPanel=stage.querySelector(".v63-story");
 const storyTitle=stage.querySelector(".v63-story-title");
 const storyDetail=stage.querySelector(".v63-story-detail");
 const storyProgress=stage.querySelector(".v63-story-progress");
 const storyButton=controls.querySelector(".v63-tour");
 let pointer={x:0,y:0},last=0,lastRender=0;
 let onMove,onLeave,onResize,onVisibility,onControls;
 const ownedTextures=[];
 const PAL={blue:0x1551d8,gold:0xffc62f,red:0xff3328,night:0xe8f0fa};
 const makeMat=(color,metalness=0.2,roughness=0.48,emissive=0x000000,intensity=0)=>
   new THREE.MeshStandardMaterial({color,metalness,roughness,emissive,emissiveIntensity:intensity});
 const mats={
  blue:makeMat(PAL.blue,.21,.29),cyan:makeMat(0x5f94ff,.26,.32),
  gold:makeMat(PAL.gold,.22,.36,0xe39505,.13),
  red:makeMat(PAL.red,.24,.38),dark:makeMat(0x172443,.28,.60),
  side:makeMat(0x9bbce0,.18,.65),cream:makeMat(0xf7fbff,.08,.61),
  glass:makeMat(0x73d7f7,.40,.13,0x1c68bb,.47),
  route:makeMat(PAL.gold,.12,.30,0xffb725,1.4),
  road:makeMat(0xdce8f7,.08,.86),
  trim:makeMat(0x1a3e83,.55,.28),
  chrome:makeMat(0xc7d8ec,.35,.48),
  windowLight:makeMat(0x82d7f3,.10,.20,0x4b9de8,.70),
  headlight:makeMat(0xfef4cb,.14,.25,0xffc62f,1.6)
 };
 const box=(parent,w,h,d,x,y,z,material)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  mesh.position.set(x,y,z);mesh.castShadow=!coarse;mesh.receiveShadow=!coarse;
  parent.add(mesh);return mesh;
 };
 const sphere=(parent,r,x,y,z,material,detail=12)=>{
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,detail,8),material);
  mesh.position.set(x,y,z);parent.add(mesh);return mesh;
 };
 const cylinder=(parent,radius,height,x,y,z,material,segments=16)=>{
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,segments),material);
  mesh.position.set(x,y,z);parent.add(mesh);return mesh;
 };
 // Procedural typographic signage is painted directly on 3D materials, not HTML.
 const sign=(parent,label,x,y,z,width=1.3,height=.33)=>{
  const canvas=document.createElement("canvas");
  canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext("2d");if(!ctx)return;
  ctx.clearRect(0,0,512,128);ctx.fillStyle="#FFF8E4";
  ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.font="900 62px system-ui,Arial,sans-serif";ctx.fillText(label,256,67,490);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=2;
  ownedTextures.push(texture);
  const surface=new THREE.Mesh(new THREE.PlaneGeometry(width,height),
   new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
  surface.position.set(x,y,z);parent.add(surface);return surface;
 };
 // Additive GPU sprites create a restrained cinematic glow without a post-processing pass.
 let glowTexture;
 const glow=(parent,x,y,z,color,scale,opacity=.34)=>{
  if(!glowTexture){
   const canvas=document.createElement("canvas");canvas.width=128;canvas.height=128;
   const ctx=canvas.getContext("2d");
   if(!ctx)return;
   const gradient=ctx.createRadialGradient(64,64,2,64,64,63);
   gradient.addColorStop(0,"rgba(255,255,255,.93)");
   gradient.addColorStop(.19,"rgba(255,255,255,.55)");
   gradient.addColorStop(.50,"rgba(255,255,255,.13)");
   gradient.addColorStop(1,"rgba(255,255,255,0)");
   ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
   glowTexture=new THREE.CanvasTexture(canvas);
   glowTexture.colorSpace=THREE.SRGBColorSpace;
   ownedTextures.push(glowTexture);
  }
  const material=new THREE.SpriteMaterial({
   map:glowTexture,color,transparent:true,opacity,
   blending:THREE.AdditiveBlending,depthWrite:false
  });
  const sprite=new THREE.Sprite(material);
  sprite.position.set(x,y,z);sprite.scale.set(scale,scale,1);
  parent.add(sprite);return sprite;
 };
 const plinth=(parent,w,d)=>{
  const shade=new THREE.Mesh(new THREE.CircleGeometry(1,24),
   new THREE.MeshBasicMaterial({color:0x03060e,transparent:true,opacity:.30,depthWrite:false}));
  shade.rotation.x=-Math.PI/2;shade.position.y=-.279;shade.scale.set(w*.57,d*.58,1);
  parent.add(shade);
  box(parent,w,.23,d,0,-.12,0,mats.side);
  box(parent,w*.86,.04,d*.85,0,.025,0,mats.road);
 };
 // LOGISTICS-3D-01: new provisional meshes for the same warehouse GLB loading slots.
 // Former storefront, motorcycle and red house are fully replaced.
 function storefront(){
  const g=new THREE.Group();g.name="commerce";g.position.set(vertical?-.7:-5,0,vertical?-4.7:0);scene.add(g);
  plinth(g,5.85,4.55);
  box(g,5.54,2.64,3.48,0,1.40,-.25,mats.cream);
  box(g,5.72,.25,3.83,0,2.83,-.25,mats.chrome);
  for(let i=0;i<9;i++)box(g,.03,.035,3.72,-2.5+i*.625,3.02,-.25,mats.cyan);
  for(const px of [-1.87,0,1.87]){
   box(g,1.53,1.68,.09,px,1.05,1.53,mats.dark);
   box(g,1.27,1.35,.1,px,.96,1.59,mats.chrome);
   for(let y=.42;y<1.51;y+=.16)box(g,1.27,.018,.11,px,y,1.65,mats.cream);
   box(g,1.56,.15,.20,px,1.91,1.61,mats.blue);
   box(g,1.52,.15,.63,px,.13,1.83,mats.side);
  }
  sign(g,"DESSET",0,2.28,1.61,1.12,.23);
  for(const px of [-2.15,2.15])box(g,.75,.30,.65,px,3.17,-1.00,mats.chrome);
  return g;
 }
 function courier(){
  const g=new THREE.Group();g.name="courier";g.position.set(vertical?0:.98,.13,vertical?0:1.18);scene.add(g);
  plinth(g,3.95,3.10);
  for(let n=0;n<2;n++){
   const ox=n===0?-1.04:1.08,z=n===0?-.42:.55;
   box(g,.92,.88,1.70,ox,1.0,z,mats.cream);
   box(g,.94,.09,1.72,ox,1.49,z,mats.chrome);
   box(g,.77,.69,.68,ox,.90,z+1.07,mats.blue);
   box(g,.65,.32,.04,ox,1.05,z+1.43,mats.glass);
   box(g,.78,.09,.11,ox,.61,z+1.43,mats.chrome);
   for(const side of [-.49,.49])for(const wz of [z-.60,z+.63,z+1.04]){
    const tire=new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,.16,12),mats.dark);
    tire.rotation.z=Math.PI/2;tire.position.set(ox+side,.41,wz);g.add(tire);
   }
   for(const side of [-.36,.36])box(g,.13,.1,.06,ox+side,.76,z+1.46,mats.headlight);
  }
  return g;
 }
 function destination(){
  const g=new THREE.Group();g.name="destination";g.position.set(vertical?.7:5.03,0,vertical?4.7:-.35);scene.add(g);
  plinth(g,3.85,3.26);
  box(g,3.38,2.35,2.5,0,1.2,-.29,mats.cream);
  box(g,3.66,.22,2.78,0,2.51,-.29,mats.chrome);
  for(const px of [-1.08,1.08]){
   box(g,1.27,1.52,.07,px,.92,1.03,mats.dark);
   box(g,1.08,1.28,.08,px,.85,1.09,mats.chrome);
   for(let j=0;j<7;j++)box(g,1.07,.02,.10,px,.38+j*.16,1.13,mats.cream);
   box(g,1.42,.14,.62,px,.13,1.34,mats.side);
  }
  for(let i=0;i<4;i++)box(g,.55,.47,.55,-1.2+i*.8,.24,2.04,i%2?mats.chrome:mats.cream);
  sign(g,"MUELLES",0,2.22,1.02,1.1,.17);
  return g;
 }
 function decorate(){
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(22,14),mats.road);
  ground.rotation.x=-Math.PI/2;ground.position.y=-.32;scene.add(ground);
  const grid=new THREE.GridHelper(20,20,0x8aace0,0xa7c4e9);
  grid.position.y=-.297;grid.material.transparent=true;grid.material.opacity=.35;scene.add(grid);
  for(const [x,z,color] of [[-5,-2,0x1551d8],[0,-2.7,0xffc62f],[5,-2,0xff3328]]){
   const disc=new THREE.Mesh(new THREE.CircleGeometry(2.2,34),
    new THREE.MeshBasicMaterial({color,transparent:true,opacity:.15,depthWrite:false}));
   disc.rotation.x=-Math.PI/2;disc.position.set(x,-.288,z);scene.add(disc);
  }
  for(const [x,z] of [[-8,2],[-2.7,3],[3.3,3],[8,2]]){
   cylinder(scene,.055,1.55,x,.70,z,mats.side);
   sphere(scene,.13,x,1.52,z,mats.gold);
  }
  const path=vertical?[
   new THREE.Vector3(-.5,.18,-2.9),new THREE.Vector3(-1.15,.21,-1.6),
   new THREE.Vector3(-.8,.22,-.7),new THREE.Vector3(.45,.23,.8),
   new THREE.Vector3(1.15,.20,2.05),new THREE.Vector3(.6,.20,3.20)
  ]:[
   new THREE.Vector3(-3.15,.18,1.22),new THREE.Vector3(-1.65,.20,2.35),
   new THREE.Vector3(.10,.21,2.30),new THREE.Vector3(1.90,.23,2.26),
   new THREE.Vector3(3.05,.22,1.45),new THREE.Vector3(3.7,.20,.65)
  ];
  const curve=new THREE.CatmullRomCurve3(path);
  routeHalo=new THREE.Mesh(new THREE.TubeGeometry(curve,76,.15,7,false),
    new THREE.MeshBasicMaterial({color:0xffb725,transparent:true,opacity:.13,depthWrite:false}));
  scene.add(routeHalo);
  const lightLine=new THREE.Mesh(new THREE.TubeGeometry(curve,76,.045,7,false),mats.route);
  scene.add(lightLine);
  particle=sphere(scene,.18,0,0,0,mats.gold);
  particle.userData.curve=curve;
  parcel=new THREE.Group();
  parcel.userData.curve=curve;
  box(parcel,.82,.64,.71,0,0,0,mats.gold);
  box(parcel,.10,.66,.73,0,.005,0,mats.cream);
  box(parcel,.85,.07,.12,0,.34,0,mats.cream);
  parcel.position.set(vertical?-1.2:-2.25,1.35,vertical?-2.35:-.58);scene.add(parcel);
  glow(scene,vertical?-.7:-5,2.8,vertical?-4.7:0,0x4a8cff,2.8,.28);
  glow(scene,vertical?.7:5.03,2.6,vertical?4.7:-.35,0xff6852,2.4,.23);
  glow(scene,vertical?0:.98,2.1,vertical?0:1.18,0xffc62f,1.7,.25);
  glow(particle,0,0,0,0xffc62f,1.5,.55);
  // Soft pools of light offer depth without a costly post-processing pass.
  const pools=vertical?[[-.7,-4.7,2.25],[0,0,2.05],[.7,4.7,2.0]]:[[-5,0,2.25],[.98,1.18,2.05],[5.03,-.35,2.0]];
  for(const [x,z,r] of pools){
    const halo=new THREE.Mesh(new THREE.CircleGeometry(r,32),
      new THREE.MeshBasicMaterial({color:0x2e68c7,transparent:true,opacity:.07,depthWrite:false}));
    halo.rotation.x=-Math.PI/2;halo.position.set(x,-.283,z);scene.add(halo);
  }
 }
 function setup(){
  scene=new THREE.Scene();
  scene.background=new THREE.Color(PAL.night);
  scene.fog=new THREE.FogExp2(PAL.night,.010);
  scene.add(new THREE.HemisphereLight(0xffffff,0x6b90c5,2.15));
  const sun=new THREE.DirectionalLight(0xf5faff,3.25);
  sun.position.set(-3,11,7);sun.castShadow=!coarse;
  sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-13,right:13,top:11,bottom:-11,near:.5,far:40});
  sun.shadow.bias=-.0007;sun.shadow.normalBias=.025;
  sun.shadow.camera.updateProjectionMatrix();scene.add(sun);
  const fill=new THREE.PointLight(0xb5d4ff,12,17);
  fill.position.set(0,5.2,4.2);scene.add(fill);
  const rim=new THREE.PointLight(0x4c80ff,8.5,15);
  rim.position.set(5.5,4,-4);scene.add(rim);
  const neon=new THREE.PointLight(0x62a5ff,4,9);
  neon.position.set(5,3,1);scene.add(neon);
  storefront();courier();destination();decorate();
  const key=new THREE.OrthographicCamera(-9,9,5,-5,.1,150);
  camera=key;
  renderer=new THREE.WebGLRenderer({antialias:!coarse,alpha:false,powerPreference:"low-power",preserveDrawingBuffer:false});
  renderer.setClearColor(PAL.night,1);
  renderer.shadowMap.enabled=!coarse;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.12;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,coarse?1:1.4));
  const canvas=renderer.domElement;
  canvas.setAttribute("aria-hidden","true");canvas.tabIndex=-1;
  canvas.className="v6-three-canvas";mount.appendChild(canvas);
  canvas.addEventListener("webglcontextlost",e=>{e.preventDefault();fail("context-lost")});
  const width=Math.max(1,mount.clientWidth),height=Math.max(1,mount.clientHeight);
  resize(width,height);
  return renderer.info;
 }
 const presets=vertical?{
  overview:{pos:[3.5,14.8,15.2],look:[0,1,0]},
  commerce:{pos:[3.2,10.8,7.0],look:[-.7,1.1,-4.7]},
  courier:{pos:[3.4,9.3,9.7],look:[0,1.1,0]},
  destination:{pos:[4.8,10.8,14.5],look:[.7,1.1,4.7]}
 }:{
  overview:{pos:[12,11,18],look:[0,1,0]},
  commerce:{pos:[-.3,8.2,12],look:[-4.2,1.0,0]},
  courier:{pos:[7.8,8.1,11.3],look:[.98,1.1,1.18]},
  destination:{pos:[7.6,8.7,12],look:[4.1,1,.1]}
 };
 const cameraTarget=new THREE.Vector3();
 const tmp=new THREE.Vector3(),desiredLook=new THREE.Vector3();
 function resize(w,h){
  if(!renderer||!camera)return;
  const ratio=w/Math.max(1,h),size=vertical?6.6:5.8;
  camera.left=-size*ratio;camera.right=size*ratio;
  camera.top=size;camera.bottom=-size;
  camera.updateProjectionMatrix();renderer.setSize(w,h,false);
 }
 function stop(){
  alive=false;
  if(raf){cancelAnimationFrame(raf);raf=0}
 }
 function fail(reason){
  stop();stage.dataset.v6State=reason;
  storyActive=false;stage.dataset.v63Tour="stopped";
  if(storyPanel)storyPanel.hidden=true;
  if(storyButton){storyButton.textContent="Ver recorrido 3D";storyButton.setAttribute("aria-pressed","false")}
   controls.hidden=true;stage.dataset.v6View="fallback";
  ro?.disconnect();observer?.disconnect();
  if(onMove)mount.removeEventListener("pointermove",onMove);
  if(onLeave)mount.removeEventListener("pointerleave",onLeave);
  if(onResize)window.removeEventListener("resize",onResize);
  if(onVisibility)document.removeEventListener("visibilitychange",onVisibility);
  if(onControls)controls.removeEventListener("click",onControls);
  const materials=new Set(Object.values(mats));
  scene?.traverse(obj=>{
    obj.geometry?.dispose();
    if(Array.isArray(obj.material))for(const m of obj.material)materials.add(m);
    else if(obj.material)materials.add(obj.material);
  });
  for(const material of materials)material.dispose();
  for(const texture of ownedTextures)texture.dispose();
  renderer?.dispose();renderer=undefined;
  mount.replaceChildren();
  window.__dessetV6Probe=undefined;
  const trigger=stage.querySelector(".v6-enable-webgl");
  if(trigger)trigger.hidden=false;
  stage.dispatchEvent(new Event("desset:v6-unavailable"));
 }
 const cancelTour=(reason="manual")=>{
  if(!storyActive&&stage.dataset.v63Tour!=="complete")return;
  storyActive=false;
  stage.dataset.v63Tour=reason==="complete"?"complete":"stopped";
  if(storyButton){
   storyButton.textContent=reason==="complete"?"Repetir recorrido":"Ver recorrido 3D";
   storyButton.setAttribute("aria-pressed","false");
  }
  if(reason==="complete"&&storyPanel){
   storyTitle.textContent="RECORRIDO FINALIZADO";
   storyDetail.textContent="Visión conceptual de comercio, reparto y destino; no es una entrega real.";
   storyProgress.value=100;
  }else if(storyPanel){storyPanel.hidden=true;storyProgress.value=0}
 };
 const applyView=(view,{preserveStory=false}={})=>{
  if(!(view in presets))return;
  if(!preserveStory)cancelTour("manual");
  cameraPreset=view;stage.dataset.v6View=view;


  paused=false;
  const pause=controls.querySelector(".v6-pause");
  if(pause)pause.textContent="Pausar movimiento";
  wake();
 };
 const beginTour=()=>{
  if(!storyPanel||!storyButton||!renderer)return;
  storyActive=true;storyElapsed=0;storyBeat=-1;
  stage.dataset.v63Tour="playing";
  storyPanel.hidden=false;storyProgress.value=0;
  storyButton.textContent="Detener recorrido";
  storyButton.setAttribute("aria-pressed","true");
  applyView("overview",{preserveStory:true});
 };
 function render(now){
  if(!alive)return;
  raf=requestAnimationFrame(render);
  if(document.hidden||!onscreen||paused)return;
  if(now-lastRender<(coarse?32:22))return;
  const wallDelta=Math.min(.20,(now-last||16)/1000);
  const delta=Math.min(.055,wallDelta);last=now;lastRender=now;
  frame+=delta;
  if(storyActive){
   storyElapsed=Math.min(STORY_DURATION,storyElapsed+wallDelta);
   const step=storyAtTime(storyElapsed);
   if(step.index!==storyBeat){
    storyBeat=step.index;
    applyView(step.beat.view,{preserveStory:true});
    storyTitle.textContent=step.beat.title;
    storyDetail.textContent=step.beat.detail;
    stage.dataset.v63Beat=step.beat.id;
   }
   storyProgress.value=step.progress;
   if(step.done)cancelTour("complete");
  }
  const preset=presets[cameraPreset];
  const dx=!coarse?pointer.x*.32:0,dy=!coarse?pointer.y*.21:0;
  const orbit=!coarse&&cameraPreset==="overview"?Math.sin(frame*.19)*.15:0;
  tmp.set(preset.pos[0]+dx+orbit,preset.pos[1]+dy,preset.pos[2]);
  camera.position.lerp(tmp,Math.min(1,delta*3.2));
  desiredLook.set(...preset.look);
  cameraTarget.lerp(desiredLook,Math.min(1,delta*4.1));
  camera.lookAt(cameraTarget);
  if(parcel){
   if(storyActive&&parcel.userData.curve){
    const point=parcel.userData.curve.getPointAt(routeProgress(storyElapsed));
    parcel.position.set(point.x,point.y+.75+Math.sin(frame*2.1)*.07,point.z);
    parcel.rotation.y=Math.sin(frame*1.2)*.12;
   }else{
    parcel.position.set(vertical?-1.2:-2.25,1.35+Math.sin(frame*1.65)*.13,vertical?-2.35:-.58);
    parcel.rotation.y=Math.sin(frame*.48)*.09;
   }
  }
  if(routeHalo)routeHalo.material.opacity=.12+Math.sin(frame*1.4)*.025;
  if(particle){
   const p=particle.userData.curve.getPointAt((frame*.082)%1);
   particle.position.copy(p);
  }
  renderer.render(scene,camera);
  stage.dataset.v6Frames=String(Number(stage.dataset.v6Frames||0)+1);
 }
 function wake(){
  if(!renderer||alive||paused||document.hidden||!onscreen||stage.dataset.v6State!=="active")return;
  alive=true;last=0;lastRender=0;raf=requestAnimationFrame(render);
 }
  // Render a complete GPU frame while the image-free fallback is visible.
  // Reveal WebGL only after model loading and one valid draw call.
 const revealReady=()=>{
  if(!renderer||stage.dataset.v6State!=="preparing")return;
  renderer.render(scene,camera);
  controls.hidden=false;
  stage.dataset.v6State="active";
  stage.dispatchEvent(new Event("desset:v6-ready"));
  wake();
 };
 // Core 3D scene starts on demand via the existing V5 progressively enhanced controller.
 try{
  const probe=document.createElement("canvas");
  if(!probe.getContext("webgl2")){fail("unsupported");}
  else{
   setup();
   stage.dataset.v6State="preparing";
   controls.hidden=true;
   const trigger=stage.querySelector(".v6-enable-webgl");
   if(trigger)trigger.hidden=true;
   onControls=e=>{
    const button=e.target.closest("button");if(!button)return;

    if(button.classList.contains("v63-tour")){
     if(storyActive){cancelTour("manual");applyView("overview")}
     else beginTour();
     return;
    }
    if(button.classList.contains("v6-pause")){
      paused=!paused;button.textContent=paused?"Reanudar movimiento":"Pausar movimiento";
      if(paused)stop();else wake();
     }
   };
   controls.addEventListener("click",onControls);
   onMove=e=>{
    if(coarse)return;
    const r=mount.getBoundingClientRect();
    pointer.x=((e.clientX-r.left)/Math.max(1,r.width)-.5)*2;
    pointer.y=((e.clientY-r.top)/Math.max(1,r.height)-.5)*2;
   };
   onLeave=()=>{pointer.x=0;pointer.y=0};
   onResize=()=>{
    if(!renderer)return;
    // Avoid stretched geometry and high-cost mobile shaders after rotation:
     // restore the text fallback if geometry quality breakpoints change.
    const isVertical=window.matchMedia("(max-width: 430px)").matches;
    const isCoarse=window.matchMedia("(max-width: 800px)").matches;
     if(isVertical!==vertical||isCoarse!==coarse){fail("fallback");return}
    resize(Math.max(mount.clientWidth,1),Math.max(mount.clientHeight,1));
   };
   mount.addEventListener("pointermove",onMove,{passive:true});
   mount.addEventListener("pointerleave",onLeave,{passive:true});
   window.addEventListener("resize",onResize,{passive:true});
   ro=new ResizeObserver(entries=>{for(const e of entries)resize(Math.max(1,e.contentRect.width),Math.max(1,e.contentRect.height))});
   ro.observe(mount);
   observer=new IntersectionObserver(entries=>{
     onscreen=entries[0]?.isIntersecting===true;
     if(onscreen)wake();else stop();
   }, {threshold:0.02});
   observer.observe(stage);
   onVisibility=()=>{if(document.hidden)stop();else wake()};
   document.addEventListener("visibilitychange",onVisibility);
   camera.position.set(...presets.overview.pos);cameraTarget.set(...presets.overview.look);camera.lookAt(cameraTarget);
   applyView("overview");
   renderer.render(scene,camera);
   const objectBounds=()=>{
     const result={};
     for(const name of ["commerce","courier","destination"]){
       const object=scene.getObjectByName(name);
       if(!object)continue;
       const b=new THREE.Box3().setFromObject(object);
       const points=[];
       for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])
         for(const z of [b.min.z,b.max.z])
           points.push(new THREE.Vector3(x,y,z).project(camera));
       result[name]={
         minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),
         minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))
       };
     }
     return result;
   };
   window.__dessetV6Probe=()=>({threeRevision:THREE.REVISION,webgl:true,frames:Number(stage.dataset.v6Frames||0),
      triangles:renderer?.info.render.triangles||0,drawCalls:renderer?.info.render.calls||0,
      currentView:cameraPreset,domCanvas:mount.querySelectorAll("canvas").length,
      shadows:renderer?.shadowMap.enabled===true,
      geometryCount:renderer?.info.memory.geometries||0,
      textureCount:renderer?.info.memory.textures||0,
      material:"PBR",colorSpace:"srgb",cinematic:"v6.2",
      glbLoaded:modelStats.ready?modelStats.models.length:0,
      glbModels:modelStats.models,glbStatus:stage.dataset.v62ModelsStatus||"not-started",
      tourActive:storyActive,tourSeconds:Number(storyElapsed.toFixed(3)),
      tourBeat:STORY_BEATS[storyBeat]?.id||null,tourDuration:STORY_DURATION,
      tourProgress:storyProgress?.value||0,
      objectBounds:objectBounds()});
  // Keep the accessible static description visible until the GLBs finish loading.
   // one true GPU frame has been rendered. Prevents empty canvas and model pop.
   void hydrateGLBModels({
    scene,coarse,stage,sign,ownedTextures,
    isLive:()=>Boolean(renderer)&&stage.dataset.v6State==="preparing"
   }).then(value=>{
    if(!renderer)return;
    modelStats=value;
    revealReady();
   }).catch(error=>{
    if(!renderer)return;
    stage.dataset.v62ModelsStatus="fallback";
    console.warn("DESSET detailed GLB fallback:",String(error).slice(0,200));
    revealReady();
   });
  }
 }catch(e){console.warn("DESSET experimental Three.js fallback:",String(e));fail("unsupported")}
}
