# DESSET Prime · HERO-PHOTO-01: portada fotográfica aprobada

**Base:** `584e7857e70912b3581f19b09472897289b8aa2f` (PR #7 en borrador). La referencia de imagen es la **última versión aprobada por el usuario**, con uniforme azul, mochila negra, motocicleta corriente y dos espejos retrovisores. Es arte conceptual, no fotografía de operaciones reales.

## Intervención

- La portada pasa de composición abstracta «IDEAS EN ACCIÓN» a una **escena fotográfica de comercio y reparto**. Es un cambio visible que reproduce la estructura de la maqueta: titular y CTA a la izquierda, fotografía a la derecha; en móvil, lectura en una columna.
- Se conserva **el logotipo oficial existente en `assets/deliver-assets-mark.png`**, sin inventar ninguna versión. Se conservan «EL COMERCIO / SE MUEVE» y el CTA «Hablemos de tu negocio».
- **La imagen nueva** `assets/desset-hero-entrega-dos-espejos.webp` es local, 1671×941, 157 296 bytes, SHA-256 `9f7940ed40dac21dcd286655930750ffd1008cf84830ed8b2e086a40c4cd00f1`. No hay CDN, enlaces de terceros ni capturas de actividad real.
- La escena se etiqueta visiblemente «Representación conceptual · No corresponde a operaciones activas de DESSET» y la descripción accesible dice lo mismo.
- La jerarquía comercial y navegación existente siguen operativas. Se deja el enlace opcional de tour 3D en segundo plano, sin cambiar GLB ni Three.js.
- Nuevo CSS aislado `styles-hero-photo.css`: no reestructura las demás secciones, no reescribe el sistema de marca ni toca producción.

## Control de calidad

Se agrega y certifica localmente el fichero WebP en la lista de build y verificador SHA-256; fuente CSS acotada a 9500 bytes, imagen acotada a 210000 bytes. Browser QA comprueba imagen cargada, marca oficial y texto eliminado. CI de compilación, tests unitarios, cobertura de alcance declarado, estática, seguridad HTTP, mutation testing dirigido, navegadores, GPU WebGL2, Lighthouse sintético y capturas. Aprobación artística requiere ver escritorio/móvil; no equiparar tests con percepción.

**Gobierno:** PR DRAFT / NO MERGE / NO AUTO-MERGE / NO DEPLOY / NO RELEASE / NO DNS / NO CLOUDFLARE. Ningún cambio al repo de producción `M0-coder/DESSET`. Integración posterior únicamente con autorización de SHA exacto.
