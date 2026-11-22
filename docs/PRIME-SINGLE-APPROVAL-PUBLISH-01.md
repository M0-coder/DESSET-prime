# DESSET Prime — una sola aprobación humana para publicar

## Decisión
La única autorización humana de producción es **Review deployments → Approve and deploy** del entorno protegido de GitHub Actions `desset-prime-production`. Este entorno debe mantener al menos un **required reviewer** y la restricción a `main`. Las variables anteriores `DESSET_PRIME_RELEASE_ENABLED`, `DESSET_PRIME_VISUAL_APPROVED_SHA`, `DESSET_PRIME_RIGHTS_APPROVED`, `DESSET_PRIME_CONTACT_APPROVED`, `DESSET_PRIME_SECURITY_APPROVED`, `DESSET_PRIME_ROLLBACK_BACKUP_APPROVED` y `DESSET_PRIME_INDEX_APPROVED` **ya no son utilizadas por el workflow de publicación**; se podrán retirar manualmente desde Settings una vez verificado el despliegue, sin modificar secretos ni el entorno.

## Procedimiento operativo
1. Preparar cambio y PR; ejecutar el CI del commit propuesto y revisar sus diferencias.
2. Fusionar manualmente después de aprobar el PR. Consultar el **nuevo SHA exacto de 40 caracteres** en `main`.
3. Consultar Cloudflare Pages `desset-institucional` en vivo y obtener `canonical_deployment.id`. El ID de recuperación histórico de `config/prime-release-target.json` **no** reemplaza a este ID actual.
4. Iniciar una sola ejecución **Run workflow** del workflow `prime-manual-publish.yml` desde `main`. El formulario solicita exclusivamente: `release_sha` y `expected_previous_deployment`. Iniciar el workflow es el disparador técnico, **no otra autorización de negocio**.
5. En la ejecución, un revisor autorizado aprueba una sola vez en `desset-prime-production` mediante **Review deployments → Approve and deploy**. Si GitHub no solicita esta aprobación, **NO PUBLICAR**: comprobar las reglas del entorno.
6. Después de esa aprobación, el workflow verifica automáticamente el SHA del checkout, proyecto, dos dominios, estado y ID de producción dos veces, CI/compilación, dependencias, licencias, contactos institucionales, CSP, imágenes, JS, WebGL y hashes del paquete. Debe detenerse ante cualquier incongruencia, sin credenciales de Cloudflare en las primeras etapas.
7. Solo cuando pasen los controles se ejecuta el único `wrangler pages deploy` a `desset-institucional`, rama `release-approved`. Comprobar nuevo SHA de Cloudflare y HTTPS en `desset.lat` y `www.desset.lat`, 404, CSP, recursos y el titular visible.

## Controles que **no** se eliminan
- Solamente `workflow_dispatch` en `main`, sin publicación automática por `push` o PR.
- Revisor humano obligatorio en environment, secreto de Cloudflare restringido a ese environment.
- SHA exacto, UUID de despliegue actual, doble lectura de Cloudflare, concurrencia serializada y rollback manual.
- Política de indexación **fija en NOINDEX**. No hay opción `INDEX` en este flujo; indexar requerirá otro cambio explícito y revisado.
- Pruebas unitarias/contratos y navegador, seguridad de dependencias, reproducibilidad y evidencias. La aprobación de un despliegue no certifica derechos legales ni pruebas en dispositivos físicos; el revisor responde por verificar ese alcance.

## Alcance de ingeniería y límites
Primero fijar alcance: arquitectura, compilación, pruebas unitarias e instrumentadas, cobertura, análisis estático, calidad de CI, seguridad, reproducibilidad, mutation testing, deuda técnica y evidencia de ejecución. Las pruebas automatizadas solo demuestran la cobertura instrumentada y registrada; no inventar alcance real.

**NO AUTO-MERGE. NO DEPLOY NI DNS EN ESTE PR. NO MODIFICAR SECRETOS, VARIABLES NI REGLAS DEL ENTORNO AUTOMÁTICAMENTE.** Un PR fusionado genera un SHA nuevo y jamás equivale a aprobación de publicación.
