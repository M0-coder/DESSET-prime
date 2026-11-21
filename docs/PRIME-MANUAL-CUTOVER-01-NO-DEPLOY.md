# DESSET Prime — CUTOVER-01 · publicación manual en Cloudflare Pages (sin ejecución)

**Estado: DRAFT / NO DEPLOY.** La web original y definitiva se desarrolla exclusivamente en `M0-coder/DESSET-prime`. `M0-coder/DESSET` es el experimento antiguo, NO se importan sus HTML/CSS, logos ni scripts. El sitio institucional definitivo reemplazará al experimento en `desset.lat` **solo con autorización nueva de publicación por SHA exacto**.

## 1. Arquitectura

- Origen: `DESSET-prime`, rama `main` **únicamente tras autorización y revisión final del PR canónico #24, por SHA exacto**. `main` contiene solo README hasta que exista merge aprobado. No fusionar PRs históricos encadenados por inferencia.
- Destino: proyecto existente **Cloudflare Pages Direct Upload** `desset-institucional`; rama interna de producción `release-approved`; dominios `desset.lat` y `www.desset.lat`, sin cambios DNS.
- Referencia actual de recuperación: despliegue `b107eff2-6511-4e04-a780-fbd28e93e4e9`; SHA experimental `9f48d62cdadb43135fc9c2072cdc9e31f695c9ab`. Ambos se **vuelven a verificar EN VIVO** en la futura ventana de publicación. Si cambian, NO-GO hasta actualizar la autorización.
- `.github/workflows/prime-manual-publish.yml`: PR = **pruebas únicamente**; producción = `workflow_dispatch` exclusivamente sobre `main`. La operación requiere bandera **desactivada por defecto**, confirmación literal, SHA exacto, aprobaciones institucionales, entorno GitHub protegido, preflight Cloudflare y token de acceso limitado a Pages.
- `scripts/prime-manual-cutover-package.mjs`: genera los 34 archivos del paquete de publicación (33 de la copia verificada más `THIRD-PARTY-NOTICES.txt` con los textos completos MIT de las dependencias instaladas) desde la compilación nativa Prime sin incorporar archivos del experimento. Los únicos archivos originales modificados respecto a la copia de ensayo son `index.html`, `_headers`, `robots.txt` y `sitemap.xml`; el logo, las fotos, Three.js, GLB y JS permanecen intactos. `scripts/verify-prime-manual-package.mjs` verifica SHA-256 de todos los archivos.

## 2. Controles previos al release: requeridos pero NO configurados en este PR

Antes de **habilitar** el workflow manual debe comprobarse en GitHub:
- Entorno `desset-prime-production` con **revisores requeridos**, acceso restringido a rama `main` y, cuando corresponda, sin autoaprobación. La declaración `environment:` por sí sola NO crea una regla de aprobación.
- Secreto del entorno `CLOUDFLARE_API_TOKEN` con **mínimo alcance de Pages Edit para este proyecto**. No insertar tokens en archivos ni variables visibles.
- Variable de repositorio `DESSET_CF_ACCOUNT_ID` igual al ID congelado en `config/prime-release-target.json`. No cambiar la cuenta sin un PR revisado.
- Las siguientes variables **deben permanecer vacías o en false hasta autorización expresa**: `DESSET_PRIME_RELEASE_ENABLED`, `DESSET_PRIME_RIGHTS_APPROVED`, `DESSET_PRIME_CONTACT_APPROVED`, `DESSET_PRIME_SECURITY_APPROVED`, `DESSET_PRIME_ROLLBACK_BACKUP_APPROVED`, `DESSET_PRIME_INDEX_APPROVED`. `DESSET_PRIME_VISUAL_APPROVED_SHA` debe contener exactamente el SHA final revisado.
- Alcance de aceptación: arquitectura y compilación, pruebas unitarias e instrumentadas, cobertura real productiva, SAST/SCA/SBOM, licencias, calidad CI, reproducibilidad de compilaciones independientes, mutation testing de funciones relevantes, deuda técnica, accesibilidad manual, móviles físicos y evidencia por SHA. CI verde no certifica todo lo anterior.
- Capturar respaldo íntegro del sitio experimental y verificar que el despliegue anterior sigue elegible para rollback. Cloudflare conserva versiones según su política de retención, que no equivale a una garantía de archivo perpetuo. No eliminar el repositorio antiguo antes de documentar y conservar este respaldo.


- Los cinco enlaces sociales (Instagram, Facebook, TikTok, YouTube y X) constan como **declarados por el titular** en `config/prime-social-owner-attestation.json`, cada uno con URL exacta y `data-channel-basis="owner-attested"`. **No existe prueba independiente de acceso administrativo**. El workflow debe bloquear cambios no declarados y jamás confundir esta declaración con verificación de plataforma.
- El workflow de PR ejecuta dos compilaciones desde árboles limpios y compara bit a bit los manifiestos SHA-256 del sitio original. Esta evidencia no sustituye pruebas en iOS/Android físicos.
- Se distribuye `THIRD-PARTY-NOTICES.txt` con las licencias completas de Three.js y esbuild, sin alterar el logotipo, fotografías, SVG ni GLB originales.

## 3. Ejecución futura — SOLO tras autorización de merge y release independientes

La acción manual solicitará exactamente:
- `release_sha`: SHA de 40 hexadecimales, igual al HEAD de `main` autorizado, sin checkout de merge sintético.
- `expected_previous_deployment`: UUID verificado del despliegue público que se va a reemplazar.
- `confirmation`: `PUBLICAR_PRIME_DESSET`.
- `seo_policy`: `NOINDEX` o `INDEX`. **INDEX** exige aparte `DESSET_PRIME_INDEX_APPROVED=true`; no habilitar indexación antes de cerrar derechos, privacidad, canales e identidad comercial.

La rutina verifica identidad del commit; compila y audita el código del repositorio Prime; ejecuta los contratos y pruebas de navegador; genera un paquete con hashes; comprueba los dominios, el proyecto, la rama y el ID anterior de Cloudflare; comprueba de nuevo el ID justo antes de la mutación; y usa un comando manual `wrangler pages deploy` sobre el proyecto Pages existente. Después verifica SHA desplegado, HTML, HTTPS, CSP, recursos estáticos, robots/sitemap, ambos dominios y error 404. No toca DNS.

**No hay activación automática:** aunque el PR se aprobara en el futuro, sin la orden manual, las variables, las protecciones y el secreto correspondiente, la rama de publicación no procede. Este PR no configura ninguna variable, entorno ni secreto.

## 4. Recuperación: procedimiento manual, nunca adivinado

Si falla el smoke **después** de una publicación, no ejecutar automáticamente una segunda operación. Obtener el SHA/ID actual de Cloudflare y confirmar si existe intervención concurrente. Si la versión problemática todavía es la actual, el operador autorizado puede:

1. Abrir Cloudflare Pages, `desset-institucional`, **Deployments**, seleccionar el despliegue previo confirmado y usar **Rollback**; o llamar al endpoint oficial con token autorizado y ID validado:
   `POST /accounts/{account_id}/pages/projects/desset-institucional/deployments/{previous_deployment_id}/rollback`.
2. Verificar de nuevo `desset.lat`, `www.desset.lat`, HTTP, headers y recursos.
3. Conservar hashes y logs del fallo; no borrar despliegues ni ramas.

**Riesgo residual:** el chequeo GET antes de desplegar NO es una operación atómica de compare-and-swap; una publicación desde otro repositorio o consola durante la misma ventana podría producir un conflicto. Exigir ventana de mantenimiento sin otros operadores, revisar y suspender pipelines experimentales con autorización, y verificar dos veces en Cloudflare.

## 5. Alcance de este PR

Permite **probar el mecanismo y sus negativas** en CI, no ejecutar una publicación. Este PR no modifica archivos visuales de DESSET Prime ni `main`, Cloudflare, DNS, tokens, variables, entornos, releases o repositorios existentes.

**Decisión actual: NO-GO para publicación**, pendiente de aprobación técnica, visual, institucional y de despliegue por SHA exacto. Ver también `docs/PRIME-WORK-RELEASE-HANDOFF-2026-11-21.md` para el inventario observado en vivo y el traspaso operativo a Work.

Fuentes técnicas:
- [Cloudflare Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Wrangler Pages deploy](https://developers.cloudflare.com/workers/wrangler/commands/pages/)
- [Rollback de Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/rollbacks/)
- [GitHub environment protection](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)

### Evidencia privada de administración para la publicación

La persona que revisa la evidencia contrasta las cinco URL de `config/prime-social-owner-attestation.json` con el perfil y un control de administración visible en la sesión autenticada de cada plataforma. Para un enlace compartido de Facebook debe comprobar también a qué página conduce. Conserva las pruebas en privado y calcula el SHA-256 de cada archivo original. Si una cuenta carece de prueba, deja la revisión pendiente.

Una vez comprobadas las cinco cuentas, guarda el acta como secreto de entorno `DESSET_CHANNEL_ADMIN_REVIEW` en `desset-prime-production`. El acta JSON contiene `schema` igual a `desset-prime-channel-admin-review-v1`, `repository` igual a `M0-coder/DESSET-prime`, el `source_sha` completo de main, `reviewer`, `reviewed_at` en UTC y `channels` con cinco entradas. Cada entrada contiene `platform`, la `url` exacta que se publica, `method` igual a `authenticated-admin-control-observed` y el `evidence_sha256` de la prueba revisada. El administrador del entorno custodia el acta. El workflow comprueba su alcance y consistencia; la comprobación de la prueba original corresponde a la persona que la revisa. Los resultados de CI de un PR siguen usando exclusivamente la declaración pública. La aprobación final de despliegue es independiente.
