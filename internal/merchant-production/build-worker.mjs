import {build} from "esbuild";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const root=new URL("../../",import.meta.url);
const allowed=Object.freeze({"styles.css":"text/css","styles-system.css":"text/css","styles-typography.css":"text/css","styles-onboarding.css":"text/css","assets/deliver-assets-mark.png":"image/png","fonts/inter-latin-variable.woff2":"font/woff2","fonts/plus-jakarta-sans-latin-variable.woff2":"font/woff2"});
export function loadMerchantUI(){
 return {template:readFileSync(new URL("registro-comercios.html",root),"utf8"),assets:Object.fromEntries(Object.entries(allowed).map(([path,type])=>[path,{type,base64:readFileSync(new URL(path,root)).toString("base64")}]))};
}
export async function buildMerchantWorker(){
 const ui=loadMerchantUI();
 const result=await build({stdin:{contents:'import {handle} from "./internal/merchant-production/worker.mjs"; const ui='+JSON.stringify(ui)+'; export default {fetch(req,env,ctx){return handle(req,env,ctx,fetch,Math.floor(Date.now()/1000),ui)}};',resolveDir:fileURLToPath(root),sourcefile:"merchant-entry.mjs",loader:"js"},bundle:true,format:"esm",platform:"browser",target:"es2022",write:false,minify:true,logLevel:"silent"});
 if(result.outputFiles.length!==1)throw Error("Unexpected Worker output");
 return result.outputFiles[0].text;
}
