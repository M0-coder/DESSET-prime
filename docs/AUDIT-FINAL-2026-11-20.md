# DESSET Prime — AUDIT-FINAL · dictamen técnico e institucional
**Fecha de auditoría:** 2026-11-20 (Perú).
**Candidato visual:** `M0-coder/DESSET-prime` PR #11, SHA exacto `fcac31dafa51c80b6d03ab8569cb7cef211c3719`.
**Repositorio oficial de publicación:** `M0-coder/DESSET`, rama `main` observada en `9f48d62cdadb43135fc9c2072cdc9e31f695c9ab`.
**Resultado:** **PASS técnico de CI del candidato; NO-GO para fusionar o sustituir producción**.
**Intervención:** SOLO LECTURA sobre código y CI existentes, y esta documentación en una rama separada. NO MERGE, NO AUTO-MERGE, NO RELEASE, NO DEPLOY, NO DNS, NO CLOUDFLARE, NO INDEXACIÓN.

## 1. Alcance y fuente verificable
Auditoría de arquitectura, compilación, pruebas unitarias e instrumentadas, cobertura, análisis estático, CI, seguridad, reproducibilidad, mutation testing, deuda técnica, identidad, accesibilidad, rendimiento y preparación de migración de la web institucional. La web no procesa pedidos ni pagos; la operación comercial pertenece a aplicaciones futuras.

Evidencia primaria: [CI exacto #44838906681](https://github.com/M0-coder/DESSET-prime/actions/runs/44838906681), [candidato PR #11](https://github.com/M0-coder/DESSET-prime/pull/11), [artefactos y capturas](https://github.com/M0-coder/DESSET-prime/actions/runs/44838906681/artifacts/14680420212), [Lighthouse](https://github.com/M0-coder/DESSET-prime/actions/runs/44838906681/artifacts/14680060749), [workflow oficial](https://github.com/M0-coder/DESSET/blob/9f48d62cdadb43135fc9c2072cdc9e31f695c9ab/.github/workflows/cloudflare-pages-production.yml).

**Límites:** no consulta en vivo a Cloudflare ni inspección del navegador de un dispositivo físico, sin pentest externo, sin verificación registral o legal, sin comparar todos los frames con Figma y sin certificar titularidad de canales sociales. Los resultados HTTP se refieren a un servidor local de CI, no a los dominios públicos.

## 2. Cadena de cambios y separación forense
`PR #2 (77d225d9) → PR #7 (584e7857) → PR #8 (27bd5adc) → PR #9 (8773d302) → PR #10 (eb7da198) → PR #11 (fcac31da)`.

Las comparaciones Git muestran que PR #11 está **13 commits por delante y 0 detrás** de la referencia de diseño PR #2, con **31 rutas netas modificadas**. Ninguno de los PR #7–11 se ha fusionado; permanecen abiertos y DRAFT. El candidato no incorpora la línea lateral de copy PR #3 ni los experimentos RENDER PR #4–6. El PR #12 (PERF-01) también está **excluido** y su rama separada; fue identificado como experimento sin mejora de LCP demostrada.

El repositorio de Prime parte de una base antigua de su propio `main`: el candidato está **319 commits ahead / 0 behind** del `main` de Prime. Eso NO lo convierte en un release del repositorio oficial `M0-coder/DESSET`; son repositorios distintos. No aplicar los PR en producción mediante un merge automático entre repositorios.

## 3. Evidencia técnica — misma revisión exacta de PR #11
| Control | Evidencia verificada | Dictamen |
|---|---|---|
| CI | `source-check` y `lighthouse-local-lab`, 2/2 SUCCESS | PASS |
| Build/package | 30 archivos, 2 376 763 B, 3 GLB validados; `dist/site-manifest.json` con SHA-256 por archivo | PASS dentro del pipeline |
| Pruebas Node | **119/119** ejecutadas y PASS | PASS en alcance de contratos |
| Chrome real en CI | 6 estados, 25 capturas, navegación y movimiento reducido | PASS automatizado |
| GPU | **32/32** controles WebGL2 en fuente y **32/32** en `dist/`, SwiftShader, 16 812 triángulos | PASS en software, NO hardware físico |
| HTTP fuente y `dist/` | **17/17** controles por ejecución; CSP, noindex, MIME, prohibición de rutas | PASS local |
| Integración observacional | Preflight 10/10; el propio informe indica **publicación NO-GO** | PASS técnico / NO-GO release |
| Estática | 24 referencias de activos, 0 incidencias del scanner | PASS scanner limitado |
| Mutación | 4/4 mutantes preseleccionados eliminados | PASS smoke, NO es puntuación global |
| Lighthouse móvil | Performance 98, accesibilidad 100, buenas prácticas 100, LCP 2328,89 ms, CLS 0 | PASS laboratorio |
| Lighthouse escritorio | Performance 100, accesibilidad 100, buenas prácticas 100, LCP 725,67 ms, CLS 0 | PASS laboratorio |

**Aclaración imprescindible sobre cobertura.** La línea `# all files | 99.89% statements | 88.52% branches | 99.53% functions` procede de `node --experimental-test-coverage --test tests/*.test.mjs` y el extracto lista principalmente `*.test.mjs`. **No** acredita 99,89 % de cobertura global de la aplicación ni del bundle Three.js; falta instrumentación de código productivo y un umbral de cobertura pertinente. Los 4 mutantes se limitan a contratos V5 específicos.

**Aclaración de reproducibilidad.** El lockfile y `npm ci --ignore-scripts` fijan resolución de dependencias, y el manifiesto comprueba el contenido de una ejecución. No se verificaron **dos compilaciones independientes sobre la misma revisión con comparación bit a bit**, ni está firmado criptográficamente el manifiesto SHA-256. No declarar firma de software o build universalmente reproducible.

## 4. Hallazgos priorizados y bloqueantes
| ID | Riesgo | Severidad | Hecho comprobado / consecuencia | Acción exigida |
|---|---|---|---|---|
| AF-01 | Empaquetado incompatible | **P0 BLOQUEANTE** | Prime genera **30 archivos**; workflow oficial exige exactamente **13** y compara `styles.css` + `styles-compact.css` versionados, texto HTML histórico y activos de publicación anteriores. No sirve copiar `dist/` ni ejecutar el workflow actual sin adaptación | PR de migración **en el repositorio oficial**, inventario cerrado nuevo, hashes, controles negativos y rollback |
| AF-02 | Autorización visual inexistente para relevo | **P0 BLOQUEANTE** | Base aprobada oficial `DESSET-V12-CONTACT-2026-11-17`; su workflow y README requieren comentario de propietario verificable con **SHA-256 exacto del diseño**. CI de Prime no equivale a esa aprobación | Obtener revisión visual formal de la versión consolidada y autorización vinculada a SHA |
| AF-03 | Política de indexación y archivos de sitio distintos | **P0 BLOQUEANTE** | Prime deliberadamente lleva `noindex,nofollow`, carece de `robots.txt` y `sitemap.xml` en su paquete; release oficial exige ambos, canonical/HTTPS y smoke público | Definir política SEO institucional y adaptar solo mediante PR/consentimiento de release, no quitar noindex prematuramente |
| AF-04 | Captación y canales no certificados | **P1 ALTA** | Los tres enlaces de Instagram/X/Facebook conservan `data-channel-review="pending"`. CTA de negocio lleva a contacto, cuya vía principal es Instagram pendiente de titularidad. No existe contacto institucional verificable | Verificar propiedad/uso legal y privacidad; preferir canal formal aprobado o mensaje prudente sin inventarlo |
| AF-05 | Derechos de marca y fotografía / legal | **P1 ALTA** | Las tres nuevas fotos se documentan como aportadas por el titular; el logo tiene blob Git idéntico al oficial: `fa6cb4ea5c5331c4cf47dfd157214e972f809356`. Esto no sustituye las constancias formales de derechos de imagen, software, marca y uso comercial | Expediente de procedencia/cesiones/autorizaciones, personas sintéticas explícitas y revisión legal |
| AF-06 | Accesibilidad y hardware sin validar | **P1 ALTA** | Chrome automatizado / Lighthouse y SwiftShader PASS, pero no hay ensayos auditados de Android físico, Safari iOS, 4G, batería, zoom 400 %, lector de pantalla o teclado completo con evaluación humana | Matriz física y WCAG manual; registrar defectos por dispositivo |
| AF-07 | Seguridad de la cadena de suministro incompleta | **P1 ALTA** | Prime tiene CSP y permisos GitHub `contents:read`, acciones fijadas a SHA, `npm ci` con lockfile. No corre SAST/SCA completo, SBOM, auditoría de licencias ni análisis automatizado de vulnerabilidades; `npm --no-audit` no reemplaza SCA. Lighthouse `npm exec --yes --package=lighthouse@12.8.2` sin lock de transitive deps | Integrar SAST/SCA, SBOM, licencias y evidencia de dependencias del toolchain, antes del PR oficial |
| AF-08 | Cobertura y mutación insuficientes para aseverar «extremo a extremo» | **P2 MEDIA** | Cobertura Node concentrada en tests y mutación 4/4 dirigida, no global. End-to-end de Chrome sí existe pero no hace pruebas de campo | Cobertura del código real, umbrales y mutaciones del código crítico |
| AF-09 | Deuda CSS acumulada | **P2 MEDIA** | Cinco hojas de estilo: `styles.css` 44 221 B, `styles-v5.css` 14 519 B, `styles-system.css` 8 277 B, `styles-hero-photo.css` 8 516 B y `styles-visual02.css` 4 838 B: **80 371 B** de CSS fuente. Estratos de reglas y excepciones | Revisar cascada por selectores, no refactor masivo antes de visual diff |
| AF-10 | Rendimiento no mejorado por PERF-01 | **P2 MEDIA** | PR #12 final en DRAFT presenta 97 móvil / LCP 2483,60 ms vs PR #11 98 / 2328,89 ms. Intento de lazy-load del póster rompió el contrato WebGL y fue revertido | Excluir PR #12 de integración; mediciones repetidas y en dispositivos físicos |
| AF-11 | Evidencia temporal y snapshot histórico | **P2 MEDIA** | Capturas de PR #11 expiran **2026-12-04 ~23:45 UTC**. `config/v55-production-snapshot.json` fue capturado 2026-11-19, no implica estado Cloudflare actual. GitHub oficial `main` fue observado en `9f48d62...`, coincidente con el snapshot; **no** verifica deploy vivo | Preservar evidencias y consultar Cloudflare real en el preflight final |
| AF-12 | Diferencia de experiencia frente a web aprobada | **P2 MEDIA** | Web oficial previa usa Bento compacto, sin scroll; Prime usa web editorial con navegación vertical y 3D opcional. No son intercambiables sin aprobación de diseño y comportamiento | Aprobación de experiencia desktop/móvil + comparación con baseline oficial |

## 5. Controles que sí resisten el análisis
- El logotipo de Prime coincide con el blob Git de producción y baseline visual aprobado; los 3 WebP del recorrido son **diferentes** y su integridad se verifica con SHA-256. No se ha reutilizado la portada como tres recortes.
- El sitio comunica «representación conceptual», **no** afirma operaciones activas; estado de aplicaciones `not_published` y URLs de tiendas no verificadas impiden presentar descargas inexistentes.
- Protección local: CSP `default-src 'self'`, `object-src 'none'`, `form-action 'none'`, `frame-ancestors 'none'` en `_headers`, servidor exclusivamente loopback, denylist de rutas no públicas, sin formularios de pedidos/pagos y marcado noindex.
- WebGL se inicia por decisión de la persona; se comprueba la presencia del póster antes del consentimiento, carga de 3 GLB, controles, fallback y modo reducido. El PR #12 probó y confirmó que retrasar ese póster causa una regresión; se dejó fuera.
- CI tiene permisos de GitHub de lectura y carece de pasos de despliegue o secretos de Cloudflare. Las acciones críticas están referenciadas por SHA completo.

## 6. Plan de salida: secuencia con controles y permisos separados
1. **AUDIT-FINAL cerrado con NO-GO**: congelar PR #11 como referencia exacta y este dictamen; no fusionar PR #12. Descargar/retener capturas antes de su caducidad.
2. **LEGAL / CANALES**: confirmar marca/logo/fotos y el canal de contacto válido. No inventar actividad o descargas.
3. **HARDENING**: SAST/SCA/SBOM/licencias, pruebas WCAG manuales, Android y Safari físico, redes móviles, estabilidad de GPU y doble build con verificación bit a bit.
4. **INTEGRATION-01 (PR oficial separado)**: migrar la web de `DESSET-prime` al repositorio `M0-coder/DESSET` **sin sobrescribir automáticamente la versión pública**, reescribir los contratos de empaquetado y publicación (30 recursos, CSS y rutas), y actualizar los tests / snapshot visual únicamente tras aprobación exacta.
5. **STAGING / RELEASE-GATE**: QA independiente contra artefacto final, HTTPS, canonical/robots/sitemap, noindex según política autorizada, comparación visual con baseline vigente, live Cloudflare observacional y plan de rollback por deployment ID / SHA.
6. **RELEASE SOLO CON AUTORIZACIÓN NUEVA**: merge por SHA exacto y despliegue `workflow_dispatch` como actos independientes. Hasta entonces **NO-GO**.

## 7. Gobierno de esta auditoría
**Este documento es un registro de evidencia, NO una autorización de cambios.** Se añade como único archivo en un PR de auditoría DRAFT con base PR #11. No modifica HTML, CSS, scripts, fotos, 3D, workflows, dominio o sitio oficial.
