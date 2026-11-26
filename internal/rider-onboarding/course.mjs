export const VERSION="rider-course-v1";
export const lessons=[
["Seguridad vial","Revisa el vehículo y utiliza protección adecuada. Respeta señales y límites. Detente en un lugar seguro antes de consultar el teléfono."],
["Recogida y custodia","Comprueba referencia, estado externo e instrucciones autorizadas. Protege los productos, no abras envases sellados y comunica daños."],
["Entrega y trato","Verifica la referencia y usa el mecanismo de entrega autorizado. Respeta al destinatario y protege sus datos."],
["Incidencias y emergencias","Prioriza la integridad física. Detente ante riesgos o accidentes. Solicita ayuda cuando corresponda y comunica la incidencia."],
["Identidad y privacidad","No compartas cuentas, claves ni códigos. Accede solo a los datos necesarios y reporta intentos de fraude."]
];
export const questions=[
["q1",true,"Recibes un pedido mientras conduces. ¿Qué haces?",["Consultar el teléfono mientras avanzas","Detenerte en un lugar seguro antes de consultar","Responder antes de detenerte"],1],
["q2",false,"Antes de comenzar el reparto, ¿qué revisas?",["Estado del vehículo y protección adecuada","Solo el saldo de la aplicación","Únicamente la ruta más corta"],0],
["q3",true,"El comercio entrega un paquete dañado. ¿Cómo procedes?",["Ocultas el daño","Abres y reparas el envase","Comunicas la incidencia y sigues instrucciones autorizadas"],2],
["q4",false,"¿Qué verificas al recoger un pedido?",["Referencia, estado externo e instrucciones","Solo el nombre del comercio","Contenido de cada envase sellado"],0],
["q5",true,"El destinatario no responde. ¿Qué haces?",["Dejas el pedido sin instrucciones","Contactas por el canal autorizado y comunicas la incidencia","Publicas su teléfono"],1],
["q6",false,"¿Cómo confirmas una entrega?",["Con una publicación personal","Sin comprobar referencia","Con el mecanismo autorizado y la referencia correcta"],2],
["q7",true,"Ocurre un accidente durante el reparto. ¿Qué priorizas?",["Cumplir el plazo","La seguridad física y asistencia necesaria","Cerrar el pedido antes de pedir ayuda"],1],
["q8",false,"Si el recorrido presenta condiciones inseguras, ¿qué haces?",["Te detienes con seguridad y comunicas el riesgo","Aceleras","Ignoras el riesgo si el pedido es urgente"],0],
["q9",true,"Alguien que dice ser de soporte pide tu código. ¿Qué haces?",["Lo envías si conoce tu nombre","Lo compartes temporalmente","No lo compartes y reportas el intento"],2],
["q10",false,"¿Qué datos del destinatario puedes consultar?",["Solo los necesarios para el servicio autorizado","Los de todos los pedidos anteriores","Los que quieras conservar para uso personal"],0]
];
export const courseHash=async()=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify({VERSION,lessons,questions,minimum:8})))),b=>b.toString(16).padStart(2,"0")).join("");
export function grade(answers){if(!answers||Object.keys(answers).length!==10||questions.some(q=>!Object.hasOwn(answers,q[0])||!["0","1","2"].includes(answers[q[0]])))throw Object.assign(Error("INVALID_ANSWERS"),{status:400,publicCode:"INVALID_ANSWERS"});let score=0,critical=true;for(const q of questions){const correct=Number(answers[q[0]])===q[4];score+=Number(correct);if(q[1]&&!correct)critical=false;}return {score,critical,passed:score>=8&&critical};}
