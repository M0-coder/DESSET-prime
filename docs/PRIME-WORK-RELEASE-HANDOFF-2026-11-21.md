# DESSET Prime — entrega operativa a ChatGPT Work (NO MERGE / NO DEPLOY)
Fecha de observación: 2026-11-21. Fuente de código/diseño: `M0-coder/DESSET-prime`, PR #24 (`integration/prime-canonical-official-candidate-v1-no-deploy`). Base observada de `main`: `ec6899d56a4befefea0402e9cca7419d3dca5e7e` (solo README). SHA de código auditado antes de agregar este documento: `ec8aad2282ff9a05e3d6560849dc4d91c6d6bc8f`. **El SHA definitivo debe consultarse de nuevo; nunca autorizar uno anterior por comodidad.**

## Objeto y límites de la delegación
Preparar la sustitución de la web temporal por el **diseño original de DESSET Prime** en el proyecto Cloudflare Pages EXISTENTE `desset-institucional`, conservando ambos dominios `desset.lat` y `www.desset.lat`, sin copiar código ni diseño de `M0-coder/DESSET`. La web es institucional: pedidos, pagos, login y operaciones pertenecen a las apps y no deben simularse. No cambiar identidad, fuente, logo, fotografías, animaciones, disposición o 3D sin aprobación de diseño basada en diferencias medibles.

Hasta autorización explícita posterior: **NO squash/merge, NO release, NO despliegue real ni preview público, NO modificar DNS, NO Cloudflare write, NO activar indexación ni pipelines automáticos, NO borrar ramas/repositorios ni desactivar la web actual**. La autorización para preparar y diagnosticar no es aprobación empresarial para publicar.

## 1. Fuente y estado observado en GitHub
- PR canónico: https://github.com/M0-coder/DESSET-prime/pull/24. Se encuentra DRAFT/OPEN, no fusionado.
- Baseline del paquete reciente: HTML estático con fuentes WOFF2 alojadas localmente, Six CSS, Three.js 0.187.0 + 3 modelos GLB, cierre visual de la portada sin texto superpuesto, sin checkout remoto.
- Tests automatizados: Node source-contracts, HTTP, browser QA a 320/390/768/1024/1440 px, WebGL2 SwiftShader (no hardware físico), SPDX/SCA/mitigaciones, dos compilaciones independientes, cuatro mutantes dirigidos (NO es mutation testing global).
- Estado del último CI antes de este expediente: source-check, derechos/SBOM, preflight y gate offline exitosos. Lighthouse móvil presentó **84/100 rendimiento, LCP 2708 ms, TBT 443 ms y CLS 0**; escritorio 99/100, LCP 910 ms. Falló la compuerta mínima móvil 85; el job se solicitó repetir para aislar variabilidad. No bajar umbrales sin justificación y aprobación.
- Los hashes en site-manifest son controles de integridad, **no firmas criptográficas** ni demostración suficiente de propiedad intelectual.
- `main` carecía de protección de rama al observar el repositorio; confirmar reglas efectivas en GitHub, revisores, entornos y permisos.

## 2. Cloudflare — comprobación AUTENTICADA y SOLO LECTURA de 2026-11-21
Proyecto Pages: `desset-institucional`, subdominio `desset-institucional.pages.dev`, rama producción `release-approved`.
- Despliegue `latest` y `canonical`: `b107eff2-6511-4e04-a780-fbd28e93e4e9`, estado SUCCESS, SHA registrado `9f48d62cdadb43135fc9c2072cdc9e31f695c9ab`.
- `desset.lat` y `www.desset.lat`: dominios personalizados con estado activo.
- Ambos DNS son CNAME con proxy a `desset-institucional.pages.dev`.
- Revalidar todos estos hechos inmediatamente antes de publicar; los datos son una foto y no una reserva inmutable. La API de Cloudflare no valida por sí sola el contenido HTTP visto por usuarios ni que exista un respaldo autónomo.
- **No crear otro proyecto ni tocar DNS.** Sustituir en el mismo Pages, con despliegue por hash y rama `release-approved`, únicamente tras aprobación separada.

## 3. Checklist de preparación que Work puede ejecutar SIN autorización de producción
1. Revalidar HEAD y diff completo del PR #24 frente a `main`. Auditar arquitectura, compilación, unitarias/instrumentadas, cobertura, análisis estático/SAST, calidad CI, SCA/SBOM, derechos, reproducibilidad, mutation testing, deuda técnica y evidencia de ejecución **sobre el SHA final**.
2. Investigar Lighthouse móvil usando `reports/lighthouse/mobile.json` del workflow `44892075043` y sus reruns: 443 ms TBT, seis CSS bloqueantes, imagen hero LCP; repetir en runner de capacidad comparable. No atribuir a código una oscilación del runner sin A/B y medianas. Corregir solo problemas demostrados, sin pérdida visual.
3. Comparar con Figma original https://www.figma.com/design/cUGTTGlTB05xiKLL8NGcwG — Website Final, Website Responsive Final, Design System Production, Asset Library — y guardar diff visual de escritorio/móvil y estados (menu, accordions, 3D, reduced-motion, fallback). Si no hay acceso o baseline aprobado, marcar **NO VERIFICADO**, no inventar paridad.
4. Probar Safari/iOS y Chrome/Android reales, teclado/lector de pantalla, zoom al 200%, sin scroll horizontal, latencia móvil y falla de WebGL. Registrar dispositivo, sistema, navegador, versión y captura.
5. Comprobar por acceso administrativo autorizado los cinco perfiles declarados (Instagram, Facebook, TikTok, YouTube, X). Están etiquetados como `owner-attested`; no equivalen a validación independiente. No añadir otros enlaces inventados.
6. Confirmar situación legal, privacidad, datos de empresa y derechos de todos los activos con el titular. Si no existe documentación o empresa registrada, no simular RUC, razón social o aviso legal definitivo. Confirmar explícitamente política SEO `NOINDEX` o `INDEX`, sin elegir `INDEX` por defecto.
7. Completar respaldo autónomo del despliegue anterior, hashes y prueba de recuperación; asegurar que el rollback funciona y comprobar su retención. No borrar el repositorio/web temporal.
8. Inspeccionar que las protecciones de rama `main`, environment `desset-prime-production`, secreto con mínimos permisos de Pages y variables de aprobación existen y funcionan; dejar flags de release en FALSE. Nada de exponer valores secretos.
9. Ejecutar **offline** `npm ci --ignore-scripts`, `npm run build:site`, `npm run verify:site`, `npm test`, `npm audit --audit-level=high`, los gates HTTP/browser/GPU, y los verificadores de packaging manual con evidencias por SHA. Comprobar dos compilaciones bit a bit iguales y archivo `THIRD-PARTY-NOTICES.txt`.
10. Redactar dictamen PASS/FAIL/NO-GO por área, link a evidencias, riesgos residuales y siguiente autorización exacta. No cerrar un riesgo sin evidencia real.

## 4. Secuencia de publicación FUTURA: nunca automática
**Gate A — autorizar integración:** presentar PR #24, SHA final, diff, revisiones y CI completo; obtener consentimiento separado para squash/merge. Tras el merge, `main` tendrá un SHA propio: reejecutar íntegro y autorizar explícitamente ese **SHA real**.

**Gate B — autorizar publicación y SEO por separado:** validar backup restaurable y despliegue vivo previo, ambos dominios, empresas/derechos/avisos, auditorías, verificaciones visuales, políticas SEO y permisos mínimos. Exigir aprobación escrita del titular y ventana controlada. Conservar `DESSET_PRIME_RELEASE_ENABLED=false` si falta un gate.

**Gate C — operador Work/humano autorizado:** solo entonces invocar `.github/workflows/prime-manual-publish.yml` como `workflow_dispatch` desde `main`, con el `release_sha` de 40 caracteres aprobado, `expected_previous_deployment` actualizado, `confirmation=PUBLICAR_PRIME_DESSET` y `seo_policy` aprobado. No activar estas variables por inferencia. El workflow hace preflight y, bajo guardas, el `wrangler pages deploy` al mismo Pages.

**Gate D — verificación posterior:** comparar commit publicado en Cloudflare, HTML/canonical, redirects/HTTPS, CSP, robots/sitemap, assets, 404, CSS, JS, 3 GLB, fuentes, links, responsive y ambos dominios. Si falla tras publicar, detenerse, reevaluar concurrencia, y ejecutar rollback MANUAL al ID previamente aprobado; nunca borrar antes de recuperar.

## 5. Traspaso
Work debe continuar desde el PR #24 y este expediente, demostrar cada PASS con registros verificables, proponer cambios mínimos por rama/commit controlados y solicitar autorización antes del merge, DNS, SEO, publicación, credenciales o rollback. **No confundir todos los workflows verdes con aprobación comercial o legal para publicar.**
