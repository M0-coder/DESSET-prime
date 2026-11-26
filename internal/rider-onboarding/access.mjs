// Same verified Access pattern as frozen merchant candidate; role-specific audience and allowlist.
const fail=(status,publicCode)=>Object.assign(Error(publicCode),{status,publicCode});
const enc=new TextEncoder();
const digest=async v=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(v))),x=>x.toString(16).padStart(2,"0")).join("");
const bytes=s=>{if(!/^[A-Za-z0-9_-]+$/.test(s))throw Error();return Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"=")),c=>c.charCodeAt(0));};
const decode=s=>JSON.parse(new TextDecoder().decode(bytes(s)));
export async function verifyAccess(req,env,fetcher=fetch,now=Math.floor(Date.now()/1000)){
 // MFA is enforced by the dedicated Access application policy. No client-declared actor or role.
 // ADMIN_POLICY_VERIFIED remains off until the policy and negative MFA tests are evidenced.
 if(env.RIDER_ADMIN_POLICY_VERIFIED!=="true"||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.RIDER_ACCESS_ISSUER??"")||!/^[a-f0-9]{64}$/.test(env.RIDER_ACCESS_AUD??"")||!env.RIDER_ADMIN_SUBJECTS)throw fail(503,"ADMIN_DISABLED");
 try{
 const raw=req.headers.get("Cf-Access-Jwt-Assertion");if(!raw||raw.length>16384)throw Error();
 const parts=raw.split(".");if(parts.length!==3)throw Error();
 const h=decode(parts[0]),p=decode(parts[1]);if(h.alg!=="RS256"||typeof h.kid!=="string"||h.crit||p.iss!==env.RIDER_ACCESS_ISSUER||!Array.isArray(p.aud)||!p.aud.includes(env.RIDER_ACCESS_AUD)||!Number.isSafeInteger(p.exp)||p.exp<=now||!Number.isSafeInteger(p.iat)||p.iat>now+30||(p.nbf!==undefined&&(!Number.isSafeInteger(p.nbf)||p.nbf>now))||typeof p.sub!=="string"||!env.RIDER_ADMIN_SUBJECTS.split(",").map(x=>x.trim()).includes(p.sub)||typeof p.email!=="string"||!p.email.includes("@")||p.exp<=p.iat||p.exp-p.iat>900||p.type!=="app")throw Error();
 const r=await fetcher(env.RIDER_ACCESS_ISSUER+"/cdn-cgi/access/certs",{redirect:"error",signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();
 const keys=(await r.json()).keys;if(!Array.isArray(keys))throw Error();const matches=keys.filter(k=>k.kid===h.kid&&k.kty==="RSA"&&(!k.alg||k.alg==="RS256")&&(!k.use||k.use==="sig"));if(matches.length!==1)throw Error();const jwk=matches[0];
 const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
 if(!await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,bytes(parts[2]),enc.encode(parts[0]+"."+parts[1])))throw Error();
 return p.sub;
 }catch{throw fail(403,"ACCESS_DENIED");}
}
// Only the Cloudflare runtime can supply ctx.access. A copied signed JWT alone is insufficient.
export async function authorizeRider(req,env,ctx,fetcher,now){
 if(env.RIDER_ADMIN_POLICY_VERIFIED!=="true")throw fail(503,"ADMIN_DISABLED");
 if(!ctx?.access||ctx.access.aud!==env.RIDER_ACCESS_AUD||typeof ctx.access.getIdentity!=="function")throw fail(403,"ACCESS_CONTEXT_REQUIRED");
 const actor=await verifyAccess(req,env,fetcher,now);
 try{
 const identity=await ctx.access.getIdentity();
 const raw=req.headers.get("Cf-Access-Jwt-Assertion"),claims=decode(raw.split(".")[1]);
 if(typeof env.RIDER_ADMIN_EMAIL!=="string"||!env.RIDER_ADMIN_EMAIL||typeof identity?.email!=="string"||identity.email.toLowerCase()!==claims.email.toLowerCase()||identity.email.toLowerCase()!==env.RIDER_ADMIN_EMAIL.toLowerCase())throw Error();
 return {actor,csrf:await digest("desset-rider-admin-v1:"+raw)};
 }catch{throw fail(403,"ACCESS_DENIED");}
}
