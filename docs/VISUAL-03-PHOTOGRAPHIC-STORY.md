# VISUAL-03 — Tres fotografías originales y distintas de DESSET

Base de revisión: PR #10 `eb7da19890455777e88b18a394603061f98ecc48`. Se corrige **el mismo PR #11**, no se arrastran modificaciones de otros experimentos 3D.

## Corrección solicitada por el titular

Se retira el experimento previo que repetía tres veces la fotografía de portada y la recortaba mediante pseudo-elementos.

La sección ELEGIR / PREPARAR / ENTREGAR muestra **tres imágenes distintas suministradas por el titular**:
- `assets/scene-choose.webp`: persona eligiendo productos y mirando su móvil en una tienda.
- `assets/scene-prepare.webp`: comerciante preparando productos en una bolsa de papel.
- `assets/scene-move.webp`: repartidor DESSET con uniforme azul y mochila negra entregando una bolsa en un domicilio, **sin moto** en esta escena (versión corregida).

Los tres WebP son archivos originales distintos, reducidos a 960×640, calidad 77 y almacenados localmente, con hashes de integridad comprobados. Los SVG `assets/scene-*.svg` siguen intactos como fallback semántico; los títulos y explicaciones permanecen editables y accesibles. No se genera un logotipo nuevo ni se publican afirmaciones falsas de operaciones reales.

La portada conserva **exactamente** el WebP aprobado del reparto, motocicleta con dos espejos, uniformes, logo y CTA. No se modifica la escena WebGL/GLB, fuentes, animaciones, DNS, Cloudflare ni configuración de producción.

## Pruebas requeridas antes de aceptar
- Compilación y empaquetado reproducibles, hash SHA-256 por cada WebP, formatos y tamaños `<120 KB` por imagen.
- HTML y CSS sin duplicados ni overlay falso, imagen correcta por tarjeta en Chromium.
- Capturas 25 casos responsive/reduced-motion, contratos Node, revisión estática y de seguridad, HTTP, integridad `dist`, WebGL2 fuente/paquete, mutaciones dirigidas, Lighthouse.
- Comparación visual de las tres escenas y confirmación de que el contenido conceptual no implica pedidos activos.
- **CI aprobado no equivale a autorización de merge o a evidencia de GPU física.**

**NO MERGE / NO AUTO-MERGE / NO DEPLOY / NO RELEASE / NO DNS / NO CLOUDFLARE / NO INDEXACIÓN.**
