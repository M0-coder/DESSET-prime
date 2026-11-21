# PRIME-CLEANUP-01 — Limpieza de ornamentación invisible (NO DEPLOY)

## Identidad del cambio
- Base exacta: `2709561289fddd6e932f996a643a303915843d95` (PR #24, draft).
- Única rama afectada: `integration/prime-canonical-official-candidate-v1-no-deploy`.
- Objetivo: eliminar del DOM seis fragmentos ornamentales **ya invisibles** por una regla `display:none!important`, sin cambiar la portada visible, la foto oficial ni el motor WebGL2.

## Cambio y pruebas
1. Retirar los tres nodos `v4-shape`, `motion-brand-thread`, `v4-canvas-stamp` (logo duplicado e invisible) y `v5-hero-refraction` con sus subelementos.
2. Eliminar la regla de `styles-hero-photo.css` cuyo único propósito era esconder dichos nodos.
3. Conservar sin cambios las dos marcas visibles (cabecera y pie), la imagen `desset-hero-entrega-dos-espejos.webp`, la imagen responsive, las fotografías ELEGIR/PREPARAR/ENTREGAR, los tres modelos GLB, el contenido, los enlaces y los bloques 3D.
4. Sustituir en la auditoría de navegador las aserciones sobre ornamentos ocultos por comprobaciones positivas de foto, marca, texto, accesibilidad y controles, más un test negativo de ausencia de elementos obsoletos.
5. Actualizar los contratos históricos que exigían por error aquellos elementos invisibles; agregar regresión CLEANUP-01 al test editorial.

## Gates de aceptación
- El candidato solo es válido si `npm ci --ignore-scripts --no-audit --no-fund`, `npm run build:site`, `npm run verify:site`, `node --test tests/*.test.mjs`, auditoría de navegador y móvil, WebGL2 source/dist, Lighthouse, HTTP, licencias/SBOM y reproducibilidad aprueban **para el SHA resultante**.
- CI PASS no sustituye comprobación visual manual sobre capturas antes/después.
- Pueden persistir reglas CSS históricas relacionadas con los ornamentos ya ausentes; su eliminación requiere inventario de dependencias y pruebas específicas. No se eliminan indiscriminadamente otros estilos con referencias en contratos antiguos.
- La fuente Inter está declarada pero no distribuida en la web: queda pendiente decidir contra la tipografía aprobada en Figma. No importar fuentes remotas ni alterar métricas sin evidencia.
- Aún no se ha podido obtener acceso detallado a Figma para certificar equivalencia visual.
- Mantener `noindex,nofollow`, bloqueo de aplicaciones y política sin pagos ni pedidos web.

**Política:** NO MERGE, NO AUTO-MERGE, NO RELEASE, NO DEPLOY, NO DNS, NO CLOUDFLARE, NO ELIMINAR REPOSITORIOS/BRANCHES.
