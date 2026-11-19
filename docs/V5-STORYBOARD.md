# DESSET Prime V5.0 — Cinematic Experience / storyboard

**Estado:** rama aislada de diseño, NO aprobada, NO desplegada. Base: V4.5 `c60d8af00debecca517472152cc9986e9cec8641`. No modifica la marca raster histórica, la web oficial, Cloudflare, DNS ni código de las cuatro apps.

## Dirección creativa

La web no debe parecer una plantilla de delivery ni prometer servicio disponible. Su lenguaje es **editorial, cinético y tridimensional de tipo 2.5D**. Conserva el logotipo PNG y la paleta azul #1551D8, amarillo #FFC62F, rojo #FF3328, tinta #111111 y papel #F7F5EE.

### Escena A — Portada / una idea toma forma
- El titular existente «EL COMERCIO SE MUEVE» conserva su mensaje, estructura y enlaces.
- Un lente de planos iluminados y pequeños destellos aporta profundidad al lienzo de color, con desplazamiento de puntero **muy limitado en equipos de puntero fino**; sin seguimiento del scroll.
- El símbolo original se mantiene intacto. La composición tiene un final fijo; no hay flashes ni loops agresivos.

### Escena B — Conectar / el pedido conceptual
- Nueva pieza **SVG isométrica original de tres estaciones** sobre el flujo ELEGIR / ORGANIZAR / MOVER ya existente.
- Se presenta como visualización conceptual, no captura de app, flota operativa o ETA real.
- Un trazo de ruta y tres nodos se dibujan **una sola vez** al entrar en pantalla; las tarjetas existentes continúan accesibles.
- La nueva ilustración SVG mantiene forma y significado en modo estático, en móvil y con JS desactivado.

### Escena C — Contacto / decisión
- Iluminación editorial localizada detrás del titular, sin ocultar información ni alterar el CTA.
- Entrada finita y legible del ambiente, sin partículas permanentes ni vídeo de reproducción automática.

## Arquitectura / desempeño

- HTML/CSS/SVG/JS nativos, sin framework de animación, servidor remoto, webfont remota ni dependencias npm.
- `styles.css` V4.5 no se toca: V5 aislado en `styles-v5.css`; `scripts/motion.js` V4.5 no se toca: V5 en `scripts/v5-cinematic.js`.
- Imagen SVG local lazy, `decoding=async` y dimensiones explícitas.
- Animar solamente `opacity`, `transform` y `stroke-dashoffset`; limitar `will-change` temporalmente o no usarlo.
- Respetar `prefers-reduced-motion`; sin control del scroll, sin movimiento si el usuario no lo desea; la información esencial está presente sin JS.
- No añadir reclamos de disponibilidad, pedidos, pagos, usuarios, resultados ni cobertura.
- No editar `index.html` de producción ni activar conexiones de despliegue.

## Criterios de aceptación y evidencia

Primero fijar el alcance: arquitectura, compilación, pruebas unitarias e instrumentadas, cobertura, análisis estático, calidad de CI, seguridad, reproducibilidad, mutation testing, deuda técnica y evidencia de ejecución.

1. `node --check` sobre nuevo JS y contratos Node de V5.
2. CI de V4.5 sin regresiones, más auditoría Chrome de V5 y capturas desktop/móvil/reduced.
3. Sin scroll horizontal en 320/390/768/1024/1440; enlaces de contacto y marca intactos.
4. Sin scripts remotos, sin formularios, sin rastreo, sin dependencia 3D o vídeo pesado.
5. La escena es 2.5D vectorial y **no** se vende como render de Blender ni WebGL real. La sustitución posterior por render cinematográfico final requiere evaluación de tamaño, derechos, composición y rendimiento.
6. Revisión visual humana contra Figma maestro pendiente por límite de lectura del plan Starter.
7. **DRAFT / NO MERGE / NO DEPLOY / NO PRODUCTION** incluso con CI verde.
