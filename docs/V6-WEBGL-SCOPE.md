# DESSET Prime V6 — Three.js WebGL real, NO DEPLOY

El objetivo es implementar geometría tridimensional real y cámara interactiva, **no fingir que una imagen IA es 3D interactivo**.

## Diseño
- Geometrías creadas en el cliente con `three@0.187.0` y `WebGLRenderer`, con escena propia de comercio, paquete, motocicleta, ruta y destino.
- JS original en `scripts/v6-three.src.mjs`, empaquetado por `esbuild@0.28.2` como `assets/v6-three.bundle.js` **local**, sin CDN. En desarrollo ejecutar `npm ci && npm run build:3d`.
- La imagen V5.2 WebP/SVG sigue visible mientras carga, con movimiento reducido, dispositivos WebGL incompatibles, errores de contexto, o cuando el móvil no opta por entrar en 3D.
- Escritorio activa cuando la escena aparece; móvil activa únicamente con botón. `IntersectionObserver` y `document.visibilityState` paran el bucle fuera de la vista; FPS, pixel ratio y geometrías están limitados.
- Cámara con tres puntos de interés (general, comercio, destino), botones accesibles, pointer suavizado sin bloquear scroll; control de pausa/continuar y retorno a imagen.
- Accesibilidad: descripción textual intacta, sin dependencia del canvas, controles con `aria-pressed`, `prefers-reduced-motion` sin WebGL.
- CI: build autenticado con versiones exactas, pruebas unitarias/contratos y **smoke de GPU**; no se declarará real hasta Chrome WebGL2 creado y triángulos renderizados.

**NO-GO para publicación:** requiere aprobación de diseño, pruebas de teléfonos físicos, Web Vitals de campo y revisión de integridad. Sin merge, deploy, DNS ni edición de la web anterior.
