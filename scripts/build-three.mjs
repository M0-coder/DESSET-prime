/** Build a locally hosted, no-CDN Three.js bundle for the experimental preview. */
import {build} from "esbuild";
import {stat,writeFile,mkdir} from "node:fs/promises";
import {gzipSync} from "node:zlib";
import {readFileSync} from "node:fs";
// Geometry floating-point output changes with V8; preserve reviewed GLB hashes.
if(process.versions.node!=="22.16.0")throw Error("Reproducible build requires Node 22.16.0; use nvm use before building");
await import("./build-glb-models.mjs");
const output="assets/v6-three.bundle.js";
const result=await build({
 entryPoints:["scripts/v6-three.src.mjs"],bundle:true,platform:"browser",format:"iife",
 target:["es2020"],minify:true,legalComments:"eof",outfile:output,
 logLevel:"warning",metafile:true,write:true,
});
const js=readFileSync(output);
const bytes=js.length,gzipBytes=gzipSync(js,{level:9}).length;
if(bytes>750000 || gzipBytes>190000)throw Error("Three.js output exceeds V6 budget: "+bytes+" raw / "+gzipBytes+" gzip");
if(Object.values(result.metafile.outputs).some(output=>output.imports?.some(imp=>imp.external)))throw Error("External runtime import left in Three.js bundle");
await mkdir("reports/quality",{recursive:true});
await writeFile("reports/quality/v6-three-bundle.json",JSON.stringify({
 type:"self-hosted-Three.js-WebGL",three:"0.187.0",esbuild:"0.28.2",
 output,rawBytes:bytes,gzipBytes,rawLimit:750000,gzipLimit:190000,
 inputs:Object.keys(result.metafile.inputs).length,
 scope:"experimental build asset only; no deployment and no network dependencies at runtime"
},null,2)+"\n");
console.log("DESSET V6 Three.js local IIFE build PASS: "+bytes+" bytes, gzip "+gzipBytes+" bytes");
