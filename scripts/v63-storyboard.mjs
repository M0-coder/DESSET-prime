/** DESSET Prime V6.3 — deterministic cinematic storyboard.
 * Pure functions: no timers, network, browser globals or access to production.
 * All scenes are conceptual, never evidence of an operational delivery. */
export const STORY_BEATS=Object.freeze([
 Object.freeze({id:"opening",view:"overview",start:0,end:0.85,title:"COMERCIO EN MOVIMIENTO",detail:"Una visualización conceptual de DESSET."}),
 Object.freeze({id:"commerce",view:"commerce",start:0.85,end:3.1,title:"01 / EL COMERCIO",detail:"Donde comienza un futuro pedido."}),
 Object.freeze({id:"courier",view:"courier",start:3.1,end:5.85,title:"02 / EL REPARTIDOR",detail:"El movimiento conecta cada punto."}),
 Object.freeze({id:"destination",view:"destination",start:5.85,end:8.45,title:"03 / EL DESTINO",detail:"Una ruta que termina en la entrega."}),
 Object.freeze({id:"closing",view:"overview",start:8.45,end:9.3,title:"DESSET / VISIÓN",detail:"Representación artística, no un servicio activo."})
]);
export const STORY_DURATION=STORY_BEATS.at(-1).end;
export function storyAtTime(seconds){
 if(typeof seconds!=="number"||!Number.isFinite(seconds))throw new TypeError("Finite elapsed seconds required");
 const t=Math.max(0,Math.min(seconds,STORY_DURATION));
 const index=STORY_BEATS.findIndex(beat=>t>=beat.start&&t<beat.end);
 const normalized=index<0?STORY_BEATS.length-1:index;
 return {index:normalized,beat:STORY_BEATS[normalized],
  seconds:t,progress:Math.min(100,Math.round(t/STORY_DURATION*100)),
  done:t>=STORY_DURATION};
}
export function routeProgress(seconds){
 const t=Math.max(0,Math.min(STORY_DURATION,Number(seconds)||0));
 // Vehicle's route visual stays within 0–1; smoothstep avoids an abrupt launch.
 const q=t/STORY_DURATION;
 return q*q*(3-2*q);
}
