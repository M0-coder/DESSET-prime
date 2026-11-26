// Production hostname is a proposed dedicated domain, not a provisioned route.
export const PRODUCTION_ORIGIN="https://comercios.desset.lat";
const validRef=v=>typeof v==="string"&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{2,119}$/.test(v);
const closed=(status,publicCode)=>Object.assign(Error(publicCode),{status,publicCode});
export function originFor(env){
 const expected=env.ENVIRONMENT==="production"?PRODUCTION_ORIGIN:env.ENVIRONMENT==="staging"?"https://desset-merchant-staging.morimil-pabfelon.workers.dev":null;
 if(!expected||env.SERVICE_ORIGIN!==expected)throw closed(403,"HOST");
 return expected;
}
export async function productionGate(env,feature){
 if(env.ENVIRONMENT!=="production"||!env.DB)throw closed(503,"FEATURE_DISABLED");
 originFor(env);
 const flags={intake:["INTAKE_ENABLED","intake_enabled"],notification:["NOTIFICATIONS_ENABLED","notification_enabled"],activation:["ACTIVATION_ENABLED","activation_enabled"]};
 if(!Object.hasOwn(flags,feature))throw closed(503,"FEATURE_DISABLED");
 const [binding,column]=flags[feature];
 if(env[binding]!=="true"||env.PRODUCTION_POLICY_VERIFIED!=="true"||!validRef(env.LAUNCH_AUTHORIZATION_REF))throw closed(503,"FEATURE_DISABLED");
 const s=await env.DB.prepare("SELECT environment,intake_enabled,notification_enabled,activation_enabled,privacy_version,launch_authorization_ref FROM merchant_runtime WHERE id=1").first();
 if(!s||s.environment!=="production"||s[column]!==1||s.launch_authorization_ref!==env.LAUNCH_AUTHORIZATION_REF)throw closed(503,"FEATURE_DISABLED");
 if(feature==="intake"&&(env.PRIVACY_POLICY_VERIFIED!=="true"||!s.privacy_version||s.privacy_version!==env.PRIVACY_VERSION||env.PRIVACY_URL!=="https://desset.lat/privacidad-comercios.html"||env.TERRITORY_VERIFIED!=="true"))throw closed(503,"PRIVACY_OR_TERRITORY_NOT_READY");
 return s;
}
