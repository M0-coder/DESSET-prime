/* DESSET PRIME V6 — actual Three.js / WebGL2, no static-image masquerade.
 * All geometry is procedural, no external textures, fetch, tracking or WebGPU.
 * The V5 WebP image remains the functional fallback and accessible context. */
import * as THREE from "three";

const stage=document.querySelector(".v5-city-stage");
const mount=stage?.querySelector(".v6-three-mount");
const controls=stage?.querySelector(".v6-three-controls");
const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true;
const coarse=window.matchMedia?.("(max-width: 800px)")?.matches===true;
if(!stage||!mount||!controls||reduced){
 if(stage)stage.dataset.v6State=reduced?"reduced":"missing";
}else{
 let renderer,scene,camera,ro,observer,raf=0,alive=false,onscreen=true,paused=false;
 let cameraPreset="overview",frame=0,particle,parcel,routeHalo;
 let pointer={x:0,y:0},last=0,lastRender=0;
 let onMove,onLeave,onResize,onVisibility,onControls;
 const ownedTextures=[];
 const PAL={blue:0x1551d8,gold:0xffc62f,red:0xff3328,night:0x0b1024};
 const makeMat=(color,metalness=0.2,roughness=0.48,emissive=0x000000,intensity=0)=>
   new THREE.MeshStandardMaterial({color,metalness,roughness,emissive,emissiveIntensity:intensity});
 const mats={
  blue:makeMat(PAL.blue,.21,.29),cyan:makeMat(0x5f94ff,.26,.32),
  gold:makeMat(PAL.gold,.22,.36,0xe39505,.13),
  red:makeMat(PAL.red,.24,.38),dark:makeMat(0x172443,.28,.60),
  side:makeMat(0x263e73,.20,.60),cream:makeMat(0xf9f0d3,.08,.61),
  glass:makeMat(0x73d7f7,.40,.13,0x1c68bb,.47),
  route:makeMat(PAL.gold,.12,.30,0xffb725,1.4),
  road:makeMat(0x122142,.14,.78),
  trim:makeMat(0x1a3e83,.55,.28),
  chrome:makeMat(0xc5d6f6,.75,.22),
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
 function storefront(){
  const g=new THREE.Group();g.name="commerce";g.position.set(coarse?-.7:-5,0,coarse?-4.7:0);scene.add(g);
  plinth(g,4.1,3.1);
  box(g,2.7,2.3,1.95,0,1.22,-.2,mats.blue);
  box(g,3.1,.27,2.25,0,2.47,-.22,mats.cyan);
  for(const x of [-.91,.91])box(g,.65,1.03,.035,x,1.22,.796,mats.glass);
  box(g,.6,1.53,.055,0,1.01,.80,mats.dark);
  box(g,3.22,.2,1.15,0,1.96,1.12,mats.gold);
  for(let i=0;i<7;i++)box(g,.43,.10,.79,-1.35+i*.45,1.79,1.26,i%2?mats.cream:mats.red);
  box(g,1.24,.27,.05,0,2.08,.935,mats.dark);
  box(g,1.11,.27,.07,0,2.10,.974,mats.trim);
  sign(g,"DESSET",0,2.10,1.017,.95,.18);
  for(const x of [-1.04,1.04])cylinder(g,.13,.7,x,.39,1.5,mats.gold);
  for(const x of [-.91,.91])box(g,.055,1.1,.07,x,1.22,.831,mats.chrome);
  box(g,2.76,.065,.18,0,.19,.88,mats.chrome);
  box(g,.75,.08,.50,0,.17,1.01,mats.gold);
  sphere(g,.064,.20,1.0,.852,mats.headlight);
 }
 function destination(){
  const g=new THREE.Group();g.name="destination";g.position.set(coarse?.7:5.03,0,coarse?4.7:-.35);scene.add(g);
  plinth(g,3.65,3.15);
  box(g,2.65,2.12,2.18,0,1.12,0,mats.red);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(2.14,1.28,4,1),mats.cream);
  roof.position.set(0,2.75,0);
  roof.rotation.y=Math.PI/4;g.add(roof);
  box(g,.83,1.48,.058,.36,.76,1.122,mats.dark);
  box(g,.62,.6,.065,-.81,1.30,1.123,mats.glass);
  box(g,.52,.62,.062,1.333,1.31,-.34,mats.windowLight);
  sphere(g,.075,.80,.72,1.17,mats.gold);
  box(g,1.02,.09,.42,.36,.17,1.33,mats.cream);
  box(g,2.84,.13,.20,0,2.15,1.03,mats.chrome);
  sign(g,"DESTINO",0,2.17,1.145,1.35,.17);
  box(g,.05,.67,.09,-.81,1.32,1.166,mats.chrome);
 }
 function courier(){
  const g=new THREE.Group();g.name="courier";g.position.set(coarse?0:.98,.13,coarse?0:1.18);scene.add(g);
  plinth(g,3.9,2.65);
  for(const x of [-.92,.91]){
   const tyre=new THREE.Mesh(new THREE.TorusGeometry(.39,.115,8,18),mats.dark);
   tyre.position.set(x,.50,.54);g.add(tyre);
   const hub=new THREE.Mesh(new THREE.CircleGeometry(.17,16),mats.cyan);
   hub.position.copy(tyre.position);hub.position.z+=.03;g.add(hub);
  }
  box(g,1.77,.19,.58,0,.68,.39,mats.red);
  box(g,.92,.47,.88,.05,1.04,.02,mats.blue);
  cylinder(g,.21,.72,-.16,1.60,.05,mats.cream);
  const helmet=sphere(g,.33,-.12,2.12,.05,mats.gold);
  helmet.scale.set(1, .84,1);
  const visor=box(g,.40,.16,.07,-.02,2.15,.336,mats.dark);
  visor.rotation.z=-.1;
  const trunk=box(g,1.15,.96,.9,.83,1.55,-.15,mats.gold);
  trunk.rotation.y=.06;
  box(g,.75,.08,.92,.82,2.04,-.15,mats.red);
  box(g,.45,.24,.06,.82,1.52,.33,mats.dark);
  sphere(g,.11,-1.22,.92,.48,mats.headlight);
  box(g,.18,.25,.65,-1.12,.59,.50,mats.chrome);
  box(g,1.85,.045,.65,0,.47,.43,mats.dark);
  box(g,.43,.11,.06,-.16,1.33,.38,mats.gold);
  box(g,.45,.07,.07,.82,1.24,.365,mats.chrome);
  return g;
 }
 function decorate(){
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(22,14),mats.road);
  ground.rotation.x=-Math.PI/2;ground.position.y=-.32;scene.add(ground);
  const grid=new THREE.GridHelper(20,20,0x314977,0x1b2d4b);
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
  const path=coarse?[
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
  box(parcel,.82,.64,.71,0,0,0,mats.gold);
  box(parcel,.10,.66,.73,0,.005,0,mats.cream);
  box(parcel,.85,.07,.12,0,.34,0,mats.cream);
  parcel.position.set(coarse?-1.2:-2.25,1.35,coarse?-2.35:-.58);scene.add(parcel);
  glow(scene,coarse?-.7:-5,2.8,coarse?-4.7:0,0x4a8cff,2.8,.28);
  glow(scene,coarse?.7:5.03,2.6,coarse?4.7:-.35,0xff6852,2.4,.23);
  glow(scene,coarse?0:.98,2.1,coarse?0:1.18,0xffc62f,1.7,.25);
  glow(particle,0,0,0,0xffc62f,1.5,.55);
  // Soft pools of light offer depth without a costly post-processing pass.
  const pools=coarse?[[-.7,-4.7,2.25],[0,0,2.05],[.7,4.7,2.0]]:[[-5,0,2.25],[.98,1.18,2.05],[5.03,-.35,2.0]];
  for(const [x,z,r] of pools){
    const halo=new THREE.Mesh(new THREE.CircleGeometry(r,32),
      new THREE.MeshBasicMaterial({color:0x2e68c7,transparent:true,opacity:.07,depthWrite:false}));
    halo.rotation.x=-Math.PI/2;halo.position.set(x,-.283,z);scene.add(halo);
  }
 }
 function setup(){
  scene=new THREE.Scene();
  scene.background=new THREE.Color(PAL.night);
  scene.fog=new THREE.FogExp2(PAL.night,.018);
  scene.add(new THREE.HemisphereLight(0xbad6ff,0x071020,1.85));
  const sun=new THREE.DirectionalLight(0xf5faff,3.25);
  sun.position.set(-3,11,7);sun.castShadow=!coarse;
  sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-13,right:13,top:11,bottom:-11,near:.5,far:40});
  sun.shadow.bias=-.0007;sun.shadow.normalBias=.025;
  sun.shadow.camera.updateProjectionMatrix();scene.add(sun);
  const fill=new THREE.PointLight(0xffc62f,17,17);
  fill.position.set(0,5.2,4.2);scene.add(fill);
  const rim=new THREE.PointLight(0x4c80ff,8.5,15);
  rim.position.set(5.5,4,-4);scene.add(rim);
  const neon=new THREE.PointLight(0xff3328,4,9);
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
 const presets=coarse?{
  overview:{pos:[3.5,14.8,15.2],look:[0,1,0]},
  commerce:{pos:[3.2,10.8,7.0],look:[-.7,1.1,-4.7]},
  destination:{pos:[4.8,10.8,14.5],look:[.7,1.1,4.7]}
 }:{
  overview:{pos:[12,11,18],look:[0,1,0]},
  commerce:{pos:[-.3,8.2,12],look:[-4.2,1.0,0]},
  destination:{pos:[7.6,8.7,12],look:[4.1,1,.1]}
 };
 const cameraTarget=new THREE.Vector3();
 const tmp=new THREE.Vector3(),desiredLook=new THREE.Vector3();
 function resize(w,h){
  if(!renderer||!camera)return;
  const ratio=w/Math.max(1,h),size=coarse?6.6:5.8;
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
  controls.hidden=true;stage.dataset.v6View="poster";
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
 }
 const applyView=(view)=>{
  if(!(view in presets))return;
  cameraPreset=view;stage.dataset.v6View=view;
  for(const button of controls.querySelectorAll("[data-v6-camera]"))
   button.setAttribute("aria-pressed",String(button.dataset.v6Camera===view));
  paused=false;
  const pause=controls.querySelector(".v6-pause");
  if(pause)pause.textContent="Pausar movimiento";
  wake();
 };
 function render(now){
  if(!alive)return;
  raf=requestAnimationFrame(render);
  if(document.hidden||!onscreen||paused)return;
  if(now-lastRender<(coarse?32:22))return;
  const delta=Math.min(.055,(now-last||16)/1000);last=now;lastRender=now;
  frame+=delta;
  const preset=presets[cameraPreset];
  const dx=!coarse?pointer.x*.32:0,dy=!coarse?pointer.y*.21:0;
  const orbit=!coarse&&cameraPreset==="overview"?Math.sin(frame*.19)*.15:0;
  tmp.set(preset.pos[0]+dx+orbit,preset.pos[1]+dy,preset.pos[2]);
  camera.position.lerp(tmp,Math.min(1,delta*3.2));
  desiredLook.set(...preset.look);
  cameraTarget.lerp(desiredLook,Math.min(1,delta*4.1));
  camera.lookAt(cameraTarget);
  if(parcel){
   parcel.position.y=1.35+Math.sin(frame*1.65)*.13;
   parcel.rotation.y=Math.sin(frame*.48)*.09;
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
  if(!renderer||alive||paused)return;
  alive=true;last=0;lastRender=0;raf=requestAnimationFrame(render);
 }
 // Core 3D scene starts on demand via the existing V5 progressively enhanced controller.
 try{
  const probe=document.createElement("canvas");
  if(!probe.getContext("webgl2")){fail("unsupported");}
  else{
   setup();
   stage.dataset.v6State="active";
   controls.hidden=false;
   const trigger=stage.querySelector(".v6-enable-webgl");
   if(trigger)trigger.hidden=true;
   onControls=e=>{
    const button=e.target.closest("button");if(!button)return;
    if(button.dataset.v6Camera){applyView(button.dataset.v6Camera);return}
    if(button.classList.contains("v6-pause")){
      paused=!paused;button.textContent=paused?"Reanudar movimiento":"Pausar movimiento";
      if(paused)stop();else wake();
    }else if(button.classList.contains("v6-poster")){fail("poster")}
   };
   controls.addEventListener("click",onControls);
   onMove=e=>{
    if(coarse)return;
    const r=mount.getBoundingClientRect();
    pointer.x=((e.clientX-r.left)/Math.max(1,r.width)-.5)*2;
    pointer.y=((e.clientY-r.top)/Math.max(1,r.height)-.5)*2;
   };
   onLeave=()=>{pointer.x=0;pointer.y=0};
   onResize=()=>{if(renderer)resize(Math.max(mount.clientWidth,1),Math.max(mount.clientHeight,1))};
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
      material:"PBR",colorSpace:"srgb",cinematic:"v6.1",
      objectBounds:objectBounds()});
  }
 }catch(e){console.warn("DESSET experimental Three.js fallback:",String(e));fail("unsupported")}
}
