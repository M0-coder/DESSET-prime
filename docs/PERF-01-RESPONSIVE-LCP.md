# DESSET Prime — PERF-01: carga crítica y prioridades de imágenes

**Base SHA:** `fcac31dafa51c80b6d03ab8569cb7cef211c3719`, PR #11. **Solo cambios de prioridades de descarga**, sin alterar ninguna imagen, uniforme, CTA, texto, CSS, JS de animación, WebGL, GLB ni dominio.

## Hallazgo
La portada tenía `loading=eager` / `fetchpriority=high` y su WebP móvil responsive, pero los recursos LCP se descubrían en la sección del hero, después de los estilos. Las tres fotografías del recorrido ya eran lazy, pero no tenían prioridad de red explícita.

## Cambio
- Dos hints `rel=preload as=image` dentro del head, **excluyentes por media query**, apuntando exactamente a los dos WebP originales de portada. Móvil <=700px precarga su WebP 960px; desktop >=701px precarga el WebP de 1671px. Mantener sus MIME y URL sin query strings; no añadir imágenes nuevas ni duplicar descargas por usar URLs diferentes.
- Las tres tarjetas WebP conservan su `picture` + SVG de respaldo + `loading=lazy`, y añaden `fetchpriority=low` a sus `img` de fallback efectivos.
- Nada cambia en composición, resolución, calidad o tamaño del archivo; no se altera la carga voluntaria del motor 3D ni el contenido institucional.

## Pruebas y criterios
- Unit tests: exactamente 2 pistas excluyentes delante de hojas CSS, rango idéntico al `picture`, 3 SVG/WebP intactos y prioridades correctamente declaradas.
- Chrome instrumentado desktop, tablet, móvil y modo reducido: exactamente **una pista activa por viewport**, `currentSrc` correspondiente, hero alta prioridad y 3 tarjetas lazy/low.
- Build `dist/` determinista con SHA-256, static gate, seguridad HTTP, 3 GLB y WebGL2, CI completa, Lighthouse móvil/escritorio comparado con **baseline PR11** (móvil laboratorio 98, LCP 2328,89 ms, CLS0; escritorio 100, LCP 725,67 ms). No reclamar aceleración real sin medición comparable.
- Si hay duplicación de solicitudes, peor puntuación o regresión visual, corregir o descartar antes de integrar.
- Mutation smoke dirigido, cobertura instrumentada de alcance declarado, reproducibilidad y deuda técnica documentados. Lighthouse local no implica rendimiento real en teléfonos físicos.

**Control:** PR DRAFT / NO MERGE / NO DEPLOY / NO RELEASE / NO DNS / NO CLOUDFLARE. Ningún cambio a `desset.lat`. Incorporar solo por autorización futura de SHA.
