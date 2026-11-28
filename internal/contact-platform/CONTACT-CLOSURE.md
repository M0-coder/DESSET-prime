# CONTACT-READY — cierre de preparación local (NO-GO producción)
Alcance congelado: correspondencia institucional, nueve categorías, una D1, un panel y respuesta humana mediante correo institucional. No añadir CRM, ticketing, automatización de correo ni sistemas adicionales sin demanda demostrada.

## Candidato de cierre
Baseline validado 59793f217b127c23b9437497f3aa570c19f06f4c, main 58da16289aca0f1478a0d75b481f196553614a19: 11/11 workflows, 495/495 Node tests, 22/22 workerd, 72 circuitos navegador, 144 transiciones, HTTP 30/30, 4/4 mutaciones dirigidas, Lighthouse 93/100 móvil/escritorio, LCP móvil 3088.16ms. Reproducibilidad: dos compilaciones independientes con manifiestos idénticos. Rights/SBOM: 4 recursos seleccionados pendientes de revisión individual; NO-GO. Evidencia de ejecución 46101010107, 46101010044, 46101009939, 46101010017, 46101009997. Esta revisión añade paginación keyset del panel y ensayo de cierre/reapertura en D1 efímera; nueva CI requerida (496 pruebas Node y 23 checkpoints esperados). El endpoint JSON de cola anterior conserva su contrato limitado; no exponerlo como segunda interfaz operativa. Sin nuevas dependencias, sin modificaciones públicas ni cambios del Worker default.

## Separación de entornos y activación (configuración externa, no realizada)
| Elemento | Staging aislado | Producción |
| --- | --- | --- |
| Origen | https://contacto-staging.desset.lat (propuesto) | https://contacto.desset.lat (propuesto) |
| D1 | Nueva DB exclusiva, datos ficticios | Nueva DB exclusiva, sin importar staging |
| Access y MFA | Aplicación y audiencia exclusivas, identidades aprobadas para pruebas | Aplicación y audiencia exclusivas, roster real aprobado |
| Turnstile y limitación | Claves y bindings exclusivos | Claves y bindings exclusivos |
| Runtime | Mantener staging cerrado por defecto; requiere revisión de entrypoint y política de pruebas aislada | Default bloqueado; habilitación mediante revisión y aprobación explícitas |
| Correo y alertas | Destinos de prueba autorizados | Buzón institucional y responsables aprobados |
| DNS / despliegue | Autorización independiente | Autorización independiente |

No reutilizar IDs, claves, roster, cookies de sesión ni datos entre entornos. El candidato de integración dispone de una migración exclusiva runtime-staging.sql, composición privada staging-candidate.mjs y composición production-candidate.mjs, con ambas exportaciones por defecto bloqueadas. El formulario administrado reutiliza la plantilla institucional, con transporte, timeout y verificación del recibo; el proveedor real, la conexión pública y la recuperación tras recarga requieren validación alojada. Ver [ACTIVATION-INTEGRATION.md](ACTIVATION-INTEGRATION.md). Accesibilidad física, entrega/respuesta, backups y reversión alojada requieren evidencia previa a activar. No se habilita recepción por marcar un documento.

## Punto de salida
Tras CI exacto y revisión del diff, conservar el candidato cerrado y congelar la preparación local. No más microfases de expansión. Los 14 gates de activation-readiness.json continúan PENDING: no son pruebas ya aprobadas ni autorizaciones. Antes de despliegue, resolver los requisitos externos y los cambios de integración explícitos arriba, repetir CI exacto, conservar evidencias y obtener autorización separada de merge, despliegue y recepción. Seguir ACTIVATION-HANDOFF.md y CONTACT-OPERATING-PROCEDURE.md. La prueba de cierre/reapertura es local, no rollback de infraestructura real.
