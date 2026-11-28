# CONTACT-READY — procedimiento operativo propuesto (NO-GO)
Estado: borrador interno, sin autorización de operación ni tratamiento de datos reales. Complementa ACTIVATION-HANDOFF.md; no sustituye los 14 requisitos de activation-readiness.json. Un único sistema D1 para correspondencia institucional; SQLite es exclusivamente una referencia de regresión. No es soporte de pedidos, entregas, pagos ni incidencias de aplicaciones.

## Responsables y canales
Una persona autorizada puede asumir varias categorías, con acceso mínimo necesario y un suplente aprobado. No se inventan cargos ocupados, buzones, dominios verificados ni acuerdos de nivel de servicio.
| Categoría | Función responsable propuesta | Titular / suplente / canal / plazo |
| --- | --- | --- |
| alianzas | Dirección comercial | Pendientes de aprobación |
| inversion | Dirección / relaciones con inversionistas | Pendientes de aprobación |
| marketing | Marketing | Pendientes de aprobación |
| prensa | Comunicaciones | Pendientes de aprobación |
| instituciones | Relaciones institucionales | Pendientes de aprobación |
| profesionales | Talento | Pendientes de aprobación |
| legal | Legal | Pendientes de aprobación |
| seguridad | Seguridad / privacidad | Pendientes de aprobación |
| otras | Coordinación institucional | Pendientes de aprobación |

## Flujo de atención
1. El visitante selecciona una categoría, completa los campos necesarios y acepta el aviso de privacidad aprobado. La confirmación de recepción se muestra únicamente tras un recibo válido del servidor; no promete respuesta ni resolución.
2. El responsable autenticado revisa únicamente su bandeja. RECEIVED indica recepción, no lectura humana. IN_REVIEW indica inicio de revisión. No asignar implícitamente la consulta a otro departamento; la derivación requiere un procedimiento autorizado que preserve acceso mínimo.
3. Responder mediante un buzón institucional aprobado y verificado, inicialmente de forma manual. No utilizar cuentas personales ni reenviar mensajes íntegros a canales no autorizados; verificar destinatario, evitar copia innecesaria de datos y no solicitar contraseñas, documentos sensibles o pagos por este canal. Para seguridad y privacidad usar el procedimiento específico aprobado.
4. Registrar la evidencia mínima de atención en el sistema institucional autorizado (referencia, fecha, responsable y resultado; sin duplicar el contenido de la consulta). Actualmente D1 registra transiciones, no una entrega de correo ni una evidencia de respuesta. El cierre manual requiere verificar que se respondió o que existe un motivo documentado de cierre sin respuesta. No atribuir esa comprobación al código actual.
5. CLOSED significa cierre administrativo, no confirmación de entrega ni satisfacción del remitente. Si una respuesta rebota o el caso exige seguimiento, escalar al responsable designado mediante un procedimiento aprobado; el estado actual no permite reapertura. Definir ese procedimiento antes de activar; no construir otro sistema de tickets por defecto.
6. Revisar cola, consultas pendientes y capacidad con la frecuencia aprobada. Recorrer todas las páginas de hasta 100 registros mediante el cursor de la bandeja; la implementación candidata requiere CI y ensayo real. Reiniciar desde la primera página al comenzar una revisión: no es una instantánea congelada y los registros nuevos o vencidos pueden cambiar entre páginas. No confundir fin de la página con fin de la atención. Retención, eliminación y copias de seguridad requieren política aprobada y evidencia.

## Operación y contingencias
- Antes de habilitar: titular y suplente por categoría, responsable de incidentes, buzón y permisos verificados, plazos y frecuencia de revisión aprobados, ensayo de recepción-respuesta-cierre con datos ficticios. Todos pendientes.
- Ante acceso no autorizado o pérdida de datos: suspender el alcance afectado, revocar credenciales, avisar al responsable designado y preservar únicamente evidencia autorizada. No exportar datos personales a logs o repositorios.
- Ante indisponibilidad o retrasos: utilizar un canal alternativo solo si está aprobado; no mostrar éxito falso ni prometer atención que no puede acreditarse. Revisar el procedimiento de escalamiento.
- Antes de cierre de fase: comprobar todas las categorías, aislamiento, idempotencia, accesibilidad, paginación, política de retención, prueba de respuesta, staging aislado, reversión y CI del SHA exacto. Los requisitos legales, proveedor real, MFA y activación siguen sujetos a autorización separada.

## Evidencia y límites
Baseline histórico 53042127fed61cdac0c00283f9330f62cb42f1bf: 11/11 workflows, 495/495 Node, 22/22 workerd, 36 + 36 circuitos navegador y 144 transiciones auditadas. Artefactos de GitHub: workerd 15245017025, SHA-256 de archivo declarado por GitHub 4e15623a009243d5e5327838571e062510d1c89e7e38413a5ce1b6d2dd542912; navegador 15245331107, SHA-256 declarado 4f5d146d88aba4c87acb4e69780472ad9f8632edfe95986a55b1a5395f5c36af. No se afirma haber descargado o comprobado los bytes. Conservar evidencia antes de su vencimiento. Los ensayos son locales y usan identidad y datos sintéticos. Ninguna aprobación de despliegue, DNS, secretos, recursos, activación ni tratamiento real.
