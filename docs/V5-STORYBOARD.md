# DESSET Prime V5.2 — Cinematic Experience / storyboard y procedencia

**Estado:** rama aislada de diseño, NO aprobada, NO desplegada. Base: V4.5 `c60d8af00debecca517472152cc9986e9cec8641`. No modifica la marca raster histórica, la web oficial, Cloudflare, DNS ni código de las cuatro apps.

## Dirección creativa

La web no debe parecer una plantilla de delivery ni prometer servicio disponible. Su lenguaje es **editorial y cinético, con renderizados 3D conceptuales precomputados y alternativas SVG 2.5D**. No es una escena WebGL ni una operación de reparto real. Conserva el logotipo PNG y la paleta azul #1551D8, amarillo #FFC62F, rojo #FF3328, tinta #111111 y papel #F7F5EE.

### Escena A — Portada / una idea toma forma
- El titular existente «EL COMERCIO SE MUEVE» conserva su mensaje, estructura y enlaces.
- Un lente de planos iluminados y pequeños destellos aporta profundidad al lienzo de color, con desplazamiento de puntero **muy limitado en equipos de puntero fino**; sin seguimiento del scroll.
- El símbolo original se mantiene intacto. La composición tiene un final fijo; no hay flashes ni loops agresivos.

### Escena B — Conectar / el pedido conceptual
- Los **renderizados WebP optimizados** (horizontal y vertical) muestran comercio, paquete, repartidor y destino con iluminación volumétrica; los SVG isométricos originales permanecen como alternativa de compatibilidad, sobre el flujo ELEGIR / ORGANIZAR / MOVER existente.
- Se presenta como visualización conceptual, no captura de app, flota operativa o ETA real.
- La ruta luminosa forma parte del render; su aparición usa una transición finita de cámara/luz. El conector original entre ELEGIR / ORGANIZAR / MOVER conserva su animación CSS finita. Se eliminó el antiguo trazado superpuesto que no coincidía con la escena nueva.
- El navegador selecciona WebP de escritorio en ≥431px y WebP vertical en ≤430px mediante `<picture>`. El fallback SVG mantiene la representación sin soporte WebP; el contenido es legible sin JS y con movimiento reducido.

### Escena C — Contacto / decisión
- Iluminación editorial localizada detrás del titular, sin ocultar información ni alterar el CTA.
- Entrada finita y legible del ambiente, sin partículas permanentes ni vídeo de reproducción automática.


## V5.2 — procedencia, integridad y límites
- Render conceptual de escritorio: `assets/v5-cinematic-desktop.webp`, 192284 B, SHA256 `474f755562617e230f864306d91ed641f96d3bcf58c7757618209c5dd584ec39`.
- Render conceptual móvil: `assets/v5-cinematic-mobile.webp`, 246332 B, SHA256 `4acb78bf2e97f6ee3647cc8b54368d80d6cf5ee730ad1e976c8be77da7fcb5cc`.
- Ilustraciones originales generadas con herramientas de imagen de IA durante esta sesión creativa; convertidas localmente a WebP con Pillow/libwebp. Son una **ficción gráfica de la visión logística**, no fotografías de clientes, comercio asociado, calles de Huacho o flota DESSET.
- El resultado web conserva PNG de marca original y las alternativas `assets/v5-logistics-scene.svg` y `assets/v5-logistics-mobile.svg`. No añade dependencias ni licencia de terceros para vídeo, fuentes, WebGL o analítica.
- Las animaciones reales son **CSS/JS progresivo** sobre render estático. No atribuir al archivo movimientos 3D nativos, FPS medidos, velocidad en móviles ni un proyecto Blender editable.
- Riesgos sin cerrar: correspondencia precisa con Figma, accesibilidad manual (zoom, lectores de pantalla, contraste y sensibilidad al movimiento), mediciones Lighthouse/Core Web Vitals reales, revisión de derechos y claims legales, score de mutation testing y análisis SAST/SCA global.

## Arquitectura / desempeño

- HTML/CSS/SVG/JS nativos, sin framework de animación, servidor remoto, webfont remota ni dependencias npm.
- `styles.css` V4.5 no se toca: V5 aislado en `styles-v5.css`; `scripts/motion.js` V4.5 no se toca: V5 en `scripts/v5-cinematic.js`.
- Imagen WebP local de **192 284 bytes (1752×897 escritorio)** y **246 332 bytes (1024×1536 móvil)**, ambas `loading=lazy` y `decoding=async` con dimensiones explícitas y SVG alternativo. Recursos autocontenidos en el repositorio.
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
5. Los recursos prioritarios son **imágenes estáticas generadas digitalmente con apariencia tridimensional**. No son modelos Blender ni 3D interactivo. Revisar derechos de uso, acabado de marca, composición y rendimiento antes de publicar.
6. Revisión visual humana contra Figma maestro pendiente por límite de lectura del plan Starter.
7. **DRAFT / NO MERGE / NO DEPLOY / NO PRODUCTION** incluso con CI verde.
