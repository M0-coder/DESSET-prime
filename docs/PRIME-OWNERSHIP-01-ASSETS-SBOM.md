# DESSET Prime — OWNERSHIP-01 · activos originales y software de terceros

**Proyecto principal:** `M0-coder/DESSET-prime`. **Estado:** registro de declaraciones e integridad, sin modificación de producción.

## Alcance y declaración

El responsable del proyecto ha manifestado expresamente el **20 de noviembre de 2026** que los elementos originales de DESSET Prime pertenecen al proyecto. Esta declaración se recoge sin cuestionarla ni cambiar la estética, logo, modelos GLB, fotografías, uniformes, animaciones o ilustraciones.

Para evitar registrar hechos no verificados, la evidencia se clasifica así:
- **Titularidad declarada:** sí; 18 activos originales visuales identificados en `config/prime-original-assets.json`.
- **Integridad técnica:** el sistema contrasta el SHA-256 de los 18 archivos originales contra el manifiesto de la propia compilación. Un cambio de imagen, logo, SVG o GLB sin revisar el registro falla en CI.
- **Cadena documental de derechos:** todavía no hay facturas, acuerdos de cesión, licencias de generación, contratos de autoría o inscripción vinculados a cada activo en este expediente. Eso no significa que el usuario no sea titular, sino que no hemos adjuntado documentación adicional.
- **Titular jurídico futuro:** no se presupone que una empresa ya registrada haya recibido esos derechos. En caso de constitución societaria, conviene formalizar la aportación/cesión de IP si los activos son propiedad personal del fundador.

### Propiedad original vs. dependencias externas

El bundle `assets/v6-three.bundle.js` está generado a partir de código original de Prime **y de Three.js**, que está disponible bajo MIT; no se puede clasificar su contenido íntegro como propiedad exclusiva del proyecto. `esbuild` es una dependencia de desarrollo bajo MIT. Sus licencias permiten usos comerciales sujeto al cumplimiento de sus avisos de licencia y copyright.

El script `scripts/prime-rights-license-audit.mjs` lee las versiones, integridades y metadatos de licencia de `package-lock.json` y compara el inventario visual original. El workflow `prime-rights-sbom-no-deploy.yml` produce evidencia de auditoría y **un SPDX SBOM generado por npm**, sin contactar ni modificar Cloudflare y sin otorgar permisos de publicación. El informe dice expresamente `legal_title_independently_verified:false` y `release_decision:NO-GO`.

**Licencias:** preservar los avisos y términos aplicables de los paquetes MIT en las distribuciones que contengan su código. Revisar la inclusión efectiva del texto íntegro de licencia antes de autorizar producción; el bundle actual contiene una nota SPDX de Three.js, que no debe confundirse con prueba de propiedad del código. Este documento no es una certificación legal ni una liberación del cumplimiento de licencia.

## Lo que queda para lanzamiento

El único bloqueo de **titularidad declarada** de los 18 activos queda documentado. Antes de publicar debe cerrarse la **aprobación operativa por SHA exacto** de los derechos —diferente de la mera declaración—, la cadena documental cuando corresponda, privacidad y contacto, pruebas en equipos físicos, cobertura/SAST/mutation testing aplicable y respaldo recuperable.

La variable `DESSET_PRIME_RIGHTS_APPROVED` **no se activa automáticamente**. Su habilitación futura requiere autorización distinta, vinculada al SHA finalmente fusionado y al expediente real. No la ponemos en `true` por escribir un JSON.

**Sin cambios en el antiguo repositorio experimental, los dominios, GitHub `main`, credenciales ni Cloudflare.** Ninguna operación de merge, auto-merge, release, deploy, rollback o borrado está autorizada.
