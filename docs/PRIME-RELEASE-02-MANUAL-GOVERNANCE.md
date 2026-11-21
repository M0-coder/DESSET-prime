# DESSET Prime — RELEASE-02: preparación de publicación sin cambiar producción

**Arquitectura correcta:** `M0-coder/DESSET-prime` es el único origen del sitio institucional definitivo. La web de `M0-coder/DESSET` es un experimento en retirada; no participa en el build, pruebas ni paquete de Prime. La sustitución del dominio se hará exclusivamente con un artefacto de Prime, no fusionando CSS o assets del prototipo.

**Estado:** DRAFT / preparación solamente. **NO MERGE, NO AUTO-MERGE, NO DEPLOY, NO DNS, NO RELEASE, NO DELETE, NO ACTIVAR PUBLICACIÓN AUTOMÁTICA.**

## Contratos ya instrumentados

- `config/prime-release-target.json`: destino estricto `desset-institucional`, rama de producción `release-approved`, canonical `desset.lat`, ID histórico de recuperación `b107eff2-6511-4e04-a780-fbd28e93e4e9`; `production_deploy_enabled:false` y nueva autorización obligatoria. Esto es **un snapshot de referencia, no una consulta en vivo en cada build**. Se debe revalidar antes de cualquier publicación.
- `scripts/prime-release-preflight.mjs`: verifica checkout Git por SHA exacto y una referencia Cloudflare conocida; valida manifiesto y hashes de todos los archivos de `dist` y prepara **dos paquetes independientes** mediante la herramienta Prime existente. Compara byte a byte los inventarios, almacena un paquete candidato de 33 archivos en una ubicación nueva y crea el expediente `prime-release-evidence.json`.
- `tests/prime-release-preflight.test.mjs`: pruebas de cambios de SHA, destino, deploy ID, imágenes, archivos inesperados, credenciales y políticas. No se aceptan banderas que autoricen producción.
- `.github/workflows/prime-release-preflight.yml`: CI con permisos GitHub de solo lectura y **sin acceso a ningún secreto Cloudflare ni comandos de despliegue**. Compila desde la fuente de Prime, comprueba SHA del commit real, ejecuta npm audit de dependencias productivas, verificaciones y archiva un candidato no publicable.

El paquete de ensayo conserva la marca, las tres fotografías específicas, el 3D, el contenido institucional y aplicaciones sin publicar. `robots.txt` bloquea indexación, `<meta robots>` indica `noindex,nofollow`, `sitemap.xml` está vacío, y el HTML solo agrega canonical/`og:url` en la COPIA. `audit.json` y el manifiesto de verificación están fuera de la raíz pública. No se autorizan pedidos ni pagos en el sitio.

## Alcance de QA (sin inventar aprobaciones)

Primero fijar alcance: arquitectura, compilación, pruebas unitarias e instrumentadas, cobertura del código productivo, análisis estático, CI, seguridad, reproducibilidad, mutation testing, deuda técnica y evidencia de ejecución. El pipeline hace **dos empaquetados** comparables, pero **no dos compilaciones de fuentes independientes**. `npm audit --omit=dev` es SCA parcial y no reemplaza SAST, SBOM, licencias o revisión humana. Browser y SwiftShader CI tampoco equivalen a pruebas en Android/iOS físicos. No declarar publicación lista mientras estos pendientes sigan abiertos.

## Procedimiento futuro de sustitución — requiere orden nueva por SHA

1. Terminar y aprobar diseño Prime, derechos de imagen/logo y canales institucionales. No introducir promesas de servicio o descargas inexistentes.
2. Cerrar CI (unitarias, browser, WebGL, HTTP, Lighthouse), SAST/SCA/SBOM, pruebas manuales de accesibilidad, Safari/iOS/Android y doble compilación de fuentes. Archivar evidencia por **SHA exacto**.
3. Decidir explícitamente indexación SEO de producción. El paquete NO-GO nunca debe desplegarse tal cual: lleva `noindex` y `Disallow: /`. Preparar una variante final con canonical, OG, robots y sitemap reales únicamente después de esa decisión; volver a probar enlaces, MIME, CSP, cache y respuestas 200/404.
4. Consultar EN VIVO Cloudflare Pages antes de la ventana de cambio: verificar proyecto, production_branch, despliegue actual y su SHA, dominios y HTTPS. Si el deployment ID no coincide con el esperado, detener y reconciliar. Guardar identificador/URL del despliegue previo y comprobar una vía de rollback.
5. Solicitar consentimiento **separado**: (a) merge por SHA exacto, (b) ejecución manual de publicación de un artefacto exacto; exigir aprobación del entorno GitHub con revisión humana, token de alcance mínimo y control de versión desplegada. No es suficiente un PR aprobado o un resultado CI verde.
6. Publicar Prime en el proyecto de Cloudflare existente **sin cambios DNS**; comprobar SHA/asset hashes/HTTPS/CSP, `desset.lat` y `www.desset.lat`, 404 y CSS/JS/GLB/WebP. Ante fallo crítico, detener y regresar al despliegue anterior.
7. Con la web definitiva confirmada y respaldo exportado, el titular podrá retirar o eliminar el repositorio experimental. Este documento no ejecuta ni autoriza ese paso.

**Reglas de liberación:** no se incorpora en este PR un paso de `pages deploy`, ni credenciales o valores que activen por sí solos producción. La futura implementación de publicación real será otro PR revisable que estará apagado hasta nueva autorización.

**Fuente:** documentación oficial de Cloudflare Pages para proyectos con cargas directas y cabeceras `_headers`:
- https://developers.cloudflare.com/pages/get-started/direct-upload/
- https://developers.cloudflare.com/pages/configuration/headers/
- https://developers.cloudflare.com/pages/configuration/serving-pages/
