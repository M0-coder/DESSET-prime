# DESSET Prime — ANIM-01 · Dirección de movimiento cinematográfica editorial

**Referencia original preferida:** `77d225d9ccf0cce66203d0625475ede4bab71227`, rama `design/v5-cinematic-experience-no-deploy`. No arrastrar PR #3 (copy) ni PR #4–6 (3D).

## Diagnóstico
El sitio ya cuenta con una línea editorial de marca y animaciones finitas. El problema era la acumulación de señales propias de demos tecnológicas: barrido de escaneo sobre la escena, destello que cruza la portada, respuesta decorativa al puntero, entrada violenta de planos, escala y giros en las ilustraciones y el cierre.

## Intervención ANIM-01
1. **Hero:** se conserva EL COMERCIO / SE MUEVE, el logo y «Hablemos de tu negocio». Se acorta la amplitud del plano azul, se desacelera el sello y se sustituye la entrada explosiva del rojo por una acomodación breve y sobria.
2. **Sin estética de videojuego:** ocultar escaneo e iluminación barrida decorativa; detener desplazamientos del lente decorativo. *No* eliminar modelos, arte original ni recorrido 3D bajo consentimiento.
3. **Recorrido de la web:** una sola entrada por intersección para pilar de confianza, tarjeta de servicios, propuesta comercial, perfiles y área de cierre. Sin scroll listening, autoplay, bucles, bloqueos ni desplazamiento programático.
4. **Secuencia de servicio:** mantener ELEGIR / PREPARAR / ENTREGAR con escala casi estática y pocos píxeles de entrada, sin rotaciones de las ilustraciones.
5. **Cierre:** revelado de líneas verticalmente, sin skew, rebote o entrada diagonal.
6. **Accesibilidad:** semántica original, contenido visible antes y después de JS, movimiento reducido respetado, sin alteración de navegación, enlaces, CTA, portada o DNS.

## Alcance de código
- `styles.css`: dirección artística animada y reemplazo de keyframes visualmente lúdicos.
- `scripts/motion.js`: extiende la lista de elementos observados, sin temporizadores ni scroll handler.
- `scripts/browser-audit.mjs`: prueba valores computados en Chromium y mantiene las capturas desktop/mobile/reduced motion.
- `tests/anim01-editorial.test.mjs`: nuevo contrato de intención, accesibilidad y controles.

No cambios de HTML, 3D GLB/Three.js, fotos WebP, CSS system, cabezales CSP, empaquetado, programa de release ni producción.

## Criterios de aceptación
Compilación + empaquetado reproducible, pruebas unitarias, static gate, HTTP 17/17, preflight de publicación en NO-GO, cobertura instrumental con alcance correcto, mutation smoke dirigido, navegador con 6 estados/25 capturas, GPU WebGL2 intacta, Lighthouse en sitio `dist/`. Comparar capturas con versión preferida, no solo CI.

**Gobierno:** DRAFT / NO MERGE / NO AUTO-MERGE / NO DEPLOY / NO RELEASE / NO DNS / NO CLOUDFLARE. Requiere revisión visual antes de considerar integración por SHA separado.

### Ajuste de contratos legado

El presupuesto contractual de `styles.css` (<45KB) y el veto a animación en `trust-ledger` se preservaron; no se relajó ningún test. Para ello, las entradas editoriales se reusaron desde `prime-scene-rise` con solo 12px de desplazamiento, y los keyframes existentes `v4-red-pop`, `v4-canvas-reveal`, `v45-blue-strike`, `v45-mark-lock`, `v45-scene-illustration` y `v45-route-point` se suavizaron *en su origen*, sin duplicar miles de bytes de CSS. El cierre (estilo 60/30/10) ahora llega verticalmente sin inclinación. Se deshabilitó el listener de puntero que ya no tiene sentido. La tarjeta de confianza queda siempre estática y legible.
