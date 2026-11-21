# PRIME-NATIVE-HOSTING-01 — reemplazo del experimento con DESSET Prime

**Decisión del titular:** `M0-coder/DESSET-prime` es el proyecto original/definitivo. El repositorio `M0-coder/DESSET` aloja un experimento antiguo que se sustituirá; no es fuente de diseño ni dependencia para compilar o publicar Prime. Este PR está basado en el SHA visual `fcac31dafa51c80b6d03ab8569cb7cef211c3719` del PR #11 de Prime. **No modifica la web pública.**

## Alcance antes de actuar

Arquitectura, compilación, pruebas unitarias e instrumentadas, cobertura del código productivo, análisis estático, calidad CI, seguridad, reproducibilidad, mutation testing, deuda técnica y evidencia ejecutable. No declarar cobertura global ni móviles físicos probados sin datos. La web será **institucional**; las transacciones pertenecen a aplicaciones DESSET. Las aplicaciones todavía no están publicadas.

## Implementación en el repositorio correcto

`scripts/prime-hosting-candidate.mjs` solo lee `dist/` generado por el propio Prime con `npm run build:site`. Verifica el manifiesto, SHA-256 de los archivos, logo, tres fotografías distintas, GLB, CSP, noindex y estado de tiendas. Rechaza archivos añadidos, symlinks, manipulaciones y banderas o credenciales de publicación.

Después copia los 30 archivos del sitio original a una **carpeta temporal nueva** y añade SOLO para ensayo tres recursos: `robots.txt` con `Disallow: /`, un `sitemap.xml` vacío y `404.html`. El HTML de salida conserva el diseño y añade exclusivamente `canonical` y `og:url` para `https://desset.lat/`. Se mantienen los activos originales byte a byte; no se copia el manifiesto interno al directorio público. El archivo de evidencias y hashes permanece fuera de la raíz servida.

**Resultado de ensayo sobre artefacto real de PR #11:** 33 archivos, 2.377.372 bytes, 10/10 pruebas Node PASS en local, `release_decision: NO-GO` y `release_authorized: false`. GitHub CI de este PR debe corroborarse por SHA separado.

## Pruebas en el repositorio Prime

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run build:site
node --test tests/prime-hosting-candidate.test.mjs
DESSET_PRIME_HOSTING_MODE=LOCAL_REHEARSAL_ONLY node scripts/prime-hosting-candidate.mjs "$(pwd)/dist" "$(git rev-parse HEAD)"
```

El workflow `preview-checks.yml` existente empaqueta `dist/` antes de ejecutar `tests/*.test.mjs`, por lo que incorpora automáticamente las 10 pruebas nuevas sin necesitar permisos de publicación.

**Limitación:** el script acepta un SHA de 40 caracteres pero NO comprueba criptográficamente que corresponda al checkout. Esa procedencia se tiene que validar con GitHub/CI en el release final.

## Camino al reemplazo real

1. Mantener PR como **DRAFT** mientras CI y QA visual confirman los cambios. Preservar fotografías y diseño aprobados de PR #11.
2. Preparar en Prime un PR independiente de **release manual**, sin depender de los 13 archivos del repositorio viejo, con control SHA, inventario, HTTPS, cabeceras CSP, noindex/indexación expresamente elegida, políticas `robots`/`sitemap`, smoke HTTPS y rollback por deployment ID.
3. Revisar titularidad del logo/fotos/canales de contacto y completar seguridad SAST/SCA/SBOM, licencias, accesibilidad manual, Android/iOS físicos y doble build reproducible.
4. Comprobar destino Cloudflare `desset-institucional` en SOLO LECTURA. Solo después de aprobación específica por SHA se podrá ejecutar merge **y por separado** la publicación manual, sin modificar DNS. Comprobar sitio público y rollback.
5. Una vez Prime ocupe `desset.lat` y exista respaldo verificable, el titular podrá decidir el destino del repositorio experimental.

Los PR #63 y #64 del repositorio experimental quedan **supersedidos como camino de entrega**, no se deben fusionar. No hemos borrado ni alterado el repositorio antiguo.

**RESTRICCIONES:** NO MERGE · NO AUTO-MERGE · NO DEPLOY · NO RELEASE · NO DNS · NO CLOUDFLARE · NO ELIMINAR RAMAS/REPOSITORIOS.
