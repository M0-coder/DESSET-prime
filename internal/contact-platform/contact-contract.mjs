// Shared browser/server input contract; no bindings or database operations.
const fail=(status,code)=>Object.assign(Error(code),{status,code});
export const categories=Object.freeze(["alianzas","inversion","marketing","prensa","instituciones","profesionales","legal","seguridad","otras"]);
export const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function normalizeContact(input,privacyVersion){
 const keys=["category","person","email","organization","phone","subject","message","consent","privacyVersion","requestKey","challenge"];
 if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).length!==keys.length||keys.some(k=>!Object.hasOwn(input,k)))throw fail(400,"INVALID_FIELDS");
 const clean=(v,max,required=true,multiline=false)=>{if(typeof v!=="string")throw fail(400,"INVALID_FIELD");const s=v.trim().normalize("NFC");if((required&&!s)||s.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(s)||(!multiline&&/[\r\n\t]/u.test(s)))throw fail(400,"INVALID_FIELD");return s;};
 if(!categories.includes(input.category)||input.consent!==true||input.privacyVersion!==privacyVersion||typeof input.requestKey!=="string"||!/^[a-f0-9]{64}$/.test(input.requestKey))throw fail(400,"INVALID_REQUEST");
 const person=clean(input.person,100),email=clean(input.email,150).toLowerCase(),organization=clean(input.organization,120,false),phone=clean(input.phone,30,false),subject=clean(input.subject,120),message=clean(input.message,2000,true,true);
 if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)||(phone&&!/^\+?[0-9 ()-]{6,30}$/.test(phone))||(["seguridad","otras","profesionales"].includes(input.category)&&organization)||(!["prensa","alianzas","marketing","instituciones"].includes(input.category)&&phone))throw fail(400,"INVALID_CONTACT");
 if(typeof input.challenge!=="string"||!input.challenge||input.challenge.length>2048)throw fail(400,"INVALID_CHALLENGE");
 return {category:input.category,person,email,organization,phone,subject,message,privacyVersion,requestKey:input.requestKey,challenge:input.challenge};
}
