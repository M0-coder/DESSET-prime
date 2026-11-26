// Shared portable input validator: local reference and Worker.
export const merchantFields=["business_name","category","department","province","district","address","contact_name","phone","email"];
export const interestLevels=Object.freeze(["ready","soon","evaluating","information"]);
export const optionalFields=["postal_code","interest_level","contact_pronunciation"];
const allowedCategories=new Set(["restaurant","grocery","bakery","specialty","pharmacy","other"]);
export function validateMerchantInput(input){
 if(!input||typeof input!=="object"||Object.keys(input).some(k=>!merchantFields.includes(k)&&!optionalFields.includes(k)&&k!=="observations"))throw Error("INVALID_FIELDS");
 const data={};
 for(const key of merchantFields){
  if(typeof input[key]!=="string")throw Error("INVALID_FIELD");
  const v=input[key].trim();
  if(!v||v.length>200||/[\u0000-\u001f\u007f]/.test(v))throw Error("INVALID_FIELD");
  data[key]=v;
 }
 if(!allowedCategories.has(data.category)||!/^\+51[0-9]{9}$/.test(data.phone)||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))throw Error("INVALID_CONTACT_OR_CATEGORY");
 data.email=data.email.toLowerCase();
 if(input.observations!==undefined){if(typeof input.observations!=="string"||input.observations.length>1000||/[\u0000-\u001f\u007f]/.test(input.observations))throw Error("INVALID_FIELD");const note=input.observations.trim();if(note)data.observations=note;}
 if(input.postal_code!==undefined){if(typeof input.postal_code!=="string"||!/^\d{5}$/.test(input.postal_code))throw Error("INVALID_POSTAL_CODE");data.postal_code=input.postal_code;}
 if(input.interest_level!==undefined){if(!interestLevels.includes(input.interest_level))throw Error("INVALID_INTEREST_LEVEL");data.interest_level=input.interest_level;}
 if(input.contact_pronunciation!==undefined){if(typeof input.contact_pronunciation!=="string"||input.contact_pronunciation.length>200||/[\u0000-\u001f\u007f]/.test(input.contact_pronunciation))throw Error("INVALID_FIELD");const v=input.contact_pronunciation.trim();if(v)data.contact_pronunciation=v;}
 return data;
}
