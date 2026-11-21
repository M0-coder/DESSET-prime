# DESSET Prime — Correctivos de auditoría (NO DEPLOY)

## Alcance

- Fuente: revisión de Motion V2 y video histórico.
- Ruta de trabajo: `M0-coder/DESSET-prime` / `design/figma-v1-no-deploy`.
- Identidad: `assets/deliver-assets-mark.png` permanece **binariamente idéntico** al archivo histórico (Git blob `fa6cb4ea5c5331c4cf47dfd157214e972f809356`).

## Corregido

1. Eliminación real de reglas hero V1 y `@keyframes arrive`; un solo `styles.css` para evitar cascadas contradictorias.
2. Límite de escala del PNG original a 96 píxeles en el hero, sin redibujarlo ni recolorearlo.
3. Eliminación de `frame-ancestors` en CSP `meta`; configuración de cabeceras `_headers` compatible con Cloudflare Pages (solo será efectiva bajo un servidor que respete ese archivo).
4. CI instrumentado con CDP en Chrome en diversos anchos, controles de overflow, navegación móvil, teclado, reducción de movimiento, y capturas en varias fases; conservación de pruebas estáticas anteriores.
5. Sin deployment, auto-merge, DNS, DNS alterado ni edición del repositorio oficial.

## Deliberadamente pendientes / no inventar

- Wordmark exacto DESSET y familias tipográficas canónicas del archivo Figma: no inspeccionables por cuota agotada. El texto tipográfico en el header es un rótulo HTML **provisional**, no se presenta como logo original.
- Revisión jurídica de derechos y uso comercial.
- Validación visual de animación real por el fundador. CI no aprueba un diseño por sí solo.
- Pruebas de cobertura de frontend, SAST/SCA integral y mutation testing (gates separados).

## Criterio

No declarar finalizado mientras no pasen checks automáticos y revisión visual del logo, tipografía, experiencia responsive, microinteracciones y ritmo audiovisual.
