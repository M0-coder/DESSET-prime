# DESSET Prime — ANIM-02: introducción fotográfica y capítulos cinematográficos

**Base exacta:** `27bd5adca00fef34fdcfab4251f8114e98133550` — PR #8, portada fotográfica aprobada por el titular.

## Alcance cerrado

Este cambio **no modifica** fotografía original, su crop móvil, materiales GLB, logotipo oficial, fuente de la imagen, uniforme azul, mochila negra, moto de dos espejos, contenido comercial, CTA, HTML, motor 3D, rutas, metadatos, producción, Cloudflare o dominio.

Se modifica **solo movimiento de presentación**:
1. Entrada de fotografía de 1,35 s: encuadre vertical de 12% que se revela sin tapar el contenido permanentemente, acabando con la imagen original sin filtros.
2. Enfoque fotográfico de 2,05 s: exposición y saturación suaves que vuelven al valor original; escala máxima 1,025. Sin parpadeos, zoom continuo, blur ni texturas adicionales.
3. Titular «EL COMERCIO / SE MUEVE» entra en dos tiempos, junto con introducción, descripción y CTA comercial.
4. Capítulos «visión», «servicios», «cómo funciona», «audiencias» y cierre aparecen por proximidad al viewport. Las señales se disparan solo una vez por `IntersectionObserver`, sin scroll listeners.
5. Secuencia ELEGIR / PREPARAR / ENTREGAR mantiene 3 tarjetas, escalonadas en 110ms.
6. `prefers-reduced-motion` muestra la portada y el contenido estáticos, sin ocultar nada ni alterar enlaces.

## Arquitectura y evidencia
- `styles-hero-photo.css` concentra nuevas animaciones; presupuesto contractual máximo 9,5 KB.
- `scripts/motion.js` reutiliza el observador existente, no agrega motor.
- `scripts/browser-audit.mjs` valida animaciones reales computadas en Chrome y fallback reduced.
- `tests/anim02-cinematic-chapters.test.mjs` prueba narrativa, identidad, CSP y límites.
- Gate de seguridad/CI completo: compilación, SHA-256 de `dist`, pruebas unitarias y navegador, static source/security, HTTP, Lighthouse de laboratorio, WebGL2 empaquetado y fuente, mutaciones dirigidas y cobertura declarada con limitaciones.

**Criterio estético:** secuencia visible en apertura, pero sin efecto de videojuego ni cambio de imagen al terminar. Cualquier regresión de legibilidad, LCP o render móvil es NO-GO y obliga a descartar o corregir.

**Control:** PR apilado en DRAFT, sin merge, releases, deploy, DNS, Cloudflare, indexación ni cambios de producción; integración solo después de revisión y autorización por SHA exacto.
